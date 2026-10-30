import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { writePortableZip } from "./portable-zip.mjs";

import { createId, normalizeRelative, walk } from "./common.mjs";
import { compileE10, wrapE10Module } from "./compiler.mjs";
import {
  EB_CUSTOM_EMPTY_FILES,
  isEbCustomComponent,
  validateEbCustomComponentProject,
} from "./eb-custom-component.mjs";
import {
  isBusinessComponent,
  validateBusinessComponentProject,
} from "./business-component.mjs";
import {
  FEATURE_THEME_EMPTY_PRELOAD_FILES,
  isFeatureTheme,
  validateFeatureThemeProject,
} from "./feature-theme.mjs";

const EB_CUSTOM_EMPTY_SET = new Set(EB_CUSTOM_EMPTY_FILES);
const FEATURE_THEME_EMPTY_SET = new Set(FEATURE_THEME_EMPTY_PRELOAD_FILES);

function rootFolder(buildJson, projectDirectory) {
  const root = {
    appUUID: buildJson.appUUID || createId(),
    id: buildJson.id || createId(),
    attribute: "P",
    debugFlag: buildJson.debugFlag || "n",
    deleteType: 0,
    displayOrder: 10000,
    lockFlag: buildJson.lockFlag || "n",
    treeType: "R",
    systemFlag: buildJson.systemFlag || "n",
    name: buildJson.name || path.basename(projectDirectory),
    flowNum: 0,
    officialFlag: buildJson.officialFlag || "n",
  };
  if (isEbCustomComponent(buildJson)) {
    Object.assign(root, {
      appMode: 2,
      pcOrMobile: buildJson.pcOrMobile || "A",
      commonFlag: buildJson.commonFlag || "n",
      isTheme: buildJson.isTheme || "n",
      isVue: buildJson.isVue ?? 0,
    });
  } else if (isBusinessComponent(buildJson) || isFeatureTheme(buildJson)) {
    Object.assign(root, {
      appMode: Number(buildJson.appMode),
      pcOrMobile: buildJson.pcOrMobile || "A",
      commonFlag: buildJson.commonFlag || "n",
      isTheme: buildJson.isTheme || "n",
      isVue: buildJson.isVue ?? 0,
    });
  }
  return root;
}

function folderRecord(root, name, parentId, parentIds, attribute = "N") {
  return {
    appUUID: root.appUUID,
    rootFolderId: root.id,
    debugFlag: root.debugFlag,
    deleteType: 0,
    displayOrder: 10000,
    lockFlag: root.lockFlag,
    name,
    flowNum: 0,
    id: createId(),
    officialFlag: root.officialFlag,
    systemFlag: root.systemFlag,
    treeType: "R",
    parentId,
    parentIds,
    attribute,
  };
}

function isPositiveDecimalId(value) {
  return /^[1-9]\d*$/.test(String(value));
}

function createPositiveId() {
  let id = "0";
  while (id === "0") id = createId();
  return id;
}

async function restoreZipBackups(backups) {
  const restoreErrors = [];
  for (const backup of [...backups].reverse()) {
    try {
      await rename(backup.backup, backup.original);
    } catch (error) {
      restoreErrors.push(`${path.basename(backup.original)} (${error.message})`);
    }
  }
  if (restoreErrors.length > 0) {
    console.error(`恢复旧补丁包失败，备份仍保留: ${restoreErrors.join("; ")}`);
  }
}

async function backupExistingZips(targetDirectory, currentName) {
  const backups = [];
  try {
    for (const entry of await readdir(targetDirectory, { withFileTypes: true })) {
      // 只替换当前应用的产物；其他 ZIP 不属于本次构建的清理范围。
      if (!entry.isFile() || entry.name !== currentName) continue;
      const original = path.join(targetDirectory, entry.name);
      const backup = path.join(targetDirectory, `.${randomUUID()}.ecodecmd-backup`);
      await rename(original, backup);
      backups.push({ original, backup });
    }
    return backups;
  } catch (error) {
    await restoreZipBackups(backups);
    throw new Error(`备份旧补丁包失败: ${error.message}`);
  }
}

