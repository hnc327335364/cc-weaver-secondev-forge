#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {lstat,readFile,readdir,realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptFile=fileURLToPath(import.meta.url);
const skillRoot=path.resolve(path.dirname(scriptFile),'..');
const domain=path.basename(skillRoot)==='ecode-security-review'?'SECURITY':'PERFORMANCE';
const stages=new Set(['FILE_SAVE','PROJECT_IMPORT','PROJECT_MIGRATION','PROJECT_RELEASE','JAR_RELEASE','UNKNOWN']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const fail=message=>{throw new Error(`REVIEW_CONTRACT_INVALID: ${message}`);};
const byPath=(a,b)=>Buffer.compare(Buffer.from(a.path,'utf8'),Buffer.from(b.path,'utf8'));
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};

async function files(root,base=root){
 const info=await lstat(root);if(info.isSymbolicLink())fail(`symlink not allowed: ${root}`);
 if(info.isFile())return [{path:path.relative(base,root).split(path.sep).join('/')||path.basename(root),sha256:sha(await readFile(root))}];
 if(!info.isDirectory())return [];
 const out=[];for(const name of (await readdir(root)).sort())out.push(...await files(path.join(root,name),base));return out;
}
function inventoryHash(items){return sha(items.map(x=>`${x.path}:${x.sha256}`).join('\n'));}
async function rulePackVersion(){
 const items=[];
 for(const rel of ['TOOL-REFERENCE.md','references'])for(const item of await files(path.join(skillRoot,rel),skillRoot))items.push(item);
 return inventoryHash(items.sort(byPath));
}
async function prepare(){
 const stage=option('--stage'),artifact=option('--artifact'),out=option('--out');
 if(!stage||!stages.has(stage)||!artifact||!out)fail('prepare requires valid --stage, --artifact and --out');
 const completeValue=option('--complete');if(completeValue!==undefined&&!['true','false'].includes(completeValue))fail('--complete must be true or false');
 const loadedChecklists=domain==='SECURITY'?(option('--checklists')||'').split(',').filter(Boolean).sort():[];
 if(loadedChecklists.some(x=>!['frontend','java'].includes(x)))fail('--checklists accepts frontend,java');unique(loadedChecklists,'loadedChecklists');
 const canonical=await realpath(artifact),inputFiles=(await files(canonical)).sort(byPath);
 if(!inputFiles.length)fail('artifact has no regular files');
 const artifactHash=inventoryHash(inputFiles),pack=await rulePackVersion();
 const prefix=domain==='SECURITY'?'SEC':'PERF';
 const reviewId=`${prefix}-${sha(`${domain}:${stage}:${artifactHash}:${pack}`).slice(0,24)}`;
 const manifest={schemaVersion:'1.1',auditType:domain,auditStage:stage,reviewId,artifactHash,rulePackVersion:pack,inputFiles,reviewInput:{completeSnapshot:completeValue==='true',loadedChecklists,externalEvidence:[]}};
 await writeFile(out,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return manifest;
}
const array=(value,name)=>{if(!Array.isArray(value))fail(`${name} must be an array`);return value;};
const unique=(values,name)=>{if(new Set(values).size!==values.length)fail(`${name} must be unique`);};
const fields=(value,names,label)=>{if(!value||names.some(name=>value[name]===undefined))fail(`${label} missing required field`);};
function common(result,input){
 if(result.schemaVersion!=='1.1'||result.auditType!==domain||!stages.has(result.auditStage))fail('schemaVersion, auditType or auditStage mismatch');
 for(const field of ['reviewId','artifactHash','rulePackVersion','decision','riskState','assuranceLevel'])if(typeof result[field]!=='string'||!result[field])fail(`${field} required`);
 for(const field of ['inputFiles','findings','rulesApplied','rulesSkipped','verificationNeeded','errors'])array(result[field],field);
 if(!result.reviewInput||typeof result.reviewInput.completeSnapshot!=='boolean'||!Array.isArray(result.reviewInput.loadedChecklists)||!Array.isArray(result.reviewInput.externalEvidence))fail('reviewInput invalid');
 unique(result.reviewInput.loadedChecklists,'loadedChecklists');if(domain==='PERFORMANCE'&&result.reviewInput.loadedChecklists.length)fail('performance review cannot load security checklists');
 if(!result.summary||typeof result.summary!=='object')fail('summary required');
 const applied=result.rulesApplied;unique(applied,'rulesApplied');
 if(!applied.length&&result.decision==='PASS')fail('PASS requires at least one applied rule');
 const skipped=result.rulesSkipped.map(x=>x.ruleId);unique(skipped,'rulesSkipped');
 if(result.rulesSkipped.some(x=>!x||typeof x.ruleId!=='string'||typeof x.reason!=='string'||!x.reason))fail('rulesSkipped item invalid');
 if(applied.some(x=>skipped.includes(x)))fail('rulesApplied and rulesSkipped overlap');
 const roots=result.findings.map(x=>x.rootCauseKey);if(roots.some(x=>typeof x!=='string'||!x))fail('finding rootCauseKey required');unique(roots,'finding rootCauseKey');
 for(const item of result.errors)fields(item,['code','severity','message','artifact','missingItems'],'error');
 if(result.summary.filesReviewed!==result.inputFiles.length)fail(`summary.filesReviewed must equal ${result.inputFiles.length}`);
 const prefix=domain==='SECURITY'?'SEC':'PERF',expectedReviewId=`${prefix}-${sha(`${domain}:${result.auditStage}:${result.artifactHash}:${result.rulePackVersion}`).slice(0,24)}`;
 if(result.reviewId!==expectedReviewId)fail('reviewId is not bound to current provenance');
 if(result.assuranceLevel==='STATIC_AND_RUNTIME'&&!result.reviewInput.externalEvidence.length)fail('STATIC_AND_RUNTIME requires bound external evidence');
 const projectStage=!['FILE_SAVE','UNKNOWN'].includes(result.auditStage);
 if(projectStage&&!result.reviewInput.completeSnapshot){const code=domain==='SECURITY'?'SEC-INPUT-INCOMPLETE':'PERF-INPUT-INCOMPLETE';if(result.decision!=='BLOCK'||!result.errors.some(x=>x.code===code))fail(`incomplete project snapshot requires ${code} BLOCK`);}
 if(input){for(const field of ['auditType','auditStage','reviewId','artifactHash','rulePackVersion'])if(result[field]!==input[field])fail(`${field} differs from prepared manifest`);if(JSON.stringify(result.inputFiles)!==JSON.stringify(input.inputFiles))fail('inputFiles differ from prepared manifest');if(JSON.stringify(result.reviewInput)!==JSON.stringify(input.reviewInput))fail('reviewInput differs from prepared manifest');}
}
async function security(result){
 array(result.checklistResults,'checklistResults');
 const statuses=['PASS','FAIL','N/A','UNVERIFIED'];
 for(const item of result.findings)fields(item,['ruleId','severity','title','file','startLine','endLine','evidence','evidenceType','rootCauseKey','risk','remediation','blocking'],'security finding');
 for(const item of result.checklistResults){fields(item,['ruleId','status','highRisk','reason','evidence'],'checklist result');if(!statuses.includes(item.status)||typeof item.ruleId!=='string'||typeof item.reason!=='string')fail('checklist result invalid');}
 for(const item of result.verificationNeeded)fields(item,['ruleId','file','reason','requiredEvidence','highRisk','blocking'],'verificationNeeded');
 const checklistFiles={frontend:'frontend-security-checklist.md',java:'java-web-security-checklist.md'},allowed=[];
 if(!['FILE_SAVE','UNKNOWN'].includes(result.auditStage)&&result.reviewInput.completeSnapshot&&!result.reviewInput.loadedChecklists.length)fail('complete security project requires loaded checklist');
 for(const name of result.reviewInput.loadedChecklists){const markdown=await readFile(path.join(skillRoot,'references',checklistFiles[name]),'utf8');allowed.push(...[...markdown.matchAll(/^- \[ \] `([^`]+)`/gm)].map(match=>match[1]));}
 unique(allowed,'loaded checklist IDs');const actual=result.checklistResults.map(x=>x.ruleId);unique(actual,'checklistResults ruleId');
 if(actual.some(id=>!allowed.includes(id)))fail('checklist result is outside loadedChecklists');
 if(!['FILE_SAVE','UNKNOWN'].includes(result.auditStage)&&result.reviewInput.completeSnapshot&&(actual.length!==allowed.length||allowed.some(id=>!actual.includes(id))))fail('checklist coverage mismatch');
 const count=s=>result.checklistResults.filter(x=>x.status===s).length;
 const expected={findingCount:result.findings.length,passCount:count('PASS'),failCount:count('FAIL'),naCount:count('N/A'),unverifiedCount:count('UNVERIFIED')};
 for(const [key,value] of Object.entries(expected))if(result.summary[key]!==value)fail(`summary.${key} must equal ${value}`);
 const blocked=result.findings.some(x=>x.blocking===true)||result.checklistResults.some(x=>x.status==='FAIL'||(x.status==='UNVERIFIED'&&x.highRisk===true))||result.verificationNeeded.some(x=>x.blocking===true)||result.errors.length>0;
 const conditional=!blocked&&(result.verificationNeeded.length>0||result.findings.length>0);
 const decision=blocked?'BLOCK':conditional?'CONDITIONAL':'PASS',risk=blocked?'BLOCKED':conditional?'WARNINGS':'CLEAN';
 if(result.decision!==decision||result.riskState!==risk)fail(`decision/riskState must be ${decision}/${risk}`);
}
function performance(result){
 if(!['NOT_PROVIDED','PARTIAL','VERIFIED'].includes(result.runtimeValidationStatus))fail('runtimeValidationStatus invalid');
 if(result.assuranceLevel==='STATIC_AND_RUNTIME'&&result.runtimeValidationStatus!=='VERIFIED')fail('STATIC_AND_RUNTIME requires VERIFIED runtimeValidationStatus');
 for(const finding of result.findings){
  fields(finding,['ruleId','rootCauseKey','findingType','severity','title','file','startLine','endLine','evidence','evidenceType','triggerPath','performanceImpact','policyBasis','remediation','fixExample'],'performance finding');
  if(!['ERROR','WARN'].includes(finding.severity))fail('finding severity invalid');
  const expected=String(finding.ruleId).startsWith('Weaver-')?'PLATFORM_POLICY':'PERFORMANCE_RISK';
  if(finding.findingType!==expected)fail(`${finding.ruleId} findingType must be ${expected}`);
  if(expected==='PLATFORM_POLICY'&&(!finding.policyBasis||!String(finding.performanceImpact).includes('未由本次静态证据证明')))fail('platform policy finding needs policyBasis and explicit impact boundary');
 }
 for(const item of result.verificationNeeded)fields(item,['ruleId','file','reason','requiredEvidence'],'verificationNeeded');
 const errorCount=result.findings.filter(x=>x.severity==='ERROR').length,warnCount=result.findings.filter(x=>x.severity==='WARN').length;
 const policyCount=result.findings.filter(x=>x.findingType==='PLATFORM_POLICY').length,performanceRiskCount=result.findings.length-policyCount;
 for(const [key,value] of Object.entries({errorCount,warnCount,policyCount,performanceRiskCount}))if(result.summary[key]!==value)fail(`summary.${key} must equal ${value}`);
 const blocked=errorCount>0||result.errors.length>0,warnings=!blocked&&(warnCount>0||result.verificationNeeded.length>0);
 const decision=blocked?'BLOCK':'PASS',risk=blocked?'BLOCKED':warnings?'WARNINGS':'CLEAN';
 if(result.decision!==decision||result.riskState!==risk)fail(`decision/riskState must be ${decision}/${risk}`);
}
async function validate(){
 const output=option('--output'),inputPath=option('--input');if(!output)fail('validate requires --output');
 const result=JSON.parse(await readFile(output,'utf8')),input=inputPath?JSON.parse(await readFile(inputPath,'utf8')):undefined;
 common(result,input);
 if(input){const artifact=option('--artifact');if(!artifact)fail('validate with --input requires --artifact');const current=(await files(await realpath(artifact))).sort(byPath);if(JSON.stringify(current)!==JSON.stringify(input.inputFiles)||inventoryHash(current)!==input.artifactHash)fail('artifact snapshot differs from prepared manifest');if(await rulePackVersion()!==input.rulePackVersion)fail('rule pack differs from prepared manifest');}
 if(domain==='SECURITY')await security(result);else performance(result);return {ok:true,auditType:domain,reviewId:result.reviewId,decision:result.decision,riskState:result.riskState};
}
try{
 const command=args[0];const result=command==='prepare'?await prepare():command==='validate'?await validate():fail('usage: prepare|validate');
 console.log(JSON.stringify(result));
}catch(error){console.error(error.message);process.exitCode=1;}
