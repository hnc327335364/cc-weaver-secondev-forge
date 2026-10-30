#!/usr/bin/env node
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {open} from 'node:fs/promises';
import {readJson,writePrivate,sanitize,required,fail} from './transport.mjs';
import {e9Client,oauthClient} from './clients.mjs';
import {createPlan,applyPlan,selectScope,TYPES} from './sync.mjs';
import {catalog,callHr} from './hr.mjs';
const usage=`ecode-integration (Node.js 18+; no npm dependencies)
  help
  e9 read --config FILE --resource subcompany|department|position|employee --out NEW_FILE [--filters FILE]
  e9 snapshot --config FILE --out NEW_FILE
  oauth check --config FILE [--refresh]
  sync plan --config FILE --snapshot FILE --out NEW_FILE
  sync apply --config FILE --plan FILE --dry-run
  sync apply --config FILE --plan FILE --approve SHA256 --journal NEW_FILE
  hr list
  hr call --config FILE --operation ID [--payload FILE] [--allow-write --journal NEW_FILE]
Secrets: environment variables referenced by config; never command arguments.
All output files must be new. Plan and dry-run are offline. Live calls require recorded target contracts.`;
export function parseArgs(argv){
  const args={command:argv[0]||'help',action:argv[1]};const bool=new Set(['dry-run','allow-write','refresh']);
  const values=new Set(['config','resource','out','filters','snapshot','plan','approve','journal','operation','payload']);
  for(let i=2;i<argv.length;i++){
    const key=argv[i].replace(/^--/,'');if(argv[i]===key||Object.hasOwn(args,key))fail('ARGUMENT_INVALID');
    if(bool.has(key))args[key]=true;else if(values.has(key)&&argv[i+1]&&!argv[i+1].startsWith('--'))args[key]=argv[++i];else fail('ARGUMENT_INVALID');
  }
  const valid={help:[],e9:['read','snapshot'],oauth:['check'],sync:['plan','apply'],hr:['list','call']};
  if(!Object.hasOwn(valid,args.command)||(args.command!=='help'&&!valid[args.command].includes(args.action)))fail('COMMAND_INVALID');
  if(args.command==='help'&&argv.length>1)fail('ARGUMENT_INVALID');
  const allowed={
    'e9 read':['config','resource','out','filters'], 'e9 snapshot':['config','out'],
    'oauth check':['config','refresh'], 'sync plan':['config','snapshot','out'],
    'sync apply':['config','plan','dry-run','approve','journal'],
    'hr list':[], 'hr call':['config','operation','payload','allow-write','journal'],
  }[args.command+' '+args.action]||[];
  for(const key of Object.keys(args))if(!['command','action'].includes(key)&&!allowed.includes(key))fail('ARGUMENT_INVALID');
  if(args['dry-run']&&(args.approve||args.journal))fail('ARGUMENT_CONFLICT');
  return args;
}
async function journal(file,work){
  const fd=await open(required(file,'JOURNAL_REQUIRED'),'wx',0o600);
  const audit=async event=>{await fd.writeFile(JSON.stringify({time:new Date().toISOString(),...event})+'\n');await fd.sync();};
  try{return await work(audit);}finally{await fd.close();}
}
export async function run(argv,io={}){
  const args=parseArgs(argv);
  if(args.command==='help')return usage;
  if(args.command==='hr'&&args.action==='list')return await catalog();
  const config=await readJson(args.config);
  if(args.command==='e9'){
    const client=e9Client(config,io);
    if(args.action==='read'){
      const rows=await client.all(required(args.resource),args.filters?await readJson(args.filters):{});
      await writePrivate(args.out,sanitize({origin:client.origin,type:args.resource,rows},client.secrets));return {ok:true,count:rows.length,output:args.out};
    }
    if(!Array.isArray(config.sync?.subcompanyIds)||!config.sync.subcompanyIds.length)fail('SYNC_SCOPE_REQUIRED');
    const snapshot={origin:client.origin,capturedAt:new Date().toISOString()};
    for(const type of TYPES)snapshot[type]=await client.all(type);
    const selected=selectScope(snapshot,config.sync.subcompanyIds);
    await writePrivate(args.out,sanitize(selected,client.secrets));return {ok:true,output:args.out,counts:Object.fromEntries(TYPES.map(type=>[type,selected[type].length]))};
  }
  if(args.command==='oauth')return await oauthClient(config,io).check(args.refresh);
  if(args.command==='sync'){
    if(args.action==='plan'){
      const plan=createPlan(await readJson(args.snapshot),config);await writePrivate(args.out,plan);
      return {ok:true,output:args.out,digest:plan.digest,recordCount:plan.recordCount,mode:'plan-only',networkRequests:0};
    }
    const plan=await readJson(args.plan);
    if(args['dry-run'])return await applyPlan(plan,config,{dryRun:true});
    if(args.approve!==plan.digest)fail('PLAN_APPROVAL_REQUIRED');
    return await journal(args.journal,audit=>applyPlan(plan,config,{approve:args.approve,audit,io}));
  }
  const payload=args.payload?await readJson(args.payload):{};
  const invoke=()=>callHr(config,required(args.operation),payload,{allowWrite:args['allow-write']===true,io});
  if(args['allow-write'])return await journal(args.journal,async audit=>{
    await audit({event:'attempt',operation:args.operation});
    try{const result=await invoke();await audit({event:'response-received-business-result-unverified',operation:args.operation});return result;}
    catch(error){await audit({event:'failed-or-indeterminate',operation:args.operation});throw error;}
  });
  return await invoke();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const result=await run(process.argv.slice(2));console.log(typeof result==='string'?result:JSON.stringify(sanitize(result),null,2));}
  catch(error){console.error(JSON.stringify({ok:false,error:/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:error.code==='EEXIST'?'OUTPUT_EXISTS':'INTEGRATION_FAILED'}));process.exitCode=1;}
}
