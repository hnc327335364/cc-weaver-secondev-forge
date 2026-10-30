import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const PLATFORM_WRITE_METHODS = Object.freeze([
  'projectCreate', 'appPublish', 'createEbuilderPage', 'uploadEbuilderThumbnail',
  'createPortalPage', 'packageCheckUpload', 'packageImport',
]);
export const FORM_WRITE_TOOLS = Object.freeze(['create_form', 'batch_create_fields', 'save_sample_data']);

export async function assertManagedContract(releaseRoot, { uiCodeMcpVersion = '0.2.34' } = {}) {
  const modules = path.join(releaseRoot, 'node_modules');
  const read = (name) => readFile(path.join(modules, name), 'utf8');
  const [index, platform, publish, build, next, mcp, ecodeClient, service] = await Promise.all([
    read('ui-code-agent/dist/index.js'),
    read('ui-code-agent/dist/commands/platform.js'),
    read('ui-code-agent/dist/commands/publish-target.js'),
    read('ui-code-agent/dist/commands/build.js'),
    read('ui-code-agent/dist/commands/next.js'),
    read('ui-code-agent/dist/data-binding/mcp-client.js'),
    read('@ui-code-agent/ecode-platform/dist/client.js'),
    read('ui-service-mcp/dist/server.js'),
  ]);
  const required = [
    [index, /void main\(\)/u],
    [platform, /export async function runPlatform\(/u],
    [publish, /export async function runPublishTarget\(/u],
    [build, /export async function runBuild\(/u],
    [build, /packageProjectWithAppIdStaging/u],
    [next, /recordPublishDecision\(projectDir, 'publish'\)/u],
    [mcp, /export class FormServiceMcpClient/u],
    [mcp, /async call\(tool, args\)/u],
    [mcp, /this\.request\('tools\/call'/u],
    [ecodeClient, /export class EcodeClient/u],
  ];
  if (required.some(([source, pattern]) => !pattern.test(source))) throw new Error('MANAGED_CONTRACT_UNSUPPORTED');
  for (const tool of FORM_WRITE_TOOLS) {
    if (!mcp.includes(`'${tool}'`) || !service.includes(`${tool}:`)) throw new Error(`MANAGED_FORM_TOOL_UNSUPPORTED: ${tool}`);
  }
  for (const method of PLATFORM_WRITE_METHODS) {
    if (!new RegExp(`\\b(?:async )?${method}\\(`, 'u').test(ecodeClient)) throw new Error(`MANAGED_PLATFORM_METHOD_UNSUPPORTED: ${method}`);
  }
  if (!/const WRITE_TOOLS = new Set\(\['create_form', 'batch_create_fields', 'save_sample_data'\]\)/u.test(mcp)) {
    throw new Error('MANAGED_FORM_WRITE_SET_CHANGED');
  }
  // optional peer 可能被 npm 跳过；core doctor 成功不能证明 E10 组件体系已安装。
  const [manifest, peer, server, catalog, collections, preview, checksums, auth] = await Promise.all([
    read('ui-code-agent/package.json').then(JSON.parse),
    read('ui-code-mcp/package.json').then(JSON.parse),
    read('ui-code-mcp/release/server.mjs'),
    read('ui-code-mcp/componentData/catalog.json').then(JSON.parse),
    read('ui-code-mcp/componentData/component-collections.json').then(JSON.parse),
    read('ui-code-mcp/previewRuntime/manifest.json').then(JSON.parse),
    read('ui-code-mcp/componentData/checksums.json').then(JSON.parse),
    read('ui-code-agent/dist/environment-auth.js'),
    ...['SKILL.md', 'AGENTS.md', 'AGENTS-static.md'].map((name) => read(`@ui-code-agent/capability-pack/${name}`)),
  ]);
  if (manifest.peerDependencies?.['ui-code-mcp'] !== uiCodeMcpVersion || manifest.peerDependenciesMeta?.['ui-code-mcp']?.optional !== true || peer.name !== 'ui-code-mcp' || peer.version !== uiCodeMcpVersion || peer.bin?.['ui-code-mcp'] !== 'release/server.mjs') throw new Error('MANAGED_E10_PEER_UNSUPPORTED');
  if (!/createRuntimeAsync\(\)/u.test(server) || !/connect\(new StdioServerTransport\(\)\)/u.test(server)) throw new Error('MANAGED_E10_STDIO_UNSUPPORTED');
  if (catalog.schemaVersion !== 3 || !['weapp-ui', 'weapp-ebdcontainercoms'].every((id) => catalog.libraries?.some((library) => library.id === id)) || !collections.items?.some((item) => item.id === 'portal-pc' && item.members?.length) || preview.schemaVersion !== 1 || preview.library?.id !== 'weapp-ui' || !preview.entrypoints?.scripts?.length || !/^[a-f0-9]{64}$/u.test(checksums['catalog.json'] || '') || !/^[a-f0-9]{64}$/u.test(checksums['component-collections.json'] || '')) throw new Error('MANAGED_E10_KNOWLEDGE_UNSUPPORTED');
  if (!/export async function setEnvironmentAuth\(/u.test(auth) || !/export async function verifyEnvironmentAuth\(/u.test(auth)) throw new Error('AUTH_BRIDGE_UNSUPPORTED');
  return { e10PagePackage: true, publish: true, businessDataWrite: true };
}
