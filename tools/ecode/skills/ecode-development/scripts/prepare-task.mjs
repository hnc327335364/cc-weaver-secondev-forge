#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeScenario } from './route-scenario.mjs';
import { analyzePrompt } from './prompt-intent.mjs';
import { baselinesInPrompt, normalizeBaseline } from './lib/e10-baseline.mjs';

export function prepareTask(prompt, context = {}) {
  const route = routeScenario(prompt);
  const scope = analyzePrompt(prompt);
  const text = scope.activeText.toLowerCase();
  const onlyInit = route.units.length > 0 && route.units.every(u=>u.id==='backend-project-init');
  const hasInit = route.units.some(u=>u.id==='backend-project-init');
  const integrationOnly=route.units.length>0&&route.units.every(u=>u.id==='e9-e10-integration');
  const e9ReadOnly=integrationOnly&&/e9/.test(text)&&!/e10|hr|同步|迁移/.test(text);
  const promptBaselines = baselinesInPrompt(text, hasInit && /e10|基线|版本/.test(text));
  const e10Baseline = context.e10Baseline ? normalizeBaseline(context.e10Baseline) : (promptBaselines.length === 1 ? promptBaselines[0] : null);
  const baselineClarifications = promptBaselines.length > 1 && !context.e10Baseline
    ? ['需求中存在多个 E10 完整基线，请确认目标基线。']
    : !e10Baseline && !e9ReadOnly && (!onlyInit || /依赖|下载|编译|构建|打包/.test(text)) ? [onlyInit ? '下载依赖前确认 E10 基线；纯骨架 init 可以先完成。' : '确认目标 E10 完整基线及来源；确认前仅可分析，不得选择平台 API 或生成业务代码。'] : [];
  const high = ['删除','权限','认证','鉴权','事务','数据库写入','写数据库','修改数据库','更新数据库','插入数据','删除数据','写入数据','安全','漏洞','注入','越权','不可逆','敏感数据','部署','生产','发布','覆盖','密钥','密码','令牌'].filter(term=>text.includes(term));
  if(route.skills.includes('ecode-integration')&&/同步|迁移|保存|重置|解锁|停止/.test(text)&&!/仅.*查询|只.*查询|查询.*日志/.test(text))high.push('集成数据或任务变更');
  const medium = ['新增','增加','新建','接口','api','hook','dubbo','模块','改造','重构'].filter(term=>text.includes(term));
  const low = ['小改','调整文案','样式修正','拼写'].filter(term=>text.includes(term));
  const changeRisk = high.length?'high':low.length&&!medium.length?'low':'medium';
  const units = route.units.length?route.units:[{id:'discover',technicalDomain:route.technicalDomain,dependsOn:[],documentsToLoad:[],modules:[]}];
  return {
    goal:String(prompt).trim(),businessObjects:[],actors:[],e10Modules:[],technicalDomain:route.technicalDomain,
    tasks:units.map(unit=>({...unit,description:unit.sourceText || String(prompt).trim()})),
    constraints:['Read project baseline and existing implementation before choosing APIs.','Missing critical evidence blocks dependent implementation.'],
    externalConfiguration:[],acceptanceCriteria:['逐项映射用户验收标准，分别报告编译、测试和运行验证。'],
    changeRisk,riskReasons:high.length?high:medium.length?medium:low,
    intent:scope.intent, excludedScope:scope.excluded,
    confirmationRequired:scope.intent!=='analysis' && changeRisk!=='low' && context.authorized!==true,
    authorizationNote:'已有明确授权在原范围内持续有效；脚本风险分类不撤销用户授权。',
    interfaceAudience:route.interfaceAudience,clarifications:[...new Set([...route.clarifications,...baselineClarifications])],
    e10Baseline, baselineStatus:e10Baseline?'PROVIDED_REQUIRES_VERIFICATION':'UNVERIFIED',
    decisionStatus:'DRAFT',evidence:[],templateVersion:'1.3.3',verification:[],
  };
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const prompt=process.argv.slice(2).join(' ').trim();
  if(!prompt){console.error('请提供需求描述');process.exitCode=1;}
  else console.log(JSON.stringify(prepareTask(prompt),null,2));
}
