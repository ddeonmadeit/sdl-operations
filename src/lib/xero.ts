import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bills, contacts, jobs, stages, variations } from "@/db/schema";
import { appUrl } from "./email";
import { addDays, jobRef, today } from "./format";
import { getSetting, getXeroConnection, setXeroConnection, type XeroConnection } from "./settings";

/**
 * Xero integration (OAuth 2.0 web app flow).
 *  - Approved supplier / subcontractor / KPR bills are pushed to Xero as Bills (ACCPAY).
 *  - Approved variations are pushed as draft client invoices (ACCREC).
 *  - Paid status of pushed bills is synced back.
 * Docs: https://developer.xero.com/documentation/api/accounting/invoices
 */

const AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const API = "https://api.xero.com";
const DEFAULT_SCOPES =
  "openid profile email offline_access accounting.invoices accounting.contacts accounting.settings.read accounting.payments.read";

export const xeroConfigured = () => Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
export const xeroRedirectUri = () => `${appUrl()}/api/xero/callback`;

export function xeroAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID!,
    redirect_uri: xeroRedirectUri(),
    scope: process.env.XERO_SCOPES || DEFAULT_SCOPES,
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Xero token error (${res.status}): ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
}

export async function completeXeroConnection(code: string) {
  const tok = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: xeroRedirectUri() });
  const res = await fetch(`${API}/connections`, { headers: { authorization: `Bearer ${tok.access_token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't read Xero organisations (${res.status})`);
  const tenants = (await res.json()) as { tenantId: string; tenantName: string; tenantType: string }[];
  const org = tenants.find((t) => t.tenantType === "ORGANISATION") ?? tenants[0];
  if (!org) throw new Error("No Xero organisation was authorised.");
  await setXeroConnection({
    tenantId: org.tenantId,
    tenantName: org.tenantName,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + tok.expires_in * 1000,
    connectedAt: new Date().toISOString(),
  });
}

async function accessToken(): Promise<XeroConnection> {
  const conn = await getXeroConnection();
  if (!conn) throw new Error("Xero isn't connected.");
  if (conn.expiresAt - 60_000 > Date.now()) return conn;
  const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refreshToken });
  const next = { ...conn, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: Date.now() + tok.expires_in * 1000 };
  await setXeroConnection(next);
  return next;
}

type XeroError = { Message?: string; Elements?: { ValidationErrors?: { Message: string }[] }[]; Detail?: string; Title?: string };

