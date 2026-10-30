import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertManagedContract } from './managed-contract.mjs';

const PACKAGE = 'ui-code-agent';
const REGISTRY = 'https://registry.npmjs.org';
const LOCK_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runtime-lock');
export const CONTRACT_FILES = [
  ...['package.json', 'dist/index.js', 'dist/environment-auth.js', 'dist/commands/next.js', 'dist/commands/platform.js', 'dist/commands/publish-target.js', 'dist/commands/build.js', 'dist/data-binding/mcp-client.js'].map((name) => `${PACKAGE}/${name}`),
  '@ui-code-agent/ecode-platform/dist/client.js', 'ui-service-mcp/dist/server.js', 'ui-service-mcp/dist/context.js',
  ...['SKILL.md', 'AGENTS.md', 'AGENTS-static.md'].map((name) => `@ui-code-agent/capability-pack/${name}`),
  ...['release/server.mjs', 'componentData/catalog.json', 'componentData/checksums.json', 'componentData/component-collections.json', 'previewRuntime/manifest.json'].map((name) => `ui-code-mcp/${name}`),
];
const VERSION = /^\d+\.\d+\.\d+$/;
const digest = (data) => createHash('sha256').update(data).digest('hex');

function rejectRegistryOverride(env) {
  for (const [name, value] of Object.entries(env)) {
    if ((name === 'ECODE_PAGE_NPM_REGISTRY' || name.toLowerCase() === 'npm_config_registry') && value && value !== REGISTRY) throw new Error('RUNTIME_REGISTRY_OVERRIDE_REJECTED');
  }
}

export async function pinnedRelease() {
  const [releaseText, packageText, lockText] = await Promise.all(['release.json', 'package.json', 'package-lock.json'].map((name) => readFile(path.join(LOCK_ROOT, name), 'utf8')));
  const release = JSON.parse(releaseText), manifest = JSON.parse(packageText), lock = JSON.parse(lockText);
  if (release.schema !== 1 || release.package !== PACKAGE || release.registry !== REGISTRY || !VERSION.test(release.version) || !VERSION.test(release.uiCodeMcpVersion) || digest(lockText) !== release.packageLockSha256) throw new Error('RUNTIME_PIN_INVALID');
  const expected = { [PACKAGE]: release.version, 'ui-code-mcp': release.uiCodeMcpVersion };
  for (const dependencies of [manifest.dependencies, lock.packages?.['']?.dependencies]) {
    if (!dependencies || Object.keys(dependencies).length !== 2 || Object.entries(expected).some(([name, version]) => dependencies[name] !== version)) throw new Error('RUNTIME_PIN_DEPENDENCIES_INVALID');
  }
  if (lock.lockfileVersion !== 3 || !manifest.private) throw new Error('RUNTIME_PIN_LOCK_INVALID');
  for (const [location, item] of Object.entries(lock.packages)) {
    if (!location) continue;
    if (!/^node_modules\/(?:@[^/]+\/)?[^/]+(?:\/node_modules\/(?:@[^/]+\/)?[^/]+)*$/u.test(location) || location.includes('..')) throw new Error('RUNTIME_PIN_PATH_INVALID');
    let url;
    try { url = new URL(item.resolved); } catch { throw new Error('RUNTIME_PIN_REGISTRY_INVALID'); }
    if (url.origin !== REGISTRY || url.username || url.password || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(item.integrity || '') || !VERSION.test(item.version)) throw new Error('RUNTIME_PIN_REGISTRY_INVALID');
  }
  return { ...release, manifest, lock, packageText, lockText, releaseId: `${release.version}-${release.packageLockSha256.slice(0, 12)}` };
}

// 不继承 npm 鉴权、用户配置、代理或 NODE_OPTIONS；所有缓存和配置均在本次临时目录。
async function isolatedNpm(directory, env) {
  rejectRegistryOverride(env);
  const clean = {};
  for (const [key, value] of Object.entries(env)) if (['path', 'systemroot', 'windir', 'comspec', 'pathext'].includes(key.toLowerCase())) clean[key] = value;
  const temporary = path.join(directory, 'tmp');
  await mkdir(temporary, { recursive: true });
  const user = path.join(directory, 'npm-user.conf'), global = path.join(directory, 'npm-global.conf');
  await Promise.all([user, global].map((name) => writeFile(name, '', { mode: 0o600 })));
  return { env: { ...clean, TMPDIR: temporary, TMP: temporary, TEMP: temporary }, args: [`--userconfig=${user}`, `--globalconfig=${global}`, `--cache=${path.join(directory, 'npm-cache')}`, `--registry=${REGISTRY}`, '--fetch-retries=0', '--fetch-timeout=30000'] };
}

