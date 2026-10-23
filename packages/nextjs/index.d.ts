export declare const VERSION: string;
export declare const ENDPOINTS: string[];

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
