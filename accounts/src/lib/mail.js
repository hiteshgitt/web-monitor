// Account emails (verify address, reset password) through Resend. Sender: ACCOUNTS_EMAIL_FROM.
import { esc } from './ui.js';

export const mailConfigured = (env) => Boolean(env.RESEND_API_KEY && env.ACCOUNTS_EMAIL_FROM);

function layout(heading, text, button, url, footer) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#161a2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #e2e5f0;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<p style="margin:0 0 18px;font-weight:700;font-size:17px">Ruya Lab</p>
<h1 style="margin:0 0 10px;font-size:20px">${esc(heading)}</h1>
<p style="margin:0 0 22px;color:#5b6178;line-height:1.5">${esc(text)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#5b5bd6;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${esc(button)}</a>
<p style="margin:22px 0 0;color:#5b6178;font-size:13px;line-height:1.5">${esc(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

async function send(env, to, subject, html, text) {
  if (!mailConfigured(env)) throw new Error('email_not_configured');
  const res = await fetch(`${env.RESEND_API_BASE || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.ACCOUNTS_EMAIL_FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`resend_${res.status}`);
}

export function sendVerifyEmail(env, to, url) {
  return send(env, to, 'Confirm your Ruya Lab email',
    layout('Confirm your email', 'Confirm this address to finish setting up your Ruya Lab account. One account works for WebMonitor, RuyaShield and every Ruya Lab product.', 'Confirm email', url,
      'The link works for 24 hours. If you did not create a Ruya Lab account, ignore this email.'),
    `Confirm your Ruya Lab email: ${url}\n\nThe link works for 24 hours. If you did not create an account, ignore this email.`);
}

export function sendResetEmail(env, to, url) {
  return send(env, to, 'Reset your Ruya Lab password',
    layout('Reset your password', 'Someone (hopefully you) asked to reset the password of your Ruya Lab account.', 'Choose a new password', url,
      'The link works for one hour and only once. If you did not ask for this, ignore this email; your password stays the same.'),
    `Reset your Ruya Lab password: ${url}\n\nThe link works for one hour. If you did not ask for this, ignore this email.`);
}
