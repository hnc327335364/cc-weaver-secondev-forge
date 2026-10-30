#!/usr/bin/env node

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSession } from './lib/auth.mjs';
import { EcodeClient } from './lib/client.mjs';
import { CliError, EXIT, errorPayload, sanitize } from './lib/errors.mjs';

const HELP = `Usage: ecode-cli [--state <session-file>] <group> <action> [options]

Commands:
  system version
  project list [--name <text>] [--app-name <text>] [--app-id <id>] [--system-project <true|false>]
  tree list --parent-id <id>
  app create --project-id <id> --name <name> [--project-type react] [--vue] [--theme]
  folder create --parent-id <id> --name <name>
  app download --app-id <id> [--output <parent-directory>]
  file create --parent-id <id> --name <name> --type <type>
  file get --id <id> [--source-out <path>] [--compiled-out <path>]
  file update --id <id> --source-file <path> --compiled-file <path>
  package check --file <zip> --project-id <id>
  package import --file <zip> --project-id <id> [--auto-publish] [--cover-config]
                 [--relevance-config-file <json>] [--build-json <path>]

Output: one JSON object on stdout. Diagnostics use stderr.`;

function parseArgs(argv) {
  const values = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    if (!key) throw new CliError('INVALID_INPUT', 'Empty option name', { exitCode: EXIT.INPUT });
    if (['vue', 'theme', 'auto-publish', 'cover-config', 'help'].includes(key)) {
      values[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new CliError('INVALID_INPUT', `Option --${key} requires a value`, { exitCode: EXIT.INPUT });
    }
    values[key] = value;
    index += 1;
  }
  return { positional, values };
}

function required(values, key) {
  const value = values[key];
  if (value === undefined || value === '') throw new CliError('INVALID_INPUT', `Missing required option --${key}`, { exitCode: EXIT.INPUT });
  return value;
}

function id(values, key) {
  const value = required(values, key);
  if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
    throw new CliError('INVALID_INPUT', `Option --${key} must be a positive integer`, { exitCode: EXIT.INPUT });
  }
  return value;
}

function readLocal(path, label) {
  try {
    return readFileSync(resolve(path), 'utf8');
  } catch {
    throw new CliError('LOCAL_FILE_ERROR', `Cannot read ${label}`, { exitCode: EXIT.FILE, details: { path: resolve(path) } });
  }
}

function decodeContent(value, label) {
  if (value === undefined || value === null || value === '') return '';
  try {
    return Buffer.from(String(value), 'base64').toString('utf8');
  } catch {
    throw new CliError('INVALID_RESPONSE', `Server returned invalid ${label}`, { exitCode: EXIT.BUSINESS });
  }
}

function writeLocal(path, content, label) {
  try {
    const target = resolve(path);
    writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
    return target;
  } catch {
    throw new CliError('LOCAL_FILE_ERROR', `Cannot write ${label}`, { exitCode: EXIT.FILE, details: { path: resolve(path) } });
  }
}

const CONFIG_STATES = Object.freeze({
  'config/config.js': 'y',
  'config/config_default.js': 'y',
  'config/configLoad.js': 'n',
  'config/configLoad_default.js': 'n',
});

function safePathSegment(value, label) {
  const segment = String(value ?? '');
  if (!segment || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\')) {
    throw new CliError('INVALID_RESPONSE', `Server returned unsafe ${label}`, { exitCode: EXIT.BUSINESS });
  }
  return segment;
}

function codeFilename(code) {
  const name = safePathSegment(code?.name, 'code name');
  const extension = String(code?.extension ?? '');
  if (!extension) return name;
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  if (!/^\.[A-Za-z0-9]+$/.test(normalizedExtension)) {
    throw new CliError('INVALID_RESPONSE', 'Server returned unsafe code extension', { exitCode: EXIT.BUSINESS });
  }
  return name.endsWith(normalizedExtension) ? name : `${name}${normalizedExtension}`;
}

