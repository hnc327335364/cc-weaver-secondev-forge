#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, lstat, realpath, rename, rm, rmdir, open, mkdtemp, copyFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ARCHIVE_LIMIT, requireSpace, saveStream, extractZip, validateJar, hashFile, readZip } from './archive-stream.mjs';
import { validateClassFile } from './class-file.mjs';
import { normalizeBaseline } from '../../../scripts/lib/e10-baseline.mjs';

export const REQUIRED_ROOT_ENTRIES = [
  "buildSrc",
  "gradle",
  "secDevLib",
  "secDevClasses",
  "devLib",
  "build.gradle",
  "settings.gradle",
  "gradlew",
  "gradlew.bat",
  "gradle.properties",
];

export const REQUIRED_MODULE_DIRECTORIES = [
  path.join("src", "main", "java"),
  path.join("src", "main", "resources"),
];

export const MONITOR_MIN_VERSION = 'V5.0.9.920260922-RC';

const ASSETS = new URL('../assets/', import.meta.url);
const SOURCE = JSON.parse(await readFile(new URL('template-source.json', ASSETS), 'utf8'));
export const TEMPLATE_DOWNLOAD_URL = SOURCE.sourceUrl;
export const STATE_PATH = '.ecode-runtime/project-state.json';
const ROOT_DIRS = REQUIRED_ROOT_ENTRIES.slice(0,5);
const ROOT_FILES = [...REQUIRED_ROOT_ENTRIES.slice(5), 'gradle/wrapper/gradle-wrapper.jar','gradle/wrapper/gradle-wrapper.properties',
  'buildSrc/src/main/java/com/weaver/ecode/gradle/plugin/BuildArchPlugin.java',
  'buildSrc/src/main/resources/META-INF/gradle-plugins/com.weaver.ecode.gradle.plugin.BuildArchPlugin.properties'];
