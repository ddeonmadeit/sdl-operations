"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, sessions, users } from "@/db/schema";
import { hashPassword, requireAdmin, requireOffice, requireUser, verifyPassword } from "@/lib/auth";
import { CONTACT_TYPES, ROLES, type ContactType, type Role } from "@/lib/constants";
import { toCents } from "@/lib/format";
import { optStr, str, type ActionState } from "@/lib/form";
import { setSetting, setXeroConnection } from "@/lib/settings";
import { refresh } from "./util";

type Result = ActionState & { redirect?: string; id?: number };

/* ───────────── Contacts ───────────── */

function contactValues(fd: FormData) {
  const type = str(fd, "type") as ContactType;
  return {
    type: type in CONTACT_TYPES ? type : "client",
    name: str(fd, "name"),
    contactName: optStr(fd, "contactName"),
    email: optStr(fd, "email"),
    phone: optStr(fd, "phone"),
    address: optStr(fd, "address"),
    trade: optStr(fd, "trade"),
    abn: optStr(fd, "abn"),
    notes: optStr(fd, "notes"),
  };
}

export async function createContact(fd: FormData): Promise<Result> {
  await requireOffice();
  const v = contactValues(fd);
  if (!v.name) return { error: "Name is required." };
  const [c] = await db.insert(contacts).values(v).returning({ id: contacts.id });
  refresh();
  return { ok: true, message: `${v.name} added`, id: c!.id };
}

export async function updateContact(id: number, fd: FormData): Promise<Result> {
  await requireOffice();
  const v = contactValues(fd);
  if (!v.name) return { error: "Name is required." };
  await db.update(contacts).set(v).where(eq(contacts.id, id));
  refresh();
  return { ok: true, message: "Contact saved" };
}

export async function archiveContact(id: number, archived: boolean): Promise<Result> {
  await requireOffice();
  await db.update(contacts).set({ archived }).where(eq(contacts.id, id));
  refresh();
  return { ok: true, message: archived ? "Contact archived" : "Contact restored", redirect: archived ? "/office/contacts" : undefined };
}

/* ───────────── Settings ───────────── */

export async function saveCompany(fd: FormData): Promise<Result> {
  await requireOffice();
  await setSetting("company", {
    name: str(fd, "name") || "SDL Creations",
    abn: str(fd, "abn"),
    address: str(fd, "address"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    licence: str(fd, "licence"),
  });
  refresh();
  return { ok: true, message: "Company details saved" };
}

export async function saveRates(fd: FormData): Promise<Result> {
  await requireOffice();
  await setSetting("rates", {
    kprHourlyCents: toCents(str(fd, "kprHourly")),
    gstPct: Number(str(fd, "gstPct")) || 0,
    defaultMarkupPct: Number(str(fd, "defaultMarkupPct")) || 0,
    quoteValidDays: Number(str(fd, "quoteValidDays")) || 30,
  });
  refresh();
  return { ok: true, message: "Rates saved" };
}

export async function saveTemplates(fd: FormData): Promise<Result> {
  await requireOffice();
  await setSetting("templates", {
    quoteTerms: str(fd, "quoteTerms"),
    clientContractTerms: str(fd, "clientContractTerms"),
    subcontractTerms: str(fd, "subcontractTerms"),
    inductionItems: str(fd, "inductionItems")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  });
  refresh();
  return { ok: true, message: "Templates saved" };
}

export async function saveXeroSettings(fd: FormData): Promise<Result> {
  await requireOffice();
  await setSetting("xero", {
    expenseAccountCode: str(fd, "expenseAccountCode"),
    salesAccountCode: str(fd, "salesAccountCode"),
    trackingCategory: str(fd, "trackingCategory"),
    billStatus: str(fd, "billStatus") === "AUTHORISED" ? "AUTHORISED" : "DRAFT",
  });
  refresh();
  return { ok: true, message: "Xero settings saved" };
}

export async function disconnectXero(): Promise<Result> {
  await requireAdmin();
  await setXeroConnection(null);
  refresh();
  return { ok: true, message: "Xero disconnected" };
}

/* ───────────── Users ───────────── */

export async function createUser(fd: FormData): Promise<Result> {
  await requireAdmin();
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const role = str(fd, "role") as Role;
  if (!name || !email) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!(role in ROLES)) return { error: "Choose a role." };
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email));
  if (exists) return { error: "Someone already uses that email." };
  await db.insert(users).values({
    name,
    email,
    phone: optStr(fd, "phone"),
    role,
    passwordHash: await hashPassword(password),
    hourlyRateCents: toCents(str(fd, "hourlyRate")),
  });
  refresh();
  return { ok: true, message: `${name} can now sign in` };
}

export async function updateUser(id: number, fd: FormData): Promise<Result> {
  const admin = await requireAdmin();
  const role = str(fd, "role") as Role;
  if (!(role in ROLES)) return { error: "Choose a role." };
  const active = str(fd, "active") !== "off";
  if (id === admin.id && (role !== "admin" || !active)) return { error: "You can't remove your own admin access." };
  const password = str(fd, "password");
  if (password && password.length < 8) return { error: "New password must be at least 8 characters." };
  await db
    .update(users)
    .set({
      name: str(fd, "name"),
      email: str(fd, "email").toLowerCase(),
      phone: optStr(fd, "phone"),
      role,
      active,
      hourlyRateCents: toCents(str(fd, "hourlyRate")),
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    })
    .where(eq(users.id, id));
  if (!active || password) await db.delete(sessions).where(eq(sessions.userId, id));
  refresh();
  return { ok: true, message: "User saved" };
}

export async function changeMyPassword(fd: FormData): Promise<Result> {
  const user = await requireUser();
  const current = str(fd, "current");
  const next = str(fd, "next");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const [row] = await db.select().from(users).where(eq(users.id, user.id));
  if (!row || !(await verifyPassword(current, row.passwordHash))) return { error: "Current password is wrong." };
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  return { ok: true, message: "Password changed" };
}
