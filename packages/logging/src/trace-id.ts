/**
 * W3C Trace Context–compatible ID generation.
 *
 * trace-id: 32 hex chars (128-bit)
 * span-id:  16 hex chars (64-bit)
 *
 * Uses crypto.getRandomValues which works in both Node 20+ and browsers.
 */

const HEX: string[] = [];
for (let i = 0; i < 256; i++) {
  HEX.push(i.toString(16).padStart(2, "0"));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += HEX[bytes[i]!];
  }
  return out;
}

/** 32 hex chars — becomes a real OTel trace ID when instrumentation is added. */
export function generateTraceId(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** 16 hex chars — becomes a real OTel span ID when instrumentation is added. */
export function generateSpanId(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(8)));
}

/** HTTP header used to propagate the correlation / trace ID between frontend and backend. */
export const CORRELATION_HEADER = "x-correlation-id";
