#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { ensureRuntime, inspectRuntime, protocolPaths, runtimeEnvironment, runtimeRoot } from './runtime.mjs';
import { invalidatePageAuth, syncSession, withPageSessionLock } from './session-bridge.mjs';
import { approvalPlan, consumeApproval } from './approval.mjs';
import { validateDataWrite } from './data-write.mjs';

const LOGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../e10-login-cli/scripts/e10-login-cli.mjs');
const DEFAULT_STATE = path.resolve(homedir(), '.weaver-cc-assistant/sessions/default.json');
const LOCAL = new Set(['init', 'inputs', 'design-style', 'spec', 'components', 'icons', 'plan', 'scaffold', 'evidence', 'validate', 'preview', 'inspect', 'report', 'doctor', 'user-message', 'help', '--help', '-h', 'version', '--version', '-V']);
const LOCAL_PORTAL_DATA = new Set(['status', 'material', 'keep-mock']);
const PLATFORM_READ = new Set(['projects', 'inspect', 'checkout', 'verify-page', 'doctor']);
const PLATFORM_WRITE = new Set(['check', 'import', 'deploy']);
const PUBLISH_TARGET_READ = new Set(['status', 'decide', 'select', 'list-eb', 'search-eb', 'application-input', 'select-eb', 'propose-name', 'confirm-name']);
const PUBLISH_TARGET_WRITE = new Set(['create-eb-page', 'create-portal-page']);

export function parseInvocation(argv) {
  const separator = argv.indexOf('--');
  const head = separator < 0 ? argv : argv.slice(0, separator);
  const args = separator < 0 ? [] : argv.slice(separator + 1);
  const command = head[0];
  const parsed = parseArgs({ args: head.slice(1), options: { state: { type: 'string' }, 'approval-file': { type: 'string' } }, strict: true });
  if (!['status', 'ensure', 'update', 'doctor', 'protocol', 'sync', 'run', 'plan', 'help'].includes(command)) throw new Error('ARGUMENT_INVALID');
  if (['run', 'plan'].includes(command) && !args.length) throw new Error('ARGUMENT_INVALID: run|plan -- <ui-code-agent arguments>');
  if (!['run', 'plan'].includes(command) && args.length) throw new Error('ARGUMENT_INVALID');
  if (command !== 'run' && parsed.values['approval-file']) throw new Error('ARGUMENT_INVALID: approval file is for run only');
  return { command, args, statePath: parsed.values.state || DEFAULT_STATE, approvalFile: parsed.values['approval-file'] };
}

export function classifyInvocation(args) {
  const [command, subcommand] = args;
  if (command === 'auth' && subcommand === 'status' && args.length === 2) return 'auth-status';
  if (command === 'auth') throw new Error('AUTH_MANAGED: use e10-login-cli');
  if (command === 'data-write') {
    if (!['create_form', 'batch_create_fields', 'save_sample_data'].includes(subcommand)) throw new Error('DATA_WRITE_TOOL_UNSUPPORTED');
    const parsed = parseArgs({ args: args.slice(2), options: { 'input-file': { type: 'string' } }, strict: true });
    if (!parsed.values['input-file'] || parsed.positionals.length || args.length !== 4 || args[2] !== '--input-file') throw new Error('DATA_WRITE_INPUT_INVALID');
    return 'data-write';
  }
  if (command === 'delivery-decision' && ['approve', 'review-data', 'approve-data'].includes(subcommand)) return 'local';
  if (command === 'portal-data' && LOCAL_PORTAL_DATA.has(subcommand)) {
    parseArgs({ args: args.slice(2), options: { dir: { type: 'string' }, note: { type: 'string' }, json: { type: 'boolean' } }, strict: true });
    return 'local';
  }
  if (command === 'portal-data') return 'auth-read';
  if (command === 'data-plan' && subcommand === 'open-config') return 'publish';
  if (command === 'data-plan' || command === 'eb-form') return 'auth-read';
  if (command === 'platform' && PLATFORM_READ.has(subcommand)) return 'auth-read';
  if (command === 'platform' && PLATFORM_WRITE.has(subcommand)) return 'publish';
  if (command === 'publish-target' && PUBLISH_TARGET_READ.has(subcommand)) return 'auth-read';
  if (command === 'publish-target' && PUBLISH_TARGET_WRITE.has(subcommand)) return 'publish';
  if (command === 'build') return 'build';
  if (command === 'next') return 'next';
  if (LOCAL.has(command)) return 'local';
  throw new Error('COMMAND_NOT_APPROVED: unknown or unsupported page command');
}