export function runtimeRoot(env = process.env) {
  return path.resolve(env.ECODE_PAGE_RUNTIME_HOME || path.join(os.homedir(), '.weaver-cc-assistant', 'page-runtime', '1.3.4'));
}

export function runtimeEnvironment(root = runtimeRoot(), env = process.env, authenticated = false) {
  const clean = { ...env };
  if (!authenticated) {
    for (const name of ['ETEAMSID', 'UI_CODE_AGENT_ETEAMSID', 'UI_CODE_AGENT_AUTH', 'UI_CODE_AGENT_TOKEN']) delete clean[name];
  }
  return { ...clean, UI_CODE_AGENT_HOME: path.join(root, authenticated ? 'state' : 'local-state') };
}

export function nodeSupported(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 5);
}

export function npmInvocation(args, env = process.env) {
  const nodeDir = path.dirname(process.execPath);
  for (const cli of [path.join(nodeDir, 'node_modules/npm/bin/npm-cli.js'), path.resolve(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js')]) {
    if (existsSync(cli)) return [process.execPath, [cli, ...args]];
  }
  for (const dir of (env.PATH || '').split(path.delimiter)) {
    const cli = path.join(dir, process.platform === 'win32' ? 'npm.cmd' : 'npm');
    if (existsSync(cli)) return [cli, args];
  }
  throw new Error('NPM_NOT_FOUND');
}

export async function captured(command, args, { cwd, env = process.env, timeout = 600000 } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', size = 0;
    const timer = setTimeout(() => child.kill(), timeout);
    const receive = (field) => (chunk) => {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) { child.kill(); return; }
      if (field === 'stdout') stdout += chunk;
      else stderr += chunk;
    };
    child.stdout.on('data', receive('stdout'));
    child.stderr.on('data', receive('stderr'));
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => { clearTimeout(timer); resolve({ code: size > 4 * 1024 * 1024 ? 1 : code, stdout, stderr }); });
  });
}

async function contractHashes(releaseRoot) {
  const hashes = {};
  const root = await realpath(releaseRoot);
  for (const name of CONTRACT_FILES) {
    const filename = await realpath(path.join(releaseRoot, 'node_modules', name)), relative = path.relative(root, filename);
    if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('RUNTIME_CONTRACT_PATH_ESCAPE');
    hashes[name] = digest(await readFile(filename));
  }
  return hashes;
}

function platformMatches(constraint, current) {
  if (!Array.isArray(constraint) || !constraint.length) return true;
  return !constraint.includes(`!${current}`) && (!constraint.some((name) => !name.startsWith('!')) || constraint.includes(current));
}

export function dependencyApplies(item, { platform = process.platform, arch = process.arch, libc } = {}) {
  // npm 会省略不匹配的原生可选包；Linux 同架构还必须区分 glibc/musl。
  if (platform === 'linux' && libc === undefined) libc = process.report.getReport().header.glibcVersionRuntime ? 'glibc' : 'musl';
  return platformMatches(item.os, platform) && platformMatches(item.cpu, arch) && (platform !== 'linux' || platformMatches(item.libc, libc));
}

export async function inspectLockedDependencies(releaseRoot, release = undefined) {
  release ||= await pinnedRelease();
  if (digest(await readFile(path.join(releaseRoot, 'package-lock.json'))) !== release.packageLockSha256 || (await readFile(path.join(releaseRoot, 'package.json'), 'utf8')) !== release.packageText) throw new Error('RUNTIME_LOCK_CHANGED');
  const canonicalRoot = await realpath(releaseRoot), evidence = [];
  for (const [location, item] of Object.entries(release.lock.packages)) {
    if (!location) continue;
    const filename = path.join(releaseRoot, location, 'package.json');
    if (!existsSync(filename) && item.optional && !dependencyApplies(item)) continue;
    let data, actual;
    try {
      const canonical = await realpath(filename), relative = path.relative(canonicalRoot, canonical);
      if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('escape');
      data = await readFile(filename);
      actual = JSON.parse(data);
    } catch { throw new Error(`RUNTIME_DEPENDENCY_MISSING_OR_INVALID: ${location}`); }
    if (actual.name !== location.split('node_modules/').at(-1) || actual.version !== item.version) throw new Error(`RUNTIME_DEPENDENCY_VERSION_CHANGED: ${location}`);
    evidence.push([location, item.version, digest(data)]);
  }
  return { count: evidence.length, manifestDigest: digest(JSON.stringify(evidence)) };
}

