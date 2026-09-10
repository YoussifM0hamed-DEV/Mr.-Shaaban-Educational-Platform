const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

if (env.mailConfigured) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  logger.info(`Email sending enabled via ${env.SMTP_HOST} as ${env.SMTP_USER}`);
} else {
  logger.warn(
    'Email is not configured, so password reset links are printed to this console ' +
      'instead of being sent. Set SMTP_USER and SMTP_PASS in .env to enable sending.'
  );
}

/** Confirms the SMTP credentials actually work. Used by the startup check. */
async function verifyConnection() {
  if (!transporter) return { ok: false, reason: 'not configured' };
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Sends one email.
 * When SMTP is not set up the message is logged instead, so the flow can be
 * developed and tested without credentials. Never throws at the caller.
 */
async function send({ to, subject, html, text }) {
  if (!transporter) {
    logger.warn(`[email not sent - SMTP off] to=${to} subject="${subject}"`);
    logger.warn(`[email body] ${text}`);
    return { sent: false, reason: 'not configured' };
  }

  try {
    const info = await transporter.sendMail({ from: env.mailFrom, to, subject, html, text });
    logger.info(`Email sent to ${to} (${info.messageId})`);
    return { sent: true };
  } catch (err) {
    logger.error(`Failed to email ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

function layout({ title, body, cta }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#4f46e5,#3730a3);padding:24px;">
        <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(env.PLATFORM_NAME)}</p>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${escapeHtml(title)}</h1>
        ${body}
        ${
          cta
            ? `<p style="margin:24px 0;">
                 <a href="${cta.url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px;">${escapeHtml(cta.label)}</a>
               </p>
               <p style="margin:0;font-size:12px;color:#64748b;">
                 If the button does not work, copy this link into your browser:<br />
                 <span style="word-break:break-all;color:#4f46e5;">${cta.url}</span>
               </p>`
            : ''
        }
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">
          ${escapeHtml(env.PLATFORM_NAME)} - ${escapeHtml(env.TEACHER_NAME)}
        </p>
      </div>
    </div>
  </body>
</html>`;
}

/** The password reset email. `resetUrl` already contains the single-use token. */
async function sendPasswordReset({ to, name, resetUrl, expiresInMinutes }) {
  const subject = `Reset your ${env.PLATFORM_NAME} password`;

  const text = [
    `Hello ${name},`,
    '',
    `Someone asked to reset the password for your ${env.PLATFORM_NAME} account.`,
    `Open this link to choose a new password. It expires in ${expiresInMinutes} minutes and can only be used once:`,
    '',
    resetUrl,
    '',
    'If you did not ask for this, you can ignore this email. Your password stays as it is.',
  ].join('\n');

  const html = layout({
    title: 'Reset your password',
    body: `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;">Hello ${escapeHtml(name)},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;">
        Someone asked to reset the password for your account. Choose a new one using the button below.
      </p>
      <p style="margin:0;font-size:14px;color:#334155;">
        The link expires in <strong>${expiresInMinutes} minutes</strong> and works only once.
        If you did not ask for this, ignore this email and your password stays as it is.
      </p>`,
    cta: { label: 'Choose a new password', url: resetUrl },
  });

  return send({ to, subject, html, text });
}

/** Confirmation after a successful reset, so an unexpected change is noticed. */
async function sendPasswordChanged({ to, name }) {
  const subject = `Your ${env.PLATFORM_NAME} password was changed`;

  const text = [
    `Hello ${name},`,
    '',
    'Your password was just changed. You can now sign in with the new one.',
    '',
    'If this was not you, contact your teacher immediately.',
  ].join('\n');

  const html = layout({
    title: 'Your password was changed',
    body: `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;">Hello ${escapeHtml(name)},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;">
        Your password was just changed. You can sign in with the new one now.
      </p>
      <p style="margin:0;font-size:14px;color:#b91c1c;">
        If this was not you, contact your teacher immediately.
      </p>`,
    cta: { label: 'Sign in', url: `${env.CLIENT_URL}/login` },
  });

  return send({ to, subject, html, text });
}

module.exports = {
  send,
  sendPasswordReset,
  sendPasswordChanged,
  verifyConnection,
  isConfigured: env.mailConfigured,
};
