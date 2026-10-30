// Contract subset: GitHub REST releases; Gitee v5.4.93 releases/attach_files.
// Raw streams preserve binary multipart payloads; local process state resets per run.
const http = require('http');
let release=null, files=[], events=[], mode='normal';
http.createServer((req,res)=>{
  let chunks=[];
  req.on('data', c=>chunks.push(c));
  req.on('end', ()=>{
    const raw=Buffer.concat(chunks), url=new URL(req.url,'http://local'), p=url.pathname;
    const send=(v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
    if(p==='/reset') { release=null;files=[];events=[];mode=url.searchParams.get('mode')||'normal';return send({ok:true}); }
    if(p==='/audit') return send({release,events,files:files.map(({id,name})=>({id,name}))});
    const gitee=p.startsWith('/v5/');
    const base=(gitee?'/v5':'')+'/repos/test/repo/releases';
    let values={};
    const ct=req.headers['content-type']||'';
    if(ct.includes('application/json')) { try{values=JSON.parse(raw);}catch{return send({},400);} }
    else if(ct.includes('application/x-www-form-urlencoded')) values=Object.fromEntries(new URLSearchParams(raw.toString()));
    if(req.method==='GET' && p===base+'/1') return release?send(release):send({},404);
    if('prerelease' in values) values.prerelease=values.prerelease===true||values.prerelease==='true';
    if(req.method==='GET' && p.startsWith(base+'/tags/')) return release?send(release):send({},404);
    if(req.method==='POST' && p===base) {
      if(!['name','tag_name','body','target_commitish'].every(k=>values[k])) return send({},400);
      if(gitee && ('draft' in values || !ct.includes('x-www-form-urlencoded'))) return send({},400);
      if(release) return send({},422);
      events.push('create'); release={id:1,...values};return send(release,201);
    }
    const list=base+'/1/'+(gitee?'attach_files':'assets');
    if(req.method==='GET' && p===list) return send(files.map(({id,name})=>({id,name})));
    if(req.method==='POST' && p===list) {
      events.push('upload');if(mode==='fail-upload') return send({},500);
      let name, bytes;
      if(gitee) {
        const boundary=(ct.split('boundary=')[1]||'');
        const endHeader=raw.indexOf('\r\n\r\n');
        const header=raw.subarray(0,endHeader).toString();
        const match=header.match(/name="file"; filename="([^"]+)"/);
        if(!boundary || endHeader<0 || !match) return send({},400);
        name=match[1];bytes=raw.subarray(endHeader+4,raw.length-Buffer.byteLength('\r\n--'+boundary+'--\r\n'));
      }else{name=url.searchParams.get('name');bytes=raw;}
      const file={id:files.length+1,name,bytes};files.push(file);return send({id:file.id,name},201);
    }
    const match=p.match(gitee?/\/attach_files\/(\d+)\/download$/:/\/assets\/(\d+)$/);
    if(req.method==='GET' && match) {
      if(!gitee && req.headers.accept!=='application/octet-stream') return send({},400);
      const file=files.find(f=>f.id===Number(match[1]));if(!file)return send({},404);
      res.writeHead(200,{'Content-Type':'application/octet-stream'});return res.end(mode==='corrupt'?Buffer.from('bad'):file.bytes);
    }
    if(req.method==='PATCH' && p===base+'/1') {
      if(gitee && !values.tag_name)return send({},400);
      events.push('finalize');release={...release,...values};return send(release);
    }
    return send({error:'not modeled'},501);
  });
}).listen(process.env.PORT || 4500);
