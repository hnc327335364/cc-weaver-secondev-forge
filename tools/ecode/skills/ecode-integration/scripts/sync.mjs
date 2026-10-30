import {contract,required,originOf,digest,fail} from './transport.mjs';
import {oauthClient} from './clients.mjs';
export const TYPES=['subcompany','department','position','employee'];
const root=id=>id===undefined||id===null||id===''||String(id)==='0';
const val=(row,...keys)=>{for(const key of keys)if(row[key]!==undefined&&row[key]!==null&&row[key]!=='')return String(row[key]);return '';};
function unique(rows,key){const map=new Map();for(const row of rows){const id=required(key(row),'SYNC_KEY_REQUIRED');if(map.has(id))fail('SYNC_DUPLICATE_KEY');map.set(id,row);}return map;}
function ordered(rows,key,parent){
  const byId=unique(rows,key),out=[],done=new Set(),visiting=new Set();
  function visit(row){const id=key(row);if(done.has(id))return;if(visiting.has(id))fail('SYNC_PARENT_CYCLE');visiting.add(id);const p=parent(row);if(byId.has(p))visit(byId.get(p));visiting.delete(id);done.add(id);out.push(row);}
  for(const row of rows)visit(row);return out;
}
function binding(c){return digest({e9:c.e9,e10:c.e10,sync:c.sync});}
export function selectScope(snapshot,ids){
  if(!Array.isArray(ids)||!ids.length)fail('SYNC_SCOPE_REQUIRED');const scope=new Set(ids.map(String));
  const subcompany=snapshot.subcompany.filter(r=>scope.has(String(r.id)));
  const department=snapshot.department.filter(r=>scope.has(val(r,'subcompanyid1','subcompanyid')));
  const deps=new Set(department.map(r=>String(r.id)));
  const employee=snapshot.employee.filter(r=>deps.has(String(r.departmentid)));
  const positions=new Set(employee.map(r=>String(r.jobtitle)));const sourcePositions=unique(snapshot.position,r=>String(r.id));
  for(const p of snapshot.position)if(deps.has(val(p,'jobdepartmentid','departmentid')))positions.add(String(p.id));
  // Include real ancestors, never invent a top-level anchor or mutate it by name.
  const pending=[...positions];for(let i=0;i<pending.length;i++){const p=sourcePositions.get(pending[i]);const parent=p&&val(p,'parentjobtitleid');if(!root(parent)&&!positions.has(parent)){positions.add(parent);pending.push(parent);}}
  return {...snapshot,subcompany,department,employee,position:snapshot.position.filter(r=>positions.has(String(r.id)))};
}
export function createPlan(snapshot,c){
  const targetOrigin=contract(c.e10),sourceOrigin=originOf(c.e9?.origin,c.e9?.allowHttp),s=c.sync;
  if(snapshot.origin!==sourceOrigin)fail('SYNC_SOURCE_ORIGIN');
  if(!Array.isArray(s?.subcompanyIds)||!s.subcompanyIds.length)fail('SYNC_SCOPE_REQUIRED');
  for(const type of TYPES)if(!Array.isArray(snapshot[type]))fail('SYNC_SNAPSHOT_SCHEMA');
  const scope=new Set(s.subcompanyIds.map(String));const subs=unique(snapshot.subcompany,r=>val(r,'id'));
  if(scope.size!==subs.size||[...subs.keys()].some(id=>!scope.has(id)))fail('SYNC_SCOPE_MISMATCH');
  const deps=unique(snapshot.department,r=>val(r,'id')),positions=unique(snapshot.position,r=>val(r,'id'));
  unique(snapshot.employee,r=>val(r,'workcode','jobNum'));
  const maximum=s.maxRecords;if(!Number.isSafeInteger(maximum)||maximum<1||maximum>100000)fail('SYNC_LIMIT_REQUIRED');
  const recordCount=TYPES.reduce((sum,type)=>sum+snapshot[type].length,0);if(!recordCount||recordCount>maximum)fail('SYNC_LIMIT_EXCEEDED');
  const code=(type,id)=>(s.codePrefixes?.[type]||'')+id;
  const external=(type,id)=>(s.existing?.[type]||[]).includes(id);
  const ref=(type,id,map)=>{if(map.has(id))return code(type,id);if(external(type,id))return id;fail('SYNC_FOREIGN_REFERENCE');};
  const data={};
  data.subcompany=ordered(snapshot.subcompany,r=>val(r,'id'),r=>val(r,'supsubcomid')).map(r=>{
    const id=val(r,'id'),p=val(r,'supsubcomid');const item={code:code('subcompany',id),name:required(val(r,'subcompanyname','name')),status:required(s.orgStatus,'SYNC_ORG_STATUS_REQUIRED')};
    if(!root(p))item.parent=ref('subcompany',p,subs);else if(s.rootParent){if(!external('subcompany',s.rootParent))fail('SYNC_ROOT_UNVERIFIED');item.parent=s.rootParent;}
    const fullname=val(r,'subcompanydesc');if(fullname)item.fullname=fullname;return item;
  });
  data.department=ordered(snapshot.department,r=>val(r,'id'),r=>val(r,'supdepid')).map(r=>{
    const sub=val(r,'subcompanyid1','subcompanyid');if(!scope.has(sub))fail('SYNC_SCOPE_MISMATCH');
    const p=val(r,'supdepid');const item={code:code('department',val(r,'id')),name:required(val(r,'departmentname','name')),status:required(s.orgStatus),parent:root(p)?code('subcompany',sub):ref('department',p,deps)};
    if(val(r,'departmentmark'))item.fullname=val(r,'departmentmark');return item;
  });
  // Subcompany and department share an organization reference space.
  unique([...data.subcompany,...data.department],r=>r.code);
  data.position=ordered(snapshot.position,r=>val(r,'id'),r=>val(r,'parentjobtitleid')).map(r=>{
    const item={code:code('position',val(r,'id')),name:required(val(r,'jobtitlename','name')),is_canceled:required(s.positionCanceled,'SYNC_POSITION_STATUS_REQUIRED')};
    const p=val(r,'parentjobtitleid');if(!root(p))item.parent=ref('position',p,positions);else if(s.positionRootCode){if(!external('position',s.positionRootCode))fail('SYNC_POSITION_ROOT_UNVERIFIED');item.parent=s.positionRootCode;}
    const dep=val(r,'jobdepartmentid','departmentid');if(!root(dep))item.department=ref('department',dep,deps);return item;
  });
  data.employee=snapshot.employee.map(r=>{
    const status=val(r,'status');if(!Object.hasOwn(s.statusMap||{},status))fail('SYNC_STATUS_UNMAPPED');
    const item={job_num:required(val(r,'workcode','jobNum')),username:required(val(r,'lastname','lastName')),department:ref('department',val(r,'departmentid'),deps),personnel_status:required(s.statusMap[status],'SYNC_STATUS_INVALID')};
    const pos=val(r,'jobtitle');if(!root(pos))item.position=ref('position',pos,positions);
    for(const field of ['mobile','email'])if(val(r,field))item[field]=val(r,field);
    const sex=val(r,'sex');if(s.sexMap&&sex){if(!Object.hasOwn(s.sexMap,sex))fail('SYNC_SEX_UNMAPPED');item.sex=s.sexMap[sex];}
    const hire=val(r,'createdate','hireDate');if(hire){if(!/^\d{4}-\d{2}-\d{2}/.test(hire))fail('SYNC_DATE_INVALID');item.hiredate=hire.slice(0,10);}return item;
  });
  const batches=[];const size=s.batchSize??50;if(!Number.isInteger(size)||size<1||size>50)fail('SYNC_BATCH_SIZE');
  for(const type of TYPES){
    const endpoint=required(s.endpoints?.[type],'SYNC_ENDPOINT_REQUIRED');
    const name='sync'+type[0].toUpperCase()+type.slice(1);
    if(!['/api/hrm/restful/'+name,'/sapi/hrm/restful/'+name].includes(endpoint))fail('SYNC_ENDPOINT_INVALID');
    const dataRule={employee:'job_num',[type]:type==='employee'?'job_num':'code'};
    if(type==='position'||type==='employee')dataRule.department='code';if(type==='employee')dataRule.position='code';
    for(let start=0;start<data[type].length;start+=size)batches.push({type,path:endpoint,body:{data:data[type].slice(start,start+size),dataRule,optId:required(c.e10.operatorId,'SYNC_OPERATOR_REQUIRED')}});
  }
  const plan={schemaVersion:1,sourceOrigin,targetOrigin,baseline:c.e10.baseline,configDigest:binding(c),recordCount,scope:[...scope],batches};
  return {...plan,digest:digest(plan)};
}
export async function applyPlan(plan,c,options={}){
  const {digest:hash,...body}=plan;
  if(hash!==digest(body)||plan.configDigest!==binding(c)||plan.targetOrigin!==contract(c.e10)||plan.schemaVersion!==1)fail('PLAN_CHANGED');
  if(options.dryRun)return {ok:true,mode:'dry-run',networkRequests:0,digest:hash,recordCount:plan.recordCount};
  if(options.approve!==hash)fail('PLAN_APPROVAL_REQUIRED');required(c.sync.backupEvidence,'SYNC_BACKUP_EVIDENCE_REQUIRED');
  const client=options.client||oauthClient(c,options.io);
  let completed=0;
  for(let index=0;index<plan.batches.length;index++){
    const batch=plan.batches[index];
    if(!TYPES.includes(batch.type)||batch.path!==c.sync.endpoints[batch.type]||batch.body.data.length>50)fail('PLAN_BATCH_INVALID');
    await options.audit?.({event:'attempt',index,type:batch.type,count:batch.body.data.length,digest:hash});
    let response;
    try{response=await client.call(batch.path,batch.body);}catch{
      await options.audit?.({event:'indeterminate',index,completed,digest:hash});fail('BATCH_REQUEST_INDETERMINATE_STOPPED');
    }
    if(!Array.isArray(response.data)||response.data.length!==batch.body.data.length||response.data.some(r=>String(r.status).toUpperCase()!=='SUCCESS')||(response.errcode!==undefined&&String(response.errcode)!=='0')||(response.message?.errcode!==undefined&&String(response.message.errcode)!=='0')){
      await options.audit?.({event:'failed-or-unverified',index,completed,digest:hash});fail('BATCH_FAILED_OR_UNVERIFIED_STOPPED');
    }
    completed+=batch.body.data.length;await options.audit?.({event:'completed',index,completed,digest:hash});
  }
  return {ok:true,completed,digest:hash,rollback:'not-automatic'};
}
