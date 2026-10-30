#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RULES = [
  {
    scenario: "component-js-sdk",
    any: ["组件化jssdk", "组件化js-sdk", "weaversdk", "comprender", "funcapply", "三方接入", "外部系统接入"],
    skills: ["frontend-development", "e10-component-js-sdk"],
    documents: [
      "skills/e10-local-knowledge/modules/e10-component-js-sdk/references/component-js-sdk.md",
    ],
  },
  {
    scenario: "workflow-detail-summary",
    all: ["流程", "明细"],
    any: ["汇总", "合计", "主表"],
    skills: ["e10-workflow", "e10-form-jsapi"],
    documents: [
      "skills/e10-local-knowledge/modules/e10-workflow-jsapi/references/examples/detail-summary.md",
      "skills/e10-local-knowledge/modules/e10-form-jsapi/references/form-jsapi.md",
    ],
  },
  {
    scenario: "workflow-submit-interceptor",
    all: ["提交"],
    any: ["拦截", "校验", "阻止", "不通过"],
    skills: ["e10-workflow", "e10-form-jsapi"],
    documents: [
      "skills/e10-local-knowledge/modules/e10-workflow-jsapi/references/examples/submit-interceptor.md",
    ],
  },
  {
    scenario: "workflow-custom-button",
    all: ["流程", "按钮"],
    any: ["自定义", "新增", "添加", "详情"],
    skills: ["e10-workflow"],
    documents: [
      "skills/e10-local-knowledge/modules/e10-workflow-jsapi/references/examples/custom-button.md",
    ],
  },
  {
    scenario: "form-field-linkage",
    all: ["字段"],
    any: ["联动", "变化", "显隐", "只读", "必填"],
    skills: ["e10-form-jsapi"],
    documents: [
      "skills/e10-local-knowledge/modules/e10-form-jsapi/references/form-jsapi.md",
    ],
  },
  {
    scenario: "api-interceptor",
    all: ["接口"],
    any: ["拦截", "改写", "注入", "篡改"],
    skills: ["frontend-development"],
    documents: [
      "skills/ecode-development/modules/frontend-development/references/request-interceptor.md",
      "skills/ecode-development/modules/frontend-development/references/examples/api-interceptor.md",
    ],
  },
  {
    scenario: "component-override",
    any: ["复写", "regovprops", "组件样式", "组件参数", "props"],
    skills: ["frontend-development", "e10-utils-knowledge"],
    documents: [
      "skills/ecode-development/modules/frontend-development/references/react.md",
      "skills/ecode-development/modules/frontend-development/references/examples/component-override.md",
    ],
  },
  {
    scenario: "single-page-api",
    all: ["单页"],
    any: ["接口", "请求", "路由", "页面"],
    skills: ["frontend-development"],
    documents: [
      "skills/ecode-development/modules/frontend-development/references/react.md",
      "skills/ecode-development/modules/frontend-development/references/request-interceptor.md",
      "skills/ecode-development/modules/frontend-development/references/examples/single-page-route.md",
    ],
  },
];

function normalize(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function matches(text, rule) {
  const all = rule.all || [];
  const any = rule.any || [];
  return all.every((term) => text.includes(term)) &&
    (!any.length || any.some((term) => text.includes(term)));
}

export function routeScenario(prompt) {
  const text = normalize(prompt);
  const matched = RULES.filter((rule) => matches(text, rule));
  const scenarios = [...new Set(matched.map((rule) => rule.scenario))];
  const skills = [...new Set(matched.flatMap((rule) => rule.skills))].slice(0, 3);
  const documentsToLoad = [
    ...new Set(matched.flatMap((rule) => rule.documents)),
  ].slice(0, 3);
  const recognized = scenarios.length > 0;
  return {
    technicalDomain: recognized ? "frontend" : "unknown",
    frontendFramework: recognized ? "react" : "unknown",
    scenarios,
    skills,
    documentsToLoad,
    requiresNarrowing: !recognized,
  };
}

export function legacyUnits(prompt) {
  const text = normalize(prompt);
  return RULES.filter(rule => matches(text, rule)).map(rule => ({
    scenario: rule.scenario, skills: [...rule.skills], documents: [...rule.documents],
  }));
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const prompt = args.filter((arg) => arg !== "--json").join(" ");
  if (!prompt) throw new Error("请提供需求描述");
  const result = routeScenario(prompt);
  if (json) {
    console.log(JSON.stringify(result));
    return;
  }
  console.log(`technicalDomain: ${result.technicalDomain}`);
  console.log(`frontendFramework: ${result.frontendFramework}`);
  console.log(`scenarios: ${result.scenarios.join(", ") || "unknown"}`);
  console.log(`skills: ${result.skills.join(", ") || "none"}`);
  console.log(`documentsToLoad: ${result.documentsToLoad.join(", ") || "none"}`);
}

if (process.argv[1] && process.argv[1] !== "-" && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
