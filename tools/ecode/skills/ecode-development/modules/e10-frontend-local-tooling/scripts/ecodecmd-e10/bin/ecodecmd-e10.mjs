#!/usr/bin/env node

import { buildProject, checkProject } from "../src/build.mjs";
import { compilePath } from "../src/compile.mjs";
import { initProject } from "../src/init.mjs";

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const [rawKey, inline] = value.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (inline !== undefined) options[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) options[key] = argv[++index];
    else options[key] = true;
  }
  return { positional, options };
}

function help() {
  console.log(`ecodecmd-e10 - E10 frontend project init, compile, check, and package tool

Usage:
  ecodecmd-e10 init <parent-path> --project-name <name> [--app-type eb-custom-component|business-component|feature-theme] [--force]
  ecodecmd-e10 compile <file-or-directory>
  ecodecmd-e10 check <project-path>
  ecodecmd-e10 build <project-path>
`);
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [command, target] = positional;
  if (!command || command === "help" || options.help) return help();
  if (command === "init") {
    console.log(`E10 项目已初始化: ${await initProject(target, options)}`);
    return;
  }
  if (command === "compile") {
    console.log(`E10 编译检查通过: ${(await compilePath(target)).length} 个文件`);
    return;
  }
  if (command === "check") {
    await checkProject(target);
    console.log("E10 工程规则检查通过");
    return;
  }
  if (command === "build") {
    console.log(`E10 补丁包生成成功: ${await buildProject(target)}`);
    return;
  }
  throw new Error(`未知命令: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
