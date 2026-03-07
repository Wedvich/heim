import type { RequestContext } from "./middleware/request-context.ts";

export interface SessionContext {
  sessionId: string;
  principalId: string;
  tenantId: string;
  expiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      session?: SessionContext | undefined;
      requestContext: RequestContext;
    }
  }
}
