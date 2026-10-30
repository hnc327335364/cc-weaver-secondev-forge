#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertManagedContract, FORM_WRITE_TOOLS, PLATFORM_WRITE_METHODS } from './managed-contract.mjs';

export async function launch(packageRoot, args, options = {}) {
  const releaseRoot = path.dirname(path.dirname(packageRoot));
  await assertManagedContract(releaseRoot);
  const mcp = await import(pathToFileURL(path.join(packageRoot, 'dist/data-binding/mcp-client.js')).href);
  const platform = await import(pathToFileURL(path.join(releaseRoot, 'node_modules/@ui-code-agent/ecode-platform/dist/client.js')).href);
  if (typeof mcp.FormServiceMcpClient?.prototype?.call !== 'function' || typeof platform.EcodeClient !== 'function') throw new Error('MANAGED_GATE_UNSUPPORTED');
  const originalCall = mcp.FormServiceMcpClient.prototype.call;
  mcp.FormServiceMcpClient.prototype.call = function (tool, input) {
    if (FORM_WRITE_TOOLS.includes(tool)) throw new Error('DATA_WRITE_APPROVAL_REQUIRED: use page-agent data-write');
    return originalCall.call(this, tool, input);
  };
  for (const method of PLATFORM_WRITE_METHODS) {
    const original = platform.EcodeClient.prototype[method];
    if (typeof original !== 'function') throw new Error(`MANAGED_GATE_UNSUPPORTED: ${method}`);
    platform.EcodeClient.prototype[method] = function (...methodArgs) {
      if (!options.allowPublish) throw new Error('PUBLISH_APPROVAL_REQUIRED');
      return original.apply(this, methodArgs);
    };
  }
  process.argv = [process.execPath, path.join(packageRoot, 'dist/index.js'), ...args];
  await import(pathToFileURL(process.argv[1]).href);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [packageRoot, separator, ...args] = process.argv.slice(2);
  if (!packageRoot || separator !== '--') throw new Error('Usage: launch-ui-code-agent.mjs <packageRoot> -- <args>');
  try { await launch(packageRoot, args, { allowPublish: process.env.ECODE_PAGE_ALLOW_PUBLISH === '1' }); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
