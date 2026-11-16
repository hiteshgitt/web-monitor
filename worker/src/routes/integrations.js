// Account-level integrations. RuyaShield: connect with a read-only API token, see status, disconnect.
import { Hono } from 'hono';
import { connect, connectionStatus, disconnect } from '../lib/ruyashield.js';

const integrations = new Hono();

integrations.get('/ruyashield', async (c) => c.json(await connectionStatus(c.env, c.get('user').id)));

integrations.put('/ruyashield', async (c) => {
  const { token } = await c.req.json().catch(() => ({}));
  return c.json(await connect(c.env, c.get('user').id, token));
});

integrations.delete('/ruyashield', async (c) => c.json(await disconnect(c.env, c.get('user').id)));

export default integrations;
