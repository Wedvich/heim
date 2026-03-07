export interface SessionContext {
  sessionId: string;
  principalId: string;
  tenantId: string | null;
  expiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      session?: SessionContext | undefined;
    }
  }
}
