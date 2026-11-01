import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const day = (name: string) => date(name, { mode: "string" });
const created = () => ts("created_at").notNull().defaultNow();

/* ───────────── People ───────────── */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  role: text("role").notNull().default("supervisor"), // admin | office | supervisor
  passwordHash: text("password_hash").notNull(),
  hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: created(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // client | subcontractor | supplier | labour_hire
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  trade: text("trade"),
  abn: text("abn"),
  notes: text("notes"),
  xeroContactId: text("xero_contact_id"),
  archived: boolean("archived").notNull().default(false),
  createdAt: created(),
});

/* ───────────── Jobs ───────────── */

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    clientId: integer("client_id").references(() => contacts.id, { onDelete: "set null" }),
    siteAddress: text("site_address"),
    status: text("status").notNull().default("enquiry"),
    source: text("source"),
    description: text("description"),
    estimatedValueCents: integer("estimated_value_cents").notNull().default(0),
    contractValueCents: integer("contract_value_cents").notNull().default(0),
    supervisorId: integer("supervisor_id").references(() => users.id, { onDelete: "set null" }),
    startDate: day("start_date"),
    targetDate: day("target_date"),
    siteInfo: text("site_info"), // access, hazards, assembly point – shown on site + at induction
    lostReason: text("lost_reason"),
    inductionToken: text("induction_token").unique(),
    completedAt: ts("completed_at"),
    createdAt: created(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("jobs_status_idx").on(t.status)],
);

export const jobContacts = pgTable(
  "job_contacts",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    role: text("role"),
  },
  (t) => [uniqueIndex("job_contacts_unique").on(t.jobId, t.contactId)],
);

export const stages = pgTable(
  "stages",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    kind: text("kind").notNull().default("subcontractor"), // sdl | subcontractor
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    startDate: day("start_date"),
    endDate: day("end_date"),
    status: text("status").notNull().default("not_started"), // not_started | in_progress | complete | signed_off
    budgetCents: integer("budget_cents").notNull().default(0),
    notes: text("notes"),
    completedAt: ts("completed_at"),
    completedById: integer("completed_by_id").references(() => users.id, { onDelete: "set null" }),
    signedOffAt: ts("signed_off_at"),
    signedOffById: integer("signed_off_by_id").references(() => users.id, { onDelete: "set null" }),
    notifiedAt: ts("notified_at"), // dates sent to the subcontractor
  },
  (t) => [index("stages_job_idx").on(t.jobId)],
);

