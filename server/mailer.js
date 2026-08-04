import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : smtpPort === 465;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromName = process.env.SMTP_FROM_NAME || "HTG Clouds";
const fromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;

const emailEnabled = Boolean(smtpUser && smtpPass);

let transporter = null;
if (emailEnabled) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 3),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 30000),
    auth: { user: smtpUser, pass: smtpPass }
  });
} else {
  console.warn("[MAIL] SMTP_USER / SMTP_PASS not set — emails will be logged to the console instead of sent.");
}

async function sendMail({ to, subject, html, text, attachments, logLabel }) {
  if (!emailEnabled) {
    console.log("=====================================================");
    console.log(`HTGCLOUD EMAIL (TEST MODE) — ${logLabel}`);
    console.log("To:", to);
    console.log("Subject:", subject);
    if (attachments?.length) {
      console.log(
        "Attachments:",
        attachments.map((attachment) => `${attachment.filename || "attachment"} (${attachment.contentType || "unknown"})`).join(", ")
      );
    }
    console.log(text || html);
    console.log("=====================================================");
    return { delivered: false };
  }

  try {
    const startedAt = Date.now();
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text,
      attachments
    });
    console.log(`[MAIL] Sent "${logLabel}" to ${to} in ${Date.now() - startedAt}ms.`);
    return { delivered: true };
  } catch (error) {
    console.error(`[MAIL] Failed to send "${logLabel}" to ${to}:`, error);
    return { delivered: false, error };
  }
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendRelayEmail({ to, subject, html, text, attachments }) {
  const result = await sendMail({
    to,
    subject,
    html,
    text: text || htmlToText(html),
    attachments,
    logLabel: "MAIL RELAY"
  });

  if (!result.delivered) {
    throw result.error || new Error("Email delivery is not configured.");
  }

  return result;
}

function emailShell(bodyHtml) {
  return `
  <div style="background:#f6f8f8;padding:32px 16px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e9eef1;">
      <tr>
        <td style="background:#11161c;padding:24px 32px;">
          <span style="color:#48d4d3;font-size:18px;font-weight:700;letter-spacing:0.02em;">HTG Clouds</span>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;border-top:1px solid #e9eef1;">
          <p style="margin:0;color:#65707c;font-size:12px;">
            You're receiving this because someone used this email address on htgclouds.com. If this wasn't you, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>
  </div>`;
}

export async function sendVerificationCodeEmail({ to, code, fullName }) {
  const greeting = fullName ? `Hi ${fullName},` : "Hi,";
  const html = emailShell(`
    <p style="margin:0 0 16px;color:#11161c;font-size:15px;">${greeting}</p>
    <p style="margin:0 0 24px;color:#11161c;font-size:15px;">Use the code below to verify your email address. It expires in 15 minutes.</p>
    <div style="margin:0 0 24px;text-align:center;">
      <span style="display:inline-block;padding:14px 28px;background:#e3fbfa;border:1px solid #48d4d3;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:0.3em;color:#11161c;">${code}</span>
    </div>
    <p style="margin:0;color:#65707c;font-size:13px;">If you didn't request this, you can ignore this email.</p>
  `);
  const text = `Your HTG Clouds verification code is ${code}. It expires in 15 minutes.`;

  return sendMail({
    to,
    subject: `Your HTG Clouds verification code: ${code}`,
    html,
    text,
    logLabel: "VERIFICATION CODE"
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const html = emailShell(`
    <p style="margin:0 0 16px;color:#11161c;font-size:15px;">Hi,</p>
    <p style="margin:0 0 24px;color:#11161c;font-size:15px;">We received a request to reset your HTG Clouds password. This link expires in 1 hour.</p>
    <div style="margin:0 0 24px;text-align:center;">
      <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#11161b;color:#ffffff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Reset password</a>
    </div>
    <p style="margin:0;color:#65707c;font-size:13px;">If you didn't request this, you can ignore this email — your password won't change.</p>
  `);
  const text = `Reset your HTG Clouds password: ${resetUrl} (expires in 1 hour)`;

  return sendMail({
    to,
    subject: "Reset your HTG Clouds password",
    html,
    text,
    logLabel: "PASSWORD RESET"
  });
}
