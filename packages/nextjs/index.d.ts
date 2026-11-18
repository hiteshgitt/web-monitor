export declare const VERSION: string;
export declare const ENDPOINTS: string[];

/** instrumentation.ts: export { register, onRequestError } from '@ruyalab/webmonitor-nextjs/instrumentation'; */
export declare function register(): void;
export declare function onRequestError(error: unknown, request: { path?: string; method?: string }, context?: { routePath?: string }): void;
export declare function getComponents(): { id: string; name: string; status: 'ok' | 'warning' | 'error' | 'unknown'; message: string; hint?: string }[];

export declare function handleWebMonitorRequest(
  endpoint: string,
  request: { authorization?: string | null; origin: string; forwardedProto?: string | null },
): Promise<{ status: number; body: Record<string, unknown> }>;

/** App Router route handler (app/api/webmonitor/[...slug]/route.ts) */
export declare function GET(request: Request): Promise<Response>;

/** Pages Router API handler (pages/api/webmonitor/[...slug].ts) */
declare function pagesHandler(req: unknown, res: unknown): Promise<void>;
export { pagesHandler };
export default pagesHandler;
