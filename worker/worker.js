import {pbkdf2Sync, timingSafeEqual, createHash, randomBytes} from 'node:crypto';
import '../public/js/config.js';
import {levelFromExp} from '../public/js/progression.js';
export {GameRoom} from './room.js';
const config=globalThis.HordeConfig;
const hash=value=>createHash('sha256').update(value).digest('hex');
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
function error(key,status=400){return json({error:key},status);}
const sql=(db,query,...args)=>db.prepare(query).bind(...args);
export async function profile(db,id){
 const user=await sql(db,'SELECT id,display_name,tutorial_step,player_exp,currency,equipped FROM users WHERE id=?',id).first();
 if(!user)return null;
 const rows=await sql(db,'SELECT weapon,exp FROM weapons WHERE user_id=?',id).all();
 return {playerId:user.id,displayName:user.display_name,tutorialCompleted:user.tutorial_step>=6,tutorialStep:user.tutorial_step,playerLevel:levelFromExp(user.player_exp).level,playerExp:user.player_exp,currency:user.currency,equipped:user.equipped,weapons:Object.fromEntries(rows.results.map(row=>[row.weapon,{exp:row.exp,level:levelFromExp(row.exp,'weapon').level}]))};
}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('invalidInput');
 const reader=request.body?.getReader();if(!reader)throw new Error('invalidInput');let length=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();throw new Error('invalidInput');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalidInput');return value;
}
async function limited(db,key,max,windowMs){
 const now=Date.now();const row=await sql(db,`INSERT INTO limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END RETURNING count`,key,now+windowMs,now,now,now+windowMs).first();return row.count>max;
}
export async function session(db,request){
 const token=request.headers.get('cookie')?.match(/(?:^|;\s*)hm_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;
 const row=await sql(db,'SELECT user_id,token_hash FROM sessions WHERE token_hash=? AND expires_at>?',hash(token),Date.now()).first();return row;
}
const cookie=(request,token,maxAge)=>`hm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname.slice(5),db=env.DB;
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(request.method!=='GET'&&request.method!=='POST')return error('invalidInput',405);
  const origin=request.headers.get('origin');
  if((request.method==='POST'||request.headers.get('upgrade'))&&origin!==url.origin)return error('authInvalid',403);
  try {
   if(path==='health')return json({ok:true});
   if(path==='auth/login'||path==='auth/register'){
    if(request.method!=='POST')return error('invalidInput',405);
    const ip=request.headers.get('CF-Connecting-IP')||'local';
    if(await limited(db,'auth-ip:'+hash(ip),15,60000))return error('authInvalid',429);
    const data=await body(request),username=typeof data.username==='string'?data.username.toLowerCase():'';
    if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof data.password!=='string'||data.password.length<10||data.password.length>128)return error('authInvalid');
    if(await limited(db,'auth-user:'+username,10,60000))return error('authInvalid',429);
    let user=await sql(db,'SELECT * FROM users WHERE username=?',username).first();
    if(path==='auth/register'){
      const displayName=typeof data.displayName==='string'?data.displayName.trim():'';
      if(displayName.length<2||displayName.length>24)return error('invalidInput');
      const salt=randomBytes(16).toString('hex'),passwordHash=pbkdf2Sync(data.password,salt,600000,32,'sha256').toString('hex');
      if(user)return error('authInvalid',409);
      const id=crypto.randomUUID(),now=Date.now();
      try {await db.batch([sql(db,'INSERT INTO users(id,username,display_name,password_hash,salt,created_at,last_seen) VALUES(?,?,?,?,?,?,?)',id,username,displayName,passwordHash,salt,now,now),sql(db,"INSERT INTO weapons(user_id,weapon) VALUES(?,'pistol')",id)]);}catch{return error('authInvalid',409);}
      user={id};
    }else{
      const derived=pbkdf2Sync(data.password,user?.salt||'00000000000000000000000000000000',600000,32,'sha256');
      if(!user||!timingSafeEqual(derived,Buffer.from(user.password_hash,'hex')))return error('authInvalid',401);
    }
    const token=randomBytes(32).toString('hex');
    const old=await session(db,request);if(old)await sql(db,'DELETE FROM sessions WHERE token_hash=?',old.token_hash).run();
    await sql(db,'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',hash(token),user.id,Date.now()+30*86400000).run();
    return json(await profile(db,user.id),200,{'Set-Cookie':cookie(request,token,30*86400)});
   }
   const auth=await session(db,request);if(!auth)return error('loginRequired',401);const id=auth.user_id;
   if(await limited(db,'api:'+id,300,60000))return error('networkError',429);
   if(path==='auth/logout'&&request.method==='POST'){
    await db.batch([sql(db,'DELETE FROM sessions WHERE token_hash=?',auth.token_hash),sql(db,'UPDATE users SET last_seen=0 WHERE id=?',id)]);
    return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
   }
   if(path==='me')return json(await profile(db,id));
   if(path==='social'){
    await sql(db,'UPDATE users SET last_seen=? WHERE id=?',Date.now(),id).run();
    const [friends,requests,invites]=await Promise.all([
     sql(db,`SELECT u.id,u.display_name,u.last_seen FROM friendships f JOIN users u ON u.id=CASE WHEN f.sender=? THEN f.recipient ELSE f.sender END WHERE (f.sender=? OR f.recipient=?) AND accepted=1`,id,id,id).all(),
     sql(db,'SELECT u.id,u.display_name FROM friendships f JOIN users u ON u.id=f.sender WHERE f.recipient=? AND accepted=0',id).all(),
     sql(db,"SELECT i.*,u.display_name FROM invites i JOIN users u ON u.id=i.sender WHERE i.recipient=? AND i.status='pending' AND i.expires_at>?",id,Date.now()).all()
    ]);
    return json({friends:friends.results.map(r=>({id:r.id,displayName:r.display_name,online:r.last_seen>Date.now()-35000})),requests:requests.results.map(r=>({id:r.id,displayName:r.display_name})),invites:invites.results.map(r=>({id:r.id,displayName:r.display_name,expiresAt:r.expires_at}))});
   }
   const match=path.match(/^rooms\/([a-f0-9-]{36})\/(ws|leave)$/);
   if(match){
    const stub=env.ROOMS.getByName(match[1]);
    if(match[2]==='leave'&&request.method==='POST')return json(await stub.leave(id));
    if(match[2]==='ws'&&request.headers.get('upgrade')?.toLowerCase()==='websocket'){
      const headers=new Headers(request.headers);headers.set('X-Player-ID',id);headers.set('X-Session-Hash',auth.token_hash);
      return stub.fetch(new Request(request,{headers}));
    }
    return error('invalidInput');
   }
   if(request.method!=='POST')return error('invalidInput',404);
   const data=await body(request);
   if(path==='friends'){
    const user=await sql(db,'SELECT id FROM users WHERE username=?',String(data.username).toLowerCase()).first();
    if(!user||user.id===id)return error('invalidInput');
    const existing=await sql(db,'SELECT sender FROM friendships WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',id,user.id,user.id,id).first();
    if(!existing)await sql(db,'INSERT OR IGNORE INTO friendships(sender,recipient) VALUES(?,?)',id,user.id).run();return json({ok:true});
   }
   if(path==='friends/respond'){
    if(data.accept===true)await sql(db,'UPDATE friendships SET accepted=1 WHERE sender=? AND recipient=?',data.id,id).run();
    else await sql(db,'DELETE FROM friendships WHERE sender=? AND recipient=? AND accepted=0',data.id,id).run();return json({ok:true});
   }
   if(path==='buy'){
    if(data.weapon!=='ak47')return error('invalidInput');
    const price=config.weapons.ak47.price;
    const result=await db.batch([
      sql(db,"UPDATE users SET currency=currency-? WHERE id=? AND currency>=? AND NOT EXISTS(SELECT 1 FROM weapons WHERE user_id=? AND weapon='ak47')",price,id,price,id),
      sql(db,"INSERT INTO weapons(user_id,weapon) SELECT ?,'ak47' WHERE changes()=1",id)
    ]);
    if(!result[0].meta.changes)return error('insufficient');return json(await profile(db,id));
   }
   if(path==='equip'){
    const result=await sql(db,'UPDATE users SET equipped=? WHERE id=? AND EXISTS(SELECT 1 FROM weapons WHERE user_id=? AND weapon=?)',data.weapon,id,id,data.weapon).run();
    if(!result.meta.changes)return error('locked');return json(await profile(db,id));
   }
   if(path==='rooms'||path==='matches'){
    const player=await profile(db,id),training=path==='matches'&&data.mode==='tutorial';
    if(!training&&!player.tutorialCompleted)return error('tutorialRequired',403);
    const table=config.difficulties[data.mode==='multiplayer'?'multiplayer':'solo'];
    const difficulty=table.find(d=>d.id===data.difficulty)?.id||'normal',roomId=crypto.randomUUID();
    const room=await env.ROOMS.getByName(roomId).create(roomId,player,path==='rooms'?'multiplayer':training?'tutorial':'solo',difficulty);return json(room);
   }
   if(path==='invites'){
    if(typeof data.to!=='string'||typeof data.roomId!=='string')return error('invalidInput');
    const friend=await sql(db,'SELECT 1 FROM friendships WHERE accepted=1 AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))',id,data.to,data.to,id).first();
    if(!friend)return error('authInvalid',403);
    if(!(await env.ROOMS.getByName(data.roomId).canInvite(id)))return error('authInvalid',403);
    const now=Date.now(),inviteId=crypto.randomUUID();
    const result=await db.batch([
      sql(db,'UPDATE users SET last_invite=? WHERE id=? AND last_invite<=?',now,id,now-config.network.inviteCooldown),
      sql(db,"INSERT INTO invites(id,sender,recipient,room_id,expires_at) SELECT ?,?,?,?,? WHERE changes()=1 AND NOT EXISTS(SELECT 1 FROM invites WHERE sender=? AND recipient=? AND status='pending' AND expires_at>?)",inviteId,id,data.to,data.roomId,now+config.network.inviteExpiry,id,data.to,now)
    ]);
    if(!result[0].meta.changes)return error('cooldown',429);return json({ok:true});
   }
   if(path==='invites/respond'){
    const invite=await sql(db,"UPDATE invites SET status=? WHERE id=? AND recipient=? AND status='pending' AND expires_at>? RETURNING *",data.accept===true?'accepted':'declined',data.id,id,Date.now()).first();
    if(!invite)return error('expired',410);
    if(data.accept!==true)return json({ok:true});
    const player=await profile(db,id);if(!player.tutorialCompleted)return error('tutorialRequired',403);
    return json(await env.ROOMS.getByName(invite.room_id).join(player));
   }
   return error('invalidInput',404);
  }catch(err){
   if(err instanceof SyntaxError||err.message==='invalidInput')return error('invalidInput');
   console.error(JSON.stringify({event:'request_failed',path,error:err.message}));return error('serverUnavailable',500);
  }
 }
};
