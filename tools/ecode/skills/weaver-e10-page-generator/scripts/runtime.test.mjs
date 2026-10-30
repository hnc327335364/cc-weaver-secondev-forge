import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CONTRACT_FILES, dependencyApplies, ensureRuntime, inspectRuntime, latestVersion, pinnedRelease } from './runtime.mjs';
import { assertManagedContract, PLATFORM_WRITE_METHODS } from './managed-contract.mjs';

const pin = await pinnedRelease();
const diagnosis = { ok: true, scope: 'e10-page', uiCodeMcp: { ok: true }, previewRuntime: { ok: true }, features: { 'e10-page': { installed: true } } };
const env = { PATH: process.env.PATH || '', NPM_TOKEN: 'test-must-not-pass', E10_ETEAMS_ID: 'test-must-not-pass', NODE_OPTIONS: '--bad-test-option', HTTP_PROXY: 'http://invalid.test' };

async function put(root, name, data) {
  const filename = path.join(root, name);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, typeof data === 'string' ? data : JSON.stringify(data));
}

// 合成依赖树只验证本地适配器行为；任何模拟安装文件都不能被实际 import。
async function fakeInstall(root, { missingPeer = false } = {}) {
  for (const [location, item] of Object.entries(pin.lock.packages)) {
    if (!location) continue;
    if (item.optional && !dependencyApplies(item)) continue;
    if (missingPeer && location === 'node_modules/ui-code-mcp') continue;
    await put(root, `${location}/package.json`, { ...item, name: location.split('node_modules/').at(-1) });
  }
  for (const name of CONTRACT_FILES) {
    if (name.endsWith('package.json')) continue;
    if (missingPeer && name.startsWith('ui-code-mcp/')) continue;
    await put(root, `node_modules/${name}`, 'static test fixture; never execute');
  }
  const base = 'node_modules/ui-code-agent/';
  await put(root, `${base}dist/index.js`, 'void main();');
  await put(root, `${base}dist/environment-auth.js`, 'throw new Error("DOWNLOADED_CODE_MUST_NOT_RUN"); export async function setEnvironmentAuth(){} export async function verifyEnvironmentAuth(){}');
  await put(root, `${base}dist/commands/platform.js`, 'export async function runPlatform(){}');
  await put(root, `${base}dist/commands/publish-target.js`, 'export async function runPublishTarget(){}');
  await put(root, `${base}dist/commands/build.js`, 'export async function runBuild(){ packageProjectWithAppIdStaging(); }');
  await put(root, `${base}dist/commands/next.js`, "recordPublishDecision(projectDir, 'publish');");
  await put(root, `${base}dist/data-binding/mcp-client.js`, "const WRITE_TOOLS = new Set(['create_form', 'batch_create_fields', 'save_sample_data']); export class FormServiceMcpClient { async call(tool, args) { this.request('tools/call',args); } }");
  await put(root, 'node_modules/@ui-code-agent/ecode-platform/dist/client.js', `export class EcodeClient {${PLATFORM_WRITE_METHODS.map((name) => `async ${name}(){}`).join('')}}`);
  await put(root, 'node_modules/ui-service-mcp/dist/server.js', 'const handlers = { create_form: 1, batch_create_fields: 1, save_sample_data: 1 };');
  if (!missingPeer) {
    await put(root, 'node_modules/ui-code-mcp/release/server.mjs', 'createRuntimeAsync(); server.connect(new StdioServerTransport());');
    await put(root, 'node_modules/ui-code-mcp/componentData/catalog.json', { schemaVersion: 3, libraries: [{ id: 'weapp-ui' }, { id: 'weapp-ebdcontainercoms' }] });
    await put(root, 'node_modules/ui-code-mcp/componentData/component-collections.json', { schemaVersion: 3, items: [{ id: 'portal-pc', members: [{ libraryId: 'weapp-ui' }] }] });
    await put(root, 'node_modules/ui-code-mcp/componentData/checksums.json', { 'catalog.json': 'a'.repeat(64), 'component-collections.json': 'b'.repeat(64) });
    await put(root, 'node_modules/ui-code-mcp/previewRuntime/manifest.json', { schemaVersion: 1, library: { id: 'weapp-ui' }, entrypoints: { scripts: ['local.js'] } });
  }
}

