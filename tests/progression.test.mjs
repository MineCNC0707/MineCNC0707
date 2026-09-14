import test from 'node:test';
import assert from 'node:assert/strict';
import {levelFromExp,rewards} from '../public/js/progression.js';
test('Player and weapon levels use independent curves and caps',()=>{
  assert.equal(levelFromExp(1000).level,2);assert.equal(levelFromExp(1000,'weapon').level,1);
  assert.equal(levelFromExp(-100).level,1);assert.equal(levelFromExp(1e15,'weapon').level,50);
});
test('Higher difficulty increases currency; unused weapons earn no EXP',()=>{
  const table=globalThis.HordeConfig.difficulties.solo;
  const values=table.map(d=>rewards(2000,d,{pistol:2000,ak47:0}));
  assert.ok(values.every((r,i)=>!i||r.currency>values[i-1].currency));
  assert.equal(values[0].weaponExp.ak47,0);assert.equal(rewards(-1,table[0]).currency,0);
});
