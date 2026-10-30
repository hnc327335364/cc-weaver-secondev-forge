export const EXIT = Object.freeze({
  INPUT: 2,
  AUTH: 3,
  NETWORK: 4,
  HTTP: 5,
  BUSINESS: 6,
  VERSION_CONFLICT: 7,
  FILE: 8,
  ENCRYPTION: 9,
});

export class CliError extends Error {
  constructor(type, message, { code = undefined, exitCode = EXIT.BUSINESS, details = undefined } = {}) {
    super(message);
    this.name = 'CliError';
    this.type = type;
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

const SECRET_KEYS = /cookie|eteamsid|encrypt(?:ion)?key|auth(?:entication)?|session/i;

function redactText(value) {
  return String(value)
    .replace(/ETEAMSID\s*=\s*[^;\s"']+/gi, 'ETEAMSID=[redacted]')
    .replace(/(Cookie|encryptKey)\s*[:=]\s*[^\r\n,}]+/gi, '$1=[redacted]');
}

export function sanitize(value, depth = 0) {
  if (depth > 8) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (typeof value === 'string') return redactText(value);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET_KEYS.test(key) ? '[redacted]' : sanitize(item, depth + 1);
  }
  return out;
}

export function errorPayload(command, error) {
  const safe = error instanceof CliError ? error : new CliError('UNEXPECTED_ERROR', 'Unexpected CLI failure');
  const body = {
    ok: false,
    command,
    error: {
      type: safe.type,
      message: redactText(safe.message),
    },
  };
  if (safe.code !== undefined && safe.code !== null && safe.code !== '') body.error.code = String(safe.code);
  if (safe.details !== undefined) body.error.details = sanitize(safe.details);
  return { body, exitCode: safe.exitCode || 1 };
}