function pickApplicationMetadata(root, appId) {
  return {
    appId: String(root.id ?? root.appId ?? appId),
    id: String(root.id ?? root.rootFolderId ?? appId),
    appUUID: String(root.appUUID ?? ''),
    name: String(root.name),
    lockFlag: root.lockFlag ?? 'n',
    officialFlag: root.officialFlag ?? 'n',
    systemFlag: root.systemFlag ?? 'n',
    debugFlag: root.debugFlag ?? 'n',
  };
}

async function resolveApplication(client, appId) {
  const projects = [];
  for (const systemProject of [false, true]) {
    const result = await client.projectList({ appId, systemProject, type: 'and' });
    for (const project of result.data?.list ?? []) projects.push(project);
  }
  const uniqueProjects = [...new Map(projects.map((project) => [String(project?.id ?? ''), project])).values()]
    .filter((project) => /^\d+$/.test(String(project?.id ?? '')));
  if (uniqueProjects.length === 0) {
    throw new CliError('APPLICATION_PROJECT_NOT_FOUND', 'Application was not found in current tenant projects', { exitCode: EXIT.BUSINESS });
  }
  if (uniqueProjects.length > 1) {
    throw new CliError('APPLICATION_PROJECT_AMBIGUOUS', 'Application belongs to multiple current tenant projects', { exitCode: EXIT.BUSINESS });
  }
  const project = uniqueProjects[0];
  const projectTreeResult = await client.treeList(String(project.id));
  const projectFolders = projectTreeResult.data?.folders;
  if (!Array.isArray(projectFolders)) {
    throw new CliError('INVALID_RESPONSE', 'Project tree is missing folders array', { exitCode: EXIT.BUSINESS });
  }
  const applications = projectFolders.filter((folder) => String(folder?.id ?? '') === appId);
  if (applications.length !== 1) {
    throw new CliError(
      applications.length === 0 ? 'APPLICATION_NOT_FOUND_IN_PROJECT_TREE' : 'APPLICATION_AMBIGUOUS_IN_PROJECT_TREE',
      applications.length === 0
        ? 'Application was not found in resolved project tree'
        : 'Application appears multiple times in resolved project tree',
      { exitCode: EXIT.BUSINESS },
    );
  }
  safePathSegment(applications[0]?.name, 'application name');
  return { project, application: applications[0] };
}

