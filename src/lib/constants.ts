/** Status pill styles – all drawn from the four brand colours (see globals.css). */
export type Tone = "neutral" | "info" | "warn" | "good" | "bad" | "strong";

type StatusDef = { label: string; tone: Tone };

export const JOB_STATUSES = {
  enquiry: { label: "Enquiry", tone: "neutral" },
  site_visit: { label: "Site visit", tone: "info" },
  quoting: { label: "Quoting", tone: "info" },
  quoted: { label: "Quote sent", tone: "warn" },
  won: { label: "Won – to start", tone: "good" },
  in_progress: { label: "In progress", tone: "strong" },
  completed: { label: "Completed", tone: "good" },
  lost: { label: "Lost", tone: "bad" },
} satisfies Record<string, StatusDef>;
export type JobStatus = keyof typeof JOB_STATUSES;
export const LEAD_STATUSES: JobStatus[] = ["enquiry", "site_visit", "quoting", "quoted"];
export const ACTIVE_STATUSES: JobStatus[] = ["won", "in_progress"];
export const PIPELINE_ORDER: JobStatus[] = [
  "enquiry",
  "site_visit",
  "quoting",
  "quoted",
  "won",
  "in_progress",
  "completed",
];

export const STAGE_STATUSES = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "strong" },
  complete: { label: "Complete – check", tone: "warn" },
  signed_off: { label: "Signed off", tone: "good" },
} satisfies Record<string, StatusDef>;
export type StageStatus = keyof typeof STAGE_STATUSES;

export const QUOTE_STATUSES = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "warn" },
  accepted: { label: "Accepted", tone: "good" },
  declined: { label: "Declined", tone: "bad" },
} satisfies Record<string, StatusDef>;

export const CONTRACT_STATUSES = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "warn" },
  signed: { label: "Signed", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" },
} satisfies Record<string, StatusDef>;

export const VARIATION_STATUSES = {
  identified: { label: "Identified", tone: "warn" },
  priced: { label: "Priced", tone: "info" },
  submitted: { label: "With client", tone: "strong" },
  approved: { label: "Approved", tone: "good" },
  declined: { label: "Declined", tone: "bad" },
  invoiced: { label: "Invoiced", tone: "neutral" },
} satisfies Record<string, StatusDef>;
export type VariationStatus = keyof typeof VARIATION_STATUSES;

export const BOOKING_STATUSES = {
  requested: { label: "Requested", tone: "warn" },
  booked: { label: "Booked", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" },
} satisfies Record<string, StatusDef>;

export const BILL_STATUSES = {
  pending: { label: "To check", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
  paid: { label: "Paid", tone: "neutral" },
} satisfies Record<string, StatusDef>;

export const BILL_KINDS = {
  labour_hire: "Labour hire (KPR)",
  subcontractor: "Subcontractor",
  supplier: "Supplier",
} as const;
export type BillKind = keyof typeof BILL_KINDS;

export const CONTACT_TYPES = {
  client: "Client",
  subcontractor: "Subcontractor",
  supplier: "Supplier",
  labour_hire: "Labour hire",
} as const;
export type ContactType = keyof typeof CONTACT_TYPES;

export const ENTRY_TYPES = {
  note: { label: "Note", tone: "neutral" },
  client: { label: "Client conversation", tone: "info" },
  issue: { label: "Problem / issue", tone: "bad" },
  unforeseen: { label: "Unforeseen item", tone: "warn" },
  photo: { label: "Photos", tone: "neutral" },
} satisfies Record<string, StatusDef>;
export type EntryType = keyof typeof ENTRY_TYPES;

export const ROLES = {
  admin: "Admin",
  office: "Office",
  supervisor: "Supervisor",
} as const;
export type Role = keyof typeof ROLES;

export const TRADES = [
  "Earthworks",
  "Pool installation",
  "Concrete & footings",
  "Blockwork",
  "Rendering",
  "Tiling & finishes",
  "Pool fencing",
  "Plumbing",
  "Electrical",
  "Other",
];

/** The standard SDL job structure. Used when a job is created. */
export const STAGE_TEMPLATE: { name: string; kind: "sdl" | "subcontractor"; trade?: string; pool?: boolean }[] = [
  { name: "Demolition & site preparation", kind: "sdl" },
  { name: "Earthworks", kind: "subcontractor", trade: "Earthworks" },
  { name: "Pool installation", kind: "subcontractor", trade: "Pool installation", pool: true },
  { name: "Concrete & footings", kind: "subcontractor", trade: "Concrete & footings" },
  { name: "Blockwork", kind: "subcontractor", trade: "Blockwork" },
  { name: "Rendering", kind: "subcontractor", trade: "Rendering" },
  { name: "Tiling & finishes", kind: "subcontractor", trade: "Tiling & finishes" },
  { name: "Pool details, fencing & associated works", kind: "subcontractor", trade: "Pool fencing", pool: true },
  { name: "Gardens, turf & clean-up", kind: "sdl" },
];

export const JOB_SOURCES = ["Website", "Referral", "Repeat client", "Social media", "Builder", "Signage", "Other"];

/** Timeline bar colours per stage state – brand colours only. */
export function stageBarClass(status: string, kind: string) {
  if (status === "signed_off") return "bg-leaf text-cream";
  if (status === "complete") return "bg-clay text-cream";
  if (status === "in_progress") return "bg-olive text-cream";
  return kind === "sdl" ? "bg-leaf-mid text-olive" : "bg-line-strong text-olive";
}
