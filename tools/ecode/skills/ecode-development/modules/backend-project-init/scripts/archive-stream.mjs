import { open, lstat, mkdir, rm, statfs } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const ARCHIVE_LIMIT = 1024 * 1024 * 1024;
const ENTRY_LIMIT = 256 * 1024 * 1024;
const table = Array.from({length:256}, (_, value) => {
  for(let i=0;i<8;i++) value=value&1?0xedb88320^(value>>>1):value>>>1;
  return value>>>0;
});
async function readAt(handle, size, position) {
  const bytes=Buffer.alloc(size);let offset=0;
  while(offset<size) {const result=await handle.read(bytes,offset,size-offset,position+offset);if(!result.bytesRead) throw new Error('archive_truncated');offset+=result.bytesRead;}
  return bytes;
}
export async function requireSpace(directory, bytes, {statfsImpl=statfs}={}) {
  if(!Number.isSafeInteger(bytes)||bytes<0) throw new Error('dependency_space_requirement_invalid');
  const space=await statfsImpl(directory,{bigint:true});
  if(space.bavail*space.bsize<BigInt(bytes)+16n*1024n*1024n) throw new Error('dependency_disk_space_insufficient');
}
export async function hashFile(filename) {
  const hash=createHash('sha256');for await(const part of createReadStream(filename)) hash.update(part);return hash.digest('hex');
}
export async function saveStream(source, filename, {limit=ARCHIVE_LIMIT, length=null,checkSpace=requireSpace}={}) {
  let bytes=0,owned=false,checked=0;const hash=createHash('sha256');
  try {
    if(length!==null&&(!/^\d+$/.test(String(length))||Number(length)>limit)) throw new Error('download_size_limit');
    await checkSpace(path.dirname(filename),length===null?0:Number(length));
    const meter=new Transform({transform(chunk,encoding,callback) {
      bytes+=chunk.length;
      if(bytes>limit) return callback(new Error('download_size_limit'));
      const forward=()=>{hash.update(chunk);callback(null,chunk);};
      if(length===null&&(checked===0||bytes-checked>=1024*1024)) {
        checked=bytes;checkSpace(path.dirname(filename),chunk.length).then(forward,callback);
      } else forward();
    }});
    const handle=await open(filename,'wx',0o600);owned=true;
    await pipeline(source,meter,handle.createWriteStream());
    if(!bytes) throw new Error('dependency_archive_empty');
    if(length!==null&&bytes!==Number(length)) throw new Error('download_length_mismatch');
    return {filename,bytes,sha256:hash.digest('hex')};
  } catch(error) {source.destroy?.();await source.cancel?.().catch(()=>{});if(owned) await rm(filename,{force:true});throw error;}
}
export async function zipDirectory(filename,{jar=false,maxBytes=ARCHIVE_LIMIT,maxEntry=ENTRY_LIMIT,maxEntries=50000}={}) {
  const stats=await lstat(filename);
  if(!stats.isFile()||stats.size>(jar?ENTRY_LIMIT:ARCHIVE_LIMIT)||stats.size<22) throw new Error('archive_file_limit_or_type');
  const handle=await open(filename,'r');
  try {
    const tail=await readAt(handle,Math.min(stats.size,65557),Math.max(0,stats.size-65557));let end=-1;
    for(let i=tail.length-22;i>=0;i--) if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length) {end=i;break;}
    if(end<0) throw new Error('archive_zip_invalid');
    const count=tail.readUInt16LE(end+10),size=tail.readUInt32LE(end+12),offset=tail.readUInt32LE(end+16);
    if(tail.readUInt16LE(end+4)||tail.readUInt16LE(end+6)||tail.readUInt16LE(end+8)!==count||count===65535||count>maxEntries||offset+size!==stats.size-tail.length+end) throw new Error('archive_zip_unsupported');
    const entries=[],names=new Set();let position=offset,total=0;
    for(let i=0;i<count;i++) {
      if(position+46>offset+size) throw new Error('archive_zip_invalid');
      const record=await readAt(handle,46,position);
      if(record.readUInt32LE(0)!==0x02014b50) throw new Error('archive_zip_invalid');
      const flags=record.readUInt16LE(8),method=record.readUInt16LE(10),crc=record.readUInt32LE(16),packed=record.readUInt32LE(20),length=record.readUInt32LE(24);
      const nl=record.readUInt16LE(28),el=record.readUInt16LE(30),cl=record.readUInt16LE(32),mode=record.readUInt32LE(38)>>>16,local=record.readUInt32LE(42);
      if(position+46+nl+el+cl>offset+size||flags&1||![0,8].includes(method)||length>maxEntry||(total+=length)>maxBytes||length>Math.max(1024*1024,packed*1000)) throw new Error('archive_limit_or_format');
      const raw=(await readAt(handle,nl,position+46)).toString('utf8'),directory=raw.endsWith('/'),name=raw.replace(/\/$/,'');
      if(!name||name.length>1024||/[\\\x00-\x1f:]/.test(name)||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..')) throw new Error('archive_unsafe_path');
      const key=jar?name:name.toLowerCase(),type=mode&0xf000;
      if((!jar&&type&&type!==0x8000&&type!==0x4000)||(names.has(key)&&(!jar||!directory))) throw new Error('archive_link_or_duplicate');
      names.add(key);
      if(local+30>offset) throw new Error('archive_zip_invalid');
      const header=await readAt(handle,30,local),localNl=header.readUInt16LE(26),localEl=header.readUInt16LE(28),start=local+30+localNl+localEl;
      if(header.readUInt32LE(0)!==0x04034b50||header.readUInt16LE(8)!==method||header.readUInt16LE(6)!==flags||start+packed>offset||(await readAt(handle,localNl,local+30)).toString('utf8')!==raw||(directory&&length)) throw new Error('archive_zip_invalid');
      entries.push({name,directory,start,packed,length,method,crc,mode:mode&0o777});position+=46+nl+el+cl;
    }
    if(position!==offset+size) throw new Error('archive_zip_invalid');
    const intervals=entries.map(e=>[e.start,e.start+e.packed]).sort((a,b)=>a[0]-b[0]);
    for(let i=1;i<intervals.length;i++) if(intervals[i][0]<intervals[i-1][1]) throw new Error('archive_overlapping_entries');
    return {entries,total};
  } finally {await handle.close();}
}
export async function streamEntry(filename,entry,destination) {
  let length=0,crc=0xffffffff;
  const meter=new Transform({transform(chunk,encoding,callback) {
    length+=chunk.length;if(length>entry.length) return callback(new Error('archive_crc_or_size'));
    for(const byte of chunk) crc=table[(crc^byte)&255]^(crc>>>8);
    callback(null,chunk);
  }});
  const toFile=typeof destination==='string';
  const sink=toFile?createWriteStream(destination,{flags:'wx',mode:0o600}):destination??new Writable({write(chunk,encoding,callback){callback();}});
  try {
    const input=entry.packed?createReadStream(filename,{start:entry.start,end:entry.start+entry.packed-1,highWaterMark:64*1024}):Readable.from([]);
    await pipeline(...(entry.method===8?[input,createInflateRaw(),meter,sink]:[input,meter,sink]));
    if(length!==entry.length||((crc^0xffffffff)>>>0)!==entry.crc) throw new Error('archive_crc_or_size');
  } catch(error) {if(toFile) await rm(destination,{force:true});throw error;}
}
// Bounded template contents use the same directory and CRC checks as large archives.
export async function readZip(filename,options) {
  const {entries}=await zipDirectory(filename,options),result=[];
  for(const entry of entries) {
    const chunks=[];
    await streamEntry(filename,entry,new Writable({write(chunk,encoding,callback){chunks.push(chunk);callback();}}));
    result.push({...entry,data:Buffer.concat(chunks)});
  }
  return result;
}
export async function validateJar(filename,requiredEntry) {
  const {entries}=await zipDirectory(filename,{jar:true});
  if(!entries.some(e=>!e.directory)) throw new Error('empty_jar');
  if(requiredEntry&&!entries.some(e=>!e.directory&&e.name===requiredEntry)) throw new Error('jar_required_entry_missing');
  for(const entry of entries) await streamEntry(filename,entry);
}
export async function extractZip(filename,directory,mapName,{checkSpace=requireSpace}={}) {
  const {entries}=await zipDirectory(filename);
  const mapped=[],names=new Set();
  for(const entry of entries) {
    const name=mapName(entry);if(!name) {mapped.push({entry});continue;}
    const dest=path.resolve(directory,name),key=dest.toLowerCase();
    if(!dest.startsWith(path.resolve(directory)+path.sep)||names.has(key)) throw new Error('dependency_duplicate_destination');
    names.add(key);mapped.push({entry,dest,name});
  }
  await checkSpace(directory,mapped.reduce((sum,item)=>sum+(item.dest?item.entry.length:0),0));
  const result=[];
  for(const {entry,dest,name} of mapped) {
    if(dest) await mkdir(path.dirname(dest),{recursive:true});
    await streamEntry(filename,entry,dest);
    if(dest) result.push({name,sourceFile:dest,size:entry.length,sha256:await hashFile(dest)});
  }
  return result;
}
