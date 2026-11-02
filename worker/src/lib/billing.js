// Pro checkout. Payments stay off until the Razorpay keys and a price are set.
// Until then an admin still turns Pro on by hand from a request.
import { notificationStatement, notifyAdmins } from './alerts.js';
import { ApiError, newId, nowIso } from './util.js';

export function billingStatus(env) {
  const amount = Number(env.PRO_PRICE_PAISE);
  const enabled = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && Number.isFinite(amount) && amount > 0);
  return {
    enabled,
    provider: 'razorpay',
    amount: enabled ? amount : null,
    currency: env.PRO_CURRENCY || 'INR',
    keyId: enabled ? env.RAZORPAY_KEY_ID : null,
  };
}

const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return hex(signed);
}

function sameHex(left, right) {
  const a = String(left || '').toLowerCase();
  const b = String(right || '').toLowerCase();
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createProOrder(env, user) {
  const status = billingStatus(env);
  if (!status.enabled) throw new ApiError(503, 'Online checkout is not turned on yet. Request Pro and we will activate it by hand.');
  if (user.plan === 'pro' || user.role === 'admin') throw new ApiError(400, 'This account is already on Pro.');
  const id = newId();
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: status.amount,
      currency: status.currency,
      receipt: id.slice(0, 40),
      notes: { userId: user.id, purpose: 'pro' },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    throw new ApiError(502, data.error?.description || 'The payment order could not be opened.');
  }
  const now = nowIso();
  await env.DB.prepare(`INSERT INTO billing_orders
    (id, user_id, provider, provider_order_id, amount, currency, status, created_at)
    VALUES (?, ?, 'razorpay', ?, ?, ?, 'pending', ?)`).bind(id, user.id, data.id, status.amount, status.currency, now).run();
  return { keyId: status.keyId, orderId: data.id, amount: status.amount, currency: status.currency };
}

async function grantPro(env, order, paymentId) {
  const now = nowIso();
  if (order.status !== 'paid') {
    await env.DB.batch([
      env.DB.prepare(`UPDATE billing_orders SET status = 'paid', provider_payment_id = ?, paid_at = ?
        WHERE id = ? AND status = 'pending'`).bind(paymentId, now, order.id),
      env.DB.prepare(`UPDATE users SET plan = 'pro', upgrade_requested_at = NULL, updated_at = ? WHERE id = ?`)
        .bind(now, order.user_id),
      notificationStatement(env.DB, {
        userId: order.user_id,
        type: 'pro_approved',
        title: 'Pro is active',
        body: 'Your Pro payment is confirmed. The Advanced view is unlocked for all your sites.',
      }),
    ]);
    const user = await env.DB.prepare('SELECT email, name FROM users WHERE id = ?').bind(order.user_id).first();
    await notifyAdmins(env.DB, {
      type: 'pro_request',
      title: 'Pro paid',
      body: `${user?.name || user?.email || 'A customer'} paid for Pro.`,
    }).catch(() => {});
  }
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(order.user_id).first();
}

export async function confirmProPayment(env, user, { orderId, paymentId, signature }) {
  const status = billingStatus(env);
  if (!status.enabled) throw new ApiError(503, 'Online checkout is not turned on yet.');
  if (!orderId || !paymentId || !signature) throw new ApiError(400, 'The payment confirmation is incomplete.');
  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  if (!sameHex(expected, signature)) throw new ApiError(400, 'The payment signature did not match.');
  const order = await env.DB.prepare(`SELECT * FROM billing_orders
    WHERE provider = 'razorpay' AND provider_order_id = ? AND user_id = ?`).bind(orderId, user.id).first();
  if (!order) throw new ApiError(404, 'That payment order was not found.');
  if (order.amount !== status.amount || order.currency !== status.currency) {
    throw new ApiError(400, 'That payment does not match the current Pro price.');
  }
  return grantPro(env, order, paymentId);
}

export async function handleRazorpayWebhook(env, rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new ApiError(503, 'The payment webhook is not turned on yet.');
  const expected = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  if (!sameHex(expected, signature)) throw new ApiError(400, 'The webhook signature did not match.');
  const event = JSON.parse(rawBody);
  if (event.event !== 'payment.captured') return { ignored: true };
  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id || !payment?.id) return { ignored: true };
  const order = await env.DB.prepare(`SELECT * FROM billing_orders
    WHERE provider = 'razorpay' AND provider_order_id = ?`).bind(payment.order_id).first();
  if (!order) return { ignored: true };
  if (Number(payment.amount) !== order.amount || payment.currency !== order.currency) {
    throw new ApiError(400, 'The captured payment does not match the order.');
  }
  await grantPro(env, order, payment.id);
  return { ok: true };
}
