import protocol from '../agent-protocol.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const textError=message=>({isError:true,content:[{type:'text',text:message}]});
async function read(request,limit=50000){const raw=await request.text();if(raw.length>limit)throw Error('Request too large.');return JSON.parse(raw)}
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
async function ownSession(env,id,owner){if(!protocol.uuid(id))throw Error('Invalid session ID.');const session=await stmt(env,'SELECT * FROM gym_sessions WHERE id=? AND owner=? AND last_seen>?',id,owner,Date.now()-30000).first();if(!session)throw Error('No live browser session. Enable MCP in the gym and keep its tab visible.');return session}
async function chooseSession(env,id,owner){if(id)return ownSession(env,id,owner);const rows=await stmt(env,'SELECT * FROM gym_sessions WHERE owner=? AND last_seen>? ORDER BY last_seen DESC',owner,Date.now()-15000).all();if(rows.results.length!==1)throw Error(rows.results.length?'Multiple browser sessions: choose a session_id.':'No live browser session. Enable MCP in the gym.');return rows.results[0]}
const imageKey=id=>'gym-frames/'+id+'.png';
function decode(base64){const binary=atob(base64),bytes=new Uint8Array(binary.length);for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function encode(buffer){const bytes=new Uint8Array(buffer);let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result)}
const rounded=value=>Math.round(value*100)/100;
function metadata(result){const block=result.content?.find(c=>c.type==='text');if(!block)return null;try{const value=JSON.parse(block.text);return value&&typeof value==='object'&&!Array.isArray(value)?{block,value}:null}catch{return null}}
async function resultContent(env,row,invocation){
 const result=JSON.parse(row.result),saved=result._timing||{},server={...saved,...invocation.server,result_detected_at:Date.now()},readStart=performance.now();delete result._timing;
 if(!result.has_image){server.image_read_ms=0;server.image_encode_ms=0}if(result.has_image){const image=await env.BUCKET.get(imageKey(row.id));if(!image)return textError('Screenshot expired; call robot_observe for a new image.');const buffer=await image.arrayBuffer();server.image_read_done_at=Date.now();server.image_read_ms=rounded(performance.now()-readStart);const encodeStart=performance.now();result.content.push({type:'image',mimeType:'image/png',data:encode(buffer)});server.image_encode_ms=rounded(performance.now()-encodeStart);delete result.has_image}
 const info=metadata(result),browser=info?.value.timing?.browser||{};server.response_ready_at=Date.now();
 const diff=(end,start)=>Number.isFinite(server[end])&&Number.isFinite(server[start])?Math.max(0,server[end]-server[start]):undefined;
 const durations_ms={...invocation.durations,queue_to_claim:diff('claim_started_at','queue_write_started_at'),queue_wait:diff('claim_started_at','queue_write_done_at'),result_auth_lookup:server.result_auth_lookup_ms,claim_to_result_received:diff('result_received_at','claim_started_at'),browser_execution:browser.execution_ms,capture:browser.capture_ms,image_store:server.image_store_ms,result_save_and_detect:diff('result_detected_at','result_saving_at'),image_read:server.image_read_ms,image_encode:server.image_encode_ms,server_total:rounded(performance.now()-invocation.started)};
 if(Number.isFinite(durations_ms.claim_to_result_received)&&Number.isFinite(browser.execution_ms))durations_ms.delivery_and_upload_residual=Math.max(0,rounded(durations_ms.claim_to_result_received-browser.execution_ms));
 const timing={version:1,request_id:row.id,transport:'hosted',cached:!!invocation.cached,server,browser,durations_ms,clock_note:'UTC timestamps identify stages. Browser durations use its monotonic clock. Cross-worker UTC intervals are approximate; browser and server timestamps are not subtracted.'};
 if(info)info.block.text=JSON.stringify({...info.value,timing});else result.content.push({type:'text',text:JSON.stringify({timing})});return result
}
async function cleanup(env,owner){const old=await stmt(env,'SELECT id,result FROM gym_commands WHERE owner=? AND expires_at<? LIMIT 12',owner,Date.now()-120000).all();for(const row of old.results){if(row.result&&JSON.parse(row.result).has_image)await env.BUCKET.delete(imageKey(row.id));await stmt(env,'DELETE FROM gym_commands WHERE id=? AND owner=?',row.id,owner).run()}await stmt(env,'DELETE FROM gym_sessions WHERE owner=? AND last_seen<?',owner,Date.now()-86400000).run()}
async function bridge(request,env,owner,path){
 const receivedAt=Date.now(),parseStarted=performance.now(),body=await read(request,path==='result'?2000000:50000),now=Date.now(),parseMs=rounded(performance.now()-parseStarted);
 if(path==='connect'){const id=crypto.randomUUID();await stmt(env,'INSERT INTO gym_sessions (id,owner,last_seen,mode,joints) VALUES (?,?,?,?,?)',id,owner,now,'teach',0).run();await cleanup(env,owner);return json({session_id:id})}
 const session=await ownSession(env,body.session_id,owner);
 if(path==='poll'){
  if(!['build','teach','clips','run','network','learn'].includes(body.mode)||!Number.isInteger(body.joints)||body.joints<0||body.joints>64)throw Error('Invalid session metadata.');
  if(now-session.last_seen>5000||session.mode!==body.mode||session.joints!==body.joints)await stmt(env,'UPDATE gym_sessions SET last_seen=?,mode=?,joints=? WHERE id=? AND owner=?',now,body.mode,body.joints,session.id,owner).run();
  const hold=body.wait_ms??0;if(!Number.isInteger(hold)||hold<0||hold>8000)throw Error('Invalid poll wait.');const pollStarted=performance.now(),until=Date.now()+hold;let command;
  do{const claimAt=Date.now();command=await stmt(env,"UPDATE gym_commands SET status='claimed',payload=json_set(payload,'$.timing.claim_started_at',?) WHERE id=(SELECT id FROM gym_commands WHERE session_id=? AND owner=? AND status='pending' AND expires_at>? ORDER BY created_at LIMIT 1) AND status='pending' RETURNING id,payload,expires_at",claimAt,session.id,owner,claimAt).first();if(command||Date.now()>=until||request.signal?.aborted)break;await new Promise(resolve=>setTimeout(resolve,150))}while(true);
  return json({poll_hold_ms:rounded(performance.now()-pollStarted),command:command?{id:command.id,...JSON.parse(command.payload),deadline:command.expires_at}:null})

 }
 if(path==='result'){
  if(!protocol.uuid(body.id))throw Error('Invalid command ID.');const command=await stmt(env,"SELECT * FROM gym_commands WHERE id=? AND session_id=? AND owner=? AND status='claimed' AND expires_at>?",body.id,session.id,owner,now).first();if(!command)throw Error('Command expired or was already completed.');
  const result=body.result;if(!result||!Array.isArray(result.content)||result.content.length>3)throw Error('Invalid tool result.');const images=result.content.filter(c=>c.type==='image'),texts=result.content.filter(c=>c.type==='text');if(images.length>1||texts.length>2||texts.some(c=>typeof c.text!=='string'||c.text.length>5000))throw Error('Invalid result content.');
  const inline=images.length===1&&images[0].data?.length<=131072;const storeStarted=performance.now();if(images.length){const image=images[0];if(image.mimeType!=='image/png'||typeof image.data!=='string'||image.data.length>1800000||!/^iVBORw0KGgo[A-Za-z0-9+/=]*$/.test(image.data))throw Error('Invalid PNG screenshot.');if(!inline)await env.BUCKET.put(imageKey(command.id),decode(image.data),{httpMetadata:{contentType:'image/png'}})}
  const saved={isError:!!result.isError,content:[...texts.map(c=>({type:'text',text:c.text})),...(inline?images.map(c=>({type:'image',mimeType:'image/png',data:c.data})):[])],has_image:images.length===1&&!inline,_timing:{...JSON.parse(command.payload).timing,result_received_at:receivedAt,result_body_parse_ms:parseMs,result_auth_lookup_ms:rounded(storeStarted-parseStarted-parseMs),image_stored_at:Date.now(),image_transport:inline?'inline-rpc':images.length?'r2':'none',image_store_ms:rounded(performance.now()-storeStarted),result_saving_at:Date.now()}};await stmt(env,"UPDATE gym_commands SET status='done',result=? WHERE id=? AND owner=? AND status='claimed'",JSON.stringify(saved),command.id,owner).run();return json({ok:true})
 }
 return json({error:'Not found'},404)
}
async function callTool(env,owner,name,args,invocation){
 invocation.server.tool_started_at=Date.now();const sessionStart=performance.now();
 protocol.validate(name,args);
 if(name==='robot_sessions'){const rows=await stmt(env,'SELECT id,mode,joints,last_seen FROM gym_sessions WHERE owner=? AND last_seen>? ORDER BY last_seen DESC',owner,Date.now()-15000).all();return {content:[{type:'text',text:JSON.stringify(rows.results.map(r=>({session_id:r.id,mode:r.mode,joints:r.joints,label:'Robot Gym browser'})))}]}}
 const session=await chooseSession(env,args.session_id,owner);if(!['teach','clips','run'].includes(session.mode))throw Error('Open Teach, Clips or Run in the connected browser.');
 invocation.server.session_ready_at=Date.now();invocation.durations.session_lookup=rounded(performance.now()-sessionStart);
 const normalized=name==='robot_move'?protocol.batch(args,session.joints):null;const clean=normalized?{commands:normalized.commands,wait_ms:normalized.wait_ms}:{};const payload=JSON.stringify({name,arguments:clean});const id=args.request_id||crypto.randomUUID(),now=Date.now();
 const dedupStart=performance.now(),existing=args.request_id?await stmt(env,'SELECT * FROM gym_commands WHERE id=?',id).first():null;invocation.durations.dedup_lookup=rounded(performance.now()-dedupStart);
 if(existing){if(existing.owner!==owner||existing.session_id!==session.id||JSON.stringify({name:JSON.parse(existing.payload).name,arguments:JSON.parse(existing.payload).arguments})!==payload)throw Error('Request ID already belongs to a different command.');if(existing.status==='done'){invocation.cached=true;return resultContent(env,existing,invocation);}if(existing.expires_at<now)throw Error('Request expired. It will not be replayed. Use a fresh request_id for a new action.');}
 else {const queueStart=performance.now();invocation.server.queue_write_started_at=Date.now();const timedPayload=JSON.stringify({...JSON.parse(payload),timing:{...invocation.server}});await stmt(env,"INSERT INTO gym_commands (id,session_id,owner,created_at,expires_at,payload,status) VALUES (?,?,?,?,?,?,'pending')",id,session.id,owner,now,now+18000,timedPayload).run();invocation.server.queue_write_done_at=Date.now();invocation.durations.queue_write=rounded(performance.now()-queueStart)}
 // A stop discards unclaimed actions; the browser cancels any active plan.
 if(name==='robot_stop')await stmt(env,"UPDATE gym_commands SET status='expired' WHERE session_id=? AND owner=? AND id<>? AND status='pending'",session.id,owner,id).run();
 const deadline=existing?.expires_at||now+18000;
 while(Date.now()<deadline){const row=await stmt(env,'SELECT * FROM gym_commands WHERE id=? AND owner=?',id,owner).first();if(row?.status==='done')return resultContent(env,row,invocation);if(row?.status==='expired')throw Error('Command cancelled.');await new Promise(resolve=>setTimeout(resolve,150))}
 await stmt(env,"UPDATE gym_commands SET status='expired' WHERE id=? AND owner=? AND status<>'done'",id,owner).run();throw Error('Browser did not return a screenshot in time. No command will be retried automatically. Keep the gym tab visible.')
}
async function mcp(request,env,owner){const invocation={started:performance.now(),server:{request_received_at:Date.now()},durations:{}};const rpc=await read(request);invocation.server.request_parsed_at=Date.now();invocation.durations.request_parse=rounded(performance.now()-invocation.started);const id=rpc.id??null;let result;try{switch(rpc.method){
 case 'server/discover':result={supportedVersions:['2026-07-28'],capabilities:{tools:{}},serverInfo:{name:'robot-gym',version:'1.0.0'}};break;
 case 'initialize':result={protocolVersion:rpc.params?.protocolVersion||'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'robot-gym',version:'1.0.0'}};break;
 case 'notifications/initialized':return new Response(null,{status:202});
 case 'ping':result={};break;
 case 'tools/list':result={tools:protocol.tools};break;
 case 'tools/call':if(!owner)throw Error('Sign in to control your Robot Gym session.');result=await callTool(env,owner,rpc.params?.name,rpc.params?.arguments||{},invocation);break;
 default:return json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}})}return json({jsonrpc:'2.0',id,result})}catch(error){return json({jsonrpc:'2.0',id,result:textError(error.message)})}}
export async function handleRequest(request,env,ctx,html=''){
 const url=new URL(request.url),owner=request.headers.get('oai-authenticated-user-id');try{
  if(request.method==='GET'&&url.pathname==='/')return new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(url.pathname==='/mcp'){if(request.method!=='POST')return json({error:'Use POST JSON-RPC'},405);return await mcp(request,env,owner)}
  if(url.pathname.startsWith('/bridge/')){if(!owner)return json({error:'Sign in required'},401);if(request.method!=='POST')return json({error:'Use POST'},405);const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origin rejected'},403);if(!env.DB||!env.BUCKET)throw Error('Bridge storage is not configured.');return await bridge(request,env,owner,url.pathname.slice(8))}
  if(url.pathname==='/favicon.ico')return new Response(null,{status:204});return json({error:'Not found'},404)
 }catch(error){return json({error:error.message},400)}
}
export default {fetch(request,env,ctx){return handleRequest(request,env,ctx,typeof APP_HTML==='string'?APP_HTML:'')}};