async function downloadApplication(client, appId, outputParentDirectory) {
  const resolved = await resolveApplication(client, appId);
  const application = pickApplicationMetadata(resolved.application, appId);
  const rootPath = join(resolve(outputParentDirectory || process.cwd()), safePathSegment(application.name, 'application name'));
  // 下载只创建新副本，不以“读取服务器”为由覆盖已有本地工程。
  mkdirSync(dirname(rootPath), { recursive: true });
  try { mkdirSync(rootPath); }
  catch (error) {
    if (error.code === 'EEXIST')
      throw new CliError('LOCAL_TARGET_EXISTS', 'Application download target already exists; choose a new output parent', { exitCode: EXIT.FILE });
    throw error;
  }
  const visitedFolders = new Set();
  const files = [];
  const resourceFiles = [];

  async function visit(folderId, relativeDirectory) {
    if (visitedFolders.has(folderId)) {
      throw new CliError('INVALID_RESPONSE', 'Application tree contains a folder cycle', { exitCode: EXIT.BUSINESS });
    }
    visitedFolders.add(folderId);
    const localDirectory = relativeDirectory
      ? join(rootPath, ...relativeDirectory.split('/'))
      : rootPath;
    mkdirSync(localDirectory, { recursive: true });
    const result = await client.treeList(folderId);
    const tree = result.data || {};
    const codes = tree.codes ?? [];
    const folders = tree.folders ?? [];
    const resources = tree.resources ?? [];
    if (!Array.isArray(codes) || !Array.isArray(folders) || !Array.isArray(resources)) {
      throw new CliError('INVALID_RESPONSE', 'Application tree is missing codes, folders, or resources arrays', { exitCode: EXIT.BUSINESS });
    }
    for (const code of codes) {
      const id = String(code?.id ?? '');
      if (!/^\d+$/.test(id) || BigInt(id) <= 0n) {
        throw new CliError('INVALID_RESPONSE', 'Application tree contains an invalid code id', { exitCode: EXIT.BUSINESS });
      }
      const filename = codeFilename(code);
      const relative = relativeDirectory ? `${relativeDirectory}/${filename}` : filename;
      const target = join(rootPath, ...relative.split('/'));
      const detail = await client.fileGet(id);
      const source = decodeContent(detail.data?.content, 'source content');
      mkdirSync(dirname(target), { recursive: true });
      writeFileAtomic(target, source);
      files.push({
        path: relative,
        id,
        sourceId: detail.data?.sourceId ?? code.sourceId,
        state: CONFIG_STATES[relative] ?? code.state ?? 'n',
        compress: code.compress ?? 'n',
      });
    }
    for (const resource of resources) {
      const id = String(resource?.id ?? '');
      if (!/^\d+$/.test(id) || BigInt(id) <= 0n) {
        throw new CliError('INVALID_RESPONSE', 'Application tree contains an invalid resource id', { exitCode: EXIT.BUSINESS });
      }
      const filename = safePathSegment(resource?.name, 'resource name');
      const relative = relativeDirectory ? `${relativeDirectory}/${filename}` : filename;
      const target = join(rootPath, ...relative.split('/'));
      const downloaded = await client.resourceDownload(appId, filename);
      mkdirSync(dirname(target), { recursive: true });
      writeFileAtomic(target, downloaded.data);
      resourceFiles.push({
        path: relative,
        id,
        fileId: resource.fileId,
        extension: resource.extension ?? '',
        bytes: downloaded.data.length,
      });
    }
    for (const folder of folders) {
      const id = String(folder?.id ?? '');
      if (!/^\d+$/.test(id) || BigInt(id) <= 0n) {
        throw new CliError('INVALID_RESPONSE', 'Application tree contains an invalid folder id', { exitCode: EXIT.BUSINESS });
      }
      const name = safePathSegment(folder?.name, 'folder name');
      await visit(id, relativeDirectory ? `${relativeDirectory}/${name}` : name);
    }
  }

  await visit(appId, '');
  const codes = Object.fromEntries(files.sort((a, b) => a.path.localeCompare(b.path)).map((file) => [file.path, {
    id: file.id,
    sourceId: file.sourceId,
    state: file.state,
    compress: file.compress,
  }]));
  const resources = Object.fromEntries(resourceFiles.sort((a, b) => a.path.localeCompare(b.path)).map((resource) => [resource.path, {
    id: resource.id,
    fileId: resource.fileId,
    extension: resource.extension,
  }]));
  const buildJson = { ...application, codes, resources };
  writeFileAtomic(join(rootPath, 'build.json'), `${JSON.stringify(buildJson, null, 2)}\n`);
  return {
    output: rootPath,
    files: files.length,
    resources: resourceFiles.length,
    resourceBytes: resourceFiles.reduce((total, resource) => total + resource.bytes, 0),
    buildJson: join(rootPath, 'build.json'),
    project: { id: String(resolved.project.id), name: resolved.project.projectName, systemProject: Boolean(resolved.project.systemProject) },
    application: { ...application, codes: undefined },
  };
}

export function writeFileAtomic(path, content) {
  const target = resolve(path);
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  try {
    writeFileSync(temporary, content, 'utf8');
    renameSync(temporary, target);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      // Best-effort cleanup; preserve original write/rename error.
    }
    throw error;
  }
  return target;
}

function readJsonObject(path) {
  const content = readLocal(path, 'relevance configuration file');
  try {
    const parsed = JSON.parse(content);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    return parsed;
  } catch {
    throw new CliError('INVALID_INPUT', 'Relevance configuration must be a JSON object', { exitCode: EXIT.INPUT });
  }
}

