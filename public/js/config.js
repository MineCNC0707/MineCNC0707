(function (root) {
  'use strict';
  const config = {
    fpsOptions: [30, 60, 90, 120, 144],
    defaults: { fps: 60, sensitivity: 0.0035, volume: 0.7, fov: 85, adsMode: 'toggle', haptics: true },
    camera: { minFov: 70, maxFov: 110, viewmodelFov: 60, adsBlend: 12, maxDpr: 1.75 },
    offlineTrial: true,
    weapons: {
      pistol: { magazine: 12, reserve: 96, damage: 40, headDamage: 100, interval: 0.24, reload: 1.4, price: 0, ads: 0.82, recoil: 0.11 },
      ak47: { magazine: 30, reserve: 120, damage: 40, headDamage: 100, interval: 0.11, reload: 2.1, price: 1800, ads: 0.74, recoil: 0.09 }
    },
    progression: { playerBase: 800, playerGrowth: 1.35, weaponBase: 1200, weaponGrowth: 1.45, maxPlayerLevel: 100, maxWeaponLevel: 50, scoreToCurrency: 0.12 },
    difficulties: {
      solo: [
        { id: 'easy', health: 75, damage: 8, spawn: 0.6, cap: 12, speed: 0.9, boss: 0.8, reward: 1 },
        { id: 'normal', health: 100, damage: 12, spawn: 0.35, cap: 20, speed: 1, boss: 1, reward: 1.3 },
        { id: 'hard', health: 140, damage: 17, spawn: 0.3, cap: 24, speed: 1.1, boss: 1.3, reward: 1.7 },
        { id: 'nightmare', health: 175, damage: 22, spawn: 0.25, cap: 28, speed: 1.2, boss: 1.65, reward: 2.2 },
        { id: 'dreadmare', health: 220, damage: 28, spawn: 0.2, cap: 32, speed: 1.3, boss: 2, reward: 3 }
      ],
      multiplayer: [
        { id: 'easy', health: 105, damage: 10, spawn: 0.4, cap: 20, speed: 0.95, boss: 1.3, reward: 1.1 },
        { id: 'normal', health: 145, damage: 15, spawn: 0.3, cap: 28, speed: 1.05, boss: 1.8, reward: 1.5 },
        { id: 'hard', health: 180, damage: 20, spawn: 0.24, cap: 34, speed: 1.15, boss: 2.3, reward: 2 },
        { id: 'nightmare', health: 225, damage: 26, spawn: 0.2, cap: 40, speed: 1.25, boss: 2.8, reward: 2.6 },
        { id: 'dreadmare', health: 270, damage: 32, spawn: 0.17, cap: 44, speed: 1.35, boss: 3.4, reward: 3.4 }
      ]
    },
    boss: { everyWaves: 3, health: 1800, windup: 1.6, recovery: 1.2, cooldown: 7, radius: 6, damage: 35 },
    network: { inviteCooldown: 15000, inviteExpiry: 45000, heartbeat: 10000, reconnectMax: 10000 }
  };
  const obstacles=[];
  const add=(x,z,w,h,d,kind='building')=>obstacles.push({x,z,w,h,d,kind});
  add(0,-45,90,6,1,'wall');add(0,45,90,6,1,'wall');add(-45,0,1,6,90,'wall');add(45,0,1,6,90,'wall');
  for(const side of [-1,1])for(let i=0;i<5;i++){const x=side*(15+(i%2)*2),z=-31+i*14;add(x,z,7,5+i%3*2,8);if(i%2===0)add(x+side*5,z+2,1,.9,4,'barrier');}
  for(const [x,z] of [[-5,-9],[6,21],[-7,34]])add(x,z,2,1.6,4,'car');
  let seed=7351;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<24;i++){const size=1.2+random()*1.7,x=(random()-.5)*72,z=(random()-.5)*72;if(Math.abs(x)<7&&Math.abs(z-12)<7){i--;continue;}add(x,z,size,size,size,'crate');}
  config.world={obstacles};
  root.HordeConfig = config;
})(globalThis);
