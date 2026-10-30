import {createHash} from 'node:crypto';
import {readFile,open} from 'node:fs/promises';

export function fail(code){throw new Error(code);}
export function required(value,code='CONFIG_REQUIRED'){
  if(typeof value!=='string'||!value.trim())fail(code);
  return value;
}
export function originOf(value,allowHttp=false){
  let url;try{url=new URL(value);}catch{fail('ORIGIN_INVALID');}
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail('ORIGIN_INVALID');
  if(url.protocol!=='https:'&&!(allowHttp===true&&url.protocol==='http:'))fail('HTTPS_REQUIRED');
  return url.origin;
}
export function targetUrl(origin,relative,allowHttp=false){
  const base=originOf(origin,allowHttp);let url;
  try{url=new URL(relative,base);}catch{fail('ORIGIN_INVALID');}
  if(url.origin!==base||url.username||url.password||url.hash)fail('ORIGIN_MISMATCH');
  return url;
}
export function sanitize(value,secrets=[]){
  if(Array.isArray(value))return value.map(v=>sanitize(v,secrets));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/token|secret|password|cookie|authorization|eteamsid|privatekey/i.test(k)?'[REDACTED]':sanitize(v,secrets)]));
  if(typeof value==='string')for(const secret of secrets.filter(x=>typeof x==='string'&&x.length))value=value.split(secret).join('[REDACTED]');
  return value;
}
export function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export async function readJson(file){
  required(file,'FILE_REQUIRED');const raw=await readFile(file);if(raw.length>16*1024*1024)fail('FILE_TOO_LARGE');
  try{return JSON.parse(raw.toString('utf8'));}catch{fail('JSON_INVALID');}
}
export async function writePrivate(file,value){
  required(file,'OUTPUT_REQUIRED');const fd=await open(file,'wx',0o600);
  try{await fd.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await fd.close();}
}
export function secretFrom(section,key,env=process.env){
  const name=required(section?.[key+'Env'],'SECRET_ENV_REQUIRED');
  if(!/^[A-Z][A-Z0-9_]*$/.test(name))fail('SECRET_ENV_INVALID');
  return required(env[name],'SECRET_MISSING');
}
export function contract(section){
  required(section?.baseline,'BASELINE_REQUIRED');required(section?.contractEvidence,'CONTRACT_EVIDENCE_REQUIRED');
  return originOf(section.origin,section.allowHttp);
}
export async function requestJson(origin,relative,options={},io={}){
  const url=targetUrl(origin,relative,io.allowHttp);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await(io.fetch||fetch)(url,{...options,redirect:'error',signal:controller.signal});
    if(!response.ok)fail('HTTP_'+response.status);
    if(!/\bjson\b/i.test(response.headers.get('content-type')||''))fail('RESPONSE_NOT_JSON');
    const reader=response.body?.getReader();if(!reader)fail('RESPONSE_EMPTY');
    const chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();fail('RESPONSE_TOO_LARGE');}chunks.push(value);}
    let result;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('RESPONSE_INVALID_JSON');}
    if(!result||typeof result!=='object')fail('RESPONSE_INVALID_SCHEMA');return result;
  }catch(e){if(/^(HTTP_\d+|RESPONSE_[A-Z_]+)$/.test(e.message))throw e;fail('REQUEST_FAILED');}
  finally{clearTimeout(timer);}
}
