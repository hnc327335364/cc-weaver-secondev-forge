import { access } from "node:fs/promises";
import path from "node:path";

export const BUSINESS_COMPONENT_APP_TYPE = "business-component";

export const BUSINESS_COMPONENT_REQUIRED_FILES = [
  "entry.js",
  "config/config.js",
  "config/config_default.js",
  "config/configLoad.js",
  "config/configLoad_default.js",
];

export function isBusinessComponent(buildJson) {
  return buildJson?.projectType === "C";
}

export function businessComponentBuildFields() {
  return {
    projectType: "C",
    appMode: 0,
    pcOrMobile: "A",
    commonFlag: "n",
    isTheme: "n",
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

export async function validateBusinessComponentProject(rootPath, buildJson) {
  if (buildJson.projectType !== "C") {
    throw new Error("BUSINESS_COMPONENT_PROJECT_TYPE_REQUIRED: C");
  }
  if (Number(buildJson.appMode) !== 0) {
    throw new Error("BUSINESS_COMPONENT_APP_MODE_REQUIRED: 0");
  }
  if (buildJson.isTheme !== "n") {
    throw new Error("BUSINESS_COMPONENT_THEME_FLAG_REQUIRED: n");
  }
  if (Number(buildJson.isVue) !== 0) {
    throw new Error("BUSINESS_COMPONENT_REACT_REQUIRED");
  }
  for (const relative of BUSINESS_COMPONENT_REQUIRED_FILES) {
    try {
      await access(path.join(rootPath, ...relative.split("/")));
    } catch {
      throw new Error(`BUSINESS_COMPONENT_REQUIRED_FILE_MISSING: ${relative}`);
    }
  }
  const requiredStates = businessComponentBuildFields().codes;
  for (const [relative, expected] of Object.entries(requiredStates)) {
    if (buildJson.codes?.[relative]?.state !== expected.state) {
      throw new Error(`BUSINESS_COMPONENT_STATE_REQUIRED: ${relative}=${expected.state}`);
    }
  }
  return true;
}
