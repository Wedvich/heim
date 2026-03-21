import type { RequestContext } from "./middleware/request-context.ts";

export interface SessionContext {
  sessionId: string;
  principalId: string;
  tenantId: string;
  expiresAt: Date;
}

export interface TenantContext {
  tenantId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      session?: SessionContext;
      tenantContext?: TenantContext;
      requestContext: RequestContext;
    }
  }
}
