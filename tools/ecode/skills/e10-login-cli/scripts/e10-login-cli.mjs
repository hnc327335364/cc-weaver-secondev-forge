import { constants, createDecipheriv, createHash, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto';
import { open, chmod, mkdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertSessionFileSecurity,
  secureWindowsSessionFile,
  SessionSecurityError,
} from './lib/session-security.mjs';

export class EnvironmentSessionError extends Error {}

const DEFAULT_AUTH_PATH = '/api/bs/workflow/pathdef/applyset/getHomePage';
const TENANTS_PATH = '/api/app/basicserver/siblingstenant/list';
const AES_SECRET = Buffer.from('yoJXYSzZhAOpbEFJklGtqd74X2ChTKOL');
const USER_AGENT = 'Mozilla/5.0 EnvironmentSession/1.1';
// 会话必须留在包外的用户私有目录，避免再次分发工具包时夹带凭据。
const DEFAULT_STATE_PATH = resolve(homedir(), '.weaver-cc-assistant/sessions/default.json');
const STORED_DIGEST = Symbol('stored-session-digest');
const sessionDigest = value => createHash('sha256').update(value).digest('hex');

function originOf(value, field = '环境地址') {
  let url;
  try { url = new URL(value); } catch { throw new EnvironmentSessionError(`${field}必须是有效的 http/https URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.host || url.username || url.password) {
    throw new EnvironmentSessionError(`${field}必须是有效的 http/https URL`);
  }
  return url.origin;
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value) throw new EnvironmentSessionError(`会话文件缺少${field}`);
  return value;
}

function isCookieForHost(cookie, hostname) {
  const domain = cookie.domain.replace(/^\./, '').toLowerCase();
  const host = hostname.toLowerCase();
  return host === domain || (!cookie.hostOnly && host.endsWith(`.${domain}`));
}

function isCookieForPath(cookie, pathname) {
  const path = cookie.path || '/';
  return pathname === path || (pathname.startsWith(path) && (path.endsWith('/') || pathname[path.length] === '/'));
}

function isUnexpiredCookie(cookie, now = Date.now()) {
  return cookie.expires === undefined || cookie.expires > Math.floor(now / 1000);
}

function cookiesForUrl(session, url) {
  return session.cookies
    .filter((cookie) => isCookieForHost(cookie, url.hostname))
    .filter((cookie) => !cookie.secure || url.protocol === 'https:')
    .filter((cookie) => isCookieForPath(cookie, url.pathname))
    .filter((cookie) => isUnexpiredCookie(cookie));
}

function parseFlags(argv, start, allowed, result) {
  for (let index = start; index < argv.length; index += 1) {
    const flag = argv[index];
    const definition = allowed[flag];
    if (!definition) throw new EnvironmentSessionError(`未知参数: ${flag}`);
    if (definition === true) {
      result[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = true;
      continue;
    }
    if (index + 1 === argv.length) throw new EnvironmentSessionError(`参数缺少值: ${flag}`);
    result[definition] = argv[++index];
  }
  return result;
}

export function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new EnvironmentSessionError('用法: login|tenants|current|switch|request [options]');
  }
  const command = argv[0];
  if (command === 'login') {
    const result = parseFlags(argv, 1, {
      '--url': 'url', '--account': 'account', '--password-stdin': true,
      '--tenant': 'tenant', '--state': 'statePath', '--insecure': true,
    }, {
      command, url: undefined, account: undefined, passwordStdin: false, tenant: undefined,
      statePath: DEFAULT_STATE_PATH, insecure: false,
    });
    if (!result.url || !result.account) throw new EnvironmentSessionError('login命令需要--url和--account');
    return result;
  }
  if (command === 'tenants' || command === 'current') {
    return parseFlags(argv, 1, { '--state': 'statePath' }, { command, statePath: DEFAULT_STATE_PATH });
  }
  if (command === 'switch') {
    if (!argv[1] || argv[1].startsWith('--')) throw new EnvironmentSessionError('switch命令缺少租户名称或tenantKey');
    return parseFlags(argv, 2, { '--state': 'statePath' }, { command, tenant: argv[1], statePath: DEFAULT_STATE_PATH });
  }
  if (command === 'request') {
    if (!argv[1] || argv[1].startsWith('--')) {
      throw new EnvironmentSessionError('用法: request <path> [--method METHOD] [--data JSON] [--state FILE]');
    }
    return parseFlags(argv, 2, {
      '--method': 'method', '--data': 'data', '--state': 'statePath',
    }, { command, path: argv[1], method: 'GET', data: undefined, statePath: DEFAULT_STATE_PATH });
  }
  throw new EnvironmentSessionError(`未知命令: ${command}`);
}

export async function loadSession(statePath) {
  try {
    await stat(statePath);
    // Upgrade sessions written by earlier Windows releases without asking the
    // user to authenticate again. e10-login-cli remains the only ACL writer.
    secureWindowsSessionFile(statePath);
    assertSessionFileSecurity(statePath);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new EnvironmentSessionError(`会话文件不存在: ${statePath}`);
    if (error instanceof SessionSecurityError) throw new EnvironmentSessionError(`会话文件安全校验失败: ${error.message}`);
    throw error;
  }
  let session, stored;
  try { stored = await readFile(statePath, 'utf8'); session = JSON.parse(stored); } catch (error) {
    if (error instanceof SyntaxError) throw new EnvironmentSessionError(`会话文件不是有效 JSON: ${statePath}`);
    throw error;
  }
  if (!session || typeof session !== 'object' || session.version !== 1) throw new EnvironmentSessionError('不支持的会话文件版本');
  const origin = originOf(requireString(session.origin, 'origin'), 'origin');
  originOf(requireString(session.targetUrl, 'targetUrl'), 'targetUrl');
  originOf(requireString(session.passportUrl, 'passportUrl'), 'passportUrl');
  if (session.verifyTls !== true) throw new EnvironmentSessionError('会话文件 verifyTls 必须为 true');
  if (!Array.isArray(session.cookies)) throw new EnvironmentSessionError('会话文件 cookies 格式无效');
  for (const cookie of session.cookies) {
    if (!cookie || typeof cookie !== 'object' || !requireString(cookie.name, 'cookie name') ||
      typeof cookie.value !== 'string' || !requireString(cookie.domain, 'cookie domain') ||
      (cookie.expires !== undefined && (!Number.isFinite(cookie.expires) || cookie.expires < 0))) {
      throw new EnvironmentSessionError('会话文件 cookies 格式无效');
    }
  }
  const host = new URL(origin).hostname;
  if (!session.cookies.some((cookie) => cookie.name === 'ETEAMSID' && cookie.value &&
    isCookieForHost(cookie, host) && isUnexpiredCookie(cookie))) throw new EnvironmentSessionError('会话文件缺少 ETEAMSID');
  const loaded = { ...session, origin, statePath: resolve(statePath), sensitive: [] };
  Object.defineProperty(loaded, STORED_DIGEST, {value:sessionDigest(stored), writable:true});
  return loaded;
}

export function cookieForPath(session, pathOrUrl) {
  const url = new URL(pathOrUrl, `${session.origin}/`);
  if (url.origin !== session.origin) throw new EnvironmentSessionError(`拒绝向登录环境之外发送认证请求: ${url.origin}`);
  return cookiesForUrl(session, url).map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

function defaultCookiePath(requestUrl) {
  if (!requestUrl) return '/';
  let pathname;
  try { pathname = new URL(requestUrl).pathname; } catch { return '/'; }
  if (!pathname.startsWith('/') || pathname === '/') return '/';
  const lastSlash = pathname.lastIndexOf('/');
  return lastSlash <= 0 ? '/' : pathname.slice(0, lastSlash);
}

export function parseSetCookie(value, requestUrl) {
  if (typeof value !== 'string' || !value.includes('=')) throw new EnvironmentSessionError('Set-Cookie 格式无效');
  const [nameValue, ...attributes] = value.split(';').map((item) => item.trim());
  const separator = nameValue.indexOf('=');
  const requestPath = defaultCookiePath(requestUrl);
  const cookie = {
    name: nameValue.slice(0, separator), value: nameValue.slice(separator + 1), path: requestPath, domain: undefined,
    secure: false, expires: undefined, discard: true, rest: {},
  };
  let maxAge;
  if (!cookie.name) throw new EnvironmentSessionError('Set-Cookie 格式无效');
  for (const attribute of attributes) {
    const [key, ...rest] = attribute.split('=');
    const normalized = key.toLowerCase();
    const attributeValue = rest.join('=');
    if (normalized === 'path') cookie.path = attributeValue.startsWith('/') ? attributeValue : requestPath;
    else if (normalized === 'domain') cookie.domain = attributeValue;
    else if (normalized === 'secure') cookie.secure = true;
    else if (normalized === 'httponly') cookie.rest.HttpOnly = true;
    else if (normalized === 'max-age' && /^-?\d+$/.test(attributeValue.trim())) {
      const parsed = Number(attributeValue);
      if (Number.isFinite(parsed)) maxAge = parsed;
    }
    else if (normalized === 'expires') {
      const expires = Date.parse(attributeValue);
      if (!Number.isNaN(expires)) { cookie.expires = Math.floor(expires / 1000); cookie.discard = false; }
    }
  }
  if (maxAge !== undefined) {
    cookie.expires = Math.floor(Date.now() / 1000) + Math.max(0, maxAge);
    cookie.discard = false;
  }
  return cookie;
}

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name);
  const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

function setCookieValues(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const value = headerValue(headers, 'set-cookie');
  if (Array.isArray(value)) return value;
  return typeof value === 'string' ? [value] : [];
}

function applySetCookies(session, response, requestUrl) {
  const url = new URL(requestUrl);
  for (const value of setCookieValues(response.headers)) {
    const cookie = parseSetCookie(value, url);
    if (!cookie.domain) { cookie.domain = url.hostname; cookie.hostOnly = true; }
    if (!isCookieForHost(cookie, url.hostname)) continue;
    session.cookies = session.cookies.filter((existing) => !(
      existing.name === cookie.name && existing.domain === cookie.domain && (existing.path || '/') === cookie.path
    ));
    if (cookie.value && isUnexpiredCookie(cookie)) session.cookies.push(cookie);
    if (cookie.value) session.sensitive?.push(cookie.value);
  }
}

function parseResponseBody(raw, headers) {
  const text = raw.toString('utf8');
  const contentType = String(headerValue(headers, 'content-type') || '');
  if (contentType.includes('json') || /^[\s]*[\[{]/.test(text)) {
    try { return JSON.parse(text); } catch { return text; }
  }
  return text;
}

async function nodeRequest(urlValue, options = {}) {
  const url = new URL(urlValue);
  const transport = url.protocol === 'https:' ? https : http;
  const body = options.jsonBody === undefined ? options.body : JSON.stringify(options.jsonBody);
  const headers = { ...options.headers };
  if (options.jsonBody !== undefined) headers['Content-Type'] ??= 'application/json;charset=UTF-8';
  if (body !== undefined) headers['Content-Length'] ??= Buffer.byteLength(body);
  return new Promise((resolvePromise, rejectPromise) => {
    const request = transport.request(url, {
      method: (options.method || 'GET').toUpperCase(), headers, timeout: 30_000,
      ...(url.protocol === 'https:' ? { rejectUnauthorized: options.verifyTls !== false } : {}),
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const responseHeaders = { ...response.headers };
        resolvePromise({ status: response.statusCode || 0, url: url.href, headers: responseHeaders,
          body: parseResponseBody(Buffer.concat(chunks), responseHeaders) });
      });
    });
    request.on('timeout', () => request.destroy(new Error('请求超时')));
    request.on('error', (error) => rejectPromise(new EnvironmentSessionError(`请求失败: ${error.message}`)));
    if (body !== undefined) request.write(body);
    request.end();
  });
}

function requestAdapter(io) {
  if (typeof io.requestImpl === 'function') return io.requestImpl;
  if (typeof io.fetch === 'function') {
    return async (url, options = {}) => {
      const body = options.jsonBody === undefined ? options.body : JSON.stringify(options.jsonBody);
      const response = await io.fetch(new URL(url), {
        method: (options.method || 'GET').toUpperCase(), headers: options.headers, body, redirect: 'error',
      });
      let responseBody = response.body;
      if (typeof response.text === 'function') {
        const raw = await response.text();
        responseBody = parseResponseBody(Buffer.from(raw), response.headers);
      }
      return { status: response.status, url: response.url || String(url), headers: response.headers || {}, body: responseBody };
    };
  }
  return nodeRequest;
}

async function perform(session, requestImpl, urlValue, options = {}) {
  const url = new URL(urlValue, `${session.origin}/`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new EnvironmentSessionError('请求地址必须是 http/https URL');
  if (options.sameOrigin !== false && url.origin !== session.origin) {
    throw new EnvironmentSessionError(`拒绝向登录环境之外发送认证请求: ${url.origin}`);
  }
  const headers = { Accept: 'application/json, text/plain, */*', 'User-Agent': USER_AGENT, ...(options.headers || {}) };
  if (options.includeCookies !== false && url.origin === session.origin) {
    const matching = cookiesForUrl(session, url);
    if (matching.length) headers.Cookie = matching.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    if (options.authHeader !== false) {
      const sid = matching.find((cookie) => cookie.name === 'ETEAMSID');
      if (sid?.value) headers.ETEAMSID = sid.value;
    }
  }
  const response = await requestImpl(url, {
    method: (options.method || 'GET').toUpperCase(), headers, jsonBody: options.jsonBody,
    body: options.body, verifyTls: session.verifyTls, redirect: 'error',
  });
  const responseUrl = new URL(response.url || url.href, url);
  if (responseUrl.origin !== url.origin) throw new EnvironmentSessionError(`请求发生跨源跳转: ${responseUrl.origin}`);
  const normalized = { status: response.status, url: responseUrl.href, headers: response.headers || {}, body: response.body };
  if (options.captureCookies !== false && url.origin === session.origin) applySetCookies(session, normalized, url);
  return normalized;
}

function failed(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (body.status === false || body.success === false || body.fail === true) return true;
  const code = body.code ?? body.statusCode;
  return code !== undefined && !['0', '200'].includes(String(code));
}

function responseMessage(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '';
  const error = body.data && typeof body.data === 'object' ? body.data.errorMsg : undefined;
  if (error && typeof error === 'object') return String(error.msg || error.message || '');
  return String(body.msg || body.message || '');
}

function requireJson(response, operation) {
  if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
    throw new EnvironmentSessionError(`${operation}返回 HTTP ${response.status}`);
  }
  if (!response.body || typeof response.body !== 'object' || Array.isArray(response.body)) {
    throw new EnvironmentSessionError(`${operation}未返回 JSON`);
  }
  if (failed(response.body)) {
    const detail = responseMessage(response.body);
    throw new EnvironmentSessionError(`${operation}失败${detail ? `: ${detail}` : ''}`);
  }
  return response.body;
}

function parseTenants(body) {
  let value = body && typeof body === 'object' ? body.data : body;
  if (value && typeof value === 'object' && !Array.isArray(value)) value = value.data ?? value.list;
  if (!Array.isArray(value) || value.length === 0) throw new EnvironmentSessionError('租户接口未返回可用列表');
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new EnvironmentSessionError(`租户列表第 ${index + 1} 项不是对象`);
    const tenantKey = String(raw.tenantKey || '').trim();
    const tenantName = String(raw.tenantName || raw.name || '').trim();
    const employeeId = String(raw.employeeId || raw.empId || raw.id || '').trim();
    if (!tenantKey || !tenantName || !employeeId) throw new EnvironmentSessionError(`租户列表第 ${index + 1} 项字段不完整`);
    const currentValue = raw.current ?? raw.isCurrent ?? raw.default ?? false;
    return { tenantKey, tenantName, employeeId, current: ['1', 'true'].includes(String(currentValue).toLowerCase()), raw };
  });
}

function selectTenant(tenants, requested) {
  if (typeof requested !== 'string' || !requested.trim()) {
    const current = tenants.filter((tenant) => tenant.current);
    if (current.length === 1) return current[0];
    if (current.length === 0 && tenants.length === 1) return tenants[0];
    throw new EnvironmentSessionError(`租户列表中 current 项数量为 ${current.length}`);
  }
  const value = requested.trim();
  let matches = tenants.filter((tenant) => tenant.tenantKey === value);
  if (matches.length === 0) matches = tenants.filter((tenant) => tenant.tenantName === value);
  if (matches.length === 1) return matches[0];
  const current = matches.filter((tenant) => tenant.current);
  if (current.length === 1) return current[0];
  if (matches.length === 0) throw new EnvironmentSessionError(`找不到指定租户: ${value}`);
  throw new EnvironmentSessionError('指定租户匹配到多个身份，请使用唯一 tenantKey');
}

async function getTenants(session, requestImpl) {
  return parseTenants(requireJson(await perform(session, requestImpl, TENANTS_PATH), '获取租户'));
}

async function getCurrentTenant(session, requestImpl) {
  return selectTenant(await getTenants(session, requestImpl));
}

function currentSid(session) {
  const url = new URL(session.origin);
  return cookiesForUrl(session, url).find((cookie) => cookie.name === 'ETEAMSID')?.value || '';
}

function decodePublicKey(encryptedHex) {
  if (typeof encryptedHex !== 'string' || !encryptedHex || encryptedHex.length % 2 || !/^[0-9a-f]+$/i.test(encryptedHex)) {
    throw new EnvironmentSessionError('环境返回的 RSA 公钥格式无效');
  }
  try {
    const first = createHash('sha1').update(AES_SECRET).digest();
    const key = createHash('sha1').update(first).digest().subarray(0, 16);
    const decipher = createDecipheriv('aes-128-ecb', key, null);
    const encoded = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('ascii');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error('invalid base64');
    return createPublicKey({ key: Buffer.from(encoded, 'base64'), format: 'der', type: 'spki' });
  } catch { throw new EnvironmentSessionError('无法解开环境 RSA 公钥'); }
}

function encryptField(publicKey, value) {
  return publicEncrypt({ key: publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(value, 'utf8')).toString('base64');
}

async function exchangeTicket(session, requestImpl, redirectValue) {
  let redirect;
  try { redirect = new URL(redirectValue); } catch { throw new EnvironmentSessionError('登录跳转地址无效'); }
  const tickets = redirect.searchParams.getAll('ticket');
  if (tickets.length !== 1 || !tickets[0]) throw new EnvironmentSessionError('登录跳转地址缺少唯一 ticket');
  if (redirect.origin !== session.origin) throw new EnvironmentSessionError(`拒绝向登录环境之外发送认证请求: ${redirect.origin}`);
  const ticket = tickets[0];
  session.sensitive.push(ticket);
  redirect.searchParams.delete('ticket');
  const service = redirect.href;
  const clearUrl = new URL('/papi/app/baseserver/clearCookieByName', session.origin);
  clearUrl.searchParams.set('cookieNames', 'ETEAMSID,WECHAT_ETEAMSID');
  clearUrl.searchParams.set('service', session.origin);
  const clearBody = requireJson(await perform(session, requestImpl, clearUrl, {
    authHeader: false, captureCookies: true,
  }), '清理旧环境 Cookie');
  const payload = { ticket, service };
  if (clearBody.data && typeof clearBody.data === 'object' && clearBody.data.ETEAMSID) {
    payload.eteamsid = clearBody.data.ETEAMSID;
    session.sensitive.push(String(clearBody.data.ETEAMSID));
  }
  requireJson(await perform(session, requestImpl, '/papi/baseserver/layout/checkTicket', {
    method: 'POST', jsonBody: payload, authHeader: false, captureCookies: true,
  }), '交换登录 ticket');
  if (!currentSid(session)) throw new EnvironmentSessionError('ticket 已交换，但环境未写入 ETEAMSID');
}

function clearAuthCookies(session) {
  session.cookies = session.cookies.filter((cookie) => !['ETEAMSID', 'WECHAT_ETEAMSID'].includes(cookie.name));
}

async function verifySession(session, requestImpl) {
  const response = await perform(session, requestImpl, DEFAULT_AUTH_PATH);
  requireJson(response, '登录鉴权');
  if (new URL(response.url).origin !== session.origin) throw new EnvironmentSessionError('登录鉴权跳转到了其他环境');
}

async function withStateCommitLock(target, action) {
  const lock = `${target}.lock`, deadline = Date.now() + 15000;
  let handle;
  while (!handle) {
    try { handle = await open(lock, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new EnvironmentSessionError('主会话正在更新；请稍后重试，不自动删除会话锁');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  try { await handle.writeFile(String(process.pid)); return await action(); }
  finally { await handle.close(); await unlink(lock); }
}

async function saveSession(session, statePath, {compareStored = false} = {}) {
  const target = resolve(statePath);
  const parent = dirname(target);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await chmod(parent, 0o700);
  return await withStateCommitLock(target, async () => {
    if (compareStored) {
      let current;
      try { current = sessionDigest(await readFile(target)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!session[STORED_DIGEST] || current !== session[STORED_DIGEST]) {
        throw new EnvironmentSessionError('主会话在验证期间已更新，请重新同步');
      }
    }
    const payload = {
      version: 1, origin: session.origin, targetUrl: session.targetUrl, passportUrl: session.passportUrl,
      verifyTls: session.verifyTls, savedAt: new Date().toISOString(), cookies: session.cookies,
    };
    const temporary = `${target}.${process.pid}.${randomBytes(6).toString('hex')}`;
    const serialized = `${JSON.stringify(payload, null, 2)}\n`;
    let handle;
    try {
      handle = await open(temporary, 'wx', 0o600);
      // Apply a protected owner-only Windows DACL before writing credentials.
      secureWindowsSessionFile(temporary);
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, target);
      if (process.platform !== 'win32') await chmod(target, 0o600);
      assertSessionFileSecurity(target);
    } catch (error) {
      await handle?.close().catch(() => {});
      await unlink(temporary).catch(() => {});
      throw error;
    }
    session.statePath = target;
    Object.defineProperty(session, STORED_DIGEST, {value:sessionDigest(serialized), writable:true});
    return target;
  });
}

function readHiddenPassword(stdin) {
  if (!stdin?.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new EnvironmentSessionError('非交互输入密码必须显式使用--password-stdin');
  }
  return new Promise((resolvePromise, rejectPromise) => {
    let value = '';
    const wasRaw = Boolean(stdin.isRaw);
    const wasPaused = typeof stdin.isPaused === 'function' ? stdin.isPaused() : false;
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.removeListener('error', onError);
      stdin.setRawMode(wasRaw);
      if (wasPaused && typeof stdin.pause === 'function') stdin.pause();
    };
    const finish = (result) => { cleanup(); resolvePromise(result); };
    const onError = (error) => { cleanup(); rejectPromise(error); };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === '\r' || character === '\n' || character === '\u0004') return finish(value);
        if (character === '\u0003') return onError(new EnvironmentSessionError('密码输入已取消'));
        if (character === '\b' || character === '\u007f') value = Array.from(value).slice(0, -1).join('');
        else value += character;
      }
    };
    try {
      stdin.setRawMode(true);
      stdin.on('data', onData);
      stdin.on('error', onError);
      stdin.resume();
    } catch (error) {
      cleanup();
      rejectPromise(error);
    }
  });
}

async function readPassword(stdin, passwordStdin) {
  if (!passwordStdin) return readHiddenPassword(stdin);
  if (!stdin || typeof stdin[Symbol.asyncIterator] !== 'function') throw new EnvironmentSessionError('无法从标准输入读取密码');
  let value = '';
  for await (const chunk of stdin) {
    value += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    const lineEnd = value.search(/[\r\n]/);
    if (lineEnd !== -1) return value.slice(0, lineEnd);
  }
  return value.replace(/[\r\n]+$/, '');
}

async function switchTenant(session, requestImpl, requested) {
  const tenants = await getTenants(session, requestImpl);
  const selected = selectTenant(tenants, requested);
  const current = selectTenant(tenants);
  if (selected.employeeId === current.employeeId) return current;
  const oldToken = currentSid(session);
  if (!oldToken) throw new EnvironmentSessionError('当前会话缺少 ETEAMSID');
  session.sensitive.push(oldToken);
  const sso = requireJson(await perform(session, requestImpl, '/papi/passport/checkTenant/ssoCheck', {
    method: 'POST',
    jsonBody: { targetEmployeeId: selected.employeeId, targetTenantKey: selected.tenantKey, eteamsid: oldToken },
  }), '租户单点校验');
  const data = sso.data;
  let switchUrl;
  if (data && typeof data === 'object' && data.changeInfo) {
    session.sensitive.push(String(data.changeInfo));
    const targetOrigin = originOf(String(data.targetDomain || ''), 'targetDomain');
    if (targetOrigin !== session.origin) {
      throw new EnvironmentSessionError(`拒绝向登录环境之外发送认证请求: ${targetOrigin}`);
    }
    switchUrl = new URL('/papi/passport/changeTenant/ssoChange', targetOrigin);
    switchUrl.searchParams.set('service', targetOrigin);
    switchUrl.searchParams.set('changeInfo', String(data.changeInfo));
  } else {
    if (session.passportUrl !== session.origin) {
      throw new EnvironmentSessionError(`拒绝向登录环境之外发送认证请求: ${session.passportUrl}`);
    }
    switchUrl = new URL(`/papi/passport/changeTenantNew/${encodeURIComponent(selected.employeeId)}`, session.passportUrl);
    switchUrl.searchParams.set('service', session.origin);
    switchUrl.searchParams.set('ETEAMSID', oldToken);
  }
  clearAuthCookies(session);
  const switched = await perform(session, requestImpl, switchUrl, {
    authHeader: false, includeCookies: false, captureCookies: false,
  });
  const location = headerValue(switched.headers, 'location');
  let redirectUrl;
  if (switched.status >= 300 && switched.status < 400 && location) {
    redirectUrl = new URL(location, switchUrl).href;
  } else {
    const switchBody = requireJson(switched, '租户切换');
    if (switchBody.data && typeof switchBody.data === 'object' && switchBody.data.redirectUrl) {
      redirectUrl = String(switchBody.data.redirectUrl);
    } else if (location) {
      redirectUrl = new URL(location, switchUrl).href;
    } else {
      throw new EnvironmentSessionError('租户切换响应缺少 redirectUrl');
    }
  }
  await exchangeTicket(session, requestImpl, redirectUrl);
  const actual = await getCurrentTenant(session, requestImpl);
  if (actual.tenantKey !== selected.tenantKey) {
    throw new EnvironmentSessionError(`租户切换后 current 不一致: 期望 ${selected.tenantKey}，实际 ${actual.tenantKey}`);
  }
  await verifySession(session, requestImpl);
  await saveSession(session, session.statePath);
  return actual;
}

async function synchronizePageAgent(session, current, io) {
  try {
    const identity = {expectedTenant:current.tenantKey, expectedUser:current.employeeId};
    if (io.onSession) return await io.onSession(session, identity);
    const bridge = await import('../../weaver-e10-page-generator/scripts/session-bridge.mjs');
    return await bridge.syncSession(session, identity);
  } catch {
    return {status:'sync-failed',message:'E10 登录仍有效，页面工具会话不可用；修复后通过 page-agent sync 重试。'};
  }
}

export async function pageAgentSessionContext(statePath, io = {}) {
  const session = await loadSession(statePath);
  const current = await getCurrentTenant(session, requestAdapter(io));
  await verifySession(session, requestAdapter(io));
  await saveSession(session, statePath, {compareStored:true});
  return {session, expectedTenant:current.tenantKey, expectedUser:current.employeeId};
}

async function login(args, io, requestImpl, sensitive) {
  const password = await readPassword(io.stdin ?? process.stdin, args.passwordStdin);
  sensitive.push(password);
  if (!args.account || !password) throw new EnvironmentSessionError('账号和密码不能为空');
  const origin = originOf(args.url);
  const discoverySession = { origin, targetUrl: args.url, passportUrl: origin, verifyTls: !args.insecure, cookies: [], sensitive };
  const discoveryUrl = new URL('/papi/app/baseserver/info/getUrlInfo', origin);
  discoveryUrl.searchParams.set('type', 'pc');
  discoveryUrl.searchParams.set('service', origin);
  const discovery = requireJson(await perform(discoverySession, requestImpl, discoveryUrl, {
    authHeader: false, includeCookies: false, captureCookies: false,
  }), '获取环境登录配置').data;
  if (!discovery || typeof discovery !== 'object' || !discovery.passportUrl || !discovery.publicKey) {
    throw new EnvironmentSessionError('环境登录配置缺少 passportUrl 或 publicKey');
  }
  const passportUrl = originOf(String(discovery.passportUrl), 'passportUrl');
  const publicKey = decodePublicKey(String(discovery.publicKey));
  const session = {
    version: 1, origin, targetUrl: args.url, passportUrl, verifyTls: !args.insecure,
    cookies: [], sensitive, statePath: resolve(args.statePath),
  };
  const loginQuery = new URLSearchParams({ service: args.url }).toString();
  const loginBody = requireJson(await perform(session, requestImpl, `${passportUrl}/papi/passport/login/pclogin`, {
    method: 'POST',
    jsonBody: {
      account: encryptField(publicKey, args.account), password: encryptField(publicKey, password),
      registerDataSource: '', registerSource: '', registerSourceUrl: '', moduleSource: '', integratedLoginId: '',
      agreementChecked: '0', service: args.url,
      teamsInfo: JSON.stringify({ urlSearchParams: `?${loginQuery}` }), devType: '72', passportCusLoginDomain: passportUrl,
    },
    headers: { langType: 'zh_CN', Origin: passportUrl, Referer: `${passportUrl}/` },
    sameOrigin: false, authHeader: false, includeCookies: false, captureCookies: false,
  }), '账号登录').data;
  if (!loginBody || typeof loginBody !== 'object') throw new EnvironmentSessionError('账号登录响应缺少 data');
  if (loginBody.needCheckAgreement) throw new EnvironmentSessionError('账号需要先在登录页确认专属隐私协议');
  if (loginBody.blockType) throw new EnvironmentSessionError(`账号登录需要额外安全验证: ${loginBody.blockType}`);
  if (!loginBody.redirectUrl) throw new EnvironmentSessionError('账号登录成功但未返回 redirectUrl');
  await exchangeTicket(session, requestImpl, String(loginBody.redirectUrl));
  let current = await getCurrentTenant(session, requestImpl);
  if (args.tenant && ![current.tenantKey, current.tenantName].includes(args.tenant)) current = await switchTenant(session, requestImpl, args.tenant);
  await verifySession(session, requestImpl);
  const statePath = await saveSession(session, args.statePath);
  const pageAgent = await synchronizePageAgent(session, current, io);
  return { authenticated: true, origin: session.origin, currentTenant: current.raw, statePath, pageAgent };
}

function redact(message, sensitive) {
  let result = String(message);
  for (const value of sensitive) if (typeof value === 'string' && value) result = result.split(value).join('[REDACTED]');
  return result;
}

function sanitizeOutput(value, sensitive) {
  if (Array.isArray(value)) return value.map((item) => sanitizeOutput(item, sensitive));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /password|passphrase|credential|cookie|eteamsid|ticket|changeinfo|authorization|privatekey|publickey|(?:access|refresh|auth|id)?token$|apikey$|clientsecret$|secret$|sessionid$/i.test(key.replace(/[^a-z0-9]/gi, ''))
        ? '[REDACTED]'
        : sanitizeOutput(item, sensitive),
    ]));
  }
  return typeof value === 'string' ? redact(value, sensitive) : value;
}

export async function runCli(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const sensitive = [];
  try {
    const args = parseArguments(argv);
    const requestImpl = requestAdapter(io);
    let result;
    if (args.command === 'login') {
      result = await login(args, io, requestImpl, sensitive);
    } else {
      const session = await loadSession(args.statePath);
      session.sensitive = sensitive;
      sensitive.push(...session.cookies.map((cookie) => cookie.value).filter(Boolean));
      if (args.command === 'tenants') result = (await getTenants(session, requestImpl)).map((tenant) => tenant.raw);
      else if (args.command === 'current') result = (await getCurrentTenant(session, requestImpl)).raw;
      else if (args.command === 'switch') {
        const current = await switchTenant(session, requestImpl, args.tenant);
        result = {...current.raw,pageAgent:await synchronizePageAgent(session,current,io)};
      }
      else {
        let jsonBody;
        if (args.data !== undefined) jsonBody = JSON.parse(args.data);
        const response = await perform(session, requestImpl, args.path, { method: args.method, jsonBody });
        result = { status: response.status, url: response.url, body: response.body };
      }
    }
    stdout.write(`${JSON.stringify(sanitizeOutput(result, sensitive))}\n`);
    return 0;
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : '未知错误', sensitive);
    stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
