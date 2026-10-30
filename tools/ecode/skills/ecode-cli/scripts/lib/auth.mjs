import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { CliError, EXIT } from './errors.mjs';
import {
  assertSessionFileSecurity,
  SessionSecurityError,
} from '../../../e10-login-cli/scripts/lib/session-security.mjs';

export const DEFAULT_STATE_PATH = resolve(homedir(), '.weaver-cc-assistant/sessions/default.json');
const USER_AGENT = 'Mozilla/5.0 EnvironmentSession/1.0';

function authError(type, message) {
  return new CliError(type, message, { exitCode: EXIT.AUTH });
}

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.origin;
  } catch {
    throw authError('AUTH_INVALID', 'e10-login-cli session contains an invalid origin');
  }
}

function domainMatches(host, domain) {
  const normalized = String(domain || '').trim().toLowerCase().replace(/^\./, '');
  return normalized && (host === normalized || host.endsWith(`.${normalized}`));
}

function pathMatches(requestPath, cookiePath) {
  const expected = String(cookiePath || '/');
  if (requestPath === expected) return true;
  if (!requestPath.startsWith(expected)) return false;
  return expected.endsWith('/') || requestPath.charAt(expected.length) === '/';
}

function validateCookie(cookie, index) {
  if (!cookie || typeof cookie !== 'object' || typeof cookie.name !== 'string' || typeof cookie.value !== 'string') {
    throw authError('AUTH_INVALID', `e10-login-cli session cookie ${index + 1} is invalid`);
  }
  if (/[^\x21-\x7e]/.test(cookie.name) || /[;\r\n]/.test(cookie.name + cookie.value)) {
    throw authError('AUTH_INVALID', `e10-login-cli session cookie ${index + 1} contains invalid characters`);
  }
  return cookie;
}

export function parseSessionFile(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.cookies)) return null;
    return data;
  } catch {
    return null;
  }
}

export function loadSession({ statePath = DEFAULT_STATE_PATH, now = Date.now(), security = {} } = {}) {
  const path = resolve(statePath);
  let raw;
  try {
    assertSessionFileSecurity(path, security);
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    if (error instanceof SessionSecurityError) {
      const type = error.code === 'ACL_UNVERIFIED' ? 'AUTH_ACL_UNVERIFIED'
        : error.code === 'INVALID' ? 'AUTH_INVALID' : 'AUTH_INSECURE';
      throw authError(type, `e10-login-cli session security check failed: ${error.message}`);
    }
    throw authError('AUTH_MISSING', 'No e10-login-cli session found; authenticate with e10-login-cli first');
  }
  const data = parseSessionFile(raw);
  if (!data) throw authError('AUTH_INVALID', 'e10-login-cli session file is unreadable or unsupported');
  const baseUrl = normalizeOrigin(data.origin);
  const origin = new URL(baseUrl);
  const cookies = data.cookies.map(validateCookie);
  const currentSeconds = Math.floor(now / 1000);

  const cookieForPath = (requestPath = '/') => cookies
    .filter(cookie => domainMatches(origin.hostname, cookie.domain))
    .filter(cookie => !cookie.secure || origin.protocol === 'https:')
    .filter(cookie => cookie.expires === undefined || cookie.expires === null || Number(cookie.expires) > currentSeconds)
    .filter(cookie => pathMatches(requestPath, cookie.path))
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');

  const rootCookie = cookieForPath('/');
  const apiCookie = cookieForPath('/api/ecode/tree/list');
  if (!/(?:^|;\s*)ETEAMSID=/.test(rootCookie) && !/(?:^|;\s*)ETEAMSID=/.test(apiCookie)) {
    throw authError('AUTH_INVALID', 'e10-login-cli session has no usable ETEAMSID');
  }
  return Object.freeze({ statePath:path, baseUrl, cookie:rootCookie, cookieForPath, userAgent:USER_AGENT });
}