async function inspectAt(root, active, release) {
  if (active?.schema === 1) throw new Error('RUNTIME_LEGACY_UNPINNED: run an explicitly approved update; existing release is preserved');
  if (!VERSION.test(active?.version || '') || active?.schema !== 2 || active.scope !== 'gated-full') throw new Error('RUNTIME_IDENTITY_INVALID');
  if (active.version !== release.version || active.lockSha256 !== release.packageLockSha256 || active.releaseId !== release.releaseId) throw new Error('RUNTIME_PIN_CHANGED: run an explicitly approved update; existing release is preserved');
  const releaseRoot = path.join(root, 'releases', release.releaseId);
  const packageRoot = path.join(releaseRoot, 'node_modules', PACKAGE);
  const dependencies = await inspectLockedDependencies(releaseRoot, release);
  if (JSON.stringify(dependencies) !== JSON.stringify(active.dependencies)) throw new Error('RUNTIME_DEPENDENCY_EVIDENCE_CHANGED');
  const hashes = await contractHashes(releaseRoot);
  if (JSON.stringify(hashes) !== JSON.stringify(active.hashes)) throw new Error('RUNTIME_FILES_CHANGED');
  const contracts = await assertManagedContract(releaseRoot, { uiCodeMcpVersion: release.uiCodeMcpVersion });
  if (active.verification?.e10Page !== 'passed' || active.verification?.coreBrowserCompilation !== 'not-run') throw new Error('RUNTIME_VERIFICATION_INVALID');
  const verification = { ...active.verification };
  const capabilities = { ...contracts, validation: verification };
  return { status: 'installed', version: active.version, root, releaseRoot, packageRoot, cli: path.join(packageRoot, 'dist/index.js'), capabilities, verification, lockSha256: release.packageLockSha256 };
}

export async function inspectRuntime(root = runtimeRoot()) {
  let active;
  try { active = JSON.parse(await readFile(path.join(root, 'active.json'), 'utf8')); }
  catch (error) { return { status: error.code === 'ENOENT' ? 'not-installed' : 'invalid', reason: error.message, root }; }
  try { return await inspectAt(root, active, await pinnedRelease()); }
  catch (error) { return { status: 'invalid', reason: error.message, root }; }
}

