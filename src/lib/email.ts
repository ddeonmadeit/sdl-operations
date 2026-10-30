import "server-only";
import nodemailer from "nodemailer";
import { getSetting } from "./settings";

export const emailEnabled = () => Boolean(process.env.SMTP_HOST);

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Sends an email if SMTP is configured. Returns false when email is not set up. */
export async function sendEmail(opts: { to: string; subject: string; text: string; replyTo?: string }) {
  if (!emailEnabled()) return false;
  const company = await getSetting("company");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: opts.to,
    replyTo: opts.replyTo || company.email || undefined,
    subject: opts.subject,
    text: opts.text,
  });
  return true;
}

export function mailtoHref(to: string | null | undefined, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
