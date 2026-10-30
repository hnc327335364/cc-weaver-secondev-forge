import {readFile} from 'node:fs/promises';
import {contract,targetUrl,requestJson,secretFrom,sanitize,fail,required} from './transport.mjs';
const catalogFile=new URL('../references/hr/catalog.json',import.meta.url);
export async function catalog(){return JSON.parse(await readFile(catalogFile,'utf8'));}
export async function resolveOperation(id,params={}){
  const found=(await catalog()).find(row=>row.id===id);if(!found)fail('HR_OPERATION_UNKNOWN');
  const resolved=found.path.replace(/\{(\w+)\}/g,(_,key)=>{
    const value=String(params[key]??'');if(!/^[a-zA-Z0-9_-]+(?:,[a-zA-Z0-9_-]+)*$/.test(value))fail('HR_PARAM_INVALID');return encodeURIComponent(value);
  });
  for(const key of found.queryParameters)if(params[key]===undefined)fail('HR_QUERY_REQUIRED');
  const used=[...found.path.matchAll(/\{(\w+)\}/g)].map(x=>x[1]);const query=new URLSearchParams();
  for(const [key,value] of Object.entries(params))if(!used.includes(key)){
    if(/token|secret|password|cookie|authorization/i.test(key)||typeof value==='object'||String(value).length>1000)fail('HR_QUERY_INVALID');query.set(key,String(value));
  }
  const suffix=query.toString();
  return {...found,path:resolved+(suffix?'?'+suffix:'')};
}
export async function callHr(config,id,payload={},options={}){
  const op=await resolveOperation(id,payload.params);const c=config.hr;const origin=contract(c);
  const evidence=c.operations?.[id];required(evidence,'HR_OPERATION_EVIDENCE_REQUIRED');
  if(op.write&&!options.allowWrite)fail('HR_WRITE_APPROVAL_REQUIRED');
  if(op.method==='GET'&&payload.body!==undefined)fail('HR_GET_BODY_UNSUPPORTED');
  const secrets=[];let result;
  if(c.auth==='session'){
    // Authentication stays inside the existing login CLI. Recheck the origin
    // in the transport callback to handle a session switch between reads.
    const {runCli}=await import('../../e10-login-cli/scripts/e10-login-cli.mjs');
    const args=['request',op.path,'--method',op.method];
    if(c.statePath)args.push('--state',c.statePath);if(payload.body!==undefined)args.push('--data',JSON.stringify(payload.body));
    let output='';const status=await runCli(args,{stdout:{write:s=>{output+=s;}},stderr:{write:()=>{}},fetch:async(url,init)=>{
      targetUrl(origin,url,c.allowHttp);
      const json=await requestJson(origin,String(url),init,{...options.io,allowHttp:c.allowHttp});
      return new Response(JSON.stringify(json),{status:200,headers:{'content-type':'application/json'}});
    }});
    if(status!==0)fail('HR_SESSION_REQUEST_FAILED');
    const envelope=JSON.parse(output);if(envelope.status<200||envelope.status>=300)fail('HR_HTTP_FAILED');result=envelope.body;
  }else if(c.auth==='bearer'){
    const token=secretFrom(c,'token',options.io?.env);secrets.push(token);
    result=await requestJson(origin,op.path,{method:op.method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(payload.body===undefined?{}:{body:JSON.stringify(payload.body)})},{...options.io,allowHttp:c.allowHttp});
  }else fail('HR_AUTH_MODE_REQUIRED');
  // Keep platform payload visible (redacted); HTTP acceptance is not business success.
  return {transportOk:true,operation:id,write:op.write,businessResultVerified:false,response:sanitize(result,secrets)};
}
