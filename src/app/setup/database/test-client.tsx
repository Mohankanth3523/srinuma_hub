"use client";
import { useCallback, useEffect, useState } from "react";
type Lead = { lead_id: string; customer_name: string; company_name: string; service_type: string; requirement: string; created_at: string };
const SERVICE = ["website", "crm", "invention"];
export default function DatabaseClient() {
  const [username, setUsername] = useState("srinuma"); const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false); const [leads, setLeads] = useState<Lead[]>([]);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [name, setName] = useState(""); const [company, setCompany] = useState("");
  const [service, setService] = useState("website"); const [requirement, setRequirement] = useState("");
  const api = useCallback(async (path: string, init?: RequestInit) => {
    const result = await fetch(`/api/srinuma/${path}`, { credentials: "same-origin", cache: "no-store", ...init });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || "Request failed");
    return data;
  }, []);
  const refresh = useCallback(async () => {
    setBusy(true);
    try { const [status, records] = await Promise.all([api("health"), api("leads")]);
      setLeads(records.leads || []); setMessage(`Connected to ${status.spreadsheetTitle}. ${records.leads?.length || 0} saved leads loaded.`); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not refresh"); }
    finally { setBusy(false); }
  }, [api]);
  useEffect(() => { let active = true; api("session").then(result => { if (active && result.loggedIn) { setLoggedIn(true); void refresh(); } }).catch(() => {}); return () => { active = false; }; }, [api, refresh]);
  const login = async () => { setBusy(true); try { await api("session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); setPassword(""); setLoggedIn(true); await refresh(); } catch(e) { setMessage(e instanceof Error ? e.message : "Login failed"); } finally { setBusy(false); } };
  const add = async () => { if (!name.trim() || !requirement.trim()) { setMessage("Name and requirement are required."); return; }
    setBusy(true); try { await api("leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_name: name, company_name: company, service_type: service, requirement }) });
      setName(""); setCompany(""); setRequirement(""); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save"); } finally { setBusy(false); } };
  const logout = async () => { try { await api("session", { method: "DELETE" }); } catch {} setLoggedIn(false); setLeads([]); setMessage("Logged out"); };
  const input = { width: "100%", color: "#f6faff", background: "#142340", border: "1px solid #314667", borderRadius: 10, padding: 12 };
  const button = { borderRadius: 10, padding: "12px 16px", color: "white", background: "#176fc4", border: 0, cursor: "pointer" };
  return <main style={{ minHeight: "100vh", color: "white", background: "#061429", padding: "30px 15px", fontFamily: "system-ui,sans-serif" }}>
    <div style={{ margin: "auto", width: "min(100%,760px)", display: "grid", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div><h1 style={{ fontSize: 23, fontWeight: 800 }}>SRINUMA HUB — Database Connection Test</h1><p style={{ color: "#aac0d9" }}>Secure Google Sheets test. Original CRM dashboard is unchanged.</p></div><a href="/" style={{ color: "#60d1ff" }}>CRM ↗</a></header>
      {!loggedIn ? <form onSubmit={e => { e.preventDefault(); void login(); }} style={{ padding: 20, border: "1px solid #334c70", borderRadius: 16, display: "grid", gap: 12 }}>
        <h2 style={{ fontSize: 19 }}>Admin Login</h2><label>Username<input style={input} value={username} autoComplete="username" onChange={e => setUsername(e.target.value)}/></label>
        <label>Password<input style={input} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button disabled={busy} style={button}>Login to Database</button></form> : <>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button disabled={busy} onClick={() => void refresh()} style={button}>↻ Refresh from Google Sheet</button><button onClick={() => void logout()} style={button}>Logout</button></div>
        <section style={{ padding: 20, border: "1px solid #334c70", borderRadius: 16, display: "grid", gap: 12 }}><h2 style={{ fontSize: 19 }}>Add Test Lead (saves to the real Sheet)</h2><label>Customer Name<input style={input} value={name} onChange={e => setName(e.target.value)} /></label><label>Company<input style={input} value={company} onChange={e => setCompany(e.target.value)} /></label><label>Service<select style={input} value={service} onChange={e => setService(e.target.value)}>{SERVICE.map(v => <option key={v}>{v}</option>)}</select></label><label>Enquiry Requirement<textarea style={input} rows={3} value={requirement} onChange={e => setRequirement(e.target.value)} /></label><button disabled={busy} onClick={() => void add()} style={button}>Save Lead to Google Sheet</button></section>
        <section style={{ padding: 20, border: "1px solid #334c70", borderRadius: 16 }}><h2 style={{ fontSize: 19 }}>Saved Leads ({leads.length})</h2><div style={{ display: "grid", gap: 10, marginTop: 10 }}>{leads.map(x => <div key={x.lead_id} style={{ padding: 12, border: "1px solid #314667", borderRadius: 10 }}><b>{x.company_name || x.customer_name}</b> — {x.service_type}<p>{x.requirement}</p></div>)}</div></section>
      </>}
      {message && <div role="status" style={{ padding: 12, background: "#122747", borderRadius: 10, overflowWrap: "anywhere" }}>{message}</div>}
      <p style={{ color: "#9fb2ca", fontSize: 12 }}>Development-only test page. Backend currently supports secure admin and Leads; employee permissions, work, quotation and invoice backend sync are not yet activated. Do not use the original browser-demo login for real customer records.</p>
    </div>
  </main>;
}
