import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base='http://127.0.0.1:8787';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(path,body,cookie,origin=base){
 const response=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
function channel(room,cookie){
 const ws=new WebSocket(`ws://127.0.0.1:8787/api/rooms/${room}/ws`,{headers:{Cookie:cookie,Origin:base}});let sequence=0,state=null,messages=[];
 ws.on('message',raw=>{const data=JSON.parse(raw);messages.push(data);if(data.type==='snapshot')state=data.state;});
 return {ws,send(data){ws.send(JSON.stringify({...data,seq:++sequence}));},get state(){return state;},messages,async ready(){await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});}};
}
const accounts=[];
try{
 for(let i=0;i<2;i++){
  const username='test_'+Date.now().toString(36)+'_'+i;
  const result=await request('auth/register',{username,password:'Local-test-only-9348!',displayName:'Test '+i});assert.equal(result.status,200,JSON.stringify(result));assert.ok(result.cookie);assert.equal(result.data.tutorialCompleted,false);
  accounts.push({username,cookie:result.cookie,profile:result.data});
 }
 console.log('PASS registration and persistent profile');
 const a=accounts[0],b=accounts[1];
 assert.equal((await request('me',null,a.cookie)).data.playerId,a.profile.playerId);
 assert.equal((await request('rooms',{difficulty:'normal'},a.cookie)).status,403);
 assert.equal((await request('buy',{weapon:'ak47'},a.cookie)).status,400);
 assert.equal((await request('auth/logout',{},a.cookie,'http://evil.example')).status,403);
 console.log('PASS session restore, tutorial gate, insufficient funds and cross-origin rejection');
 for(const account of accounts){
  const match=await request('matches',{mode:'tutorial',difficulty:'normal'},account.cookie);assert.equal(match.status,200,JSON.stringify(match));
  const ch=channel(match.data.id,account.cookie);await ch.ready();
  const input=(x=0,yaw=0,pitch=0,ads=false)=>ch.send({type:'input',x,z:0,yaw,pitch,ads,paused:false});
  input(1,.4);await sleep(1000);input(-1,0);await sleep(1000);input();await sleep(250);
  ch.send({type:'jump'});await sleep(1000);ch.send({type:'fire'});await sleep(300);ch.send({type:'reload'});await sleep(1700);
  input(0,0,0,true);await sleep(150);ch.send({type:'fire'});await sleep(350);
  // Aim from the server-validated player position at the actual training target.
  const player=ch.state.players[account.profile.playerId];
  const yaw=Math.atan2(player.x,player.z-3),dist=Math.hypot(player.x,player.z-3);
  input(0,yaw,Math.atan2(player.y-1.25,dist));await sleep(150);ch.send({type:'fire'});await sleep(350);
  input(0,yaw,-Math.atan2(2-player.y,dist));await sleep(150);ch.send({type:'fire'});await sleep(350);
  const saved=await request('me',null,account.cookie);assert.equal(saved.data.tutorialCompleted,true,JSON.stringify({profile:saved.data,state:ch.state}));
  ch.ws.close();
 }
 console.log('PASS both tutorials completed through validated movement, jump, fire, reload, ADS, body and head hits');
 assert.equal((await request('friends',{username:b.username},a.cookie)).status,200);
 const pending=await request('social',null,b.cookie);assert.equal(pending.data.requests.length,1);
 await request('friends/respond',{id:a.profile.playerId,accept:true},b.cookie);
 const room=await request('rooms',{difficulty:'hard'},a.cookie);assert.equal(room.status,200);
 const first=await request('invites',{to:b.profile.playerId,roomId:room.data.id},a.cookie);assert.equal(first.status,200);
 assert.equal((await request('invites',{to:b.profile.playerId,roomId:room.data.id},a.cookie)).status,429);
 const social=await request('social',null,b.cookie);assert.equal(social.data.invites.length,1);
 await request('invites/respond',{id:social.data.invites[0].id,accept:true},b.cookie);
 const ca=channel(room.data.id,a.cookie),cb=channel(room.data.id,b.cookie);await Promise.all([ca.ready(),cb.ready()]);
 ca.send({type:'ready',ready:true});cb.send({type:'ready',ready:true});await sleep(250);ca.send({type:'start'});await sleep(500);
 assert.equal(ca.state?.status,'playing');assert.equal(Object.keys(cb.state.players).length,2);
 ca.send({type:'input',x:1,z:0,yaw:0,pitch:0,paused:false});await sleep(500);
 assert.ok(cb.state.players[a.profile.playerId].x>0);
 assert.equal(ca.state.wave,cb.state.wave);
 ca.ws.close();cb.ws.close();
 console.log('PASS friendship, invite cooldown/deduplication and real two-player room synchronization');
 await request('auth/logout',{},a.cookie);assert.equal((await request('me',null,a.cookie)).status,401);
 console.log('PASS logout invalidates the server session');
}catch(error){console.error(error);process.exitCode=1;}
setTimeout(()=>process.exit(process.exitCode||0),500);
