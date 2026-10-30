import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { CliError, EXIT } from './errors.mjs';
import { prepareTransport } from './transport-crypto.mjs';

const VERSION_CODES = new Set([9105323, 9105324]);
const PERMISSION_CODES = new Set([1052, 1056, 1803, 9105312]);

function queryString(query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

function businessFailure(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return payload.fail === true || payload.status === false;
}

function messageOf(payload, fallback) {
  return String(payload?.msg || payload?.message || fallback);
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function validAppId(value) {
  const id = text(value);
  return /^\d+$/.test(id) && BigInt(id) > 0n ? id : '';
}

function uniqueMatch(candidates, predicate, usedIds) {
  const matches = candidates.filter((candidate) => {
    const id = validAppId(candidate?.id);
    return id && !usedIds.has(id) && predicate(candidate);
  });
  return matches.length === 1 ? matches[0] : null;
}

function matchImportedApplications(packageFolders, treeFolders, baseUrl) {
  const candidates = Array.isArray(treeFolders) ? treeFolders : [];
  const usedIds = new Set();
  const warnings = [];
  const applications = packageFolders.map((source) => {
    const uuid = text(source.appUUID);
    const name = text(source.name);
    const normalizedName = name.toLocaleLowerCase();
    let match;
    let matchedBy;

    if (uuid) {
      match = uniqueMatch(candidates, (candidate) => text(candidate.appUUID) === uuid, usedIds);
      if (match) matchedBy = 'appUUID';
    }
    if (!match && normalizedName) {
      match = uniqueMatch(candidates, (candidate) => text(candidate.name).toLocaleLowerCase() === normalizedName, usedIds);
      if (match) matchedBy = 'name';
    }
    if (!match && normalizedName.length >= 3) {
      match = uniqueMatch(candidates, (candidate) => {
        const candidateName = text(candidate.name).toLocaleLowerCase();
        return candidateName && (candidateName.includes(normalizedName) || normalizedName.includes(candidateName));
      }, usedIds);
      if (match) matchedBy = 'keyword';
    }

    const base = { packageId: source.id, appUUID: source.appUUID, name: source.name };
    if (!match) {
      warnings.push({
        code: 'IMPORTED_APP_NOT_RESOLVED',
        message: `Imported application could not be uniquely resolved in project tree: ${name || uuid || source.id}`,
      });
      return { ...base, appId: null, pageUrl: null };
    }
    const appId = validAppId(match.id);
    usedIds.add(appId);
    return {
      ...base,
      appId,
      pageUrl: `${baseUrl}/ecode/main/item/${appId}`,
      matchedBy,
      releaseFlag: match.releaseFlag,
    };
  });
  return { applications, warnings };
}

export class EcodeClient {
  constructor(session, { fetchImpl = globalThis.fetch, timeoutMs = 30_000 } = {}) {
    if (typeof fetchImpl !== 'function') throw new CliError('RUNTIME_UNSUPPORTED', 'Node 18 or newer is required', { exitCode: EXIT.INPUT });
    this.session = session;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, { method = 'GET', query, form, multipart, timeoutMs, rawStatus = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || this.timeoutMs);
    const headers = {
      accept: 'application/json',
      cookie: typeof this.session.cookieForPath === 'function' ? this.session.cookieForPath(path) : this.session.cookie,
      origin: this.session.baseUrl,
      'user-agent': this.session.userAgent,
    };
    let body;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      body = new URLSearchParams();
      for (const [key, value] of Object.entries(form)) {
        if (value !== undefined && value !== null) body.set(key, String(value));
      }
    } else if (multipart) {
      body = multipart;
    }
    let response;
    try {
      response = await this.fetchImpl(`${this.session.baseUrl}${path}${queryString(query)}`, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      throw new CliError(timedOut ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR', timedOut ? 'ECode request timed out' : 'ECode service is unreachable', {
        exitCode: EXIT.NETWORK,
        details: { cause: error?.code || error?.name },
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      throw new CliError('AUTH_EXPIRED', 'ECode redirected to login; refresh authentication with e10-login-cli', { exitCode: EXIT.AUTH, code: response.status });
    }
    if (response.status === 401) throw new CliError('AUTH_EXPIRED', 'ECode authentication is no longer valid; refresh it with e10-login-cli', { exitCode: EXIT.AUTH, code: 401 });
    if (response.status === 403) throw new CliError('PERMISSION_DENIED', 'Current ECode user lacks permission', { exitCode: EXIT.BUSINESS, code: 403 });

    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new CliError(response.ok ? 'INVALID_RESPONSE' : 'HTTP_ERROR', 'ECode returned a non-JSON response', {
        exitCode: response.ok ? EXIT.BUSINESS : EXIT.HTTP,
        code: response.status,
      });
    }
    if (!response.ok) {
      throw new CliError('HTTP_ERROR', messageOf(payload, `ECode HTTP ${response.status}`), {
        exitCode: EXIT.HTTP,
        code: response.status,
        details: { serverCode: payload?.code },
      });
    }
    if (!rawStatus && businessFailure(payload)) {
      const code = Number(payload.code);
      const type = VERSION_CODES.has(code)
        ? 'VERSION_CONFLICT'
        : PERMISSION_CODES.has(code) ? 'PERMISSION_DENIED' : 'ECODE_ERROR';
      throw new CliError(type, messageOf(payload, 'ECode operation failed'), {
        exitCode: VERSION_CODES.has(code) ? EXIT.VERSION_CONFLICT : EXIT.BUSINESS,
        code: payload.code,
        details: payload.data === undefined ? undefined : { serverData: payload.data },
      });
    }
    return {
      data: Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload,
      warnings: Number(payload.code) === 210 ? [{ code: '210', message: messageOf(payload, 'ECode operation completed with warning') }] : [],
    };
  }

  async requestBinary(path, { timeoutMs } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || this.timeoutMs);
    const headers = {
      accept: '*/*',
      cookie: typeof this.session.cookieForPath === 'function' ? this.session.cookieForPath(path) : this.session.cookie,
      origin: this.session.baseUrl,
      'user-agent': this.session.userAgent,
    };
    let response;
    try {
      response = await this.fetchImpl(`${this.session.baseUrl}${path}`, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      throw new CliError(timedOut ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR', timedOut ? 'ECode resource request timed out' : 'ECode resource service is unreachable', {
        exitCode: EXIT.NETWORK,
        details: { cause: error?.code || error?.name },
      });
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400) {
      throw new CliError('AUTH_EXPIRED', 'ECode resource request redirected to login; refresh authentication with e10-login-cli', { exitCode: EXIT.AUTH, code: response.status });
    }
    if (response.status === 401) throw new CliError('AUTH_EXPIRED', 'ECode authentication is no longer valid; refresh it with e10-login-cli', { exitCode: EXIT.AUTH, code: 401 });
    if (response.status === 403) throw new CliError('PERMISSION_DENIED', 'Current ECode user lacks resource permission', { exitCode: EXIT.BUSINESS, code: 403 });
    if (!response.ok) {
      throw new CliError('HTTP_ERROR', `ECode resource HTTP ${response.status}`, { exitCode: EXIT.HTTP, code: response.status });
    }
    return { data: Buffer.from(await response.arrayBuffer()), warnings: [] };
  }

  async systemVersion() {
    const result = await this.request('/api/security/license/getVersion');
    let info = result.data;
    if (typeof info === 'string') {
      try { info = JSON.parse(info); } catch {
        throw new CliError('INVALID_RESPONSE', 'E10 version data is not valid JSON', { exitCode: EXIT.BUSINESS });
      }
    }
    if (!info || typeof info !== 'object' || Array.isArray(info) ||
        typeof info.version !== 'string' || !/^\d+(?:\.\d+){3}$/.test(info.version)) {
      throw new CliError('INVALID_RESPONSE', 'E10 baseline version is missing or invalid', { exitCode: EXIT.BUSINESS });
    }
    return { data: { version: info.version, versionShowSwitch: info.versionShowSwitch ?? null }, warnings: result.warnings };
  }

  async projectList(filters = {}) {
    const list = [];
    let page = 1;
    let count = 0;
    let hasMore = true;
    while (hasMore) {
      if (page > 10_000) throw new CliError('INVALID_RESPONSE', 'Project pagination did not terminate', { exitCode: EXIT.BUSINESS });
      const result = await this.request('/api/ecode/project/searchAll', {
        query: {
          name: filters.name,
          appName: filters.appName,
          appId: filters.appId,
          systemProject: filters.systemProject,
          type: filters.type,
          page,
          size: 100,
        },
      });
      const pageData = result.data || {};
      if (!Array.isArray(pageData.list)) throw new CliError('INVALID_RESPONSE', 'Project list response is missing list', { exitCode: EXIT.BUSINESS });
      list.push(...pageData.list);
      count = Number(pageData.count ?? list.length);
      hasMore = Boolean(pageData.hasMore);
      page += 1;
    }
    return { data: { list, count }, warnings: [] };
  }

  treeList(parentId) {
    return this.request('/api/ecode/tree/list', { query: { parentId } });
  }

  resourceDownload(appId, name) {
    return this.requestBinary(`/api/ecode/resource/view/${encodeURIComponent(appId)}/${encodeURIComponent(name)}`);
  }

  appCreate({ projectId, name, projectType = 'react', vue = false, theme = false }) {
    return this.request('/api/ecode/folder/addChildProject', {
      method: 'POST',
      form: { parentId: projectId, name, projectType, isVue: vue ? 1 : 0, isTheme: theme ? 1 : 0 },
    });
  }

  folderCreate({ parentId, name }) {
    return this.request('/api/ecode/folder/add', { method: 'POST', form: { parentId, name } });
  }

  fileCreate({ parentId, name, type }) {
    return this.request('/api/ecode/code/add', { method: 'POST', form: { parentId, name, type } });
  }

  fileGet(id) {
    return this.request(`/api/ecode/code/getById/${encodeURIComponent(id)}`);
  }

  securityInfo() {
    return this.request('/papi/security/isEnableEncryptedTrans', { rawStatus: true });
  }

  async fileUpdate({ id, source, compiled }) {
    const current = await this.fileGet(id);
    const sourceId = current.data?.sourceId;
    if (sourceId === undefined || sourceId === null) {
      throw new CliError('INVALID_RESPONSE', 'File response is missing sourceId', { exitCode: EXIT.BUSINESS });
    }
    const security = await this.securityInfo();
    const encoded = [Buffer.from(source, 'utf8').toString('base64'), Buffer.from(compiled, 'utf8').toString('base64')];
    const transport = prepareTransport(encoded, security.data || {});
    const updated = await this.request(`/api/ecode/code/update/${encodeURIComponent(id)}`, {
      method: 'POST',
      form: {
        content: transport.encrypted[0],
        compileContent: transport.encrypted[1],
        sourceId,
        encryptKey: transport.key,
      },
    });
    return {
      data: { sourceId: updated.data, transport: transport.mode },
      warnings: updated.warnings,
    };
  }

  async packageCheckUpload({ file, projectId }) {
    let stat;
    try {
      stat = statSync(file);
    } catch {
      throw new CliError('LOCAL_FILE_ERROR', 'Cannot read ECode package file', { exitCode: EXIT.FILE, details: { path: file } });
    }
    if (!stat.isFile()) throw new CliError('LOCAL_FILE_ERROR', 'Package path is not a file', { exitCode: EXIT.FILE });
    const form = new FormData();
    form.set('file', new Blob([readFileSync(file)], { type: 'application/zip' }), basename(file));
    form.set('projectId', String(projectId));
    return this.request('/api/ecode/folder/importCheck', { method: 'POST', multipart: form, timeoutMs: 300_000 });
  }

  async packageCheck({ file, projectId }) {
    const checked = await this.packageCheckUpload({ file, projectId });
    const payload = checked.data || {};
    if (!Array.isArray(payload.rootFolders) || payload.rootFolders.length === 0) {
      throw new CliError('INVALID_PACKAGE', 'ECode package contains no applications', { exitCode: EXIT.BUSINESS });
    }
    const summarize = (folder) => ({
      id: folder.id,
      appUUID: folder.appUUID,
      name: folder.name,
      version: folder.version,
      treeType: folder.treeType,
      releaseFlag: folder.releaseFlag,
    });
    const existing = Array.isArray(payload.currentRootFolders) ? payload.currentRootFolders : [];
    const existingByUuid = new Map(existing
      .filter((folder) => folder?.appUUID !== undefined && folder?.appUUID !== null)
      .map((folder) => [String(folder.appUUID), folder]));
    const applications = payload.rootFolders.map(summarize);
    const conflicts = applications
      .filter((folder) => folder.appUUID !== undefined && existingByUuid.has(String(folder.appUUID)))
      .map((folder) => ({
        package: folder,
        existing: summarize(existingByUuid.get(String(folder.appUUID))),
        overwriteOnImport: true,
      }));
    return {
      data: {
        applications,
        conflicts,
        workflowProject: Boolean(payload.isWfProject),
      },
      warnings: checked.warnings,
    };
  }

  async packageImport({ file, projectId, autoPublish = false, coverConfig = false, relevanceConfig }) {
    const checked = await this.packageCheckUpload({ file, projectId });
    const payload = checked.data || {};
    // ECode versions may return either spelling. Prefer the current camel-case
    // contract, then send both request fields with the same value for compatibility.
    const importFileId = payload.fileId ?? payload.fileid;
    if (!Array.isArray(payload.rootFolders) || payload.rootFolders.length === 0) {
      throw new CliError('INVALID_PACKAGE', 'ECode package contains no applications', { exitCode: EXIT.BUSINESS });
    }
    if (!importFileId || !payload.dir) {
      throw new CliError('INVALID_RESPONSE', 'Package check response is missing import handle', { exitCode: EXIT.BUSINESS });
    }
    const impParams = payload.rootFolders.map((folder) => ({
      id: folder.id,
      appUUID: folder.appUUID,
      version: folder.version,
      impType: 'cover',
      autoPublish: Boolean(autoPublish),
      coverConfig: Boolean(coverConfig),
      ...(folder.pcOrMobile ? { pcOrMobile: folder.pcOrMobile } : {}),
      ...(folder.commonFlag ? { commonFlag: folder.commonFlag } : {}),
    }));
    const imported = await this.request('/api/ecode/folder/importEcode', {
      method: 'POST',
      timeoutMs: 300_000,
      form: {
        fileId: importFileId,
        fileid: importFileId,
        dirName: payload.dir,
        projectId,
        impParams: JSON.stringify(impParams),
        forceFlag: false,
        relevanceConfig: JSON.stringify(relevanceConfig || {}),
      },
    });
    let resolved = {
      applications: payload.rootFolders.map((folder) => ({
        packageId: folder.id,
        appUUID: folder.appUUID,
        name: folder.name,
        appId: null,
        pageUrl: null,
      })),
      warnings: [],
    };
    try {
      const tree = await this.treeList(projectId);
      resolved = matchImportedApplications(payload.rootFolders, tree.data?.folders, this.session.baseUrl);
    } catch (error) {
      resolved.warnings.push({
        code: 'IMPORTED_APP_LOOKUP_FAILED',
        message: 'Import succeeded, but imported application page addresses could not be resolved from project tree',
      });
    }
    return {
      data: {
        imported: imported.data,
        projectId,
        applications: resolved.applications.map((application) => ({ ...application, autoPublish: Boolean(autoPublish) })),
        pageUrls: resolved.applications.map((application) => application.pageUrl).filter(Boolean),
      },
      warnings: [...checked.warnings, ...imported.warnings, ...resolved.warnings],
    };
  }
}
