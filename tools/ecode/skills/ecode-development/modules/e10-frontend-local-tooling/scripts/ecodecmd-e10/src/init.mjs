import { access, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createId } from "./common.mjs";
import {
  customComponentBuildFields,
  EB_CUSTOM_APP_TYPE,
} from "./eb-custom-component.mjs";
import {
  BUSINESS_COMPONENT_APP_TYPE,
  businessComponentBuildFields,
} from "./business-component.mjs";
import {
  FEATURE_THEME_APP_TYPE,
  featureThemeBuildFields,
} from "./feature-theme.mjs";

const SUPPORTED_APP_TYPES = new Set([
  EB_CUSTOM_APP_TYPE,
  BUSINESS_COMPONENT_APP_TYPE,
  FEATURE_THEME_APP_TYPE,
]);

function createPositiveId() {
  let id = "0";
  while (id === "0") id = createId();
  return id;
}

export function defaultBuildJson(projectName, appType) {
  const common = {
    appId: createPositiveId(),
    appUUID: createPositiveId(),
    id: createPositiveId(),
    name: projectName,
    lockFlag: "n",
    officialFlag: "n",
    systemFlag: "n",
    debugFlag: "n",
    codes: {
      "entry.js": { state: "y" },
    },
  };
  let profile;
  if (appType === EB_CUSTOM_APP_TYPE) profile = customComponentBuildFields();
  if (appType === BUSINESS_COMPONENT_APP_TYPE) profile = businessComponentBuildFields();
  if (appType === FEATURE_THEME_APP_TYPE) profile = featureThemeBuildFields();
  return profile ? { ...common, ...profile, codes: profile.codes } : common;
}

export async function initProject(parentDirectory, options = {}) {
  const projectName = options.projectName;
  if (!projectName) throw new Error("init 必须提供 --project-name");
  if (projectName === "." || projectName === "..") {
    throw new Error("--project-name 不能是 . 或 ..");
  }
  if (projectName.includes("/") || projectName.includes("\\")) {
    throw new Error("--project-name 不能包含路径分隔符");
  }
  if (options.appType && !SUPPORTED_APP_TYPES.has(options.appType)) {
    throw new Error(`不支持的 --app-type: ${options.appType}`);
  }
  const projectDirectory = path.join(path.resolve(parentDirectory), projectName);
  const exists = await access(projectDirectory).then(() => true).catch(() => false);
  if (exists && !options.force) {
    throw new Error(`${projectDirectory} 已存在；确认覆盖时使用 --force`);
  }

  await mkdir(path.join(projectDirectory, "resources"), { recursive: true });
  await mkdir(path.join(projectDirectory, "config"), { recursive: true });
  for (const filename of [
    "config/config_default.js",
    "config/config.js",
    "config/configLoad_default.js",
    "config/configLoad.js",
    "entry.js",
  ]) {
    await writeFile(path.join(projectDirectory, filename), "", { flag: options.force ? "w" : "wx" })
      .catch((error) => {
        if (error.code !== "EEXIST") throw error;
      });
  }
  if (options.appType === EB_CUSTOM_APP_TYPE) {
    const templateDirectory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../templates/eb-custom-component",
    );
    await cp(templateDirectory, projectDirectory, {
      recursive: true,
      force: true,
      errorOnExist: false,
    });
  }
  await writeFile(
    path.join(projectDirectory, "build.json"),
    `${JSON.stringify(defaultBuildJson(projectName, options.appType), null, 2)}\n`,
    { flag: options.force ? "w" : "wx" },
  ).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  return projectDirectory;
}
