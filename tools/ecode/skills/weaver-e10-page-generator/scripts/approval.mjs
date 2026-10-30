import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function option(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`APPROVAL_ARGUMENT_INVALID: ${name}`);
  return args[index + 1];
}

async function hashIfPresent(filename) {
  try { return sha256(await readFile(filename)); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function operationEvidence(args) {
  const [command, action] = args;
  const directory = option(args, '--dir');
  const fileOption = option(args, '--file');
  if ((command === 'platform' && action === 'deploy' || command === 'publish-target' || command === 'data-plan' && action === 'open-config') && !directory) {
    throw new Error('APPROVAL_DIR_REQUIRED');
  }
  if (command === 'platform' && ['check', 'import'].includes(action) && (!fileOption || !option(args, '--project-id'))) {
    throw new Error('APPROVAL_PACKAGE_TARGET_REQUIRED');
  }
  if (command === 'data-write' && !option(args, '--input-file')) throw new Error('APPROVAL_INPUT_REQUIRED');
  const evidence = {};
  for (const name of ['--input-file', '--file']) {
    const value = option(args, name);
    if (value) {
      const resolved = command === 'data-plan' && action === 'open-config' && name === '--file'
        ? path.resolve(directory, value) : path.resolve(value);
      const file = await lstat(resolved);
      if (!file.isFile() || file.isSymbolicLink()) throw new Error('APPROVAL_FILE_INVALID');
      evidence[name] = { path: resolved, sha256: sha256(await readFile(resolved)) };
    }
  }
  if (directory) {
    const resolved = path.resolve(directory);
    const dirStats = await lstat(resolved);
    if (!dirStats.isDirectory() || dirStats.isSymbolicLink()) throw new Error('APPROVAL_DIR_INVALID');
    const state = path.join(resolved, '.ui-code-agent/publish-target.json');
    evidence.project = { dir: resolved, publishStateSha256: await hashIfPresent(state) };
    if (command === 'data-plan' && action === 'open-config') {
      const handoffPath = path.join(resolved, '.ui-code-agent/configuration-handoff/current.json');
      const handoff = JSON.parse(await readFile(handoffPath, 'utf8'));
      if (!handoff?.json?.path || !handoff?.zip?.path) throw new Error('APPROVAL_HANDOFF_REQUIRED: prepare-handoff first');
      const within = (name) => {
        const filename = path.resolve(resolved, name);
        if (!filename.startsWith(`${resolved}${path.sep}`)) throw new Error('APPROVAL_HANDOFF_PATH_INVALID');
        return filename;
      };
      evidence.project.handoff = {
        receiptSha256: await hashIfPresent(handoffPath),
        jsonSha256: await hashIfPresent(within(handoff.json.path)),
        zipSha256: await hashIfPresent(within(handoff.zip.path)),
      };
      if (!evidence.project.handoff.jsonSha256 || !evidence.project.handoff.zipSha256) throw new Error('APPROVAL_HANDOFF_REQUIRED');
    }
    const target = path.join(resolved, '.target');
    let zips = [];
    try { zips = (await readdir(target)).filter((name) => name.endsWith('.zip')).sort(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    evidence.project.artifacts = [];
    for (const name of zips) {
      const filename = path.join(target, name);
      const file = await lstat(filename);
      if (!file.isFile() || file.isSymbolicLink()) throw new Error('APPROVAL_ARTIFACT_INVALID');
      evidence.project.artifacts.push({ name, sha256: sha256(await readFile(filename)) });
    }
  }
  return evidence;
}

export async function approvalPlan({ operation, args, runtime, identity }) {
  if (!['publish', 'data-write'].includes(operation)) throw new Error('APPROVAL_OPERATION_INVALID');
  return {
    schema: 1,
    approvalId: randomUUID(),
    issuedAt: new Date().toISOString(),
    operation,
    runtimeVersion: runtime.version,
    origin: identity.baseUrl,
    tenantKey: identity.tenantKey,
    userId: identity.userId,
    args,
    evidence: await operationEvidence(args),
    changeSummary: '填写本次具体变更内容；展示给用户确认后才改为 approve',
    decision: 'pending',
  };
}

export async function consumeApproval(filename, expected, runtimeRoot) {
  if (!filename) throw new Error('APPROVAL_REQUIRED: create a plan and obtain explicit user confirmation');
  const source = path.resolve(filename);
  const file = await lstat(source);
  if (!file.isFile() || file.isSymbolicLink() || file.size > 64 * 1024) throw new Error('APPROVAL_FILE_INVALID');
  const approval = JSON.parse(await readFile(source, 'utf8'));
  if (approval.schema !== 1 || !/^[0-9a-f-]{36}$/iu.test(approval.approvalId || '') || approval.decision !== 'approve' ||
      !Number.isFinite(Date.parse(approval.issuedAt)) || Date.now() - Date.parse(approval.issuedAt) < 0 || Date.now() - Date.parse(approval.issuedAt) > 30 * 60 * 1000 ||
      typeof approval.changeSummary !== 'string' || approval.changeSummary.trim().length < 8 ||
      approval.changeSummary.includes('填写本次具体变更内容')) throw new Error('APPROVAL_INCOMPLETE');
  for (const name of ['operation', 'runtimeVersion', 'origin', 'tenantKey', 'userId']) {
    if (approval[name] !== expected[name]) throw new Error(`APPROVAL_STALE: ${name}`);
  }
  if (JSON.stringify(approval.args) !== JSON.stringify(expected.args) || JSON.stringify(approval.evidence) !== JSON.stringify(await operationEvidence(expected.args))) {
    throw new Error('APPROVAL_STALE: command or input changed');
  }
  const used = path.join(runtimeRoot, 'approvals-used');
  await mkdir(used, { recursive: true, mode: 0o700 });
  const marker = await open(path.join(used, approval.approvalId), 'wx', 0o600).catch((error) => {
    if (error.code === 'EEXIST') throw new Error('APPROVAL_ALREADY_USED: verify remote outcome before retry');
    throw error;
  });
  try { await marker.writeFile(`${sha256(await readFile(source))}\n`); }
  finally { await marker.close(); }
  return approval;
}
