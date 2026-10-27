const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),{pathToFileURL}=require('url');
if(!global.crypto)global.crypto=require('crypto').webcrypto;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gym-mcp-')),dbfile=path.join(tmp,'bridge.sqlite');
const py=`import sqlite3,json,sys\nc=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row\nr=c.execute(sys.argv[2],json.loads(sys.argv[3]));rows=[dict(x) for x in r.fetchall()] if r.description else [];c.commit();print(json.dumps(rows))`;
const sql=(s,args=[])=>JSON.parse(cp.execFileSync('python3',['-c',py,dbfile,s,JSON.stringify(args)],{encoding:'utf8'}));
const db={
 prepare(s){
  return {bind(...args){
   return {first:async()=>sql(s,args)[0]||null,all:async()=>({results:sql(s,args)}),run:async()=>{sql(s,args);return {success:true}}};
  }};
 }
};
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',objects=new Map(),env={DB:db,BUCKET:{put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{arrayBuffer:async()=>objects.get(k).buffer}:null,delete:async k=>objects.delete(k)}};
for(const statement of fs.readFileSync(path.join(__dirname,'../drizzle/0000_robot_bridge.sql'),'utf8').split('--> statement-breakpoint'))sql(statement);
(async()=>{
 const {handleRequest}=await import(pathToFileURL(path.join(__dirname,'../worker/index.mjs')));
 const request=async(route,body,owner='alice',origin)=>{const headers={'Content-Type':'application/json'};if(owner)headers['oai-authenticated-user-id']=owner;if(origin)headers.Origin=origin;const r=await handleRequest(new Request('https://gym.test/'+route,{method:'POST',headers,body:JSON.stringify(body)}),env,{});return {status:r.status,data:await r.json()}};
 const rpc=(name,args={})=>request('mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});
 const discovery=await request('mcp',{id:1,method:'server/discover'},null);assert.deepEqual(discovery.data.result.supportedVersions,['2026-07-28']);
 const listing=await request('mcp',{id:1,method:'tools/list'},null);assert.equal(listing.data.result.tools.length,4);
 assert.equal((await request('bridge/connect',{},null)).status,401);assert.equal((await request('bridge/connect',{},'alice','https://evil.test')).status,403);
 const session=(await request('bridge/connect',{})).data.session_id;await request('bridge/poll',{session_id:session,mode:'teach',joints:7});
 const sessions=await rpc('robot_sessions');assert.equal(JSON.parse(sessions.data.result.content[0].text)[0].session_id,session);
 const poll=()=>request('bridge/poll',{session_id:session,mode:'teach',joints:7});
 const args={request_id:crypto.randomUUID(),commands:[{joint:1,velocity_deg_s:30,duration_ms:500},{joint:2,velocity_deg_s:-30,start_ms:100,duration_ms:500}]};
 const waiting=rpc('robot_move',args);await new Promise(r=>setTimeout(r,30));const command=(await poll()).data.command;assert(command);assert(!('end_ms' in command.arguments));
 assert.equal((await request('bridge/poll',{session_id:session,mode:'teach',joints:7},'bob')).status,400);
 const image={content:[{type:'text',text:'{"physics_running":true}'},{type:'image',mimeType:'image/png',data:png}]};
 await request('bridge/result',{session_id:session,id:command.id,result:image});const result=await waiting;assert.equal(result.data.result.content[1].data,png);const timing=JSON.parse(result.data.result.content[0].text).timing;assert.equal(timing.transport,'hosted');assert.equal(timing.request_id,args.request_id);for(const key of ['queue_to_claim','image_store','image_read','server_total'])assert(timing.durations_ms[key]>=0,key);assert(timing.server.result_received_at>=timing.server.claim_started_at);assert.equal(objects.size,0);assert.equal(timing.server.image_transport,'inline-rpc');assert.equal(timing.durations_ms.image_read,0);
 const retry=await rpc('robot_move',args);assert.equal(retry.data.result.content[1].data,png);assert(JSON.parse(retry.data.result.content[0].text).timing.cached);assert.equal((await poll()).data.command,null);
 // Large frames retain the R2 fallback, while ordinary scene images skip it.
 const original=Buffer.from(png,'base64'),payload=Buffer.from('note\0'+'A'.repeat(105000)),kind=Buffer.from('tEXt'),crcInput=Buffer.concat([kind,payload]);let crc=0xffffffff;for(const b of crcInput){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}const header=Buffer.alloc(4),checksum=Buffer.alloc(4);header.writeUInt32BE(payload.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);const large=Buffer.concat([original.subarray(0,-12),header,crcInput,checksum,original.subarray(-12)]).toString('base64');
 const largeCall=rpc('robot_observe');await new Promise(r=>setTimeout(r,30));const largeCommand=(await poll()).data.command;await request('bridge/result',{session_id:session,id:largeCommand.id,result:{content:[image.content[0],{type:'image',mimeType:'image/png',data:large}]}});const largeResult=await largeCall;assert.equal(largeResult.data.result.content[1].data,large);assert.equal(objects.size,1);assert.equal(JSON.parse(largeResult.data.result.content[0].text).timing.server.image_transport,'r2');
 // A held browser poll claims a command created after that request starts.
 const held=request('bridge/poll',{session_id:session,mode:'teach',joints:7,wait_ms:2000});await new Promise(r=>setTimeout(r,40));const heldCall=rpc('robot_observe');const heldCommand=(await held).data.command;assert(heldCommand);await request('bridge/result',{session_id:session,id:heldCommand.id,result:image});assert.equal((await heldCall).data.result.content[1].data,png);
 const wrongOwner=await request('mcp',{id:1,method:'tools/call',params:{name:'robot_observe',arguments:{session_id:session}}},'bob');assert(wrongOwner.data.result.isError);
 const invalid=await rpc('robot_move',{commands:[{joint:8,velocity_deg_s:30,duration_ms:500}]});assert(invalid.data.result.isError);assert.equal((await poll()).data.command,null);
 const pending=rpc('robot_move',{commands:[{joint:1,velocity_deg_s:30,duration_ms:500}]});await new Promise(r=>setTimeout(r,30));const stop=rpc('robot_stop');await new Promise(r=>setTimeout(r,30));const stopCommand=(await poll()).data.command;assert.equal(stopCommand.name,'robot_stop');await request('bridge/result',{session_id:session,id:stopCommand.id,result:image});assert((await pending).data.result.isError);assert.equal((await stop).data.result.content[1].type,'image');
 console.log('MCP discovery/tools, real SQLite schema/queue, authenticated session isolation, PNG return, idempotent retries, atomic validation, and Stop cancellation: pass');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>fs.rmSync(tmp,{recursive:true,force:true}));