function projectDir(args) {
  const index = args.indexOf('--dir');
  if (index < 0) return process.cwd();
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('ARGUMENT_INVALID: --dir requires a path');
  return path.resolve(args[index + 1]);
}

async function synchronize(statePath, root, runtime) {
  try {
    const { pageAgentSessionContext } = await import(LOGIN);
    const { session, expectedTenant, expectedUser } = await pageAgentSessionContext(statePath);
    const result = await syncSession(session, { runtimeRoot: root, runtime, expectedTenant, expectedUser, lockHeld: true });
    if (result.status !== 'synchronized') throw new Error('SYNC_NOT_READY');
    return result;
  } catch {
    await invalidatePageAuth(root);
    throw new Error('PAGE_AUTH_UNAVAILABLE: use e10-login-cli login/switch; stale page identity cleared');
  }
}

async function execute(script, args, env) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env, shell: false, stdio: 'inherit' });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    child.once('error', reject);
    child.once('close', (code, signal) => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function executeUi(runtime, args, env, allowPublish = false) {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'launch-ui-code-agent.mjs');
  return await execute(script, [runtime.packageRoot, '--', ...args], { ...env, ECODE_PAGE_ALLOW_PUBLISH: allowPublish ? '1' : '0' });
}

async function runtimeModule(runtime, filename) {
  return await import(pathToFileURL(path.join(runtime.packageRoot, 'dist', filename)).href);
}

