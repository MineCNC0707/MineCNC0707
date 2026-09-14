import '../public/js/config.js';
const config=globalThis.HordeConfig;
export const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function rayBox(origin,direction,min,max){
 let near=0,far=Infinity;
 for(const axis of ['x','y','z']){
  const d=direction[axis],o=origin[axis];if(Math.abs(d)<1e-9){if(o<min[axis]||o>max[axis])return Infinity;continue;}
  const a=(min[axis]-o)/d,b=(max[axis]-o)/d;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return Infinity;
 }return near;
}
export function blocked(x,z,r=.35){return config.world.obstacles.some(b=>x>b.x-b.w/2-r&&x<b.x+b.w/2+r&&z>b.z-b.d/2-r&&z<b.z+b.d/2+r);}
export function move(position,dx,dz,r=.35){
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.15));
 for(let i=0;i<steps;i++){if(!blocked(position.x+dx/steps,position.z,r))position.x+=dx/steps;if(!blocked(position.x,position.z+dz/steps,r))position.z+=dz/steps;}
 position.x=clamp(position.x,-42,42);position.z=clamp(position.z,-42,42);
}
function raySphere(o,d,c,r){const x=o.x-c.x,y=o.y-c.y,z=o.z-c.z,b=x*d.x+y*d.y+z*d.z,k=x*x+y*y+z*z-r*r,disc=b*b-k;if(disc<0)return Infinity;const near=-b-Math.sqrt(disc);return near>=0?near:Infinity;}
export function hitEnemy(player,enemies){
 const direction={x:-Math.sin(player.yaw)*Math.cos(player.pitch),y:Math.sin(-player.pitch),z:-Math.cos(player.yaw)*Math.cos(player.pitch)};
 const origin={x:player.x,y:player.y,z:player.z};let nearest=Infinity,result=null;
 for(const b of config.world.obstacles){nearest=Math.min(nearest,rayBox(origin,direction,{x:b.x-b.w/2,y:0,z:b.z-b.d/2},{x:b.x+b.w/2,y:b.h,z:b.z+b.d/2}));}
 for(const enemy of enemies){if(enemy.health<=0)continue;const scale=enemy.boss?2.1:1;
  const head=raySphere(origin,direction,{x:enemy.x,y:2*scale,z:enemy.z},.28*scale);
  const torso=rayBox(origin,direction,{x:enemy.x-.36*scale,y:.72*scale,z:enemy.z-.21*scale},{x:enemy.x+.36*scale,y:1.78*scale,z:enemy.z+.21*scale});
  const distance=Math.min(head,torso);if(distance<nearest){nearest=distance;result={enemy,headshot:head<=torso};}
 }return result;
}
export function newPlayer(profile,index=0){return {id:profile.playerId,displayName:profile.displayName,ready:false,x:index*1.2,y:1.7,z:12,yaw:0,pitch:0,health:100,score:0,weapon:profile.equipped||'pistol',ownedRifle:!!profile.weapons.ak47,ammo:{pistol:12,ak47:30},reserve:{pistol:96,ak47:120},weaponScores:{pistol:0,ak47:0},reload:0,cooldown:0,seq:0,event:null,moveX:0,moveZ:0,ads:false,sprint:false,vy:0,grounded:true,tutorialStep:profile.tutorialStep||0,trainingFlags:{moved:0,look:0,body:false,head:false},paused:true};}
export function command(state,p,data){
 if(!Number.isSafeInteger(data.seq)||data.seq<=p.seq)return false;p.seq=data.seq;
 if(state.status!=='playing'||p.health<=0)return false;
 if(data.type==='input'){
  if(![data.x,data.z,data.yaw,data.pitch].every(Number.isFinite))return false;
  const length=Math.max(1,Math.hypot(data.x,data.z));p.moveX=clamp(data.x/length,-1,1);p.moveZ=clamp(data.z/length,-1,1);
  p.trainingFlags.look+=Math.min(.2,Math.abs(data.yaw-p.yaw));p.yaw=clamp(data.yaw,-1e6,1e6);p.pitch=clamp(data.pitch,-1.42,1.42);p.ads=!!data.ads&&!p.reload;p.sprint=!!data.sprint&&!p.ads&&!p.reload;p.paused=!!data.paused;return true;
 }
 if(state.mode!=='multiplayer'&&p.paused)return false;
 const w=config.weapons[p.weapon];
 if(data.type==='jump'&&p.grounded){p.vy=5.5;p.grounded=false;p.event={type:'jump',seq:p.seq};if(p.tutorialStep===1)p.tutorialStep=2;return true;}
 if(data.type==='switch'&&!p.reload&&p.ownedRifle){p.weapon=p.weapon==='pistol'?'ak47':'pistol';p.cooldown=.4;p.event={type:'switch',seq:p.seq};return true;}
 if(data.type==='reload'&&!p.reload&&p.ammo[p.weapon]<w.magazine&&p.reserve[p.weapon]>0){p.reload=w.reload;p.reloadTransferred=false;p.event={type:'reload',seq:p.seq};return true;}
 if(data.type==='fire'&&!p.reload&&p.cooldown<=0&&p.ammo[p.weapon]>0){
  p.ammo[p.weapon]--;p.cooldown=w.interval;p.event={type:'fire',seq:p.seq};
  if(p.tutorialStep===2)p.tutorialStep=3;else if(p.tutorialStep===4&&p.ads)p.tutorialStep=5;
  const hit=hitEnemy(p,state.enemies);if(!hit)return true;
  const damage=hit.headshot?w.headDamage:w.damage;hit.enemy.health-=damage;
  p.hit={seq:p.seq,headshot:hit.headshot};
  if(state.mode==='tutorial'){
    hit.enemy.health=100000;if(p.tutorialStep===5){p.trainingFlags[hit.headshot?'head':'body']=true;if(p.trainingFlags.head&&p.trainingFlags.body)p.tutorialStep=6;}
  }else if(hit.enemy.health<=0){const score=hit.headshot?200:100;p.score+=score;p.weaponScores[p.weapon]+=score;}
  return true;
 }return false;
}
export function tick(state,dt){
 if(state.status!=='playing')return;
 const players=Object.values(state.players),alive=players.filter(p=>p.health>0);if(!alive.length){state.status='finished';return;}
 if(state.mode!=='multiplayer'&&players[0]?.paused)return;
 state.time+=dt;
 const difficulty=config.difficulties[state.mode==='multiplayer'?'multiplayer':'solo'].find(d=>d.id===state.difficulty);
 for(const p of players){
  if(p.health<=0)continue;p.cooldown=Math.max(0,p.cooldown-dt);
  if(p.reload>0){const duration=config.weapons[p.weapon].reload;p.reload=Math.max(0,p.reload-dt);
   if(p.reload<=duration*.24&&!p.reloadTransferred){const add=Math.min(config.weapons[p.weapon].magazine-p.ammo[p.weapon],p.reserve[p.weapon]);p.ammo[p.weapon]+=add;p.reserve[p.weapon]-=add;p.reloadTransferred=true;}
   if(p.reload===0&&p.tutorialStep===3)p.tutorialStep=4;
  }
  const speed=p.sprint?8:p.ads?3:5;const oldX=p.x,oldZ=p.z;
  if(!p.paused)move(p,p.moveX*speed*dt,p.moveZ*speed*dt);
  p.trainingFlags.moved+=Math.hypot(p.x-oldX,p.z-oldZ);
  if(p.tutorialStep===0&&p.trainingFlags.moved>4&&p.trainingFlags.look>.3)p.tutorialStep=1;
  p.vy-=14*dt;p.y+=p.vy*dt;if(p.y<=1.7){p.y=1.7;p.vy=0;p.grounded=true;}
 }
 if(state.mode==='tutorial'){
  if(state.enemies.length===0)state.enemies.push({id:'training',x:0,z:3,health:100000,speed:0,attack:0,boss:false});return;
 }
 state.spawnTimer-=dt;
 if(state.pending>0&&state.spawnTimer<=0){
  let x,z;for(let i=0;i<100;i++){const a=Math.random()*Math.PI*2;x=clamp(alive[0].x+Math.cos(a)*30,-40,40);z=clamp(alive[0].z+Math.sin(a)*30,-40,40);if(!blocked(x,z,.5))break;}
  const boss=state.wave%config.boss.everyWaves===0&&state.pending===1;
  state.enemies.push({id:`${state.wave}-${state.pending}`,x,z,health:boss?config.boss.health*difficulty.boss:difficulty.health,speed:(1.25+Math.random()*.9+state.wave*.04)*difficulty.speed,attack:0,boss,skill:'cooldown',skillTime:3});state.pending--;state.spawnTimer=difficulty.spawn;
 }
 for(const enemy of state.enemies){
  if(enemy.health<=0)continue;enemy.attack-=dt;
  let target=alive.reduce((best,p)=>Math.hypot(p.x-enemy.x,p.z-enemy.z)<Math.hypot(best.x-enemy.x,best.z-enemy.z)?p:best,alive[0]);
  if(enemy.boss){enemy.skillTime-=dt;
   if(enemy.skill==='windup'&&enemy.skillTime<=0){for(const p of alive)if(Math.hypot(p.x-enemy.slamX,p.z-enemy.slamZ)<config.boss.radius&&p.y<2.4)p.health=Math.max(0,p.health-config.boss.damage*difficulty.boss);enemy.skill='recovery';enemy.skillTime=config.boss.recovery;}
   else if(enemy.skillTime<=0){if(enemy.skill==='recovery'){enemy.skill='cooldown';enemy.skillTime=config.boss.cooldown;}else{enemy.skill='windup';enemy.skillTime=config.boss.windup;enemy.slamX=target.x;enemy.slamZ=target.z;}}
   if(enemy.skill!=='cooldown')continue;
  }
  const dx=target.x-enemy.x,dz=target.z-enemy.z,distance=Math.hypot(dx,dz);
  if(distance>1.65){const step=enemy.speed*dt;const oldX=enemy.x,oldZ=enemy.z;move(enemy,dx/distance*step,dz/distance*step,.4);if(Math.hypot(enemy.x-oldX,enemy.z-oldZ)<step*.3)move(enemy,-dz/distance*step,dx/distance*step,.4);}
  if(distance<1.75&&enemy.attack<=0){target.health=Math.max(0,target.health-difficulty.damage);enemy.attack=.9;}
 }
 state.enemies=state.enemies.filter(e=>e.health>0);
 if(!state.pending&&!state.enemies.length){state.wave++;state.pending=Math.min(4+state.wave*2,difficulty.cap);state.spawnTimer=1.2;}
 if(alive.every(p=>p.health<=0))state.status='finished';
}
