
import { NextRequest } from "next/server";
import { auth, success, fail, s } from "@/lib/srinuma/api";
import { makeHash } from "@/lib/srinuma/security";
import { authRedis, revokedKey } from "@/lib/srinuma/auth-redis";
import {
  rows,
  append,
  replace,
  nextId,
  withLock,
  now,
  audit,
} from "@/lib/srinuma/store";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicEmployee = (x: Record<string, string>) => ({
  employee_id: x.employee_id,
  name: x.name,
  username: x.username,
  email: x.email || "",
  phone: x.phone || "",
  role: "employee",
  active: x.active.toLowerCase() === "true",
  work_category: x.work_category || "all",
  created_at: x.created_at,
});

export async function GET(req: NextRequest) {
  try {
    await auth(req, true);
    return success({
      employees: (await rows("Employees")).items.map(publicEmployee),
    });
  } catch (e) {
    return fail(e, 401);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await auth(req, true);
    const v = (await req.json()) as Record<string, unknown>;

    const name = s(v.name, 120);
    const username = s(v.username, 70).toLowerCase();
    const email = s(v.email, 254).trim().toLowerCase();
    const pass = v.password;
    const phone = s(v.phone, 25).trim();
    if (phone && !/^\+?[0-9][0-9\s-]{6,18}$/.test(phone)) throw Error("Invalid phone number");

    if (
      !name ||
      !/^[a-z][a-z0-9._-]{2,40}$/.test(username) ||
      username === "srinuma"
    ) {
      throw Error("Valid employee name and username required");
    }

    if (!emailPattern.test(email)) {
      throw Error("Valid employee email required");
    }

    if (
      typeof pass !== "string" ||
      pass.length < 12 ||
      pass.length > 200
    ) {
      throw Error("Employee password must be 12+ characters");
    }

    const employee = await withLock("Employees", async () => {
      const sheet = await rows("Employees");

      if (!sheet.header.includes("email") || !sheet.header.includes("phone")) {
        throw Error("Employees Sheet requires email and phone headers");
      }

      if (
        sheet.items.some(
          (e) => e.username.toLowerCase() === username
        )
      ) {
        throw Error("Username already exists");
      }

      if (
        sheet.items.some(
          (e) => (e.email || "").trim().toLowerCase() === email
        )
      ) {
        throw Error("Email already registered");
      }

      const record = {
        employee_id: await nextId("Employees"),
        name,
        username,
        email,
        phone,
        role: "employee",
        password_hash: makeHash(pass),
        active: "TRUE",
        work_category: s(v.work_category, 40) || "all",
        created_at: now(),
      };

      await append("Employees", record);
      return publicEmployee(record);
    });

    await audit(actor.id, "CREATE", "Employees", employee.employee_id);

    return success({ employee }, 201);
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!req.headers.get("origin") || new URL(req.headers.get("origin")!).origin !== req.nextUrl.origin) return fail("Invalid origin",403);
    const actor = await auth(req, true);
    const v = (await req.json()) as Record<string, unknown>;
    const id = s(v.employee_id, 80);

    if (!id) throw Error("Employee ID required");

    const change: Record<string, string> = {};

    if (typeof v.active === "boolean") {
      change.active = v.active ? "TRUE" : "FALSE";
    }

    if (v.password !== undefined) {
      if (
        typeof v.password !== "string" ||
        v.password.length < 12 ||
        v.password.length > 200
      ) {
        throw Error("New employee password must be 12+ characters");
      }
      change.password_hash = makeHash(v.password);
    }

    if (v.name !== undefined) { const name=s(v.name,120).trim(); if(name.length<2) throw Error("Valid employee name required"); change.name=name; }
    if (v.work_category !== undefined) { const cat=s(v.work_category,40); if(!["all","website","crm","invention"].includes(cat)) throw Error("Invalid work category"); change.work_category=cat; }
    if (v.phone !== undefined) { const phone=s(v.phone,25).trim(); if(phone && !/^\+?[0-9][0-9\s-]{6,18}$/.test(phone)) throw Error("Invalid phone number"); change.phone=phone; }
    if (v.email !== undefined) {
      const email = s(v.email, 254).trim().toLowerCase();

      if (!emailPattern.test(email)) {
        throw Error("Valid employee email required");
      }

      change.email = email;
    }

    if (!Object.keys(change).length) {
      throw Error("No changes provided");
    }

    const employee = await withLock("Employees", async () => {
      if (change.email || change.phone !== undefined) {
        const sheet = await rows("Employees");

        if (!sheet.header.includes("email") || !sheet.header.includes("phone")) {
          throw Error("Employees Sheet requires email and phone headers");
        }

        if (change.email && sheet.items.some((e) => e.employee_id !== id && (e.email || "").trim().toLowerCase() === change.email)) {
          throw Error("Email already registered");
        }
      }

      const original = (await rows("Employees")).items.find(e => e.employee_id === id);
      if (!original) throw Error("Employee not found");
      // Invalidate existing sessions before a password change or access disable.
      // If the subsequent Sheet write fails, the account can still log in with
      // the original password; sessions are conservatively revoked.
      if (change.password_hash || change.active === "FALSE") {
        await authRedis().set(revokedKey(id), Date.now());
      }
      return replace("Employees", "employee_id", id, change);
    });

    await audit(actor.id, "UPDATE", "Employees", id);

    return success({ employee: publicEmployee(employee) });
  } catch (e) {
    return fail(e);
  }
}
