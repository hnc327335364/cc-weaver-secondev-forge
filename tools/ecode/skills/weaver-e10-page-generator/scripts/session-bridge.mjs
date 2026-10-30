import { unlink, mkdir, open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { inspectRuntime, runtimeRoot, runtimeEnvironment } from './runtime.mjs';

export { runtimeRoot, runtimeEnvironment };

export async function withPageSessionLock(root, operation, { timeoutMs = 15000 } = {}) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const file = path.join(root, '.session.lock');
  const started = Date.now();
  let handle;
  while (!handle) {
    try { handle = await open(file, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started >= timeoutMs) throw new Error('SESSION_BUSY');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid })); return await operation(); }
  finally { await handle.close(); await unlink(file); }
}

export function effectiveSession(session, now = Date.now()) {
  let url;
  try { url = new URL(session.origin); } catch { throw new Error('SESSION_ORIGIN_INVALID'); }
  if (!['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) || url.username || url.password || session.verifyTls !== true) throw new Error('SESSION_TLS_OR_ORIGIN_INVALID');
  const matches = (session.cookies || []).filter((cookie) => {
    const domain = String(cookie.domain).toLowerCase().replace(/^\./, '');
    return cookie.name === 'ETEAMSID' && typeof cookie.value === 'string' && cookie.value && !/[\s;\r\n]/.test(cookie.value) &&
      (cookie.hostOnly ? url.hostname === domain : url.hostname === domain || url.hostname.endsWith(`.${domain}`)) &&
      (!cookie.secure || url.protocol === 'https:') && (!cookie.path || cookie.path === '/') &&
      (cookie.expires == null || Number(cookie.expires) > Math.floor(now / 1000));
  });
  if (matches.length !== 1) throw new Error('SESSION_ETEAMSID_MISSING_OR_AMBIGUOUS');
  return { baseUrl: url.origin, eteamsId: matches[0].value };
}

export async function invalidatePageAuth(root = runtimeRoot()) {
  await unlink(path.join(root, 'state/auth/profile')).catch((error) => { if (error.code !== 'ENOENT') throw error; });
}

export async function syncSession(session, options = {}) {
  const root = options.runtimeRoot || runtimeRoot();
  const runtime = options.runtime || await inspectRuntime(root);
  if (runtime.status === 'not-installed') return { status: 'not-installed' };
  if (runtime.status !== 'installed') throw new Error('RUNTIME_INVALID');
  if (!options.lockHeld) return await withPageSessionLock(root, () => syncSession(session, { ...options, runtime, lockHeld: true }));
  try {
    const input = effectiveSession(session);
    const auth = options.authModule || await import(pathToFileURL(path.join(runtime.packageRoot, 'dist/environment-auth.js')).href);
    if (typeof auth.setEnvironmentAuth !== 'function') throw new Error('AUTH_BRIDGE_UNSUPPORTED');
    const result = await auth.setEnvironmentAuth({ ...input, env: runtimeEnvironment(root, process.env, true), ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) });
    if (result.baseUrl !== input.baseUrl || (options.expectedTenant && result.tenantKey !== options.expectedTenant) || (options.expectedUser && result.userId !== options.expectedUser)) throw new Error('IDENTITY_MISMATCH');
    return { status: 'synchronized', baseUrl: result.baseUrl, userId: result.userId, tenantKey: result.tenantKey, version: runtime.version };
  } catch {
    await invalidatePageAuth(root);
    throw new Error('PAGE_SESSION_SYNC_FAILED_OR_IDENTITY_MISMATCH');
  }
}
