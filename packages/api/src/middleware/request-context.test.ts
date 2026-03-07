import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requestContextMiddleware } from "./request-context.ts";

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

describe("requestContextMiddleware", () => {
  it("sets userAgent from the user-agent header", () => {
    const req = makeReq({ "user-agent": "TestBrowser/1.0" });
    requestContextMiddleware(req, {} as Response, vi.fn());
    expect(req.requestContext.userAgent).toBe("TestBrowser/1.0");
  });

  it("defaults userAgent to 'unknown' when header is absent", () => {
    const req = makeReq();
    requestContextMiddleware(req, {} as Response, vi.fn());
    expect(req.requestContext.userAgent).toBe("unknown");
  });

  it("calls next()", () => {
    const next = vi.fn();
    requestContextMiddleware(makeReq(), {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