export const scopeItems = pgTable(
  "scope_items",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    stageId: integer("stage_id").references(() => stages.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    doneAt: ts("done_at"),
    doneById: integer("done_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("scope_job_idx").on(t.jobId)],
);

export const files = pgTable(
  "files",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    ownerType: text("owner_type").notNull(), // job | entry | variation | bill | log
    ownerId: integer("owner_id"),
    category: text("category").notNull().default("document"), // plan | document | photo | invoice
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull().default(0),
    storageKey: text("storage_key").notNull(),
    uploadedById: integer("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("files_owner_idx").on(t.ownerType, t.ownerId), index("files_job_idx").on(t.jobId)],
);

/* ───────────── Sales & contracts ───────────── */

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("quote"), // estimate | quote
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"), // draft | sent | accepted | declined
  markupPct: doublePrecision("markup_pct").notNull().default(25),
  notes: text("notes"),
  validUntil: day("valid_until"),
  sentAt: ts("sent_at"),
  acceptedAt: ts("accepted_at"),
  acceptedName: text("accepted_name"),
  signatureData: text("signature_data"),
  shareToken: text("share_token").unique(),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: created(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const quoteItems = pgTable("quote_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  section: text("section").notNull().default(""),
  description: text("description").notNull(),
  qty: doublePrecision("qty").notNull().default(1),
  unit: text("unit").notNull().default("item"),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // client | subcontract
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  stageId: integer("stage_id").references(() => stages.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  scope: text("scope"),
  amountCents: integer("amount_cents").notNull().default(0),
  terms: text("terms"),
  status: text("status").notNull().default("draft"), // draft | sent | signed | cancelled
  sentAt: ts("sent_at"),
  signedAt: ts("signed_at"),
  signedName: text("signed_name"),
  signatureData: text("signature_data"),
  shareToken: text("share_token").unique(),
  createdAt: created(),
});

/* ───────────── Labour hire ───────────── */

export const labourBookings = pgTable(
  "labour_bookings",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    stageId: integer("stage_id").references(() => stages.id, { onDelete: "set null" }),
    date: day("date").notNull(),
    days: integer("days").notNull().default(1),
    workers: integer("workers").notNull().default(1),
    hours: doublePrecision("hours").notNull().default(8), // per worker per day
    startTime: text("start_time").default("07:00"),
    task: text("task"),
    status: text("status").notNull().default("requested"), // requested | booked | cancelled
    requestedById: integer("requested_by_id").references(() => users.id, { onDelete: "set null" }),
    bookedAt: ts("booked_at"),
    bookedById: integer("booked_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("bookings_date_idx").on(t.date)],
);

/* ───────────── Site records ───────────── */

export const inductions = pgTable("inductions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  company: text("company"),
  phone: text("phone"),
  whiteCard: text("white_card"),
  emergencyContact: text("emergency_contact"),
  answers: jsonb("answers").$type<string[]>().notNull().default([]),
  signatureData: text("signature_data").notNull(),
  inductedById: integer("inducted_by_id").references(() => users.id, { onDelete: "set null" }),
  selfSigned: boolean("self_signed").notNull().default(false),
  createdAt: created(),
});

export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    date: day("date").notNull(),
    authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stageId: integer("stage_id").references(() => stages.id, { onDelete: "set null" }),
    workCompleted: text("work_completed"),
    weather: text("weather"),
    subbiesOnSite: text("subbies_on_site"),
    createdAt: created(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("daily_log_unique").on(t.jobId, t.date, t.authorId)],
);

export const labourEntries = pgTable(
  "labour_entries",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    dailyLogId: integer("daily_log_id").references(() => dailyLogs.id, { onDelete: "cascade" }),
    date: day("date").notNull(),
    kind: text("kind").notNull(), // sdl | kpr
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    hours: doublePrecision("hours").notNull(),
    approvedAt: ts("approved_at"),
    approvedById: integer("approved_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("labour_job_idx").on(t.jobId), index("labour_date_idx").on(t.date)],
);

export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // note | client | issue | unforeseen | photo
    body: text("body").notNull().default(""),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    dailyLogId: integer("daily_log_id").references(() => dailyLogs.id, { onDelete: "set null" }),
    variationId: integer("variation_id"),
    resolvedAt: ts("resolved_at"),
    resolvedById: integer("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("entries_job_idx").on(t.jobId)],
);

export const variations = pgTable(
  "variations",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    source: text("source").notNull().default("site"), // site | client | office
    status: text("status").notNull().default("identified"), // identified | priced | submitted | approved | declined | invoiced
    costCents: integer("cost_cents").notNull().default(0),
    priceCents: integer("price_cents").notNull().default(0),
    identifiedById: integer("identified_by_id").references(() => users.id, { onDelete: "set null" }),
    pricedAt: ts("priced_at"),
    submittedAt: ts("submitted_at"),
    approvedAt: ts("approved_at"),
    approvedName: text("approved_name"),
    signatureData: text("signature_data"),
    declinedAt: ts("declined_at"),
    invoicedAt: ts("invoiced_at"),
    invoiceRef: text("invoice_ref"),
    xeroInvoiceId: text("xero_invoice_id"),
    shareToken: text("share_token").unique(),
    createdAt: created(),
  },
  (t) => [index("variations_job_idx").on(t.jobId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: day("due_date"),
    status: text("status").notNull().default("open"), // open | done
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    doneAt: ts("done_at"),
    doneById: integer("done_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("tasks_assignee_idx").on(t.assigneeId, t.status)],
);

/* ───────────── Money out ───────────── */

export const bills = pgTable(
  "bills",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    stageId: integer("stage_id").references(() => stages.id, { onDelete: "set null" }),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // labour_hire | subcontractor | supplier
    reference: text("reference"),
    description: text("description"),
    invoiceDate: day("invoice_date"),
    dueDate: day("due_date"),
    periodFrom: day("period_from"),
    periodTo: day("period_to"),
    hours: doublePrecision("hours"),
    amountCents: integer("amount_cents").notNull().default(0), // ex GST
    gstCents: integer("gst_cents").notNull().default(0),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | paid
    reviewNote: text("review_note"),
    approvedById: integer("approved_by_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: ts("approved_at"),
    paidAt: ts("paid_at"),
    xeroBillId: text("xero_bill_id"),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [index("bills_status_idx").on(t.status), index("bills_job_idx").on(t.jobId)],
);

/* ───────────── System ───────────── */

export const activity = pgTable(
  "activity",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    createdAt: created(),
  },
  (t) => [index("activity_job_idx").on(t.jobId), index("activity_created_idx").on(t.createdAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** File contents, used when FILE_STORAGE=database (hosts without a persistent disk). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
export const blobs = pgTable("blobs", {
  key: text("key").primaryKey(),
  data: bytea("data").notNull(),
});

/* ───────────── Relations ───────────── */

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  client: one(contacts, { fields: [jobs.clientId], references: [contacts.id] }),
  supervisor: one(users, { fields: [jobs.supervisorId], references: [users.id] }),
  stages: many(stages),
}));

export const stagesRelations = relations(stages, ({ one }) => ({
  job: one(jobs, { fields: [stages.jobId], references: [jobs.id] }),
  contact: one(contacts, { fields: [stages.contactId], references: [contacts.id] }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  job: one(jobs, { fields: [quotes.jobId], references: [jobs.id] }),
  items: many(quoteItems),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
}));

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Variation = typeof variations.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type LabourBooking = typeof labourBookings.$inferSelect;
export type FileRow = typeof files.$inferSelect;
