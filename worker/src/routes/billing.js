// Pro checkout. Creating an order and confirming it require a signed-in customer.
// Razorpay calls the webhook itself, so that route is registered without a session.
import { Hono } from 'hono';
import { billingStatus, confirmProPayment, createProOrder, handleRazorpayWebhook } from '../lib/billing.js';
import { serializeUser } from '../lib/serialize.js';

const billing = new Hono();

billing.get('/status', (c) => c.json(billingStatus(c.env)));

billing.post('/order', async (c) => c.json(await createProOrder(c.env, c.get('user'))));

billing.post('/confirm', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const user = await confirmProPayment(c.env, c.get('user'), {
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  return c.json({ user: serializeUser(user) });
});

export async function razorpayWebhook(c) {
  const raw = await c.req.text();
  return c.json(await handleRazorpayWebhook(c.env, raw, c.req.header('x-razorpay-signature') || ''));
}

export default billing;
