import { access, readFile } from "node:fs/promises";
import path from "node:path";

export const EB_CUSTOM_APP_TYPE = "eb-custom-component";

export const EB_CUSTOM_BUSINESS_FILES = [
  "Design.js",
  "View.js",
  "Config.js",
  "MDesign.js",
  "MView.js",
  "StyleConfig.js",
];

export const EB_CUSTOM_EMPTY_FILES = [
  "entry.js",
  "config/config.js",
  "config/config_default.js",
  "config/configLoad.js",
  "config/configLoad_default.js",
];

export const EB_CUSTOM_PRELOAD_FILES = new Set([
  "entry.js",
  "config/config.js",
  "config/config_default.js",
]);

export function isEbCustomComponent(buildJson) {
  return buildJson?.projectType === "E" || Number(buildJson?.appMode) === 2;
}

export function customComponentBuildFields() {
  return {
    projectType: "E",
    appMode: 2,
    pcOrMobile: "A",
    commonFlag: "n",
    isTheme: "n",
    isVue: 0,
    codes: {
      "Design.js": { state: "n" },
      "View.js": { state: "n" },
      "Config.js": { state: "n" },
      "MDesign.js": { state: "n" },
      "MView.js": { state: "n" },
      "StyleConfig.js": { state: "n" },
      "entry.js": { state: "y" },
      "config/config.js": { state: "y" },
      "config/config_default.js": { state: "y" },
      "config/configLoad.js": { state: "n" },
      "config/configLoad_default.js": { state: "n" },
    },
  };
}

async function requireFile(rootPath, relative) {
  const filename = path.join(rootPath, ...relative.split("/"));
  try {
    await access(filename);
  } catch {
    throw new Error(`EB_CUSTOM_REQUIRED_FILE_MISSING: ${relative}`);
  }
  return filename;
}

export async function validateEbCustomComponentProject(rootPath, buildJson) {
  if (buildJson.projectType !== "E") {
    throw new Error("EB_CUSTOM_PROJECT_TYPE_REQUIRED: E");
  }
  if (Number(buildJson.appMode) !== 2) {
    throw new Error("EB_CUSTOM_APP_MODE_REQUIRED: 2");
  }

  for (const relative of [...EB_CUSTOM_BUSINESS_FILES, ...EB_CUSTOM_EMPTY_FILES]) {
    await requireFile(rootPath, relative);
  }

  for (const relative of EB_CUSTOM_EMPTY_FILES) {
    const source = await readFile(path.join(rootPath, ...relative.split("/")));
    if (source.length !== 0) {
      throw new Error(`EB_CUSTOM_PRELOAD_SOURCE_NOT_EMPTY: ${relative}`);
    }
  }

  const codes = buildJson.codes ?? {};
  for (const [relative, config] of Object.entries(codes)) {
    if (config?.state === "y" && !EB_CUSTOM_PRELOAD_FILES.has(relative)) {
      throw new Error(`EB_CUSTOM_EXTRA_PRELOAD_FORBIDDEN: ${relative}`);
    }
  }
  for (const relative of EB_CUSTOM_PRELOAD_FILES) {
    if (codes[relative]?.state !== "y") {
      throw new Error(`EB_CUSTOM_PRELOAD_STATE_REQUIRED: ${relative}`);
    }
  }
  for (const relative of EB_CUSTOM_BUSINESS_FILES) {
    if (codes[relative]?.state !== "n") {
      throw new Error(`EB_CUSTOM_BUSINESS_STATE_REQUIRED: ${relative}`);
    }
  }
  return true;
}
