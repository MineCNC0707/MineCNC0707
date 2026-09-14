import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,command,tick,blocked,move,hitEnemy} from '../worker/simulation.js';
const make=()=>{const p=newPlayer({playerId:'p',displayName:'P',weapons:{pistol:{}},equipped:'pistol'});p.paused=false;return {status:'playing',mode:'solo',difficulty:'normal',players:{p},enemies:[],pending:1,spawnTimer:99,wave:1,time:0};};
test('Paused solo freezes reload, enemies and simulation time',()=>{
 const s=make(),p=s.players.p;p.paused=true;p.reload=1;s.enemies=[{id:'z',x:0,z:10,health:100,speed:2,attack:0}];tick(s,.1);assert.equal(p.reload,1);assert.equal(s.time,0);assert.equal(s.enemies[0].z,10);
});
test('Multiplayer menu does not stop the world',()=>{
 const s=make();s.mode='multiplayer';s.players.p.paused=true;tick(s,.1);assert.equal(s.time,.1);
});
test('Shots cannot be replayed and obey server ammo/cooldown',()=>{
 const s=make(),p=s.players.p;command(s,p,{type:'fire',seq:1});command(s,p,{type:'fire',seq:1});command(s,p,{type:'fire',seq:2});assert.equal(p.ammo.pistol,11);tick(s,.3);command(s,p,{type:'fire',seq:3});assert.equal(p.ammo.pistol,10);
});
test('Reload transfers ammo at its animation checkpoint, not at start',()=>{
 const s=make(),p=s.players.p;p.ammo.pistol=0;command(s,p,{type:'reload',seq:1});tick(s,.5);assert.equal(p.ammo.pistol,0);tick(s,.6);assert.equal(p.ammo.pistol,12);assert.equal(p.reserve.pistol,84);
});
test('Server movement rejects passing through a building',()=>{
 const p={x:10,z:-31};move(p,10,0);assert.ok(p.x<11.2);assert.equal(blocked(p.x,p.z),false);
});
test('Server ray distinguishes head and torso',()=>{
 const s=make(),p=s.players.p;const enemy={id:'z',x:0,z:3,health:100};p.pitch=-Math.atan2(.3,9);assert.equal(hitEnemy(p,[enemy]).headshot,true);p.pitch=Math.atan2(.45,9);assert.equal(hitEnemy(p,[enemy]).headshot,false);
});
