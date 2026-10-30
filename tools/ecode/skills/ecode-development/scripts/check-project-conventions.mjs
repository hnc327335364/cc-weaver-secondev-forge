#!/usr/bin/env node
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function checkProject(directory, mode='existing') {
  if (!['existing','new'].includes(mode)) throw new Error('mode must be existing or new');
  const root=await realpath(directory);
  const findings=[];
  const add=(code,file,message)=>findings.push({code,file,message});
  for(const [name,type] of [['resources','directory'],['config','directory'],['entry.js','file'],['build.json','file']]){
    try {
      const stat=await lstat(path.join(root,name));
      if(stat.isSymbolicLink() || (type==='directory'?!stat.isDirectory():!stat.isFile())) add('INVALID_PROJECT_ENTRY',name,`Expected ${type}, no symbolic link`);
    } catch(error) {if(error.code==='ENOENT') add('PROJECT_ENTRY_MISSING',name,`Expected ${type}`);else throw error;}
  }
  let build;
  try {build=JSON.parse(await readFile(path.join(root,'build.json'),'utf8'));}
  catch(error) {add('BUILD_JSON_UNREADABLE','build.json','Missing or invalid JSON');}
  if (!build || typeof build !== 'object' || Array.isArray(build)) add('BUILD_OBJECT_REQUIRED','build.json','build.json must be an object');
  else {
    if(!build.codes || typeof build.codes!=='object' || Array.isArray(build.codes)) add('CODES_MAP_REQUIRED','build.json','codes must be an object keyed by business file path');
    else for(const name of Object.keys(build.codes)){
      const normalized=name.replaceAll('\\','/');
      const file=path.resolve(root,normalized);
      if(path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized) || file===root || !file.startsWith(root+path.sep)) {
        add('CODE_PATH_OUTSIDE_PROJECT',name,'Code path must stay inside project');continue;
      }
      const inResources=path.relative(root,file).split(path.sep)[0]==='resources';
      if(inResources) add('BUSINESS_IN_RESOURCES',name,'build.json codes must not register business code under resources');
      if(!/\.(js|css)$/.test(name)) add('UNSUPPORTED_BUSINESS_EXTENSION',name,'Registered source must use .js or .css supported by the builder');
      try {
        const actual=await realpath(file);
        if(!actual.startsWith(root+path.sep)) add('CODE_PATH_OUTSIDE_PROJECT',name,'Code symlink resolves outside project');
        else if(!inResources && path.relative(root,actual).split(path.sep)[0]==='resources') add('BUSINESS_IN_RESOURCES',name,'Code alias resolves into resources');
        else if(!(await lstat(actual)).isFile()) add('CODE_NOT_FILE',name,'Registered code path must be a file');
      } catch(error) {if(error.code==='ENOENT') add('CODE_FILE_MISSING',name,'Registered code file missing');else throw error;}
    }
  }
  return {status:findings.length?'FAIL':'PASS',mode,readOnly:true,findings,
    semanticValidation:'UNVERIFIED',
    manualChecks:['新项目普通React页面默认函数组件，平台契约例外记录依据；存量class/store保持。','组件状态与共享store归属需人工或Agent按代码语义核验。','平台API、基线、权限、作用域及浏览器运行结果另行核验。'],
    scope:'Checks project entries and build.json registered code paths only; PASS is not build success or full project compliance.'};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [directory,...args]=process.argv.slice(2);
    if(!directory || args.length && (args.length!==2 || args[0]!=='--mode')) throw new Error('Usage: check-project-conventions.mjs <frontend-directory> [--mode existing|new]');
    const result=await checkProject(directory,args[1]||'existing');console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='FAIL'?1:0;
  } catch(error) {console.log(JSON.stringify({status:'FAIL',error:error.message,readOnly:true}));process.exitCode=1;}
}