async function localBuild(runtime, args) {
  const dir = projectDir(args);
  const { readProjectKind } = await runtimeModule(runtime, 'project-kind.js');
  if (readProjectKind(dir) !== 'static-html') throw new Error('LOCAL_BUILD_STATIC_HTML_ONLY: e10-page packaging is disabled');
  const [{ checkStaticHtmlInspection }, { checkPortalDataGate }, { checkDeliveryGate }, { packageStaticHtmlProject }] = await Promise.all([
    runtimeModule(runtime, 'static-html-inspection.js'),
    runtimeModule(runtime, 'portal-data.js'),
    runtimeModule(runtime, 'delivery-gate.js'),
    runtimeModule(runtime, 'static-html.js'),
  ]);
  if (!checkStaticHtmlInspection(dir).ok) throw new Error('LOCAL_BUILD_INSPECTION_REQUIRED');
  if (!checkPortalDataGate(dir).allowed) throw new Error('LOCAL_BUILD_MOCK_DATA_DECISION_REQUIRED');
  if (!checkDeliveryGate(dir).allowed) throw new Error('LOCAL_BUILD_PREVIEW_APPROVAL_REQUIRED');
  const result = await packageStaticHtmlProject(dir);
  if (result.code !== 0 || !result.artifact || !result.sha256) throw new Error(`LOCAL_BUILD_FAILED: ${JSON.stringify(result.issues || [])}`);
  console.log(JSON.stringify({ status: 'local-artifact-ready-unpublished', artifact: result.artifact, sha256: result.sha256, resourceCount: result.resourceCount }));
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  const input = parseInvocation(argv);
  const root = runtimeRoot();
  if (input.command === 'help') {
    console.log('page-agent.mjs status|ensure|update|doctor|protocol|sync [--state <file>]\npage-agent.mjs plan [--state <file>] -- <publish or data-write command>\npage-agent.mjs run [--state <file>] [--approval-file <approved-plan.json>] -- <page command>\nFirst page use installs the reviewed dependency lock bundled with CC. Unknown latest versions are not installed automatically. Remote writes require a fresh operation-bound plan and explicit user confirmation.');
    return 0;
  }
  if (input.command === 'status') {
    const status = await inspectRuntime(root);
    console.log(JSON.stringify({ status: status.status, version: status.version, scope: 'gated-full', capabilities: status.capabilities, verification: status.verification, reason: status.reason }));
    return 0;
  }
  const kind = ['run', 'plan'].includes(input.command) ? classifyInvocation(input.args) : undefined;
  if (input.command === 'plan' && !['publish', 'data-write'].includes(kind)) throw new Error('PLAN_ONLY_FOR_REMOTE_WRITE');
  if (input.command === 'run' && ['publish', 'data-write'].includes(kind) && !input.approvalFile) throw new Error('APPROVAL_REQUIRED: run plan first, then obtain explicit user confirmation');
  if (input.command === 'run' && !['publish', 'data-write'].includes(kind) && input.approvalFile) throw new Error('APPROVAL_NOT_APPLICABLE');
  const runtime = await ensureRuntime(root, { update: input.command === 'update' });
  if (runtime.status !== 'installed') throw new Error('RUNTIME_NOT_INSTALLED');
  if (input.command === 'ensure' || input.command === 'update') {
    console.log(JSON.stringify({ status: runtime.status, version: runtime.version, scope: 'gated-full', capabilities: runtime.capabilities, verification: runtime.verification }));
    return 0;
  }
  if (input.command === 'protocol') {
    console.log(JSON.stringify({ ...protocolPaths(runtime), version: runtime.version, scope: 'gated-full', verification: runtime.verification, integrationPriority: 'ecode-dev-tools approval gates override upstream automatic publication and data-write instructions' }));
    return 0;
  }
  if (input.command === 'doctor') return await executeUi(runtime, ['doctor', '--json'], runtimeEnvironment(root));
  return await withPageSessionLock(root, async () => {
    if (input.command === 'sync') {
      console.log(JSON.stringify(await synchronize(input.statePath, root, runtime)));
      return 0;
    }
    if (input.command === 'plan') {
      const identity = await synchronize(input.statePath, root, runtime);
      console.log(JSON.stringify(await approvalPlan({ operation: kind, args: input.args, runtime, identity }), null, 2));
      return 0;
    }
    if (kind === 'auth-status') {
      await synchronize(input.statePath, root, runtime);
      return await executeUi(runtime, input.args, runtimeEnvironment(root, process.env, true));
    }
    // 下载/安装运行时不代表获准读取既存会话或访问客户环境。
    // next 可能只是推进本地制作流程，不通过试探认证来猜测用户的远端授权。
    if (kind === 'next')
      return await executeUi(runtime, input.args, runtimeEnvironment(root));
    if (kind === 'publish' || kind === 'data-write') {
      const identity = await synchronize(input.statePath, root, runtime);
      const inputIndex = input.args.indexOf('--input-file');
      if (kind === 'data-write') {
        if (inputIndex < 0 || !input.args[inputIndex + 1]) throw new Error('DATA_WRITE_INPUT_INVALID');
        validateDataWrite(input.args[1], JSON.parse(await readFile(path.resolve(input.args[inputIndex + 1]), 'utf8')));
      }
      await consumeApproval(input.approvalFile, { operation: kind, args: input.args, runtimeVersion: runtime.version, origin: identity.baseUrl, tenantKey: identity.tenantKey, userId: identity.userId }, root);
      const env = runtimeEnvironment(root, process.env, true);
      if (kind === 'publish') return await executeUi(runtime, input.args, env, true);
      return await execute(path.join(path.dirname(fileURLToPath(import.meta.url)), 'data-write.mjs'), [runtime.packageRoot, input.args[1], path.resolve(input.args[inputIndex + 1])], env);
    }
    if (kind === 'auth-read' || kind === 'build') {
      if (kind === 'build') {
        const { readProjectKind } = await runtimeModule(runtime, 'project-kind.js');
        if (readProjectKind(projectDir(input.args)) === 'static-html') return await localBuild(runtime, input.args);
      }
      await synchronize(input.statePath, root, runtime);
      return await executeUi(runtime, input.args, runtimeEnvironment(root, process.env, true));
    }
    const env = runtimeEnvironment(root);
    if (['help', '--help', '-h'].includes(input.args[0])) {
      console.log('1.3.4 page commands use one-login session. Publication and business-data writes require plan -> user confirmation -> run --approval-file. e10-page build is available and does not itself publish.');
      return 0;
    }
    return await executeUi(runtime, input.args, env);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