function readBuildJson(path) {
  const content = readLocal(path, 'build.json');
  try {
    const parsed = JSON.parse(content);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    return { path: resolve(path), data: parsed };
  } catch {
    throw new CliError('INVALID_INPUT', 'build.json must be a JSON object', { exitCode: EXIT.INPUT });
  }
}

function validAppId(value) {
  const appId = String(value ?? '').trim();
  return /^\d+$/.test(appId) && BigInt(appId) > 0n ? appId : null;
}

function updateBuildJsonAppId(buildJson, result) {
  if (!buildJson) return result;
  const appUUID = String(buildJson.data.appUUID ?? '').trim();
  const applications = Array.isArray(result.data?.applications) ? result.data.applications : [];
  const importedForUuid = applications.filter((application) => String(application?.appUUID ?? '').trim() === appUUID);
  const resolved = importedForUuid.filter((application) => (
    application?.matchedBy === 'appUUID' && validAppId(application.appId)
  ));
  const warning = (message) => ({ code: 'BUILD_JSON_APP_ID_NOT_UPDATED', message });

  if (!appUUID || importedForUuid.length !== 1 || resolved.length !== 1) {
    return {
      ...result,
      data: { ...result.data, buildJson: { path: buildJson.path, updated: false } },
      warnings: [...(result.warnings || []), warning('Import succeeded, but build.json appId was not updated because appUUID was not uniquely resolved by exact appUUID match')],
    };
  }

  const appId = validAppId(resolved[0].appId);
  try {
    writeFileAtomic(buildJson.path, `${JSON.stringify({ ...buildJson.data, appId }, null, 2)}\n`);
  } catch {
    return {
      ...result,
      data: { ...result.data, buildJson: { path: buildJson.path, updated: false } },
      warnings: [...(result.warnings || []), warning('Import succeeded, but build.json appId could not be written')],
    };
  }
  return {
    ...result,
    data: { ...result.data, buildJson: { path: buildJson.path, updated: true, appId } },
  };
}

function knownOptions(command) {
  const common = new Set(['state']);
  const map = {
    'system.version': [],
    'project.list': ['name', 'app-name', 'app-id', 'system-project', 'type'],
    'tree.list': ['parent-id'],
    'app.download': ['app-id', 'output'],
    'app.create': ['project-id', 'name', 'project-type', 'vue', 'theme'],
    'folder.create': ['parent-id', 'name'],
    'file.create': ['parent-id', 'name', 'type'],
    'file.get': ['id', 'source-out', 'compiled-out'],
    'file.update': ['id', 'source-file', 'compiled-file'],
    'package.check': ['file', 'project-id'],
    'package.import': ['file', 'project-id', 'auto-publish', 'cover-config', 'relevance-config-file', 'build-json'],
  };
  for (const key of map[command] || []) common.add(key);
  return common;
}

function validateOptions(command, values) {
  const allowed = knownOptions(command);
  for (const key of Object.keys(values)) {
    if (!allowed.has(key)) throw new CliError('INVALID_INPUT', `Unknown option --${key}`, { exitCode: EXIT.INPUT });
  }
}

function oneOf(value, label, supported) {
  if (!supported.includes(value)) {
    throw new CliError('INVALID_INPUT', `${label} must be one of: ${supported.join(', ')}`, { exitCode: EXIT.INPUT });
  }
  return value;
}

