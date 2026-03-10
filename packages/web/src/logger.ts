export interface LogContext {
  [key: string]: unknown;
}

const isDev = import.meta.env.DEV;

function format(level: string, msg: string, ctx?: LogContext): [string, ...unknown[]] {
  if (isDev) {
    return ctx ? [`[${level}] ${msg}`, ctx] : [`[${level}] ${msg}`];
  }
  return [JSON.stringify({ level, msg, ...ctx, ts: Date.now() })];
}

export const logger = {
  error(msg: string, ctx?: LogContext) {
    console.error(...format("error", msg, ctx));
  },
  warn(msg: string, ctx?: LogContext) {
    console.warn(...format("warn", msg, ctx));
  },
  info(msg: string, ctx?: LogContext) {
    console.info(...format("info", msg, ctx));
  },
  debug(msg: string, ctx?: LogContext) {
    if (isDev) console.debug(...format("debug", msg, ctx));
  },
};
