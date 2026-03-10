import { pinoHttp, type Options } from "pino-http";
import type { IncomingMessage } from "node:http";
import { generateTraceId, CORRELATION_HEADER } from "@heim/logging";
import { logger } from "../logger.ts";

const TRACE_ID_RE = /^[0-9a-f]{32}$/;

export const requestLogger = pinoHttp({
  logger,
  genReqId: ((req: IncomingMessage) => {
    const header = req.headers[CORRELATION_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    if (value && TRACE_ID_RE.test(value)) return value;
    return generateTraceId();
  }) as Options["genReqId"],
  redact: {
    paths: ["req.headers.cookie", "req.headers.authorization"],
  },
} satisfies Options);