async function dispatch(client, command, values) {
  validateOptions(command, values);
  switch (command) {
    case 'system.version':
      return client.systemVersion();
    case 'project.list':
      return client.projectList({
        name: values.name,
        appName: values['app-name'],
        appId: values['app-id'] ? id(values, 'app-id') : undefined,
        systemProject: values['system-project'] === undefined
          ? undefined
          : oneOf(values['system-project'], 'System project', ['true', 'false']) === 'true',
        type: values.type,
      });
    case 'tree.list':
      return client.treeList(id(values, 'parent-id'));
    case 'app.download':
      return { data: await downloadApplication(client, id(values, 'app-id'), values.output), warnings: [] };
    case 'app.create':
      return client.appCreate({
        projectId: id(values, 'project-id'),
        name: required(values, 'name'),
        projectType: oneOf(values['project-type'] || 'react', 'Project type', [
          'react', 'nodejs-function', 'java-function', 'java-function-simple',
          'java-src-project', 'typescript', 'springboot-server',
        ]),
        vue: Boolean(values.vue),
        theme: Boolean(values.theme),
      });
    case 'folder.create':
      return client.folderCreate({ parentId: id(values, 'parent-id'), name: required(values, 'name') });
    case 'file.create':
      return client.fileCreate({
        parentId: id(values, 'parent-id'),
        name: required(values, 'name'),
        type: oneOf(required(values, 'type'), 'File type', ['js', 'css', 'md', 'func', 'cron', 'ts']),
      });
    case 'file.get': { // Keep content off stdout; write only when explicitly requested.
      const result = await client.fileGet(id(values, 'id'));
      const { content, compiledContent, ...metadata } = result.data || {};
      if (values['source-out']) metadata.sourceOut = writeLocal(values['source-out'], decodeContent(content, 'source content'), 'source output');
      if (values['compiled-out']) metadata.compiledOut = writeLocal(values['compiled-out'], decodeContent(compiledContent, 'compiled content'), 'compiled output');
      return { data: metadata, warnings: result.warnings };
    }
    case 'file.update':
      return client.fileUpdate({
        id: id(values, 'id'),
        source: readLocal(required(values, 'source-file'), 'source file'),
        compiled: readLocal(required(values, 'compiled-file'), 'compiled file'),
      });
    case 'package.check':
      return client.packageCheck({ file: resolve(required(values, 'file')), projectId: id(values, 'project-id') });
    case 'package.import': {
      const buildJson = values['build-json'] ? readBuildJson(values['build-json']) : undefined;
      const result = await client.packageImport({
        file: resolve(required(values, 'file')),
        projectId: id(values, 'project-id'),
        autoPublish: Boolean(values['auto-publish']),
        coverConfig: Boolean(values['cover-config']),
        relevanceConfig: values['relevance-config-file'] ? readJsonObject(values['relevance-config-file']) : undefined,
      });
      return updateBuildJsonAppId(buildJson, result);
    }
    default:
      throw new CliError('INVALID_INPUT', 'Unknown command; use --help', { exitCode: EXIT.INPUT });
  }
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  let command = 'unknown';
  try {
    const { positional, values } = parseArgs(argv);
    if (values.help || positional[0] === 'help' || argv.length === 0) {
      (deps.stderr || process.stderr).write(`${HELP}\n`);
      return 0;
    }
    if (positional.length !== 2) throw new CliError('INVALID_INPUT', 'Expected command group and action; use --help', { exitCode: EXIT.INPUT });
    command = `${positional[0]}.${positional[1]}`;
    const session = (deps.loadSession || loadSession)({ statePath: values.state || deps.statePath });
    const client = deps.client || new EcodeClient(session, { fetchImpl: deps.fetchImpl, timeoutMs: deps.timeoutMs });
    const result = await dispatch(client, command, values);
    const output = { ok: true, command, data: sanitize(result.data), warnings: sanitize(result.warnings || []) };
    (deps.stdout || process.stdout).write(`${JSON.stringify(output)}\n`);
    return 0;
  } catch (error) {
    const normalized = error instanceof CliError ? error : new CliError('UNEXPECTED_ERROR', 'Unexpected CLI failure');
    const { body, exitCode } = errorPayload(command, normalized);
    (deps.stdout || process.stdout).write(`${JSON.stringify(body)}\n`);
    return exitCode;
  }
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntrypoint) process.exitCode = await main();
