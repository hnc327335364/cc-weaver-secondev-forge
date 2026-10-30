import {publicEncrypt,constants} from 'node:crypto';
import {contract,required,secretFrom,requestJson,fail} from './transport.mjs';

export const E9_PATHS=Object.freeze({subcompany:'/api/hrm/resful/getHrmsubcompanyWithPage',department:'/api/hrm/resful/getHrmdepartmentWithPage',position:'/api/hrm/resful/getJobtitleInfoWithPage',employee:'/api/hrm/resful/getHrmUserInfoWithPage'});
export function e9Client(config,io={}){
  const c=config.e9;const origin=contract(c);let cached;let expires=0;const secrets=[];
  const rsa=value=>{
    const spk=secretFrom(c,'publicKey',io.env);
    const key=spk.includes('BEGIN PUBLIC KEY')?spk:'-----BEGIN PUBLIC KEY-----\n'+spk+'\n-----END PUBLIC KEY-----';
    try{return publicEncrypt({key,padding:constants.RSA_PKCS1_PADDING},Buffer.from(value)).toString('base64');}catch{fail('E9_RSA_KEY_INVALID');}
  };
  const send=(relative,options)=>requestJson(origin,relative,options,{...io,allowHttp:c.allowHttp});
  async function token(){
    if(cached&&Date.now()<expires)return cached;
    const secret=secretFrom(c,'secret',io.env);secrets.push(secret);
    const result=await send('/api/ec/dev/auth/applytoken',{method:'POST',headers:{appid:required(c.appId),secret:rsa(secret),'content-type':'application/x-www-form-urlencoded'},body:''});
    cached=required(result.token,'E9_AUTH_FAILED');secrets.push(cached);expires=Date.now()+1500000;return cached;
  }
  async function read(type,filters={}){
    if(!Object.hasOwn(E9_PATHS,type))fail('E9_RESOURCE_INVALID');
    const auth=await token();
    const r=await send(E9_PATHS[type],{method:'POST',headers:{appid:required(c.appId),token:auth,userid:rsa(required(c.userId)),'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({params:JSON.stringify(filters)}).toString()});
    if(!r.data||!Array.isArray(r.data.dataList))fail('E9_RESPONSE_SCHEMA');return r.data;
  }
  async function all(type,filters={}){
    const limit=c.maxRecords??10000;if(!Number.isInteger(limit)||limit<1||limit>100000)fail('E9_LIMIT_INVALID');
    const rows=[];const seen=new Set();let expected;
    for(let page=1;page<=1000;page++){
      const data=await read(type,{...filters,pagesize:200,curpage:page});
      const total=Number(data.totalSize);if(!Number.isSafeInteger(total)||total<0||total>limit)fail('E9_TOTAL_INVALID');
      if(expected!==undefined&&expected!==total)fail('E9_DATA_CHANGED');expected=total;
      for(const row of data.dataList){const id=String(row.id??'');if(!id||seen.has(id))fail('E9_DUPLICATE_ID');seen.add(id);rows.push(row);}
      if(rows.length>limit||rows.length>total)fail('E9_LIMIT_EXCEEDED');
      if(rows.length===total)return rows;
      if(!data.dataList.length)fail('E9_INCOMPLETE_PAGE');
    }
    fail('E9_PAGE_LIMIT');
  }
  return {read,all,secrets,origin};
}

export function oauthClient(config,io={}){
  const c=config.e10;const origin=contract(c);if(c.auth!=='oauth')fail('OAUTH_MODE_REQUIRED');
  let cached;let expires=0;const secrets=[];
  const send=(relative,options)=>requestJson(origin,relative,options,{...io,allowHttp:c.allowHttp});
  async function token(force=false){
    if(!force&&cached&&Date.now()<expires)return cached;
    const appSecret=secretFrom(c,'appSecret',io.env);secrets.push(appSecret);
    const codeResult=await send('/oauth2/authorize?'+new URLSearchParams({corpid:required(c.corpId),response_type:'code'}),{method:'GET'});
    const code=required(codeResult.code,'OAUTH_CODE_FAILED');secrets.push(code);
    const result=await send('/oauth2/access_token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',app_key:required(c.appKey),app_secret:appSecret,code}).toString()});
    if(String(result.errcode)!=='0')fail('OAUTH_TOKEN_FAILED');
    cached=required(result.access_token??result.accessToken??result.acessToken,'OAUTH_TOKEN_MISSING');secrets.push(cached);
    const ttl=Number(result.expires_in??7200);if(!Number.isFinite(ttl)||ttl<=0)fail('OAUTH_EXPIRY_INVALID');expires=Date.now()+Math.max(0,ttl-300)*1000;return cached;
  }
  async function call(relative,body){
    const accessToken=await token();return send(relative,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,access_token:accessToken})});
  }
  return {call,secrets,check:async(force=false)=>{await token(force);return {ok:true,origin,authentication:'oauth',storage:'process-memory',expiresAt:new Date(expires).toISOString()};}};
}
