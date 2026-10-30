export const TZ = process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "Australia/Sydney";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const audWhole = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

export function money(cents: number | null | undefined, whole = false) {
  const v = (cents ?? 0) / 100;
  return whole ? audWhole.format(v) : aud.format(v);
}

/** Compact money for tiles: $12.5k, $1.2m */
export function moneyShort(cents: number | null | undefined) {
  const v = (cents ?? 0) / 100;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${v < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  if (abs >= 10_000) return `${v < 0 ? "-" : ""}$${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${v < 0 ? "-" : ""}$${(abs / 1000).toFixed(1)}k`;
  return audWhole.format(v);
}

export function toCents(input: string | null | undefined) {
  if (!input) return 0;
  const n = Number(String(input).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToInput(cents: number | null | undefined) {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

export function pct(n: number) {
  if (!Number.isFinite(n)) return "–";
  return `${n.toFixed(1)}%`;
}

export function hours(h: number | null | undefined) {
  const v = h ?? 0;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}h`;
}

/** YYYY-MM-DD for "today" in the business timezone. */
export function today(): string {
  return isoDay(new Date());
}

export function isoDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing isoDate. */
export function weekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -dow);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
}

export function fmtDate(isoDate: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: opts.weekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: opts.year ? "numeric" : undefined,
  }).format(d);
}

/** "Today", "Tomorrow", "Yesterday", or "Mon 3 Nov" */
export function relDay(isoDate: string | null | undefined) {
  if (!isoDate) return "";
  const t = today();
  const diff = daysBetween(t, isoDate);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return fmtDate(isoDate, { weekday: Math.abs(diff) < 7, year: !isoDate.startsWith(t.slice(0, 4)) });
}

export function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function timeAgo(d: Date | null | undefined) {
  if (!d) return "";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(isoDay(d));
}

export function jobRef(id: number) {
  return `J${String(id).padStart(4, "0")}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function telHref(phone: string | null | undefined) {
  return phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;
}
