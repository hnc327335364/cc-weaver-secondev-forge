import { access, readFile } from "node:fs/promises";
import path from "node:path";

export const FEATURE_THEME_APP_TYPE = "feature-theme";

export const FEATURE_THEME_CONFIG_FILES = [
  "config/config.js",
  "config/config_default.js",
  "config/configLoad.js",
  "config/configLoad_default.js",
];

export const FEATURE_THEME_REQUIRED_FILES = ["entry.js", ...FEATURE_THEME_CONFIG_FILES];

export const FEATURE_THEME_EMPTY_PRELOAD_FILES = [
  "entry.js",
  "config/config.js",
  "config/config_default.js",
];

export const FEATURE_THEME_ALLOWED_PRELOAD_FILES = new Set(FEATURE_THEME_EMPTY_PRELOAD_FILES);

export function isFeatureTheme(buildJson) {
  return buildJson?.projectType === "T" || Number(buildJson?.appMode) === 4;
}

export function featureThemeBuildFields() {
  return {
    projectType: "T",
    appMode: 4,
    pcOrMobile: "A",
    commonFlag: "n",
    isTheme: "y",
    isVue: 0,
    codes: {
      "entry.js": { state: "y" },
      "config/config.js": { state: "y" },
      "config/config_default.js": { state: "y" },
      "config/configLoad.js": { state: "n" },
      "config/configLoad_default.js": { state: "n" },
    },
  };
}

export async function validateFeatureThemeProject(rootPath, buildJson) {
  if (buildJson.projectType !== "T") {
    throw new Error("FEATURE_THEME_PROJECT_TYPE_REQUIRED: T");
  }
  if (Number(buildJson.appMode) !== 4) {
    throw new Error("FEATURE_THEME_APP_MODE_REQUIRED: 4");
  }
  if (buildJson.isTheme !== "y") {
    throw new Error("FEATURE_THEME_FLAG_REQUIRED: y");
  }
  if (Number(buildJson.isVue) !== 0) {
    throw new Error("FEATURE_THEME_REACT_REQUIRED");
  }
  for (const relative of FEATURE_THEME_REQUIRED_FILES) {
    try {
      await access(path.join(rootPath, ...relative.split("/")));
    } catch {
      throw new Error(`FEATURE_THEME_REQUIRED_FILE_MISSING: ${relative}`);
    }
  }
  const requiredStates = featureThemeBuildFields().codes;
  if (buildJson.codes?.["entry.js"]?.state !== "y") {
    throw new Error("FEATURE_THEME_ENTRY_STATE_REQUIRED: y");
  }
  for (const [relative, expected] of Object.entries(requiredStates)) {
    if (relative === "entry.js") continue;
    if (buildJson.codes?.[relative]?.state !== expected.state) {
      throw new Error(`FEATURE_THEME_STATE_REQUIRED: ${relative}=${expected.state}`);
    }
  }
  for (const [relative, config] of Object.entries(buildJson.codes ?? {})) {
    if (config?.state === "y" && !FEATURE_THEME_ALLOWED_PRELOAD_FILES.has(relative)) {
      throw new Error(`FEATURE_THEME_PRELOAD_FORBIDDEN: ${relative}`);
    }
  }
  for (const relative of FEATURE_THEME_EMPTY_PRELOAD_FILES) {
    const source = await readFile(path.join(rootPath, ...relative.split("/")));
    if (source.length !== 0) {
      throw new Error(`FEATURE_THEME_PRELOAD_SOURCE_NOT_EMPTY: ${relative}`);
    }
  }
  return true;
}
