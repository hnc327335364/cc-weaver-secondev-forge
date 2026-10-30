#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertManagedContract, FORM_WRITE_TOOLS } from './managed-contract.mjs';

export function validateDataWrite(tool, input) {
  if (!FORM_WRITE_TOOLS.includes(tool) || !input || typeof input !== 'object' || Array.isArray(input) || Object.hasOwn(input, 'auth')) throw new Error('DATA_WRITE_INPUT_INVALID');
  const string = (name) => typeof input[name] === 'string' && input[name].trim().length > 0;
  if (tool === 'create_form' && (!string('appId') || !string('name'))) throw new Error('DATA_WRITE_INPUT_INVALID');
  if (tool === 'batch_create_fields' && (!string('appId') || !string('objId') || !string('formId') || !Array.isArray(input.fields) || !input.fields.length)) throw new Error('DATA_WRITE_INPUT_INVALID');
  if (tool === 'save_sample_data' && (!string('objId') || !input.formData || typeof input.formData !== 'object' || Array.isArray(input.formData))) throw new Error('DATA_WRITE_INPUT_INVALID');
  return input;
}

export async function writeData(packageRoot, tool, inputFile) {
  const releaseRoot = path.dirname(path.dirname(packageRoot));
  await assertManagedContract(releaseRoot);
  const input = validateDataWrite(tool, JSON.parse(await readFile(inputFile, 'utf8')));
  const { withFormServiceMcpSession } = await import(pathToFileURL(path.join(packageRoot, 'dist/data-binding/mcp-client.js')).href);
  if (typeof withFormServiceMcpSession !== 'function') throw new Error('DATA_WRITE_ABI_UNSUPPORTED');
  const result = await withFormServiceMcpSession((client) => client.call(tool, input));
  if (result?.success !== true) throw new Error('DATA_WRITE_RESULT_UNVERIFIED');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [packageRoot, tool, inputFile] = process.argv.slice(2);
  if (!packageRoot || !tool || !inputFile || process.argv.length !== 5) throw new Error('Usage: data-write.mjs <packageRoot> <tool> <inputFile>');
  try { console.log(JSON.stringify(await writeData(packageRoot, tool, inputFile))); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
