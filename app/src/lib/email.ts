import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

/**
 * Lazily built and cached. Returns null (not an error) until SMTP_HOST is
 * set in .env — every caller in this module is expected to treat "not
 * configured yet" as a no-op, not a failure, so the notification cron can
 * run safely before/after SMTP is actually set up.
 */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) {
    transporter = null;
    return transporter;
  }

  const port = Number(SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] SMTP not configured — skipping "${subject}" to ${to}`);
    return false;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM ?? "Strhni Dav <noreply@strhnidav.sk>",
    to,
    subject,
    html,
    text,
  });
  return true;
}
