import {DurableObject} from 'cloudflare:workers';
import {newPlayer,command,tick} from './simulation.js';
import {rewards} from '../public/js/progression.js';
const config=globalThis.HordeConfig;
export class GameRoom extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);this.timer=null;this.finishing=false;
  ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room_state (id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)');
  const row=ctx.storage.sql.exec('SELECT value FROM room_state WHERE id=1').toArray()[0];this.state=row?JSON.parse(row.value):null;
  if(this.state?.status==='playing')this.startLoop();
 }
 persist(){this.ctx.storage.sql.exec('INSERT INTO room_state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',JSON.stringify(this.state));}
 info(){return {id:this.state.id,mode:this.state.mode,difficulty:this.state.difficulty,status:this.state.status,host:this.state.host,members:Object.values(this.state.players).map(p=>({id:p.id,displayName:p.displayName,ready:p.ready}))};}
 create(id,profile,mode,difficulty){
  if(this.state)return this.info();
  this.state={id,mode,difficulty,host:profile.playerId,players:{[profile.playerId]:newPlayer(profile)},enemies:[],status:mode==='multiplayer'?'lobby':'playing',wave:1,pending:6,spawnTimer:0,time:0,createdAt:Date.now(),lastActive:Date.now()};
  this.persist();if(this.state.status==='playing')this.startLoop();return this.info();
 }
 canInvite(id){return !!this.state&&this.state.status==='lobby'&&!!this.state.players[id]&&Object.keys(this.state.players).length<4;}
 join(profile){
  if(!this.state||this.state.status!=='lobby')throw new Error('room unavailable');
  if(!this.state.players[profile.playerId]){if(Object.keys(this.state.players).length>=4)throw new Error('room full');this.state.players[profile.playerId]=newPlayer(profile,Object.keys(this.state.players).length);this.persist();}
  this.broadcast({type:'room',room:this.info()});return this.info();
 }
 async leave(id){
  if(!this.state?.players[id])return {ok:true};
  if(this.state.status==='playing'){this.state.players[id].health=0;this.state.players[id].paused=true;}
  else delete this.state.players[id];
  if(this.state.host===id)this.state.host=Object.keys(this.state.players).find(key=>key!==id)||id;
  for(const ws of this.ctx.getWebSockets(id)){try{ws.close(4003,'Left room');}catch{}}
  this.persist();this.broadcast({type:'room',room:this.info()});return {ok:true};
 }
 async fetch(request){
  const id=request.headers.get('X-Player-ID'),sessionHash=request.headers.get('X-Session-Hash');
  if(!this.state?.players[id]||!sessionHash)return Response.json({error:'authInvalid'},{status:403});
  for(const existing of this.ctx.getWebSockets(id)){try{existing.close(4003,'Replaced connection');}catch{}}
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server,[id]);server.serializeAttachment({id,sessionHash,messages:0,window:Date.now()});
  this.state.lastActive=Date.now();this.persist();server.send(JSON.stringify({type:'room',room:this.info()}));
  if(this.state.status!=='lobby')server.send(JSON.stringify({type:'snapshot',state:this.snapshot()}));
  if(this.state.status==='playing')this.startLoop();return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,message){
  if(typeof message!=='string'||message.length>2048){ws.close(1009,'Message too large');return;}
  const attachment=ws.deserializeAttachment();if(!attachment)return;
  const now=Date.now();if(now-attachment.window>=1000){attachment.window=now;attachment.messages=0;}attachment.messages++;ws.serializeAttachment(attachment);if(attachment.messages>75){ws.close(1008,'Rate limit');return;}
  const valid=await this.env.DB.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>?').bind(attachment.sessionHash,attachment.id,now).first();
  if(!valid){ws.close(4001,'Session expired');return;}
  let data;try{data=JSON.parse(message);}catch{return;}
  const p=this.state?.players[attachment.id];if(!p)return;this.state.lastActive=now;
  if(data.type==='ping'){await this.env.DB.prepare('UPDATE users SET last_seen=? WHERE id=?').bind(now,p.id).run();ws.send(JSON.stringify({type:'pong',time:data.time}));return;}
  if(data.type==='ready'&&this.state.status==='lobby'){p.ready=data.ready===true;this.persist();this.broadcast({type:'room',room:this.info()});return;}
  if(data.type==='start'&&p.id===this.state.host&&this.state.status==='lobby'){
   if(!Object.values(this.state.players).every(p=>p.ready))return;
   this.state.status='playing';this.persist();this.broadcast({type:'start'});this.startLoop();return;
  }
  const before=p.tutorialStep;if(command(this.state,p,data)){this.persist();if(p.tutorialStep>before)await this.saveTutorial(p);}
 }
 snapshot(){return {id:this.state.id,status:this.state.status,mode:this.state.mode,wave:this.state.wave,time:this.state.time,players:this.state.players,enemies:this.state.enemies};}
 broadcast(data){const text=JSON.stringify(data);for(const ws of this.ctx.getWebSockets()){try{ws.send(text);}catch{}}}
 startLoop(){
  if(this.timer)return;
  let previous=Date.now();
  this.timer=setInterval(()=>{
   if(!this.state||this.state.status!=='playing'){clearInterval(this.timer);this.timer=null;return;}
   const now=Date.now(),dt=Math.min((now-previous)/1000,.2);previous=now;
   if(now-this.state.lastActive>35000){for(const p of Object.values(this.state.players)){p.moveX=0;p.moveZ=0;p.paused=true;}if(now-this.state.lastActive>120000)this.state.status='finished';}
   const before=Object.fromEntries(Object.values(this.state.players).map(p=>[p.id,p.tutorialStep]));tick(this.state,dt);this.persist();
   for(const p of Object.values(this.state.players))if(p.tutorialStep>before[p.id])this.ctx.waitUntil(this.saveTutorial(p));
   this.broadcast({type:'snapshot',state:this.snapshot()});
   if(this.state.status==='finished')this.ctx.waitUntil(this.finish());
  },100);
 }
 async saveTutorial(p){if(this.state.mode!=='tutorial')return;await this.env.DB.prepare('UPDATE users SET tutorial_step=MAX(tutorial_step,?) WHERE id=?').bind(Math.min(6,p.tutorialStep),p.id).run();}
 async finish(){
  if(this.finishing||this.state.mode==='tutorial')return;this.finishing=true;
  try{
   const difficulty=config.difficulties[this.state.mode==='multiplayer'?'multiplayer':'solo'].find(d=>d.id===this.state.difficulty);
   for(const p of Object.values(this.state.players)){
    const reward=rewards(p.score,difficulty,p.weaponScores),db=this.env.DB;
    // One transaction, guarded by the receipt. Reconnect and retries cannot duplicate rewards.
    await db.batch([
      db.prepare('UPDATE users SET currency=currency+?,player_exp=player_exp+? WHERE id=? AND NOT EXISTS(SELECT 1 FROM receipts WHERE match_id=? AND user_id=?)').bind(reward.currency,reward.playerExp,p.id,this.state.id,p.id),
      ...Object.entries(reward.weaponExp).map(([weapon,exp])=>db.prepare('UPDATE weapons SET exp=exp+? WHERE user_id=? AND weapon=? AND NOT EXISTS(SELECT 1 FROM receipts WHERE match_id=? AND user_id=?)').bind(exp,p.id,weapon,this.state.id,p.id)),
      db.prepare('INSERT OR IGNORE INTO receipts(match_id,user_id,score,currency,created_at) VALUES(?,?,?,?,?)').bind(this.state.id,p.id,p.score,reward.currency,Date.now())
    ]);
   }
   this.broadcast({type:'settled'});
  }finally{this.finishing=false;}
 }
 webSocketClose(ws){try{ws.close();}catch{}const a=ws.deserializeAttachment(),p=this.state?.players[a?.id];if(p){p.moveX=p.moveZ=0;p.paused=true;this.persist();}}
 webSocketError(ws){this.webSocketClose(ws);}
}
