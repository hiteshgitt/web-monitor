// Next.js instrumentation hooks. No Node.js imports: Next also loads instrumentation.ts in the edge runtime.
// In your project's instrumentation.ts:
//   export { register, onRequestError } from '@ruyalab/webmonitor-nextjs/instrumentation';
// Errors are kept on globalThis because Next bundles instrumentation.ts and the API route separately.

const ERRORS_MAX = 200;

export const errorStore = () => (globalThis.__webmonitorErrors ??= { hooked: false, items: [] });

/** Called once when the server starts; marks error tracking as installed. */
export function register() {
  errorStore().hooked = true;
}

/** Called by Next.js 15+ for every error thrown while handling a request. */
export function onRequestError(error, request, context) {
  const store = errorStore();
  store.hooked = true;
  store.items.push({
    at: Date.now(),
    path: String(request?.path || '').split('?')[0].slice(0, 120),
    route: context?.routePath ? String(context.routePath).slice(0, 120) : null,
    message: String(error?.message || error || 'Error').slice(0, 160),
    digest: error?.digest || null,
  });
  if (store.items.length > ERRORS_MAX) store.items.splice(0, store.items.length - ERRORS_MAX);
}
