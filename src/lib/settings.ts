import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type CompanySettings = {
  name: string;
  abn: string;
  address: string;
  phone: string;
  email: string;
  licence: string;
};

export type RateSettings = {
  kprHourlyCents: number; // KPR charge-out rate (ex GST) used to estimate labour cost
  gstPct: number;
  defaultMarkupPct: number;
  quoteValidDays: number;
};

export type XeroSettings = {
  expenseAccountCode: string; // job costs
  salesAccountCode: string; // variations / client invoices
  trackingCategory: string; // optional: Xero tracking category name used for jobs
  billStatus: "DRAFT" | "AUTHORISED";
};

export type XeroConnection = {
  tenantId: string;
  tenantName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedAt: string;
};

export type TemplateSettings = {
  quoteTerms: string;
  clientContractTerms: string;
  subcontractTerms: string;
  inductionItems: string[];
};

export const DEFAULTS = {
  company: {
    name: "SDL Creations",
    abn: "",
    address: "",
    phone: "",
    email: "",
    licence: "",
  } as CompanySettings,
  rates: {
    kprHourlyCents: 5500,
    gstPct: 10,
    defaultMarkupPct: 25,
    quoteValidDays: 30,
  } as RateSettings,
  xero: {
    expenseAccountCode: "310",
    salesAccountCode: "200",
    trackingCategory: "",
    billStatus: "DRAFT",
  } as XeroSettings,
  templates: {
    quoteTerms:
      "Prices are in AUD and exclude GST unless stated.\nThis quote is valid for 30 days.\nAny work outside the scope above will be quoted as a variation and must be approved in writing before it proceeds.\nReplace this text with your standard quote terms in Settings → Templates.",
    clientContractTerms:
      "1. Scope – SDL Creations will carry out the works described in this contract.\n2. Price – The contract price is shown above and excludes GST unless stated.\n3. Variations – Any change to the scope must be agreed in writing before the work is carried out.\n4. Payment – Progress payments are due within 7 days of invoice.\n\nReplace this text with your client contract terms in Settings → Templates.",
    subcontractTerms:
      "1 Scope\nThe contractor will complete the works described in this agreement to the standard required by SDL Creations, the plans and all applicable codes.\n\n2 Price and payment\nThe agreed price is shown above (ex GST). Invoices are paid once SDL has checked and approved the completed work.\n\n3 Variations\nNo variation is to be carried out without written approval from the SDL office.\n\n4 Labour hire through the office\nAny labour hire needed for an SDL job must be requested through the SDL office before the labour attends site. The SDL office will arrange all labour hire through KPR. The contractor must not engage labour hire directly, use another labour hire agency or bring an unapproved worker to an SDL job.\n\n5 Site safety\nAll workers must complete the SDL site induction before starting work.\n\nReplace or extend this text with your full subcontractor agreement in Settings → Templates.",
    inductionItems: [
      "I have been shown the site hazards, access and restricted areas",
      "I know the emergency procedure, assembly point and first aid kit location",
      "I will wear the required PPE at all times",
      "I have read and will follow the SWMS for my work",
      "I will report all incidents, injuries and near misses to the SDL supervisor",
      "I am fit for work and not affected by alcohol or drugs",
    ],
  } as TemplateSettings,
};

type Defaults = typeof DEFAULTS;
export type SettingsKey = keyof Defaults;

export async function getSetting<K extends SettingsKey>(key: K): Promise<Defaults[K]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return { ...DEFAULTS[key], ...((row?.value as object) ?? {}) } as Defaults[K];
}

export async function getSettings<K extends SettingsKey>(keys: K[]): Promise<{ [P in K]: Defaults[P] }> {
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  const out = {} as { [P in K]: Defaults[P] };
  for (const k of keys) {
    const row = rows.find((r) => r.key === k);
    out[k] = { ...DEFAULTS[k], ...((row?.value as object) ?? {}) } as Defaults[K];
  }
  return out;
}

export async function setSetting<K extends SettingsKey>(key: K, value: Partial<Defaults[K]>) {
  const current = await getSetting(key);
  const next = { ...current, ...value };
  await db.insert(settings).values({ key, value: next }).onConflictDoUpdate({ target: settings.key, set: { value: next } });
}

export async function getXeroConnection(): Promise<XeroConnection | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "xero_connection")).limit(1);
  return (row?.value as XeroConnection) ?? null;
}

export async function setXeroConnection(conn: XeroConnection | null) {
  if (!conn) {
    await db.delete(settings).where(eq(settings.key, "xero_connection"));
    return;
  }
  await db
    .insert(settings)
    .values({ key: "xero_connection", value: conn })
    .onConflictDoUpdate({ target: settings.key, set: { value: conn } });
}