async function xero<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const conn = await accessToken();
  const res = await fetch(`${API}/api.xro/2.0${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${conn.accessToken}`,
      "xero-tenant-id": conn.tenantId,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `Xero request failed (${res.status})`;
    try {
      const err = (await res.json()) as XeroError;
      const validation = err.Elements?.flatMap((e) => e.ValidationErrors ?? []).map((v) => v.Message);
      msg = validation?.length ? validation.join("; ") : err.Message || err.Detail || err.Title || msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/** Finds or creates the Xero contact for an SDL contact and remembers the link. */
async function ensureXeroContact(contactId: number | null): Promise<{ ContactID: string }> {
  if (!contactId) throw new Error("This record has no contact.");
  const [c] = await db.select().from(contacts).where(eq(contacts.id, contactId));
  if (!c) throw new Error("Contact not found.");
  if (c.xeroContactId) return { ContactID: c.xeroContactId };

  const where = encodeURIComponent(`Name=="${c.name.replace(/"/g, '\\"')}"`);
  const found = await xero<{ Contacts: { ContactID: string }[] }>(`/Contacts?where=${where}`);
  let id = found.Contacts?.[0]?.ContactID;
  if (!id) {
    const created = await xero<{ Contacts: { ContactID: string }[] }>("/Contacts", {
      method: "POST",
      body: {
        Contacts: [
          {
            Name: c.name,
            FirstName: c.contactName?.split(" ")[0],
            LastName: c.contactName?.split(" ").slice(1).join(" ") || undefined,
            EmailAddress: c.email || undefined,
            TaxNumber: c.abn || undefined,
            Phones: c.phone ? [{ PhoneType: "DEFAULT", PhoneNumber: c.phone }] : undefined,
          },
        ],
      },
    });
    id = created.Contacts[0]!.ContactID;
  }
  await db.update(contacts).set({ xeroContactId: id }).where(eq(contacts.id, c.id));
  return { ContactID: id };
}

/** Optional job tracking: makes sure the job exists as an option in the chosen tracking category. */
async function jobTracking(job: { id: number; name: string }) {
  const { trackingCategory } = await getSetting("xero");
  if (!trackingCategory) return undefined;
  const option = `${jobRef(job.id)} ${job.name}`.slice(0, 100);
  const where = encodeURIComponent(`Name=="${trackingCategory.replace(/"/g, '\\"')}"`);
  const res = await xero<{ TrackingCategories: { TrackingCategoryID: string; Options: { Name: string }[] }[] }>(
    `/TrackingCategories?where=${where}`,
  );
  const cat = res.TrackingCategories?.[0];
  if (!cat) throw new Error(`Tracking category "${trackingCategory}" wasn't found in Xero.`);
  if (!cat.Options.some((o) => o.Name === option)) {
    await xero(`/TrackingCategories/${cat.TrackingCategoryID}/Options`, { method: "PUT", body: { Options: [{ Name: option }] } });
  }
  return [{ Name: trackingCategory, Option: option }];
}

export async function pushBill(billId: number) {
  const [row] = await db
    .select({ bill: bills, job: jobs, stage: stages })
    .from(bills)
    .innerJoin(jobs, eq(jobs.id, bills.jobId))
    .leftJoin(stages, eq(stages.id, bills.stageId))
    .where(eq(bills.id, billId));
  if (!row) throw new Error("Bill not found.");
  const { bill, job, stage } = row;
  if (bill.xeroBillId) return { invoiceId: bill.xeroBillId };
  const settings = await getSetting("xero");
  const contact = await ensureXeroContact(bill.contactId);
  const tracking = await jobTracking(job);
  const res = await xero<{ Invoices: { InvoiceID: string }[] }>("/Invoices", {
    method: "POST",
    body: {
      Invoices: [
        {
          Type: "ACCPAY",
          Contact: contact,
          Date: bill.invoiceDate ?? today(),
          DueDate: bill.dueDate ?? addDays(bill.invoiceDate ?? today(), 14),
          InvoiceNumber: bill.reference || undefined,
          Reference: `${jobRef(job.id)} ${job.name}`.slice(0, 255),
          Status: settings.billStatus,
          LineAmountTypes: "Exclusive",
          LineItems: [
            {
              Description: [job.name, stage?.name, bill.description].filter(Boolean).join(" – "),
              Quantity: 1,
              UnitAmount: bill.amountCents / 100,
              AccountCode: settings.expenseAccountCode,
              TaxType: bill.gstCents > 0 ? "INPUT" : "EXEMPTEXPENSES",
              Tracking: tracking,
            },
          ],
        },
      ],
    },
  });
  const invoiceId = res.Invoices[0]!.InvoiceID;
  await db.update(bills).set({ xeroBillId: invoiceId }).where(eq(bills.id, billId));
  return { invoiceId };
}

export async function pushVariationInvoice(variationId: number) {
  const [row] = await db
    .select({ v: variations, job: jobs })
    .from(variations)
    .innerJoin(jobs, eq(jobs.id, variations.jobId))
    .where(eq(variations.id, variationId));
  if (!row) throw new Error("Variation not found.");
  const { v, job } = row;
  const settings = await getSetting("xero");
  const contact = await ensureXeroContact(job.clientId);
  const tracking = await jobTracking(job);
  const res = await xero<{ Invoices: { InvoiceID: string; InvoiceNumber?: string }[] }>("/Invoices", {
    method: "POST",
    body: {
      Invoices: [
        {
          Type: "ACCREC",
          Contact: contact,
          Date: today(),
          DueDate: addDays(today(), 7),
          Reference: `Variation V${v.number} – ${job.name}`.slice(0, 255),
          Status: "DRAFT",
          LineAmountTypes: "Exclusive",
          LineItems: [
            {
              Description: `Variation V${v.number}: ${v.title}${v.description ? `\n${v.description}` : ""}`,
              Quantity: 1,
              UnitAmount: v.priceCents / 100,
              AccountCode: settings.salesAccountCode,
              TaxType: "OUTPUT",
              Tracking: tracking,
            },
          ],
        },
      ],
    },
  });
  return { invoiceId: res.Invoices[0]!.InvoiceID, invoiceNumber: res.Invoices[0]!.InvoiceNumber ?? null };
}

/** Marks approved bills as paid when Xero says they're paid. Returns how many changed. */
export async function syncBillPayments() {
  const open = await db.select({ id: bills.id, xeroBillId: bills.xeroBillId }).from(bills).where(eq(bills.status, "approved"));
  const pushed = open.filter((b) => b.xeroBillId);
  let changed = 0;
  for (let i = 0; i < pushed.length; i += 50) {
    const chunk = pushed.slice(i, i + 50);
    const res = await xero<{ Invoices: { InvoiceID: string; Status: string; FullyPaidOnDate?: string }[] }>(
      `/Invoices?IDs=${chunk.map((b) => b.xeroBillId).join(",")}`,
    );
    const paid = res.Invoices.filter((inv) => inv.Status === "PAID").map((inv) => inv.InvoiceID);
    const ids = chunk.filter((b) => paid.includes(b.xeroBillId!)).map((b) => b.id);
    if (ids.length) {
      await db.update(bills).set({ status: "paid", paidAt: new Date() }).where(inArray(bills.id, ids));
      changed += ids.length;
    }
  }
  return changed;
}
