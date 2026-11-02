'use strict';
// ZIP store/deflate reader for local test artifacts. Reject traversal and symlinks.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(data){let crc=0xffffffff;for(const x of data)crc=table[(crc^x)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function entries(buffer){
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Invalid ZIP');let pos=buffer.readUInt32LE(end+16),total=0;const output=[];
 for(let i=0;i<buffer.readUInt16LE(end+10);i++){
  if(buffer.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid ZIP entry');
  const len=buffer.readUInt16LE(pos+28),extra=buffer.readUInt16LE(pos+30),comment=buffer.readUInt16LE(pos+32),name=buffer.toString('utf8',pos+46,pos+46+len),size=buffer.readUInt32LE(pos+24),compressed=buffer.readUInt32LE(pos+20),at=buffer.readUInt32LE(pos+42),method=buffer.readUInt16LE(pos+10);
  if(!name||name.startsWith('/')||/[\\:\x00]/.test(name)||name.split('/').some(x=>x==='..'||x==='.')||(buffer.readUInt32LE(pos+38)>>>16&0xf000)===0xa000)throw Error('Unsafe ZIP path');
  total+=size;if(total>100*1024*1024||size>25*1024*1024)throw Error('ZIP size limit');
  const offset=at+30+buffer.readUInt16LE(at+26)+buffer.readUInt16LE(at+28),raw=buffer.subarray(offset,offset+compressed),data=method===0?raw:method===8?zlib.inflateRawSync(raw,{maxOutputLength:25*1024*1024}):null;
  if(!data||data.length!==size||crc32(data)!==buffer.readUInt32LE(pos+16))throw Error('Invalid ZIP data or CRC');output.push({name,data});pos+=46+len+extra+comment;
 }
 return output;
}
function extract(file,destination){const root=path.resolve(destination);for(const e of entries(fs.readFileSync(file))){const target=path.resolve(root,e.name);if(path.relative(root,target).startsWith('..'))throw Error('Unsafe ZIP target');if(e.name.endsWith('/'))fs.mkdirSync(target,{recursive:true});else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,e.data);}}}
module.exports={entries,extract,crc32};
