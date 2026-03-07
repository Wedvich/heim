import type { RequestHandler } from "express";

export interface RequestContext {
  readonly userAgent: string;
}

export const requestContextMiddleware: RequestHandler = (req, _res, next) => {
  req.requestContext = {
    userAgent: req.headers["user-agent"] ?? "unknown",
  };
  next();
};