export async function checkProject(projectDirectory) {
  const rootPath = path.resolve(projectDirectory);
  const buildJson = JSON.parse(await readFile(path.join(rootPath, "build.json"), "utf8"));
  if (isEbCustomComponent(buildJson)) {
    await validateEbCustomComponentProject(rootPath, buildJson);
  } else if (isFeatureTheme(buildJson)) {
    await validateFeatureThemeProject(rootPath, buildJson);
  } else if (isBusinessComponent(buildJson)) {
    await validateBusinessComponentProject(rootPath, buildJson);
  }
  return { rootPath, buildJson };
}

export async function buildProject(projectDirectory) {
  const { rootPath, buildJson } = await checkProject(projectDirectory);
  const customComponent = isEbCustomComponent(buildJson);
  const featureTheme = isFeatureTheme(buildJson);
  let idsChanged = false;
  for (const key of ["id", "appId", "appUUID"]) {
    if (buildJson[key] === undefined || buildJson[key] === null || String(buildJson[key]).trim() === "") {
      buildJson[key] = createPositiveId();
      idsChanged = true;
    }
  }
  for (const key of ["id", "appId", "appUUID"]) {
    if (!isPositiveDecimalId(buildJson[key])) {
      throw new Error(`${key} 必须是正整数`);
    }
  }
  if (idsChanged) {
    const buildJsonPath = path.join(rootPath, "build.json");
    const temporaryBuildJson = path.join(rootPath, `.build.json.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryBuildJson, `${JSON.stringify(buildJson, null, 2)}\n`);
      await rename(temporaryBuildJson, buildJsonPath);
    } catch (error) {
      await rm(temporaryBuildJson, { force: true });
      throw new Error(`回写 build.json 失败: ${error.message}`);
    }
  }
  const root = rootFolder(buildJson, rootPath);
  const patch = {
    rootFolders: [root],
    codes: [],
    folders: [],
    cronAttrs: [],
    datasources: [],
    resources: [],
    funcAttrs: [],
  };
  const packageId = randomUUID().replaceAll("-", "").toUpperCase();
  const staging = path.join(rootPath, ".ecode-runtime", "build", packageId);
  const packageDirectory = path.join(staging, packageId);
  // E10 import packages use the literal directory name "${resources".
  // The missing closing brace is intentional and matches platform exports.
  const resourceOutput = path.join(packageDirectory, root.id, "${resources");
  await mkdir(packageDirectory, { recursive: true });
  const resourceFolder = folderRecord(root, "resources", root.id, `,${root.id},`, "R");
  resourceFolder.systemFlag = "y";
  patch.folders.push(resourceFolder);

  const { files, directories } = await walk(rootPath, {
    excluded: [".target", ".ecode-runtime", ".git"],
  });
  const folderIds = new Map([[rootPath, root.id]]);
  const folderParents = new Map([[rootPath, `,${root.id},`]]);
  for (const directory of directories.sort((a, b) => a.length - b.length)) {
    const relative = normalizeRelative(rootPath, directory);
    if (relative === "resources" || relative.startsWith("resources/")) continue;
    const parent = path.dirname(directory);
    const parentId = folderIds.get(parent) ?? root.id;
    const parentIds = folderParents.get(parent) ?? `,${root.id},`;
    const isConfig = relative === "config" || relative.startsWith("config/");
    const folder = folderRecord(root, path.basename(directory), parentId, parentIds, isConfig ? "G" : "N");
    if (isConfig) folder.systemFlag = "y";
    folderIds.set(directory, folder.id);
    folderParents.set(directory, `${folder.parentIds}${folder.id},`);
    patch.folders.push(folder);
  }

  for (const filename of files) {
    const relative = normalizeRelative(rootPath, filename);
    if (relative === "build.json") continue;
    if (relative.startsWith("resources/")) {
      const output = path.join(resourceOutput, relative.slice("resources/".length));
      await mkdir(path.dirname(output), { recursive: true });
      await cp(filename, output);
      patch.resources.push({
        attribute: "RF",
        deleteType: 0,
        extension: path.extname(filename).slice(1),
        name: path.basename(filename),
        parentId: resourceFolder.id,
        rootFolderId: root.id,
        id: createId(),
        fileId: createId(),
      });
      continue;
    }
    const extension = path.extname(filename);
    if (![".js", ".css"].includes(extension)) continue;
    const source = await readFile(filename, "utf8");
    const compiledSource = extension === ".js" ? compileE10(source, filename) : source;
    // EB 固定空文件允许经过编译器，但最终产物必须保持空，不能添加模块包装代码。
    const preserveEmptyCompiled = customComponent && EB_CUSTOM_EMPTY_SET.has(relative)
      || featureTheme && FEATURE_THEME_EMPTY_SET.has(relative);
    const compiled = preserveEmptyCompiled
      ? ""
      : extension === ".js" ? wrapE10Module(compiledSource, relative) : compiledSource;
    if (customComponent && EB_CUSTOM_EMPTY_SET.has(relative) && (source.length !== 0 || compiled.length !== 0)) {
      throw new Error(`EB_CUSTOM_PRELOAD_COMPILED_NOT_EMPTY: ${relative}`);
    }
    if (featureTheme && FEATURE_THEME_EMPTY_SET.has(relative) && (source.length !== 0 || compiled.length !== 0)) {
      throw new Error(`FEATURE_THEME_PRELOAD_COMPILED_NOT_EMPTY: ${relative}`);
    }
    const parentId = folderIds.get(path.dirname(filename)) ?? root.id;
    const config = buildJson.codes?.[relative] ?? {};
    const isConfig = relative.startsWith("config/");
    patch.codes.push({
      attribute: isConfig ? "GC" : "NC",
      compiledContent: Buffer.from(compiled).toString("base64"),
      name: path.basename(filename, extension),
      flowNum: 0,
      compiledId: createId(),
      compress: config.compress || "n",
      content: Buffer.from(source).toString("base64"),
      deleteType: 0,
      extension,
      id: createId(),
      rootFolderId: root.id,
      sourceId: 0,
      systemFlag: isConfig ? "y" : root.systemFlag,
      state: config.state || "n",
      parentId,
      parentIds: folderParents.get(path.dirname(filename)) ?? `,${root.id},`,
    });
  }

  await writeFile(path.join(packageDirectory, "ecode.json"), `${JSON.stringify(patch, null, 2)}\n`);
  const targetDirectory = path.join(rootPath, ".target");
  await mkdir(targetDirectory, { recursive: true });
  const appId = String(buildJson.appId);
  const output = path.join(targetDirectory, `${appId}.zip`);
  const temporaryOutput = path.join(targetDirectory, `.${appId}.${packageId}.zip.tmp`);
  let backups = [];
  let published = false;
  try {
    const entries = await writePortableZip(staging, temporaryOutput);
    const packageEntry = `${packageId}/ecode.json`;
    if (!entries.includes(packageEntry)) {
      throw new Error("生成 ZIP 结构校验失败：缺少 ecode.json");
    }
    backups = await backupExistingZips(targetDirectory, `${appId}.zip`);
    await rename(temporaryOutput, output);
    published = true;
    for (const backup of backups)
      console.error(`旧补丁包已保留为可恢复备份: ${path.basename(backup.backup)}`);
  } catch (error) {
    await rm(temporaryOutput, { force: true });
    if (!published && backups.length > 0) await restoreZipBackups(backups);
    if (error.message.startsWith("生成 ZIP 结构校验失败")) throw error;
    throw new Error(`生成 ZIP 失败: ${error.message}`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return output;
}