export function resolveDependencyDownload(version) {
  const baselineVersion=normalizeBaseline(version);
  if(!baselineVersion) return null;
  const versionKey=baselineVersion.split('.')[2];
  return {versionKey,baselineVersion,onlineAvailable:true,source:'e-monitor',files:['lib.zip','classes.zip']};
}
function monitorOrigin(input) {
  if(!input) throw new Error('monitor_url_required');
  let url;try {url=new URL(input);} catch {throw new Error('monitor_url_invalid');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new Error('monitor_url_invalid');
  return url.origin;
}
function versionParts(value) {
  const match=/^V(\d+)\.(\d+)\.(\d+)\.(\d+)(?:-([A-Za-z0-9.]+))?$/.exec(value);
  if(!match) throw new Error('monitor_version_invalid');
  return {numbers:match.slice(1,5).map(Number),suffix:match[5]??''};
}
export function monitorVersionAllowed(value) {
  const got=versionParts(value), min=versionParts(MONITOR_MIN_VERSION);
  for(let i=0;i<4;i++) if(got.numbers[i]!==min.numbers[i]) return got.numbers[i]>min.numbers[i];
  return !got.suffix || got.suffix===min.suffix;
}
async function responseBytes(response, limit) {
  const declared=response.headers.get('content-length');
  if(declared!==null && (!/^\d+$/.test(declared)||Number(declared)>limit)) throw new Error('download_size_limit');
  const chunks=[];let size=0;
  for await(const part of response.body) {size+=part.length;if(size>limit) throw new Error('download_size_limit');chunks.push(part);}
  if(declared!==null&&size!==Number(declared)) throw new Error('download_length_mismatch');
  return Buffer.concat(chunks);
}
async function monitorRequest(url, options={}, destination,checkSpace=requireSpace) {
  let response;
  try {response=await fetch(url,{...options,headers:{'accept-encoding':'identity',...options.headers},redirect:'error',signal:AbortSignal.timeout(destination?15*60*1000:180000)});}
  catch {throw new Error('monitor_request_failed');}
  if(!response.ok) {await response.body?.cancel();throw new Error('monitor_http_'+response.status);}
  if(destination) return saveStream(response.body,destination,{length:response.headers.get('content-length'),checkSpace});
  return responseBytes(response,1024*1024);
}
function monitorJson(bytes) {try{return JSON.parse(bytes.toString());}catch{throw new Error('monitor_response_invalid_json');}}
async function downloadMonitorArchive(url,filename,checkSpace) {
  const saved=await monitorRequest(url,{},filename,checkSpace);
  const handle=await open(filename,'r');
  let head;
  try {head=Buffer.alloc(256);const {bytesRead}=await handle.read(head,0,head.length,0);head=head.subarray(0,bytesRead);}
  finally {await handle.close();}
  if(head.length>=4&&head.subarray(0,4).equals(Buffer.from('PK\x03\x04'))) return saved;
  if(saved.bytes<=1024*1024&&head.toString().trimStart().startsWith('{')) {
    let body;try {body=JSON.parse(await readFile(filename,'utf8'));} catch {}
    if(String(body?.code)==='403'||String(body?.code)==='401') throw new Error('monitor_download_auth_failed');
  }
  throw new Error('monitor_download_not_zip');
}
function packageUrl(origin,token,channel,name) {
  const url=new URL(channel==='download-api'?'/cd/secdev/downloadFile':'/weaSecondev/'+name,origin);
  if(channel==='download-api') url.searchParams.set('fileName',name);
  url.searchParams.set('token',token);
  return url;
}
export async function fetchMonitorPackages({monitorUrl,monitorUser,monitorPassword,baselineVersion,checkSpace=requireSpace}={},directory) {
  if(!directory) throw new Error('dependency_staging_directory_required');
  const origin=monitorOrigin(monitorUrl);
  const baseline=normalizeBaseline(baselineVersion);
  if(!baseline) throw new Error('baseline_version_required');
  if(!monitorUser||!monitorPassword) throw new Error('monitor_credentials_required');
  const jsonHeaders={'content-type':'application/json'};
  const login=monitorJson(await monitorRequest(new URL('/cp/logindo.json',origin),{
    method:'POST',headers:jsonHeaders,body:JSON.stringify({username:monitorUser,password:monitorPassword,captcha:'Single',languageidweaver:'7'})
  }));
  const token=login?.data?.token;
  if(typeof token!=='string'||!token) throw new Error('monitor_login_token_missing');
  let monitorVersion=null;
  try {
    const versionResponse=monitorJson(await monitorRequest(new URL('/cp/getMasterAndAgentVersionLog.json',origin),{
      method:'POST',headers:{...jsonHeaders,token},body:JSON.stringify({monitorLogType:'MASTER_ROBOT'})
    }));
    if(typeof versionResponse?.data?.monitorVersionLogs?.[0]?.version==='string') monitorVersion=versionResponse.data.monitorVersionLogs[0].version;
  } catch { /* Version is diagnostic; the authenticated package response decides availability. */ }
  let apiPreferred=false,monitorVersionIsOld=false;
  try {if(monitorVersion!==null) {apiPreferred=monitorVersionAllowed(monitorVersion);monitorVersionIsOld=!apiPreferred;}} catch {}
  const channels=apiPreferred?['download-api','protected-static']:['protected-static','download-api'];
  let protectedStaticUnavailable=false;
  for(const [index,channel] of channels.entries()) {
    const packages={};
    try {
      for(const name of ['lib.zip','classes.zip']) {
        packages[name]=await downloadMonitorArchive(packageUrl(origin,token,channel,name),path.join(directory,name),checkSpace);
      }
      return {packages,source:'e-monitor',downloadChannel:channel,monitorOrigin:origin,monitorVersion};
    } catch(error) {
      for(const name of ['lib.zip','classes.zip']) await rm(path.join(directory,name),{force:true});
      if(channel==='protected-static'&&error.message==='monitor_http_404') protectedStaticUnavailable=true;
      if(index===0&&Object.keys(packages).length===0&&error.message==='monitor_http_404') continue;
      if(monitorVersionIsOld&&protectedStaticUnavailable&&error.message==='monitor_http_404') {
        throw new Error(`当前运维平台版本较低（${monitorVersion}），暂无法下载二开依赖。请将运维平台升级至最新版本后重试；无需升级 E10 基线。`);
      }
      throw error;
    }
  }
  throw new Error('monitor_dependency_files_unavailable');
}
async function prepareDependencies(options={}) {
  const offline=Boolean(options.libArchiveFile||options.classesArchiveFile);
  if(offline && (!options.libArchiveFile||!options.classesArchiveFile||options.monitorUrl||options.monitorUser||options.monitorPassword)) throw new Error('dependency_source_conflict_or_incomplete');
  const temporary=await mkdtemp(path.join(os.tmpdir(),'ecode-deps-'));
  const checkSpace=options.checkSpace??requireSpace;
  try {
    let fetched;
    if(offline) {
      const packages={};
      for(const [name,file] of [['lib.zip',options.libArchiveFile],['classes.zip',options.classesArchiveFile]]) {
        const stats=await lstat(file);if(!stats.isFile()||stats.size>ARCHIVE_LIMIT) throw new Error('archive_file_limit_or_type');
        packages[name]=await saveStream(createReadStream(file),path.join(temporary,name),{length:stats.size,checkSpace});
      }
      fetched={packages,source:'local-archives',downloadChannel:null,monitorOrigin:null,monitorVersion:null};
    } else fetched=await fetchMonitorPackages(options,temporary);
    const stage=path.join(temporary,'stage');await mkdir(stage);
    const jars=await extractZip(fetched.packages['lib.zip'].filename,stage,e=>!e.directory&&e.name.toLowerCase().endsWith('.jar')?'secDevLib/'+path.posix.basename(e.name):null,{checkSpace});
    if(!jars.length) throw new Error('dependency_import_incomplete');
    for(const jar of jars) await validateJar(jar.sourceFile);
    const classes=await extractZip(fetched.packages['classes.zip'].filename,stage,e=>{
      if(e.directory) return null;
      const name=e.name.startsWith('secDevClasses/')?e.name.slice('secDevClasses/'.length):e.name;
      if(!name||name.startsWith('secDevClasses/')) throw new Error('classes_path_invalid_or_duplicate');
      return 'secDevClasses/'+name;
    },{checkSpace});
    const classFiles=classes.filter(e=>e.name.endsWith('.class'));
    if(!classFiles.length) throw new Error('classes_archive_has_no_class_files');
    for(const item of classFiles) {
      try {await validateClassFile(item.sourceFile,item.name.slice('secDevClasses/'.length));}
      catch {throw new Error('invalid_dependency_class: '+item.name);}
    }
    return {plan:[...jars,...classes],source:fetched.source,downloadChannel:fetched.downloadChannel,monitorOrigin:fetched.monitorOrigin,monitorVersion:fetched.monitorVersion,baselineSource:options.baselineSource,libSha256:fetched.packages['lib.zip'].sha256,classesSha256:fetched.packages['classes.zip'].sha256,temporary};
  } catch(error) {await rm(temporary,{recursive:true,force:true});throw error;}
}
async function info(file) {try{return await lstat(file);}catch(e){if(e.code==='ENOENT') return null;throw e;}}
async function projectPath(input) {
  const absolute=path.resolve(input);if((await info(absolute))?.isSymbolicLink()) throw new Error('symlink_not_allowed: '+absolute);
  let current=absolute;const tail=[];
  while(!(await info(current))) {tail.unshift(path.basename(current));const parent=path.dirname(current);if(parent===current) throw new Error('project_path_invalid');current=parent;}
  return path.join(await realpath(current),...tail);
}
async function safePath(file) {
  const full=path.resolve(file), parts=full.slice(path.parse(full).root.length).split(path.sep); let p=path.parse(full).root;
  for(const part of parts) {p=path.join(p,part);const s=await info(p);if(s?.isSymbolicLink()) throw new Error('symlink_not_allowed: '+p);}
  return full;
}
async function content(file) {const s=await info(file);return s?.isFile()&&!s.isSymbolicLink()?readFile(file):null;}
async function readState(root) {
  const result=[];
  for(const rel of [STATE_PATH,'.ecode/project-state.json']) {
    await safePath(path.join(root,rel)); const data=await content(path.join(root,rel));
    if(data) {const v=JSON.parse(data);if(!v||typeof v!=='object'||Array.isArray(v)) throw new Error('project_state_invalid');result.push(v);}
  }
  const versions=result.map(x=>x.E10Version).filter(Boolean).map(normalizeBaseline);
  if(versions.includes(null)||new Set(versions).size>1) throw new Error('project_state_baseline_conflict');
  return {...result[1],...result[0]};
}
async function selectedVersion(root, provided) {
  const state=await readState(root), existing=state.E10Version;
  if(existing && !resolveDependencyDownload(existing)) throw new Error('cached_baseline_version_invalid');
  if(provided && !resolveDependencyDownload(provided)) throw new Error('baseline_version_invalid');
  if(provided&&existing&&normalizeBaseline(provided)!==normalizeBaseline(existing)) throw new Error('baseline_conflict: use a separate project for another baseline');
  return resolveDependencyDownload(provided||existing)?.baselineVersion??null;
}
async function writeState(root, values) {
  const existing=await readState(root), dir=path.join(root,'.ecode-runtime'); await safePath(dir); await mkdir(dir,{recursive:true});
  const temp=path.join(dir,`.project-state-${randomUUID()}.tmp`);
  try {
    await writeFile(temp,JSON.stringify({...existing,...values,schemaVersion:2,checkedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
    await rename(temp,path.join(root,STATE_PATH));
  } finally {await rm(temp,{force:true});}
}
async function locked(root, operation) {
  await safePath(root); await mkdir(root,{recursive:true});
  const lock=path.join(root,'.ecode-backend.lock');
  try {await mkdir(lock);} catch(e){if(e.code==='EEXIST') throw new Error('backend_project_busy: '+lock);throw e;}
  try {return await operation();} finally {await rm(lock,{recursive:true,force:true});}
}
function moduleName(name) {
  if(!/^secondev-[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(name)) throw new Error('module_name_invalid');
  return name;
}
async function listFiles(root, relative='', result=[]) {
  const dir=path.join(root,relative); const s=await info(dir); if(!s) return result;
  if(s.isSymbolicLink()||!s.isDirectory()) throw new Error('invalid_directory: '+relative);
  for(const item of await readdir(dir,{withFileTypes:true})) {
    const name=path.join(relative,item.name);
    if(item.isSymbolicLink()) throw new Error('symlink_not_allowed: '+name);
    if(item.isDirectory()) await listFiles(root,name,result); else if(item.isFile()) result.push(name);
    else throw new Error('special_file_not_allowed');
    if(result.length>50000) throw new Error('file_count_limit');
  }
  return result;
}
function dependencyState(prepared) {
  return {
    dependencyManifest:Object.fromEntries(prepared.plan.map(({name,size,sha256})=>[name,{size,sha256}])),
    dependencyCheckedAt:new Date().toISOString(),dependencySource:prepared.source,
    libArchiveSha256:prepared.libSha256,classesArchiveSha256:prepared.classesSha256,
    monitorVersion:prepared.monitorVersion,dependencyDownloadChannel:prepared.downloadChannel,
    dependencyMonitorOrigin:prepared.monitorOrigin,dependencyBaselineSource:prepared.baselineSource,
    baselineCompatibilityVerified:false,
  };
}
async function inspectDependencies(root, manifest, {deep=true}={}) {
  const issues=[],warnings=[],files=[];
  const add=(code,extra={})=>issues.push({type:'dependency_incomplete',code,...extra});
  for(const directory of ['secDevLib','secDevClasses']) {
    try {files.push(...(await listFiles(path.join(root,directory))).map(name=>directory+'/'+name.replaceAll(path.sep,'/')));}
    catch {add('dependency_directory_invalid',{path:directory});}
  }
  const jars=files.filter(name=>name.startsWith('secDevLib/')&&name.toLowerCase().endsWith('.jar'));
  const classes=files.filter(name=>name.startsWith('secDevClasses/')&&name.endsWith('.class'));
  if(!jars.length) add('secDevLib_jars_missing');
  if(!classes.length) add('secDevClasses_class_files_missing');
  if(deep) {
    for(const name of jars) {
      try {await validateJar(path.join(root,name));}
      catch {add('invalid_jar',{path:name});}
    }
    for(const name of classes) {
      try {await validateClassFile(path.join(root,name),name.slice('secDevClasses/'.length));}
      catch {add('invalid_class_file',{path:name});}
    }
  }
  const entries=manifest&&typeof manifest==='object'&&!Array.isArray(manifest)?Object.entries(manifest):[];
  if(!entries.length) add('dependency_manifest_missing');
  else if(entries.some(([name,value])=>!/^secDev(?:Lib|Classes)\//.test(name)||/[\\\x00-\x1f:]/.test(name)||name.split('/').some(part=>!part||part==='.'||part==='..')||
    !value||!Number.isSafeInteger(value.size)||value.size<0||value.size>256*1024*1024||!/^[a-f0-9]{64}$/.test(value.sha256))||
    new Set(entries.map(([name])=>name.toLowerCase())).size!==entries.length||
    !entries.some(([name])=>name.startsWith('secDevLib/')&&name.toLowerCase().endsWith('.jar'))||
    !entries.some(([name])=>name.startsWith('secDevClasses/')&&name.endsWith('.class'))) add('dependency_manifest_invalid');
  else {
    const installed=new Set(files),expected=new Set(entries.map(([name])=>name));
    for(const [name,value] of entries) {
      if(!installed.has(name)) {add('dependency_file_missing',{path:name});continue;}
      const filename=path.join(root,name);
      if((await lstat(filename)).size!==value.size||await hashFile(filename)!==value.sha256) add('dependency_file_changed',{path:name});
    }
    const extra=files.filter(name=>!expected.has(name));
    if(extra.length) warnings.push({code:'dependency_files_untracked',files:extra});
  }
  return {dependencyInitialized:!issues.length,secDevLibJarCount:jars.length,secDevClassesClassCount:classes.length,issues,warnings};
}
export async function inspectBackendProject(projectRoot, {module:targetModule,dependencies=true}={}) {
  const root=await safePath(await projectPath(projectRoot)), issues=[], modules=[];
  const add=(type,code,extra={})=>issues.push({type,code,...extra});
  for(const dir of ROOT_DIRS) {const s=await info(path.join(root,dir));if(!s?.isDirectory()||s.isSymbolicLink()) add('root_template_invalid','directory_missing_or_invalid',{path:dir});}
  for(const file of ROOT_FILES) {
    await safePath(path.join(root,file));const data=await content(path.join(root,file));
    if(!data?.length) add('root_template_invalid','file_missing_or_empty',{path:file});
  }
  try {await validateJar(path.join(root,'gradle/wrapper/gradle-wrapper.jar'),'org/gradle/wrapper/GradleWrapperMain.class');}
  catch {add('root_template_invalid','gradle_wrapper_invalid');}
  const settings=(await content(path.join(root,'settings.gradle')))?.toString()??'';
  const build=(await content(path.join(root,'build.gradle')))?.toString()??'';
  if(!build.includes('com.weaver.ecode.gradle.plugin.BuildArchPlugin') || !build.includes('secDevLib')) add('root_template_invalid','root_build_contract_missing');
  const dynamic=settings.includes('discoverProjects(rootProject.projectDir')&&settings.includes('buildFileName')&&settings.includes('.gradle');
  if((await info(root))?.isDirectory()) {
    for(const entry of await readdir(root,{withFileTypes:true})) {
      if(entry.name.startsWith('.')||ROOT_DIRS.includes(entry.name)) continue;
      if(entry.isSymbolicLink()) {add('module_template_invalid','symlink_not_allowed',{moduleName:entry.name});continue;}
      if(!entry.isDirectory()) continue;
      if(!entry.name.startsWith('secondev-')&&!(await info(path.join(root,entry.name,'src')))&&!(await info(path.join(root,entry.name,entry.name+'.gradle')))) continue;
      modules.push(entry.name);
      try{moduleName(entry.name);}catch{add('module_template_invalid','module_name_invalid',{moduleName:entry.name});}
      const script=await content(path.join(root,entry.name,entry.name+'.gradle'));
      if(!script?.length) add('module_template_invalid','module_gradle_missing_or_empty',{moduleName:entry.name});
      for(const dir of REQUIRED_MODULE_DIRECTORIES) {const s=await info(path.join(root,entry.name,dir));await safePath(path.join(root,entry.name,dir));if(!s?.isDirectory()) add('module_template_invalid','module_directory_missing',{moduleName:entry.name,path:dir});}
      if(!dynamic && !(settings.includes("'"+entry.name+"'")&&settings.includes(entry.name+'.gradle'))) add('module_template_invalid','module_not_registered',{moduleName:entry.name});
    }
  }
  if(!modules.length) add('module_template_invalid','module_missing');
  if(targetModule && !modules.includes(moduleName(targetModule))) add('module_template_invalid','target_module_missing',{moduleName:targetModule});
  const dependency=dependencies?await inspectDependencies(root,(await readState(root)).dependencyManifest):{dependencyCheck:'not-run'};
  issues.push(...(dependency.issues??[]));
  const issueTypes=[...new Set(issues.map(i=>i.type))];
  return {...dependency,projectInitialized:!issueTypes.some(x=>x==='root_template_invalid'||x==='module_template_invalid'),issueTypes,issues,modules:modules.sort(),buildVerified:false,baselineCompatibilityVerified:false};
}
async function template(options={}) {
  if(options.templateFile && options.templateUrl) throw new Error('template_source_conflict');
  let temporary,filename=options.templateFile??fileURLToPath(new URL('secondev-demo.zip',ASSETS));
  try {
    if(options.templateUrl) {
      if(options.templateUrl!==TEMPLATE_DOWNLOAD_URL) throw new Error('download_url_not_allowed');
      temporary=await mkdtemp(path.join(os.tmpdir(),'ecode-template-'));filename=path.join(temporary,'template.zip');
      const response=await fetch(options.templateUrl,{redirect:'error',signal:AbortSignal.timeout(120000)});
      if(!response.ok) {await response.body?.cancel();throw new Error('download_failed: '+response.status);}
      await saveStream(response.body,filename,{limit:8*1024*1024,length:response.headers.get('content-length')});
    }
    const stats=await lstat(filename);
    if(!stats.isFile()||stats.size>8*1024*1024) throw new Error('archive_file_limit_or_type');
    if(await hashFile(filename)!==SOURCE.sha256) throw new Error('template_checksum_mismatch');
    const all=await readZip(filename,{maxBytes:8*1024*1024,maxEntry:2*1024*1024,maxEntries:500});
    const candidates=all.filter(x=>x.name.endsWith('/settings.gradle')).map(x=>x.name.slice(0,-'settings.gradle'.length));
    if(candidates.length!==1) throw new Error('template_root_ambiguous');
    const prefix=candidates[0], entries=all.filter(x=>x.name.startsWith(prefix)).map(x=>({...x,name:x.name.slice(prefix.length)})).filter(x=>x.name);
    for(const file of ROOT_FILES) if(!entries.some(x=>x.name===file && x.data.length)) throw new Error('template_incomplete: '+file);
    return {entries,hash:SOURCE.sha256,source:options.templateUrl??(options.templateFile?'local-verified-snapshot':'bundled-verified-snapshot')};
  } finally {if(temporary) await rm(temporary,{recursive:true,force:true});}
}
function modulePlan(entries,name) {
  moduleName(name);
  const source=entries.find(x=>x.name==='secondev-custom-demo/secondev-custom-demo.gradle');
  if(!source?.data.length) throw new Error('module_template_missing');
  return [{name,directory:true},{name:`${name}/src/main/java`,directory:true},{name:`${name}/src/main/resources`,directory:true},{name:`${name}/${name}.gradle`,data:source.data}];
}
async function applyPlan(root, plan, finalize,checkSpace=requireSpace) {
  const dirs=new Set(), files=[];
  for(const item of plan) {
    let parent=item.directory?item.name:path.dirname(item.name);
    while(parent&&parent!=='.') {dirs.add(parent);parent=path.dirname(parent);}
    if(!item.directory) files.push(item);
  }
  const ordered=[...dirs].sort((a,b)=>a.split(path.sep).length-b.split(path.sep).length);
  for(const dir of ordered) {const dest=path.join(root,dir);await safePath(dest);const s=await info(dest);if(s&&!s.isDirectory()) throw new Error('project_file_conflict: '+dir);}
  const pending=[];
  for(const f of files) {
    const dest=path.join(root,f.name);await safePath(dest);const s=await info(dest);
    if(s&&(!s.isFile()||(f.sourceFile?(s.size!==f.size||await hashFile(dest)!==f.sha256):!(await readFile(dest)).equals(f.data)))) throw new Error('project_file_conflict: '+f.name);
    if(!s) pending.push(f);
  }
  const required=pending.reduce((total,f)=>total+(f.sourceFile?f.size:f.data.length),0);
  await checkSpace(root,required);
  const createdFiles=[],createdDirs=[];
  try {
    for(const dir of ordered) {const dest=path.join(root,dir);if(!(await info(dest))) {await mkdir(dest);createdDirs.push(dest);}}
    for(const f of pending) {
      const dest=path.join(root,f.name);
      if(!(await info(dest))) {
        // Exclusive creation preserves user files. Register first so partial writes roll back.
        const handle=await open(dest,'wx',f.name==='gradlew'?0o755:0o644);createdFiles.push(dest);await handle.close();
        if(f.sourceFile) await copyFile(f.sourceFile,dest);
        else await writeFile(dest,f.data);
      }
    }
    return await finalize();
  } catch(e) {
    for(const file of createdFiles.reverse()) await rm(file,{force:true});
    for(const dir of createdDirs.reverse()) await rmdir(dir);
    throw e;
  }
}
export async function initializeBackendProject(projectRoot, options={}) {
  const root=await projectPath(projectRoot), name=moduleName(options.module??'secondev-custom-demo');
  const requestedVersion=await selectedVersion(root,options.baselineVersion);
  if(!options.skeletonOnly&&!requestedVersion) throw new Error('baseline_version_required');
  const prepared=options.skeletonOnly?null:await prepareDependencies({...options,baselineVersion:requestedVersion,baselineSource:options.baselineVersion?'explicit-input':'project-state'});
  try {return await locked(root,async()=>{
    const version=await selectedVersion(root,options.baselineVersion), t=await template(options);
    if(prepared&&!version) throw new Error('baseline_version_required');
    const rootName=options.projectName??path.basename(root).replace(/[^a-zA-Z0-9_-]/g,'-');
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(rootName)) throw new Error('project_name_invalid');
    const plan=t.entries.filter(x=>ROOT_DIRS.some(d=>x.name===d||x.name.startsWith(d+'/'))||ROOT_FILES.includes(x.name));
    const settings=plan.find(x=>x.name==='settings.gradle');
    settings.data=Buffer.from(settings.data.toString().replace("rootProject.name = 'secondev-demo'",`rootProject.name = '${rootName}'`));
    plan.push(...modulePlan(t.entries,name));
    if(prepared) plan.push(...prepared.plan);
    return applyPlan(root,plan,async()=>{
      const result=await inspectBackendProject(root,{module:name,dependencies:false});if(!result.projectInitialized) throw new Error('initialization_validation_failed: '+JSON.stringify(result.issues));
      const state=prepared?dependencyState(prepared):{};
      if(prepared) {
        Object.assign(result,await inspectDependencies(root,state.dependencyManifest,{deep:false}),{dependencyCheck:'verified',issues:result.issues});
        if(!result.dependencyInitialized) throw new Error('dependency_validation_failed');
      }
      await writeState(root,{...result,E10Version:version,templateVersion:SOURCE.templateVersion,templateSha256:t.hash,templateSource:t.source,initializerStatus:prepared?'complete':'skeleton-only',...state});
      return {...result,E10Version:version,templateSource:t.source,dependencySource:prepared?.source??null,dependencyDownloadChannel:prepared?.downloadChannel??null,statePath:STATE_PATH};
    },options.checkSpace??requireSpace);
  });} finally {if(prepared) await rm(prepared.temporary,{recursive:true,force:true});}
}
export async function createBackendModule(projectRoot, options={}) {
  const root=await projectPath(projectRoot), name=moduleName(options.module);
  return locked(root,async()=>{
    const version=await selectedVersion(root,options.baselineVersion), result=await inspectBackendProject(root,{dependencies:false}), t=await template();
    if(result.issueTypes.includes('root_template_invalid')) throw new Error('root_template_invalid: run init first');
    const settings=(await readFile(path.join(root,'settings.gradle'),'utf8'));
    if(!settings.includes('discoverProjects(rootProject.projectDir')||!settings.includes('buildFileName')) throw new Error('module_registration_unsupported');
    return applyPlan(root,modulePlan(t.entries,name),async()=>{
      const check=await inspectBackendProject(root,{module:name,dependencies:false});if(!check.projectInitialized) throw new Error('module_validation_failed');
      await writeState(root,{...check,E10Version:version});return {...check,E10Version:version,statePath:STATE_PATH};
    },options.checkSpace??requireSpace);
  });
}
export async function downloadDependencies(projectRoot, options={}) {
  const root=await projectPath(projectRoot);
  const requestedVersion=await selectedVersion(root,options.baselineVersion);
  if(!requestedVersion) throw new Error('baseline_version_required');
  const prepared=await prepareDependencies({...options,baselineVersion:requestedVersion,baselineSource:options.baselineVersion?'explicit-input':'project-state'});
  try {return await locked(root,async()=>{
    const version=await selectedVersion(root,options.baselineVersion);if(!version) throw new Error('baseline_version_required');
    return applyPlan(root,prepared.plan,async()=>{
      const result=await inspectBackendProject(root,{dependencies:false}),state=dependencyState(prepared);
      Object.assign(result,await inspectDependencies(root,state.dependencyManifest,{deep:false}),{dependencyCheck:'verified',issues:result.issues});
      if(!result.dependencyInitialized) throw new Error('dependency_validation_failed');
      await writeState(root,{...result,E10Version:version,...state});
      return {...result,baselineVersion:version,dependencySource:prepared.source,dependencyDownloadChannel:prepared.downloadChannel,baselineCompatibilityVerified:false,statePath:STATE_PATH};
    },options.checkSpace??requireSpace);
  });} finally {await rm(prepared.temporary,{recursive:true,force:true});}
}
export async function main(argv) {
  const [command,projectRoot,...rest]=argv;
  if(!['inspect','init','create-module','download'].includes(command)||!projectRoot) throw new Error('Usage: project-validator.mjs <inspect|init|create-module|download> <project-root> [--baseline-version 2512] [--monitor-url URL --monitor-user USER --password-stdin | --lib-archive-file lib.zip --classes-archive-file classes.zip] [--skeleton-only]');
  const allowed={'--module':'module','--baseline-version':'baselineVersion','--project-name':'projectName','--template-file':'templateFile','--template-url':'templateUrl','--monitor-url':'monitorUrl','--monitor-user':'monitorUser','--lib-archive-file':'libArchiveFile','--classes-archive-file':'classesArchiveFile'};
  const options={};
  for(let i=0;i<rest.length;) {
    if(rest[i]==='--skeleton-only'||rest[i]==='--password-stdin') {const key=rest[i]==='--skeleton-only'?'skeletonOnly':'passwordStdin';if(options[key]) throw new Error('invalid_argument');options[key]=true;i++;continue;}
    if(!allowed[rest[i]]||!rest[i+1]||rest[i+1].startsWith('--')||options[allowed[rest[i]]]) throw new Error('invalid_argument');options[allowed[rest[i]]]=rest[i+1];i+=2;
  }
  const supported={inspect:['module','baselineVersion'],init:['module','baselineVersion','projectName','templateFile','templateUrl','monitorUrl','monitorUser','passwordStdin','libArchiveFile','classesArchiveFile','skeletonOnly'],'create-module':['module','baselineVersion'],download:['baselineVersion','monitorUrl','monitorUser','passwordStdin','libArchiveFile','classesArchiveFile']};
  if(Object.keys(options).some(key=>!supported[command].includes(key))) throw new Error('argument_not_supported_for_command');
  if(options.skeletonOnly && ['monitorUrl','monitorUser','passwordStdin','libArchiveFile','classesArchiveFile'].some(key=>options[key])) throw new Error('skeleton_only_source_conflict');
  if(options.passwordStdin) {
    let value='';for await(const chunk of process.stdin) {value+=chunk.toString();if(value.length>4096) throw new Error('monitor_password_too_large');}
    options.monitorPassword=value.replace(/[\r\n]+$/,'');delete options.passwordStdin;
  }
  if(!options.skeletonOnly&&!options.libArchiveFile&&!options.classesArchiveFile&&['init','download'].includes(command)&&!options.monitorPassword) throw new Error('monitor_password_stdin_required');
  if(command==='inspect') {const root=await projectPath(projectRoot);const version=await selectedVersion(root,options.baselineVersion);return {...await inspectBackendProject(root,options),E10Version:version,dependencyDownload:resolveDependencyDownload(version)};}
  const calls={inspect:inspectBackendProject,init:initializeBackendProject,'create-module':createBackendModule,download:downloadDependencies};
  return calls[command](path.resolve(projectRoot),options);
}
if(process.argv[1] && await realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url)) {
  try {const result=await main(process.argv.slice(2));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(process.argv[2]==='inspect'&&(!result.projectInitialized||!result.dependencyInitialized)) process.exitCode=2;}
  catch(e){process.stderr.write(JSON.stringify({error:e.message})+'\n');process.exitCode=1;}
}
