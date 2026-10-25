import { createSign, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const REQUIRED = ["lead_id", "created_at", "customer_name", "company_name", "phone", "address", "service_type", "project_name", "requirement", "extra_features", "status", "assigned_employee_id", "updated_at"];
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };
export type LeadInput = { customer_name: string; company_name?: string; phone?: string; address?: string; service_type: "website" | "crm" | "invention"; project_name?: string; requirement: string; extra_features?: string };
export type LeadRecord = LeadInput & { lead_id: string; created_at: string; status: string; assigned_employee_id: string; updated_at: string };
let tokenCache: { accessToken: string; validUntil: number } | null = null;

function config() {
  const spreadsheetId = process.env.SRINUMA_SHEET_ID;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
  if (!spreadsheetId || (!keyPath && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64)) throw new Error("Database configuration incomplete. Run the database setup script.");
  const serviceAccount = JSON.parse((process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ? Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,'base64').toString('utf8') : readFileSync(keyPath!,'utf8'))) as ServiceAccount;
  if (!serviceAccount.client_email || !serviceAccount.private_key) throw new Error("Service account JSON file invalid.");
  return { spreadsheetId, serviceAccount };
}
function b64url(value: string) { return Buffer.from(value).toString("base64url"); }
function googleAssertion(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const endpoint = sa.token_uri || "https://oauth2.googleapis.com/token";
  if (endpoint !== "https://oauth2.googleapis.com/token") throw new Error("Unexpected service account OAuth endpoint.");
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPES, aud: endpoint, iat: now, exp: now + 3500 }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(sa.private_key).toString("base64url");
  return `${unsigned}.${signature}`;
}
async function getToken(force = false) {
  if (!force && tokenCache && tokenCache.validUntil > Date.now() + 60_000) return tokenCache.accessToken;
  const { serviceAccount } = config();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: googleAssertion(serviceAccount) }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status}). Check service account credentials and API setup.`);
  const value = await response.json() as { access_token?: string; expires_in?: number };
  if (!value.access_token) throw new Error("Google authentication did not return an access token.");
  tokenCache = { accessToken: value.access_token, validUntil: Date.now() + (value.expires_in || 3600) * 1000 };
  return tokenCache.accessToken;
}
async function googleGetOrWrite(endpoint: string, options: RequestInit = {}, retry = true): Promise<unknown> {
  const token = await getToken();
  const response = await fetch(endpoint, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) }, cache: "no-store" });
  if (response.status === 401 && retry) { tokenCache = null; await getToken(true); return googleGetOrWrite(endpoint, options, false); }
  if (!response.ok) {
    const reason = response.status === 403 ? "API not enabled, or Sheet not shared with the service account." : response.status === 404 ? "Sheet ID not found, or not shared with the service account." : "See Google Sheets permissions and configuration.";
    throw new Error(`Google Sheets request failed (${response.status}). ${reason}`);
  }
  return response.json();
}
function sheetRange(tab: string, range: string) {
  const { spreadsheetId } = config();
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`'${tab}'!${range}`)}`;
}
function asText(value: unknown) { return typeof value === "string" ? value : String(value ?? ""); }
function cleanHeader(rows: unknown[][]) {
  const header = (rows[0] || []).map(asText);
  if (REQUIRED.some(h => !header.includes(h))) throw new Error("Leads sheet columns do not match the verified SRINUMA database template.");
  return header;
}
export async function getDatabaseStatus() {
  const { spreadsheetId, serviceAccount } = config();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties.title`;
  const result = await googleGetOrWrite(url) as { properties?: { title?: string }, sheets?: { properties?: { title?: string } }[] };
  const sheetNames = (result.sheets || []).map(s => s.properties?.title || "");
  if (!sheetNames.includes("Leads")) throw new Error("Required Leads tab not found.");
  return { connected: true, spreadsheetTitle: result.properties?.title || "", hasLeads: true, serviceAccountEmail: serviceAccount.client_email };
}
export async function getLeads(): Promise<LeadRecord[]> {
  const response = await googleGetOrWrite(sheetRange("Leads", "A1:M5000")) as { values?: unknown[][] };
  const rows = response.values || [];
  const header = cleanHeader(rows);
  return rows.slice(1).filter(row => row.some(v => asText(v).trim() !== "")).map(row => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { obj[h] = asText(row[idx]); });
    return obj as LeadRecord;
  });
}
export async function addLead(input: LeadInput): Promise<LeadRecord> {
  // Read column headings before appending; never assume columns were reordered.
  const headResult = await googleGetOrWrite(sheetRange("Leads", "A1:M1")) as { values?: unknown[][] };
  const headers = cleanHeader(headResult.values || []);
  const now = new Date().toISOString();
  const record: LeadRecord = {
    ...input, lead_id: randomUUID(), created_at: now, status: "New", assigned_employee_id: "", updated_at: now,
  };
  const values = headers.map(column => asText(record[column as keyof LeadRecord]));
  const url = sheetRange("Leads", "A1:M1") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS";
  await googleGetOrWrite(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ majorDimension: "ROWS", values: [values] }) });
  return record;
}
