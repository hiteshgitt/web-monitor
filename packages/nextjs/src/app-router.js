// App Router route handler: app/api/webmonitor/[...slug]/route.(js|ts)
//   export { GET } from '@ruyalab/webmonitor-nextjs/app-router';
//   export const dynamic = 'force-dynamic';
//   export const runtime = 'nodejs';
import { handleWebMonitorRequest } from './core.js';

export async function GET(request) {
  const url = new URL(request.url);
  const endpoint = url.pathname.split('/').filter(Boolean).pop();
  const { status, body } = await handleWebMonitorRequest(endpoint, {
    authorization: request.headers.get('authorization'),
    origin: url.origin,
    forwardedProto: request.headers.get('x-forwarded-proto'),
  });
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
