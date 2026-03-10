import type { RequestHandler } from "express";

export interface RequestContext {
  readonly correlationId: string;
  readonly userAgent: string;
}

export const requestContextMiddleware: RequestHandler = (req, _res, next) => {
  req.requestContext = {
    correlationId: req.id as string,
    userAgent: req.headers["user-agent"] ?? "unknown",
  };
  next();
};
