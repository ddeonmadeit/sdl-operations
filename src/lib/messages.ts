import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, contracts, jobs, labourBookings, quotes, stages, users, variations } from "@/db/schema";
import { appUrl } from "./email";
import { addDays, fmtDate, money } from "./format";
import { getSetting } from "./settings";

export type DocKind = "quote" | "contract" | "variation" | "booking";
export type DocMessage = { to: string; subject: string; body: string; link?: string };

const firstName = (name?: string | null) => (name ? name.trim().split(/\s+/)[0] : "there");
export const shareLink = (token: string | null | undefined) => (token ? `${appUrl()}/p/${token}` : undefined);

export async function docMessage(kind: DocKind, id: number): Promise<DocMessage | null> {
  const company = await getSetting("company");
  const signoff = `Kind regards,\n${company.name}${company.phone ? `\n${company.phone}` : ""}`;

  if (kind === "quote") {
    const [row] = await db
      .select({ q: quotes, job: jobs, client: contacts })
      .from(quotes)
      .innerJoin(jobs, eq(jobs.id, quotes.jobId))
      .leftJoin(contacts, eq(contacts.id, jobs.clientId))
      .where(eq(quotes.id, id));
    if (!row) return null;
    const link = shareLink(row.q.shareToken);
    const word = row.q.kind === "estimate" ? "estimate" : "quote";
    return {
      to: row.client?.email ?? "",
      subject: `Your ${word} from ${company.name} – ${row.job.name}`,
      body: `Hi ${firstName(row.client?.contactName || row.client?.name)},\n\nThanks for the opportunity. Your ${word} for ${row.job.siteAddress || row.job.name} is ready to view${row.q.kind === "quote" ? " and accept online" : ""}:\n\n${link}\n\n${signoff}`,
      link,
    };
  }

  if (kind === "contract") {
    const [row] = await db
      .select({ c: contracts, job: jobs, contact: contacts, stage: stages })
      .from(contracts)
      .innerJoin(jobs, eq(jobs.id, contracts.jobId))
      .leftJoin(contacts, eq(contacts.id, contracts.contactId))
      .leftJoin(stages, eq(stages.id, contracts.stageId))
      .where(eq(contracts.id, id));
    if (!row) return null;
    const link = shareLink(row.c.shareToken);
    if (row.c.kind === "subcontract") {
      return {
        to: row.contact?.email ?? "",
        subject: `Subcontract agreement – ${row.stage?.name ?? row.c.title} – ${row.job.siteAddress || row.job.name}`,
        body: `Hi ${firstName(row.contact?.contactName || row.contact?.name)},\n\nPlease review and sign the subcontract agreement for ${row.stage?.name ?? "the works"} at ${row.job.siteAddress || row.job.name} (${money(row.c.amountCents)} ex GST):\n\n${link}\n\nReminder: all labour hire for SDL jobs must be booked through the SDL office.\n\n${signoff}`,
        link,
      };
    }
    return {
      to: row.contact?.email ?? "",
      subject: `Your contract with ${company.name} – ${row.job.name}`,
      body: `Hi ${firstName(row.contact?.contactName || row.contact?.name)},\n\nYour contract for ${row.job.siteAddress || row.job.name} is ready. You can read and sign it online here:\n\n${link}\n\n${signoff}`,
      link,
    };
  }

  if (kind === "variation") {
    const [row] = await db
      .select({ v: variations, job: jobs, client: contacts })
      .from(variations)
      .innerJoin(jobs, eq(jobs.id, variations.jobId))
      .leftJoin(contacts, eq(contacts.id, jobs.clientId))
      .where(eq(variations.id, id));
    if (!row) return null;
    const link = shareLink(row.v.shareToken);
    return {
      to: row.client?.email ?? "",
      subject: `Variation V${row.v.number} for approval – ${row.v.title}`,
      body: `Hi ${firstName(row.client?.contactName || row.client?.name)},\n\nAs discussed, here is variation V${row.v.number} (${row.v.title}) for ${money(row.v.priceCents)} ex GST. Please review and approve it online before we proceed:\n\n${link}\n\n${signoff}`,
      link,
    };
  }

  if (kind === "booking") {
    const [row] = await db
      .select({ b: labourBookings, job: jobs, contact: contacts, sup: users })
      .from(labourBookings)
      .innerJoin(jobs, eq(jobs.id, labourBookings.jobId))
      .leftJoin(contacts, eq(contacts.id, labourBookings.contactId))
      .leftJoin(users, eq(users.id, jobs.supervisorId))
      .where(eq(labourBookings.id, id));
    if (!row) return null;
    const { b } = row;
    const dates = b.days > 1 ? `${fmtDate(b.date, { weekday: true })} – ${fmtDate(addDays(b.date, b.days - 1), { weekday: true })} (${b.days} days)` : fmtDate(b.date, { weekday: true, year: true });
    return {
      to: row.contact?.email ?? "",
      subject: `Labour hire booking PO-${b.id} – ${company.name} – ${fmtDate(b.date, { weekday: true })}`,
      body: `Hi ${firstName(row.contact?.contactName || row.contact?.name)},\n\nPlease book the following labour for ${company.name}:\n\nPurchase order: PO-${b.id}\nSite: ${row.job.siteAddress || row.job.name}\nDate: ${dates}\nStart time: ${b.startTime || "7:00"}\nWorkers: ${b.workers}\nHours per day: ${b.hours}\nWork: ${b.task || "General site labour"}\nSupervisor on site: ${row.sup?.name ?? "TBC"}${row.sup?.phone ? ` – ${row.sup.phone}` : ""}\n\nPlease quote PO-${b.id} on your invoice.\n\n${signoff}`,
    };
  }
  return null;
}