// 仅供检查新版信息；ensure/update 不调用，也不安装返回的未知版本。
export async function latestVersion({ run = captured, env = process.env } = {}) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'cc-page-version-'));
  try {
    const npm = await isolatedNpm(temporary, env);
    const [command, args] = npmInvocation(['view', PACKAGE, 'dist-tags.latest', '--json', ...npm.args], npm.env);
    const result = await run(command, args, { cwd: temporary, env: npm.env, timeout: 30000 });
    if (result.code !== 0) throw new Error('NPM_LATEST_UNAVAILABLE');
    let version;
    try { version = JSON.parse(result.stdout.trim()); } catch { throw new Error('NPM_LATEST_INVALID'); }
    if (typeof version !== 'string' || !VERSION.test(version)) throw new Error('NPM_LATEST_INVALID');
    return version;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

async function installCandidate(root, release, options = {}) {
  const releases = path.join(root, 'releases');
  await mkdir(releases, { recursive: true, mode: 0o700 });
  const temporary = await mkdtemp(path.join(root, '.candidate-'));
  const candidate = path.join(temporary, 'release');
  try {
    await mkdir(candidate);
    await Promise.all([writeFile(path.join(candidate, 'package.json'), release.packageText), writeFile(path.join(candidate, 'package-lock.json'), release.lockText)]);
    const npm = await isolatedNpm(temporary, options.env || process.env);
    const [command, args] = npmInvocation(['ci', '--ignore-scripts', '--no-audit', '--no-fund', ...npm.args], npm.env);
    const result = await (options.run || captured)(command, args, { cwd: candidate, env: npm.env, timeout: 600000 });
    if (result.code !== 0) throw new Error('NPM_INSTALL_FAILED');
    const packageRoot = path.join(candidate, 'node_modules', PACKAGE);
    await inspectLockedDependencies(candidate, release);
    await assertManagedContract(candidate, { uiCodeMcpVersion: release.uiCodeMcpVersion });
    const doctor = await (options.run || captured)(process.execPath, [path.join(packageRoot, 'dist/index.js'), 'doctor', '--json', '--only', 'e10-page'], { cwd: candidate, env: { ...npm.env, UI_CODE_AGENT_HOME: path.join(temporary, 'anonymous-state') }, timeout: 120000 });
    let diagnosis;
    try { diagnosis = JSON.parse(doctor.stdout.trim()); } catch { throw new Error('RUNTIME_DOCTOR_INVALID'); }
    if (doctor.code !== 0 || diagnosis.ok !== true || diagnosis.scope !== 'e10-page' || diagnosis.uiCodeMcp?.ok !== true || diagnosis.previewRuntime?.ok !== true || diagnosis.features?.['e10-page']?.installed !== true) throw new Error('RUNTIME_E10_DOCTOR_FAILED');
    // 自检后再次核对锁和依赖；此回执只覆盖本地组件/知识，不冒充浏览器或编译验收。
    const dependencies = await inspectLockedDependencies(candidate, release);
    await assertManagedContract(candidate, { uiCodeMcpVersion: release.uiCodeMcpVersion });
    const hashes = await contractHashes(candidate);
    const destination = path.join(releases, release.releaseId);
    if (existsSync(destination)) {
      const current = await inspectLockedDependencies(destination, release);
      if (JSON.stringify(current) !== JSON.stringify(dependencies) || JSON.stringify(await contractHashes(destination)) !== JSON.stringify(hashes)) throw new Error('RUNTIME_RELEASE_COLLISION');
    } else await rename(candidate, destination);
    return { version: release.version, releaseId: release.releaseId, lockSha256: release.packageLockSha256, dependencies, hashes, verification: { e10Page: 'passed', coreBrowserCompilation: 'not-run', customerEnvironment: 'not-run' } };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function ensureRuntime(root = runtimeRoot(), options = {}) {
  if (!nodeSupported(options.nodeVersion)) throw new Error('NODE_UNSUPPORTED: Node >=22.5 required');
  rejectRegistryOverride(options.env || process.env);
  const release = await pinnedRelease();
  const updatable = (result) => options.update && /^(RUNTIME_LEGACY_UNPINNED|RUNTIME_PIN_CHANGED):/u.test(result.reason || '');
  const current = await inspectRuntime(root);
  if (current.status === 'installed') return current;
  if (current.status === 'invalid' && !updatable(current)) throw new Error(`RUNTIME_INVALID: ${current.reason}`);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lockFile = path.join(root, '.install.lock');
  const { open, unlink } = await import('node:fs/promises');
  const lock = await open(lockFile, 'wx', 0o600).catch(() => { throw new Error('INSTALL_BUSY'); });
  try {
    const recheck = await inspectRuntime(root);
    if (recheck.status === 'installed') return recheck;
    if (recheck.status === 'invalid' && !updatable(recheck)) throw new Error(`RUNTIME_INVALID: ${recheck.reason}`);
    const candidate = await installCandidate(root, release, options);
    const active = { schema: 2, scope: 'gated-full', ...candidate, installedAt: new Date().toISOString() };
    const nextFile = path.join(root, `.active-${process.pid}.json`);
    await writeFile(nextFile, `${JSON.stringify(active, null, 2)}\n`, { mode: 0o600 });
    await rename(nextFile, path.join(root, 'active.json'));
    return await inspectRuntime(root);
  } finally { await lock.close(); await unlink(lockFile); }
}

export function protocolPaths(runtime) {
  const base = path.join(runtime.releaseRoot, 'node_modules/@ui-code-agent/capability-pack');
  return { skill: path.join(base, 'SKILL.md'), agents: path.join(base, 'AGENTS.md'), agentsStatic: path.join(base, 'AGENTS-static.md') };
}
