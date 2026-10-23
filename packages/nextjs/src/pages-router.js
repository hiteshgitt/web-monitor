// Pages Router API route: pages/api/webmonitor/[...slug].(js|ts)
//   export { default } from '@ruyalab/webmonitor-nextjs/pages-router';
import { handleWebMonitorRequest } from './core.js';

export default async function webMonitorHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const slug = [].concat(req.query.slug || []);
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const { status, body } = await handleWebMonitorRequest(slug[slug.length - 1], {
    authorization: req.headers.authorization,
    origin: `${proto}://${req.headers.host}`,
    forwardedProto: req.headers['x-forwarded-proto'],
  });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}