async function temporary(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cc-runtime-lock-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function runner(options = {}) {
  const calls = [];
  const run = async (command, args, context) => {
    calls.push({ command, args, context });
    assert.equal(context.env.NPM_TOKEN, undefined);
    assert.equal(context.env.E10_ETEAMS_ID, undefined);
    assert.equal(context.env.NODE_OPTIONS, undefined);
    assert.equal(context.env.HTTP_PROXY, undefined);
    if (args.includes('ci')) {
      assert.ok(args.includes('--ignore-scripts'));
      assert.ok(args.includes('--no-audit'));
      assert.ok(args.includes('--no-fund'));
      assert.ok(!args.includes('install') && !args.includes('view'));
      const user = args.find((arg) => arg.startsWith('--userconfig=')).slice('--userconfig='.length);
      const global = args.find((arg) => arg.startsWith('--globalconfig=')).slice('--globalconfig='.length);
      assert.notEqual(user, global);
      assert.equal(await readFile(user, 'utf8'), '');
      assert.equal(await readFile(global, 'utf8'), '');
      assert.equal(await readFile(path.join(context.cwd, 'package-lock.json'), 'utf8'), pin.lockText);
      if (options.installFail) return { code: 1, stdout: '', stderr: 'simulated install failure' };
      await fakeInstall(context.cwd, options);
      if (options.lockChanged) await put(context.cwd, 'package-lock.json', '{}');
      return { code: 0, stdout: '', stderr: '' };
    }
    assert.deepEqual(args.slice(1), ['doctor', '--json', '--only', 'e10-page']);
    assert.ok(context.env.UI_CODE_AGENT_HOME.endsWith('anonymous-state'));
    return { code: 0, stdout: JSON.stringify(options.diagnosis || diagnosis), stderr: '' };
  };
  return { calls, run };
}

test('bundled lock pins both packages and all artifact origins/integrities', () => {
  assert.equal(pin.version, '0.1.71');
  assert.equal(pin.uiCodeMcpVersion, '0.2.34');
  assert.equal(pin.lock.packages['node_modules/ui-service-mcp'].version, '0.1.24');
  assert.equal(Object.keys(pin.lock.packages).length - 1, 127);
  for (const [name, item] of Object.entries(pin.lock.packages)) if (name) {
    assert.equal(new URL(item.resolved).origin, 'https://registry.npmjs.org');
    assert.ok(item.integrity.startsWith('sha512-'));
  }
});

test('native optional packages follow OS, architecture and Linux libc constraints', () => {
  const glibc = pin.lock.packages['node_modules/@napi-rs/keyring-linux-x64-gnu'];
  const musl = pin.lock.packages['node_modules/@napi-rs/keyring-linux-x64-musl'];
  assert.equal(dependencyApplies(glibc, { platform: 'linux', arch: 'x64', libc: 'glibc' }), true);
  assert.equal(dependencyApplies(musl, { platform: 'linux', arch: 'x64', libc: 'glibc' }), false);
  assert.equal(dependencyApplies(glibc, { platform: 'linux', arch: 'x64', libc: 'musl' }), false);
  assert.equal(dependencyApplies(musl, { platform: 'linux', arch: 'x64', libc: 'musl' }), true);
  assert.equal(dependencyApplies(musl, { platform: 'darwin', arch: 'arm64' }), false);
  assert.equal(dependencyApplies(pin.lock.packages['node_modules/@napi-rs/keyring-win32-x64-msvc'], { platform: 'win32', arch: 'x64' }), true);
});

test('first install uses npm ci, anonymous E10-only check, and ordinary reuse does not execute packages', async (t) => {
  const root = await temporary(t), mock = runner();
  const installed = await ensureRuntime(root, { run: mock.run, env });
  assert.equal(installed.status, 'installed');
  assert.equal(installed.version, pin.version);
  assert.deepEqual(installed.verification, { e10Page: 'passed', coreBrowserCompilation: 'not-run', customerEnvironment: 'not-run' });
  assert.equal(installed.capabilities.validation.coreBrowserCompilation, 'not-run');
  assert.equal(mock.calls.length, 2);
  assert.equal((await inspectRuntime(root)).status, 'installed');
  assert.equal((await ensureRuntime(root, { run: mock.run, env, update: true })).status, 'installed');
  assert.equal(mock.calls.length, 2);
  assert.deepEqual((await readdir(root)).filter((name) => name.startsWith('.candidate-')), []);
});

for (const [label, options, error] of [
  ['install error', { installFail: true }, /NPM_INSTALL_FAILED/],
  ['lock drift', { lockChanged: true }, /RUNTIME_LOCK_CHANGED/],
  ['missing optional E10 peer', { missingPeer: true }, /RUNTIME_DEPENDENCY_MISSING_OR_INVALID/],
  ['core success is not E10 success', { diagnosis: { ...diagnosis, scope: 'core' } }, /RUNTIME_E10_DOCTOR_FAILED/],
  ['E10 smoke failure', { diagnosis: { ...diagnosis, uiCodeMcp: { ok: false } } }, /RUNTIME_E10_DOCTOR_FAILED/],
]) {
  test(`failed candidate preserves legacy active state: ${label}`, async (t) => {
    const root = await temporary(t), previous = JSON.stringify({ schema: 1, version: '0.0.1', scope: 'gated-full' });
    await put(root, 'active.json', previous);
    await put(root, 'releases/0.0.1/keep.txt', 'existing runtime');
    const mock = runner(options);
    await assert.rejects(ensureRuntime(root, { update: true, run: mock.run, env }), error);
    assert.equal(await readFile(path.join(root, 'active.json'), 'utf8'), previous);
    assert.equal(await readFile(path.join(root, 'releases/0.0.1/keep.txt'), 'utf8'), 'existing runtime');
    assert.deepEqual((await readdir(root)).filter((name) => name.startsWith('.candidate-') || name === '.install.lock'), []);
  });
}

test('legacy runtime requires explicit update and remains available on disk after migration', async (t) => {
  const root = await temporary(t), mock = runner();
  await put(root, 'active.json', { schema: 1, version: '0.0.1', scope: 'gated-full' });
  await put(root, 'releases/0.0.1/keep.txt', 'existing runtime');
  await assert.rejects(ensureRuntime(root, { run: mock.run, env }), /RUNTIME_LEGACY_UNPINNED/);
  assert.equal(mock.calls.length, 0);
  assert.equal((await ensureRuntime(root, { run: mock.run, env, update: true })).status, 'installed');
  assert.equal(await readFile(path.join(root, 'releases/0.0.1/keep.txt'), 'utf8'), 'existing runtime');
});

test('dependency version and lock drift are invalid, not a new first install', async (t) => {
  const root = await temporary(t), mock = runner();
  const installed = await ensureRuntime(root, { run: mock.run, env });
  const manifest = path.join(installed.releaseRoot, 'node_modules/postcss/package.json');
  const original = await readFile(manifest, 'utf8');
  await writeFile(manifest, JSON.stringify({ ...JSON.parse(original), version: '0.0.0' }));
  assert.match((await inspectRuntime(root)).reason, /RUNTIME_DEPENDENCY_VERSION_CHANGED/);
  await writeFile(manifest, original);
  await rm(path.join(installed.releaseRoot, 'package-lock.json'));
  assert.equal((await inspectRuntime(root)).status, 'invalid');
  await assert.rejects(ensureRuntime(root, { run: mock.run, env }), /RUNTIME_INVALID/);
  assert.equal(mock.calls.length, 2);
});

test('unknown registry is rejected before install; latest is report-only', async (t) => {
  const root = await temporary(t), mock = runner();
  await assert.rejects(ensureRuntime(root, { run: mock.run, env: { ...env, ECODE_PAGE_NPM_REGISTRY: 'https://invalid.test' } }), /REGISTRY_OVERRIDE_REJECTED/);
  assert.equal(mock.calls.length, 0);
  let reports = 0;
  const latest = await latestVersion({ env, run: async (_command, args, context) => {
    reports++;
    assert.ok(args.includes('view') && !args.includes('ci'));
    assert.equal(context.env.NPM_TOKEN, undefined);
    return { code: 0, stdout: '"9.9.9"', stderr: '' };
  } });
  assert.equal(latest, '9.9.9');
  assert.equal(reports, 1);
  assert.equal((await ensureRuntime(root, { run: mock.run, env })).version, '0.1.71');
});

test('managed contract rejects wrong E10 version and missing component manifest', async (t) => {
  const root = await temporary(t);
  await fakeInstall(root);
  const file = path.join(root, 'node_modules/ui-code-mcp/package.json');
  const original = await readFile(file, 'utf8');
  await writeFile(file, JSON.stringify({ ...JSON.parse(original), version: '0.2.35' }));
  await assert.rejects(assertManagedContract(root), /MANAGED_E10_PEER_UNSUPPORTED/);
  await writeFile(file, original);
  await put(root, 'node_modules/ui-code-mcp/componentData/catalog.json', { schemaVersion: 3, libraries: [] });
  await assert.rejects(assertManagedContract(root), /MANAGED_E10_KNOWLEDGE_UNSUPPORTED/);
});
