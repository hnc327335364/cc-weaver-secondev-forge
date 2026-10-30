import { open } from 'node:fs/promises';

function modifiedUtf8(bytes) {
  const units=[];
  for(let i=0;i<bytes.length;) {
    const first=bytes[i++];
    if(first>0&&first<128) {units.push(first);continue;}
    const next=bytes[i++];if(next===undefined||(next&0xc0)!==0x80) throw new Error('invalid_class_utf8');
    if((first&0xe0)===0xc0) {
      const value=((first&31)<<6)|(next&63);
      if(value<128&&!(first===0xc0&&next===0x80)) throw new Error('invalid_class_utf8');
      units.push(value);
    } else if((first&0xf0)===0xe0) {
      const last=bytes[i++];if(last===undefined||(last&0xc0)!==0x80) throw new Error('invalid_class_utf8');
      const value=((first&15)<<12)|((next&63)<<6)|(last&63);if(value<2048) throw new Error('invalid_class_utf8');units.push(value);
    } else throw new Error('invalid_class_utf8');
  }
  let result='';for(let i=0;i<units.length;i+=8192) result+=String.fromCharCode(...units.slice(i,i+8192));return result;
}

// Structural validation only: JVM bytecode verification and target-JDK compatibility
// still require a real build. Read in bounded blocks instead of buffering each class.
export async function validateClassFile(filename, expectedPath) {
  const file=await open(filename,'r');
  try {
    const {size}=await file.stat();let position=0,blockStart=-1,block=Buffer.alloc(0),utfBytes=0;
    const fail=()=>{throw new Error('invalid_class_structure');};
    const read=async length=>{
      if(length<0||position+length>size) fail();
      if(position<blockStart||position+length>blockStart+block.length) {
        blockStart=position;block=Buffer.alloc(Math.min(size-position,Math.max(65536,length)));
        let offset=0;
        while(offset<block.length) {const {bytesRead}=await file.read(block,offset,block.length-offset,blockStart+offset);if(!bytesRead) fail();offset+=bytesRead;}
      }
      const result=block.subarray(position-blockStart,position-blockStart+length);position+=length;return result;
    };
    const u1=async()=> (await read(1))[0],u2=async()=> (await read(2)).readUInt16BE(0),u4=async()=> (await read(4)).readUInt32BE(0);
    const skip=length=>{if(length<0||position+length>size) fail();position+=length;};
    if(size>256*1024*1024||await u4()!==0xcafebabe) fail();
    const minor=await u2(),major=await u2();if(major<45) fail();
    const count=await u2();if(count<2) fail();const pool=new Array(count);
    for(let i=1;i<count;i++) {
      const tag=await u1();let value;
      if(tag===1) {const length=await u2();utfBytes+=length;if(utfBytes>16*1024*1024) fail();value=modifiedUtf8(await read(length));}
      else if([3,4].includes(tag)) skip(4);
      else if([5,6].includes(tag)) {skip(8);pool[i]={tag};if(++i>=count) fail();continue;}
      else if([7,8,16,19,20].includes(tag)) value=await u2();
      else if([9,10,11,12,17,18].includes(tag)) value=[await u2(),await u2()];
      else if(tag===15) value=[await u1(),await u2()];
      else fail();
      pool[i]={tag,value};
    }
    const ref=(index,tags)=>{if(!pool[index]||!tags.includes(pool[index].tag)) fail();return pool[index].value;};
    for(const item of pool.filter(Boolean)) {
      const {tag,value}=item;
      if([7,8,16,19,20].includes(tag)) ref(value,[1]);
      else if([9,10,11].includes(tag)) {ref(value[0],[7]);ref(value[1],[12]);}
      else if(tag===12) {ref(value[0],[1]);ref(value[1],[1]);}
      else if([17,18].includes(tag)) ref(value[1],[12]);
      else if(tag===15) {
        const [kind,index]=value;if(kind<1||kind>9) fail();
        ref(index,kind<=4?[9]:kind===9?[11]:[10,11]);
      }
    }
    await u2();const name=ref(ref(await u2(),[7]),[1]),superClass=await u2();
    if(!name||/[.;\[\x00]/.test(name)||name.split('/').some(p=>!p)) fail();
    if(expectedPath&&expectedPath.replaceAll('\\','/')!==name+'.class') throw new Error('class_path_mismatch');
    if(superClass) ref(superClass,[7]);else if(name!=='java/lang/Object'&&name!=='module-info') fail();
    const interfaces=await u2();for(let i=0;i<interfaces;i++) ref(await u2(),[7]);
    const attributes=async(allowCode=false)=>{
      const count=await u2();
      for(let i=0;i<count;i++) {
        const attributeName=ref(await u2(),[1]),length=await u4(),end=position+length;
        if(end>size) fail();
        if(attributeName==='Code'&&allowCode) {
          await u2();await u2();const codeLength=await u4();if(!codeLength||codeLength>65535) fail();skip(codeLength);
          const exceptions=await u2();
          for(let j=0;j<exceptions;j++) {
            const start=await u2(),stop=await u2(),handler=await u2(),type=await u2();
            if(start>=stop||stop>codeLength||handler>=codeLength) fail();if(type) ref(type,[7]);
          }
          await attributes();
        } else skip(length);
        if(position!==end) fail();
      }
    };
    for(const method of [false,true]) {
      const members=await u2();
      for(let i=0;i<members;i++) {await u2();ref(await u2(),[1]);ref(await u2(),[1]);await attributes(method);}
    }
    await attributes();if(position!==size) fail();
    return {name,major,minor};
  } finally {await file.close();}
}
