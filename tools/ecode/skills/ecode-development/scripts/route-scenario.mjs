#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyUnits } from './legacy-scenarios.mjs';
import { analyzePrompt } from './prompt-intent.mjs';

const DEV = 'skills/ecode-development/modules/';
const normalize = text => String(text ?? '').normalize('NFKC').toLowerCase();
const frontSignal = text => /前端|页面|组件|按钮|表单|字段|明细|javascript|react|vue|样式|js\s*-?\s*sdk|js\s*api|reghook/.test(text);
const backSignal = text => /后端|\bjava\b|controller|\bservice\b|dubbo|\bjar\b/.test(text);

export function classifyAudience(prompt) {
  const text = normalize(prompt).replace(/\s+/g,'');
  const audience = [];
  if (/第三方|三方系统|外部系统|开放平台/.test(text)) audience.push('external-system');
  if (/服务间|服务到服务|servicetoservice|service.to.service/.test(text)) audience.push('service');
  if (!/不登录|未登录|无登录/.test(text) && /已登录|登录用户|e10前端|前台登录/.test(text)) audience.push('e10-user');
  return audience.length === 1 ? audience[0] : 'unknown';
}

export function routeScenario(prompt) {
  const scope = analyzePrompt(prompt);
  const units = [];
  const add = (scenario, domain, modules, documents, source, gaps = []) => units.push({id:scenario, scenario, technicalDomain:domain,
    modules, documentsToLoad:documents, sourceText:source, clarifications:gaps, dependsOn:[]});
  let interfaceWorkFound = false;
  const audiences = [];
  for (const clause of scope.clauses) {
    const lexical = normalize(clause.text);
    const text = lexical.replace(/\s+/g,'');
    const front = frontSignal(lexical);
    const backendInit = /secdevlib|secdevclasses|secondev-|gradle/.test(text) || (backSignal(lexical) && /初始化|骨架|根工程|子模块|依赖/.test(text));
    const back = backSignal(lexical) || backendInit;
    const ebComponent = /(?:^|[^a-z0-9_])(?:eb|e-builder|ebuilder)(?=$|[^a-z0-9_])/.test(lexical) && /组件/.test(text) && /开发|自定义|设计器/.test(text);
    const businessComponentApp = /业务组件/.test(text) && /应用|react|开发|模板|构建|校验/.test(text);
    const featureThemeApp = /特色主题|主题应用/.test(text) && /开发|应用|react|模板|构建|校验/.test(text);
    const browser = (/浏览按钮|组合浏览|权限浏览/.test(text) || /\bbrowser\b/.test(lexical)) && !/浏览器/.test(text);
    const physicalQuery = /datasetservice|executesql|secondevdatasetutil|数据库|业务表|物理表/.test(text) || /\bsql\b/.test(lexical);
    const query = physicalQuery || (!front && /数据查询|查询数据|数据源/.test(text));
    const localCache = /localstorage|sessionstorage|indexeddb/.test(text) || (front && /缓存/.test(text));
    const infrastructure = /redis|消息队列|分布式锁|线程池/.test(text) || /\bmq\b/.test(lexical) || (/缓存/.test(text) && !localCache);
    const interceptor = /接口.{0,4}拦截|拦截.{0,4}接口|regapiinterceptor/.test(text);
    const jsApiOnly = /jssdk|jsapi|reghook/.test(text) && !/后端|第三方|服务间|对外/.test(text);
    const interfaceWork = !interceptor && !jsApiOnly && /接口/.test(text) && /(?:写|提供|发布|新增|创建|开发|实现|修改).{0,12}接口|(?:对外|服务间|servicetoservice).{0,10}(?:http)?接口|接口.{0,6}(?:开发|发布|定义|设计|实现)/.test(text);
    const addHere = (id, domain, modules, documents, gaps=[]) => add(id,domain,modules,documents,clause.text,gaps);
    const integration = (/e9/.test(text) && /接口|api|认证|组织|分部|部门|岗位|人员|同步|迁移/.test(text))
      || (/e10/.test(text) && /oauth|开放平台认证|开放平台令牌/.test(text))
      || (/hr|人力资源/.test(text) && /集成|同步日志|同步配置|字段映射/.test(text));
    if (integration) addHere('e9-e10-integration','unknown',['ecode-integration'],['skills/ecode-integration/TOOL-REFERENCE.md']);
    const newPage = /(?:生成|新建|创建|制作|复刻|还原).{0,16}(?:页面|网页|html|门户)|(?:页面|网页|html|门户).{0,12}(?:生成|新建|创建|制作|复刻|还原)|设计.{0,8}新(?:页面|网页|门户)/.test(text);
    const wholePage = /(?:整页|整站|整体|全局|整个).{0,12}(?:页面|网页|html|门户|布局)|(?:页面|网页|html|门户).{0,12}(?:整体|全局|改版|重做)|(?:改版|重做).{0,12}(?:页面|网页|html|门户)|(?:修改|调整|优化|设计).{0,8}整页/.test(text);
    const pageWork = newPage || wholePage || /截图.{0,12}(?:复刻|还原|生成)/.test(text);
    const smallPatch = /小改|局部补丁|接口.{0,4}拦截|拦截.{0,4}接口|regapiinterceptor|reghook|组件定位/.test(text);
    if (pageWork && !smallPatch && !/后端|接口开发/.test(text)) addHere('ai-page-generation','frontend',['weaver-e10-page-generator'],['skills/weaver-e10-page-generator/TOOL-REFERENCE.md']);
    if (/评估|功能分析|方案分析|更好.*方案|更好.*实现|历史二开|开发思路/.test(text)) addHere('requirement-assessment','unknown',['requirement-assessment'],[DEV+'requirement-assessment/MODULE.md']);
    if (ebComponent) addHere('eb-component-development','frontend',['eb-component-development'],[DEV+'eb-component-development/MODULE.md']);
    if (businessComponentApp) addHere('business-component-development','frontend',['business-component-development'],[DEV+'business-component-development/MODULE.md']);
    if (featureThemeApp) addHere('feature-theme-development','frontend',['feature-theme-development'],[DEV+'feature-theme-development/MODULE.md']);
    if (browser) addHere('browser-customization','frontend',['frontend-development','e10-ui-components'],[DEV+'frontend-development/references/browser-customization.md']);
    if (!browser && !ebComponent && /页面|组件|分组|区域/.test(text) && /样式|非标准|定位|改造|替换/.test(text)) addHere('frontend-component-locate','frontend',['frontend-development'],[DEV+'frontend-development/references/component-location.md']);
    if (/拉取|下载|已有|现有|线上|存量/.test(text) && /应用|代码|项目/.test(text) && (!back || front)) addHere('existing-app-development','frontend',['ecode-cli','frontend-development'],['skills/ecode-cli/references/existing-app-workflow.md']);
    if (clause.mode==='execute' && /发布|上传|导入/.test(text) && /应用|前端|补丁|zip/.test(text)) addHere('frontend-delivery','frontend',['ecode-cli'],['skills/ecode-cli/references/existing-app-workflow.md']);
    if (backendInit) addHere('backend-project-init','backend',['backend-project-init'],[DEV+'backend-project-init/MODULE.md']);
    if (query) addHere('backend-data-query','backend',['e10-backend-db','e10-data-dictionary'],[DEV+'e10-backend-db/references/query-selection.md']);
    if (infrastructure) addHere('backend-infrastructure','backend',['e10-backend-sdk'],[DEV+'e10-backend-sdk/references/infrastructure-patterns.md']);
    if (localCache) addHere('frontend-local-state','frontend',['frontend-development'],[DEV+'frontend-development/references/project-conventions.md']);
    if (interfaceWork) {
      interfaceWorkFound = true;
      audiences.push(classifyAudience(clause.text));
      addHere('backend-interface','backend',['e10-backend-api'],[DEV+'e10-backend-api/references/interface-selection.md']);
    }
    if (!interfaceWork && front && /调用|请求|查询数据/.test(text) && /接口|api|查询数据/.test(text)) addHere('frontend-api-consumption','frontend',['frontend-development'],[DEV+'frontend-development/references/request-interceptor.md']);
    for (const legacy of legacyUnits(clause.text)) {
      if (back && !front) continue;
      if (legacy.scenario==='api-interceptor' && (query || interfaceWork) && !front && !interceptor) continue;
      if (legacy.scenario==='component-js-sdk' && !/组件化jssdk|组件化js-sdk|weaversdk|comprender|funcapply/.test(text)) continue;
      addHere(legacy.scenario,'frontend',legacy.skills.map(name=>name==='e10-workflow'?'e10-workflow-jsapi':name),legacy.documents);
    }
    // Preserve visible work even when another clause already produced a more specific unit.
    if (front && !units.some(unit=>unit.sourceText===clause.text && unit.technicalDomain==='frontend')) addHere('frontend-development','frontend',['frontend-development'],[DEV+'frontend-development/MODULE.md']);
    if (back && !units.some(unit=>unit.sourceText===clause.text && unit.technicalDomain==='backend')) addHere('backend-development','backend',['backend-development'],[DEV+'backend-development/MODULE.md']);
  }
  const domains = new Set(units.map(item=>item.technicalDomain));
  const explicitFullstack = /全栈|前后端|fullstack/i.test(scope.activeText);
  const domain = explicitFullstack || domains.has('frontend') && domains.has('backend') ? 'fullstack' : domains.has('backend') ? 'backend' : domains.has('frontend') ? 'frontend' : 'unknown';
  if(domain==='fullstack') add('fullstack-development','fullstack',['fullstack-development'],[DEV+'fullstack-development/MODULE.md'],scope.activeText);
  const unique = [];
  for(const unit of units) {
    const existing=unique.find(item=>item.id===unit.id);
    if(existing) {existing.sourceText += '，'+unit.sourceText;} else unique.push(unit);
  }
  const knownAudiences = [...new Set(audiences.filter(item=>item!=='unknown'))];
  let interfaceAudience = interfaceWorkFound && knownAudiences.length===1 && !audiences.includes('unknown') ? knownAudiences[0] : 'unknown';
  if(interfaceAudience==='e10-user' && /不登录|未登录|无登录|(?:无需|不用|不需要|不要求).{0,8}登录/.test(scope.original)) interfaceAudience='unknown';
  if(interfaceWorkFound && interfaceAudience==='unknown') unique.find(unit=>unit.id==='backend-interface').clarifications.push('确认接口调用方：E10 登录前端、服务间，还是第三方系统？');
  if(unique.some(item=>item.id==='requirement-assessment')) unique.filter(item=>item.id!=='requirement-assessment').forEach(item=>item.dependsOn.push('requirement-assessment'));
  const clarifications = [...new Set(unique.flatMap(item=>item.clarifications))];
  return {technicalDomain:domain, frontendFramework:domain==='frontend'||domain==='fullstack'?(/vue/i.test(scope.activeText)?'vue':'react'):'unknown',
    scenarios:unique.map(item=>item.scenario), skills:[...new Set(unique.flatMap(item=>item.modules))],
    documentsToLoad:[...new Set(unique.flatMap(item=>item.documentsToLoad))], units:unique,
    intent:scope.intent, excludedScope:scope.excluded, interfaceAudience, clarifications, requiresNarrowing:!unique.length || clarifications.length>0,
    loadingPolicy:'Process units sequentially; module guidance and evidence documents have separate budgets. Load at most 3 of each per implementation unit; never discard required evidence to satisfy a budget.'};
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const prompt=process.argv.slice(2).filter(item=>item!=='--json').join(' ');
  if(!prompt) {console.error('请提供需求描述');process.exitCode=1;} else console.log(JSON.stringify(routeScenario(prompt),null,process.argv.includes('--json')?0:2));
}
