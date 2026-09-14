import './config.js';
const config=globalThis.HordeConfig.progression;
export function levelFromExp(exp,kind='player') {
  let level=1,remaining=Math.max(0,Number(exp)||0);
  const base=kind==='weapon'?config.weaponBase:config.playerBase;
  const growth=kind==='weapon'?config.weaponGrowth:config.playerGrowth;
  const max=kind==='weapon'?config.maxWeaponLevel:config.maxPlayerLevel;
  while(level<max){const needed=Math.round(base*Math.pow(level,growth));if(remaining<needed)return {level,progress:remaining,needed};remaining-=needed;level++;}
  return {level,progress:0,needed:0};
}
export function rewards(score,difficulty,weaponScores={}) {
  const safe=Math.max(0,Math.floor(score));
  return { currency:Math.floor(safe*config.scoreToCurrency*difficulty.reward), playerExp:Math.floor(safe*.4*difficulty.reward), weaponExp:Object.fromEntries(Object.entries(weaponScores).map(([key,value])=>[key,Math.floor(Math.max(0,value)*.55)])) };
}
