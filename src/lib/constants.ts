export type Tone = "gray" | "blue" | "amber" | "green" | "red" | "violet";

type StatusDef = { label: string; tone: Tone };

export const JOB_STATUSES = {
  enquiry: { label: "Enquiry", tone: "gray" },
  site_visit: { label: "Site visit", tone: "blue" },
  quoting: { label: "Quoting", tone: "violet" },
  quoted: { label: "Quote sent", tone: "amber" },
  won: { label: "Won – to start", tone: "green" },
  in_progress: { label: "In progress", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  lost: { label: "Lost", tone: "red" },
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
  not_started: { label: "Not started", tone: "gray" },
  in_progress: { label: "In progress", tone: "blue" },
  complete: { label: "Complete – check", tone: "amber" },
  signed_off: { label: "Signed off", tone: "green" },
} satisfies Record<string, StatusDef>;
export type StageStatus = keyof typeof STAGE_STATUSES;

export const QUOTE_STATUSES = {
  draft: { label: "Draft", tone: "gray" },
  sent: { label: "Sent", tone: "amber" },
  accepted: { label: "Accepted", tone: "green" },
  declined: { label: "Declined", tone: "red" },
} satisfies Record<string, StatusDef>;

export const CONTRACT_STATUSES = {
  draft: { label: "Draft", tone: "gray" },
  sent: { label: "Sent", tone: "amber" },
  signed: { label: "Signed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
} satisfies Record<string, StatusDef>;

export const VARIATION_STATUSES = {
  identified: { label: "Identified", tone: "violet" },
  priced: { label: "Priced", tone: "blue" },
  submitted: { label: "With client", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  invoiced: { label: "Invoiced", tone: "gray" },
} satisfies Record<string, StatusDef>;
export type VariationStatus = keyof typeof VARIATION_STATUSES;

export const BOOKING_STATUSES = {
  requested: { label: "Requested", tone: "amber" },
  booked: { label: "Booked", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
} satisfies Record<string, StatusDef>;

export const BILL_STATUSES = {
  pending: { label: "To check", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  paid: { label: "Paid", tone: "gray" },
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
  note: { label: "Note", tone: "gray" },
  client: { label: "Client conversation", tone: "blue" },
  issue: { label: "Problem / issue", tone: "red" },
  unforeseen: { label: "Unforeseen item", tone: "amber" },
  photo: { label: "Photos", tone: "gray" },
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
