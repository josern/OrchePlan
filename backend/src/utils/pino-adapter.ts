// Lightweight pino adapter shim. If pino is installed and USE_PINO=true, the
// application can use pino for high-performance structured logging. This file
// tries to require pino dynamically; if not found it exports null so the
// caller can fall back to the built-in logger.

export type PinoLike = {
  child: (ctx: Record<string, any>) => PinoLike;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
};

let pinoLib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  pinoLib = require('pino');
} catch (e) {
  pinoLib = null;
}

export function createPinoLogger(serviceName = 'orcheplan') : PinoLike | null {
  if (!pinoLib) return null;
  const p = pinoLib({ name: serviceName, level: process.env.LOG_LEVEL || 'info' });
  return p as PinoLike;
}

export default createPinoLogger;
