(async function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const loading = $("loading-screen");
  const errorScreen = $("error-screen");
  const errorMessage = $("error-message");
  const enterScreen = $("enter-screen");
  const pauseScreen = $("pause-screen");
  const gameOverScreen = $("game-over");
  const settingsDialog = $("settings-dialog");

  function fail(error) {
    console.error(error);
    loading.hidden = true;
    errorMessage.textContent = `错误信息：${error?.message || String(error)}`;
    errorScreen.hidden = false;
  }
  const progress=document.createElement('progress');progress.max=4;progress.value=0;
  loading.querySelector('.loading-line').replaceWith(progress);
  const loadingStage=key=>{loading.querySelector('p').textContent=window.HordeUI.t(key);};
  loadingStage('loadingEngine');

  try {
    const THREE = await import("/vendor/three.module.js");
    progress.value=1;loadingStage('loadingSession');
    const settingsApi = window.DeadSectorSettings;
    const t = window.HordeUI.t;
    let settings = settingsApi.load();

    const params = new URLSearchParams(location.search);
    const mode = params.get('mode') || 'trial';
    const difficultyTable = mode === 'multiplayer' ? window.HordeConfig.difficulties.multiplayer : window.HordeConfig.difficulties.solo;
    const difficulty = difficultyTable.find(d => d.id === params.get('difficulty')) || difficultyTable[1];
    const training = mode === 'tutorial';
    const online = mode!=='trial';
    let playerProfile=null,connection=null,matchId=params.get('room'),sequence=0,serverPlayer=null,lastInput=0,networkReady=!online;
    if(online){
      try {playerProfile=await window.HordeNetwork.api('me');if(!training&&!playerProfile.tutorialCompleted){location.replace('./index.html');return;}
        if(!matchId){const match=await window.HordeNetwork.api('matches',{mode,difficulty:difficulty.id});matchId=match.id;}
      } catch(error){location.replace('./index.html');return;}
    }
    function sendAction(type){connection?.send({type,seq:++sequence});}

    let tutorialStep=playerProfile?.tutorialStep||0, tutorialMoved=0, tutorialLook=0, tutorialBody=false, tutorialHead=false;
    const tutorialHints=['moveHint','jumpHint','shootHint','reloadHint','adsHint','hitHint'];
    const tutorialBanner=document.createElement('p');tutorialBanner.className='tutorial-banner';tutorialBanner.hidden=!training;document.body.appendChild(tutorialBanner);
    function advanceTutorial(event) {
      if(!training || online)return;
      const expected=['move','jump','shoot','reload','ads','hits'][tutorialStep];
      if(event===expected) {
        tutorialStep++;
        tutorialBanner.textContent=t(tutorialStep<6?tutorialHints[tutorialStep]:'tutorialDone');
      }
    }
    if(training)tutorialBanner.textContent=t(tutorialHints[tutorialStep] || 'tutorialDone');
    progress.value=2;loadingStage('loadingScene');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5b6967);
    scene.fog = new THREE.FogExp2(0x5b6967, 0.013);

    const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 180);
    camera.position.set(0, 1.7, 12);
    camera.rotation.order = "YXZ";
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    $("game-root").appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xc7d8d7, 0x444b36, 2.2);
    scene.add(ambient);
    const moon = new THREE.DirectionalLight(0xc9dcff, 2.1);
    moon.position.set(-14, 22, 12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    scene.add(moon);

    function canvasTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#5d6360";
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4500; i++) {
        const c = Math.floor(55 + Math.random() * 80);
        ctx.fillStyle = `rgba(${c},${c},${c},${Math.random() * 0.12})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 2.5 + 0.5, Math.random() * 2.5 + 0.5);
      }
      const t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    const concrete = canvasTexture();
    concrete.repeat.set(18, 18);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ map: concrete, color: 0x707672, roughness: 0.96 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const obstacles = [];
    const wallMat = new THREE.MeshStandardMaterial({ map: concrete, color: 0x9caaa0, roughness: 0.95 });
    function wall(x, y, z, w, h, d) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
      obstacles.push(new THREE.Box3().setFromObject(mesh));
    }
    wall(0, 3, -45, 90, 6, 1); wall(0, 3, 45, 90, 6, 1);
    wall(-45, 3, 0, 1, 6, 90); wall(45, 3, 0, 1, 6, 90);

    const crateMat = new THREE.MeshStandardMaterial({ color: 0x404743, roughness: 0.75, metalness: 0.12 });
    for (const c of window.HordeConfig.world.obstacles.filter(b=>b.kind==='crate')) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(c.w,c.h,c.d),crateMat);crate.position.set(c.x,c.h/2,c.z);crate.castShadow=crate.receiveShadow=true;scene.add(crate);obstacles.push(new THREE.Box3().setFromObject(crate));
    }

    [[-22,-18],[18,-15],[-15,24],[25,18]].forEach(([x,z]) => {
      const lamp = new THREE.PointLight(0xff2b1f, 7, 15, 2);
      lamp.position.set(x, 3, z);
      scene.add(lamp);
    });

    // Streets, damaged buildings, cars and barriers use the same simple collision system.
    const road = new THREE.Mesh(new THREE.PlaneGeometry(12,86), new THREE.MeshStandardMaterial({color:0x353e3d, roughness:1})); road.rotation.x=-Math.PI/2; road.position.y=.012; scene.add(road);
    for (let i=0;i<16;i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(.15,2),new THREE.MeshStandardMaterial({color:0xbeb897})); strip.rotation.x=-Math.PI/2;strip.position.set(0,.02,-39+i*5);scene.add(strip);
    }
    for (const side of [-1,1]) for (let i=0;i<5;i++) {
      const x=side*(15+(i%2)*2), z=-31+i*14, h=5+i%3*2;
      wall(x,h/2,z,7,h,8);
      for (let y=1.5;y<h-.5;y+=2) for(const dx of [-2,0,2]) {
        const pane=new THREE.Mesh(new THREE.PlaneGeometry(1,1.2),new THREE.MeshStandardMaterial({color:(i+dx)%3?0x233235:0x82968a,roughness:.65}));pane.position.set(x+dx,y,z+4.01);scene.add(pane);
      }
      if(i%2===0)wall(x+side*5,.45,z+2,1,.9,4);
    }
    for (const [x,z] of [[-5,-9],[6,21],[-7,34]]) {
      const car=new THREE.Group();scene.add(car);car.position.set(x,0,z);
      const body=new THREE.Mesh(new THREE.BoxGeometry(2, .8,4),new THREE.MeshStandardMaterial({color:0x624d3e,roughness:.86,metalness:.25}));body.position.y=.7;car.add(body);
      const roof=new THREE.Mesh(new THREE.BoxGeometry(1.7,.6,2),new THREE.MeshStandardMaterial({color:0x30403f,roughness:.65}));roof.position.y=1.3;car.add(roof);
      obstacles.push(new THREE.Box3().setFromObject(car));
    }
    function blocked(x,z,radius=.35) {
      return obstacles.some(b=>x>b.min.x-radius && x<b.max.x+radius && z>b.min.z-radius && z<b.max.z+radius);
    }
    function moveWithCollision(position,dx,dz,radius=.35) {
      const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.2));
      for(let i=0;i<steps;i++) {if(!blocked(position.x+dx/steps,position.z,radius))position.x+=dx/steps;if(!blocked(position.x,position.z+dz/steps,radius))position.z+=dz/steps;}
    }

    // Dedicated viewmodel camera keeps hands independent of world FOV.
    const { createAssets } = await import('./models.js');
    const assets = createAssets(THREE);
    const viewScene = new THREE.Scene();
    const viewCamera = new THREE.PerspectiveCamera(window.HordeConfig.camera.viewmodelFov, innerWidth / innerHeight, .01, 5);
    viewScene.add(new THREE.HemisphereLight(0xd4e6e2, 0x4b5342, 3));
    const weaponLight = new THREE.DirectionalLight(0xffe2be, 3); weaponLight.position.set(1,2,1); viewScene.add(weaponLight);
    let weaponKind = 'pistol';
    let weapon = assets.viewmodel(weaponKind);
    viewScene.add(weapon); weapon.scale.setScalar(.65); weapon.position.set(.18, -.16, -.55);
    let muzzle = weapon.userData.flash;
    const muzzleLight = new THREE.PointLight(0xffaa33, 0, 3); muzzleLight.position.copy(muzzle.position); viewScene.add(muzzleLight);
    const weaponAmmo = { pistol: { ammo:12, reserve:96 }, ak47:{ ammo:30, reserve:120 } };
    let ads = false, switching = 0, reloadAge = 0, reloadTransferred = false, weaponPhase = 0, fireHeld = false;
    const weaponConfig = () => window.HordeConfig.weapons[weaponKind];
    renderer.autoClear = false;

    // Game state
    const keys = {};
    const zombies = [];
    const corpses = [];
    let health = 100, score = 0, wave = 1, ammo = 12, reserve = 96;
    let dead = false, playing = false, reloading = false, shootingCooldown = false;
    let yaw = 0, pitch = 0, verticalVelocity = 0, grounded = true, recoil = 0, muzzleTimer = 0;
    let spawningWave = false;
    // These timers advance only with simulation time, so pause freezes the match.
    const gameTimers = [];
    function schedule(callback, milliseconds) { gameTimers.push({ callback, remaining: milliseconds / 1000 }); }
    function advanceTimers(delta) {
      const due = [];
      for (let i = gameTimers.length - 1; i >= 0; i--) {
        gameTimers[i].remaining -= delta;
        if (gameTimers[i].remaining <= 0) due.push(gameTimers.splice(i, 1)[0]);
      }
      for (let i = due.length - 1; i >= 0 && !dead; i--) due[i].callback();
    }
    const playerHeight = 1.7;

    function updateHud() {
      $("health-text").textContent = Math.ceil(health);
      $("health-fill").style.width = `${health}%`;
      $("score").textContent = `${t('score')} ${String(score).padStart(4, "0")}`;
      $("wave").textContent = `${t('wave')} ${wave}`;
      $("ammo").textContent = ammo;
      $("reserve").textContent = reserve;
      document.querySelector('.hud-right small').textContent=t(weaponKind);
    }

    // Audio is kept in a small separate frontend module.
    const audioApi = window.DeadSectorAudio.create(() => settings);
    const ensureAudio = audioApi.ensureAudio;
    const sfx = audioApi.sfx;
    window.addEventListener('pagehide',audioApi.dispose);
    let growlTimer=0;

    function createZombie() {
      const zombie = new THREE.Group();
      const skin = new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x66735d : 0x566150, roughness: 1 });
      const cloth = new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x302e29 : 0x29342f, roughness: 1 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.05, 0.42), cloth); torso.position.y = 1.25; zombie.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin); head.position.y = 2; zombie.add(head);
      for (const side of [-1,1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.09,0.85,8), skin);
        arm.position.set(side * 0.47,1.47,0.18); arm.rotation.x = Math.PI / 2.2; zombie.add(arm);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.27,0.85,0.3), cloth);
        leg.position.set(side * 0.19,0.43,0); zombie.add(leg);
      }
      zombie.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.userData.zombie = zombie; } });
      head.userData.headshot = true;
      zombie.userData.health = difficulty.health; zombie.userData.dead = false; zombie.userData.attack = 0;
      zombie.userData.speed = 1.25 + Math.random() * 0.9 + wave * 0.04;
      zombie.userData.walk = Math.random() * 50;
      const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 12;
      zombie.position.set(THREE.MathUtils.clamp(camera.position.x + Math.cos(a) * d, -40, 40), 0, THREE.MathUtils.clamp(camera.position.z + Math.sin(a) * d, -40, 40));
      for(let attempt=0;attempt<30 && blocked(zombie.position.x,zombie.position.z,.5);attempt++){zombie.position.x=(Math.random()-.5)*76;zombie.position.z=(Math.random()-.5)*76;}
      scene.add(zombie); zombies.push(zombie);
    }

    const bossBanner=document.createElement('p');bossBanner.className='boss-banner';bossBanner.hidden=true;document.body.appendChild(bossBanner);
    const warning=new THREE.Mesh(new THREE.RingGeometry(.2,window.HordeConfig.boss.radius,40),new THREE.MeshBasicMaterial({color:0xd55332,transparent:true,opacity:.4,side:THREE.DoubleSide}));warning.rotation.x=-Math.PI/2;warning.position.y=.04;warning.visible=false;scene.add(warning);
    let boss=null;
    function updateBoss(delta) {
      if(!boss || boss.userData.dead){warning.visible=false;bossBanner.hidden=true;return;}
      const data=boss.userData;data.skillTime-=delta;bossBanner.textContent=t(data.skill==='windup'?'bossWarning':'boss')+' · '+Math.ceil(data.health);
      if(data.skill==='windup') {
        warning.visible=true;warning.material.opacity=.2+Math.abs(Math.sin(data.skillTime*9))*.3;
        if(data.skillTime<=0){const dx=camera.position.x-warning.position.x,dz=camera.position.z-warning.position.z;if(Math.hypot(dx,dz)<window.HordeConfig.boss.radius && camera.position.y<2.4)damagePlayer(window.HordeConfig.boss.damage*difficulty.boss);data.skill='recovery';data.skillTime=window.HordeConfig.boss.recovery;warning.visible=false;}
      } else if(data.skillTime<=0) {
        if(data.skill==='recovery'){data.skill='cooldown';data.skillTime=window.HordeConfig.boss.cooldown;}
        else{data.skill='windup';data.skillTime=window.HordeConfig.boss.windup;warning.position.set(camera.position.x,.04,camera.position.z);}
      }
    }
    function spawnWave() {
      if (dead) return;
      spawningWave = true; updateHud();
      if(!training && wave%window.HordeConfig.boss.everyWaves===0){createZombie();boss=zombies[zombies.length-1];boss.scale.setScalar(2.1);boss.userData.health=window.HordeConfig.boss.health*difficulty.boss;boss.userData.boss=true;boss.userData.skill='cooldown';boss.userData.skillTime=3;bossBanner.hidden=false;audioApi.setMusic('boss');boss.traverse(c=>{if(c.isMesh)c.material.color.setHex(0x72614c);});}
      if(training){createZombie();const target=zombies[zombies.length-1];target.position.set(0,0,3);target.userData.health=100000;target.userData.speed=0;spawningWave=false;return;}
      const amount = Math.min(4 + wave * 2, difficulty.cap);
      for (let i = 0; i < amount; i++) {
        schedule(() => {
          if (!dead) createZombie();
          if (i === amount - 1) spawningWave = false;
        }, i * difficulty.spawn * 1000);
      }
    }

    const zDir = new THREE.Vector3();
    function damagePlayer(amount) {
      if (dead) return;
      health = Math.max(0, health - amount); updateHud(); sfx.hurt();
      $("damage-overlay").classList.add("show");
      setTimeout(() => $("damage-overlay").classList.remove("show"), 130);
      if (health <= 0) endGame();
    }

    function updateZombies(delta) {
      let alive = 0;
      for (const z of zombies) {
        if (z.userData.dead) continue;
        alive++; z.userData.walk += delta * 7; z.userData.attack -= delta;
        zDir.set(camera.position.x - z.position.x, 0, camera.position.z - z.position.z);
        const dist = zDir.length(); if (dist > 0.001) zDir.normalize();
        const targetYaw=Math.atan2(zDir.x,zDir.z);let turn=targetYaw-z.rotation.y;turn=Math.atan2(Math.sin(turn),Math.cos(turn));z.rotation.y+=turn*(1-Math.exp(-5*delta));
        for(let i=2;i<z.children.length;i++){const limb=z.children[i];limb.rotation.x=(i%2===0 ? Math.PI/2.2 : 0)+Math.sin(z.userData.walk+(i<4?0:Math.PI))*(i%2===0?.08:.3);}
        if(training)continue;
        if(z.userData.boss && z.userData.skill!=='cooldown')continue;
        if(dist>1.65) {const step=z.userData.speed*delta*difficulty.speed;
          const oldX=z.position.x,oldZ=z.position.z;moveWithCollision(z.position,zDir.x*step,zDir.z*step,.4);
          if(Math.abs(z.position.x-oldX)+Math.abs(z.position.z-oldZ)<step*.3)moveWithCollision(z.position,-zDir.z*step,zDir.x*step,.4);
        }
        z.position.y = Math.abs(Math.sin(z.userData.walk)) * 0.025;
        z.rotation.z = Math.sin(z.userData.walk) * 0.025;
        if (dist < 1.75 && z.userData.attack <= 0) { damagePlayer(difficulty.damage); z.userData.attack = 0.9; }
      }
      if (alive === 0 && zombies.length > 0 && !spawningWave) {
        zombies.length = 0; wave++; spawningWave = true; updateHud(); schedule(spawnWave, 1200);
      }
    }

    const raycaster = new THREE.Raycaster();
    function showHit() {
      const m = $("hitmarker"); m.classList.add("show"); setTimeout(() => m.classList.remove("show"), 90);
    }
    function killZombie(z, headshot) {
      if(z.userData.boss)audioApi.setMusic('battle');
      z.userData.dead = true; score += headshot ? 200 : 100; updateHud(); sfx.kill();
      const msg = $("kill-message"); msg.textContent = headshot ? "+200 爆头" : "+100";
      msg.textContent = headshot ? `+200 ${t('headshot')}` : '+100';
      msg.classList.remove("show"); void msg.offsetWidth; msg.classList.add("show");
      corpses.push({ zombie: z, age: 0 });
    }
    function updateCorpses(delta) {
      for (let i = corpses.length - 1; i >= 0; i--) {
        const corpse = corpses[i]; corpse.age += delta;
        const p = Math.min(corpse.age / 0.42, 1);
        corpse.zombie.rotation.z = p * Math.PI / 2; corpse.zombie.position.y = p * 0.25;
        if (corpse.age >= 0.87) {
          scene.remove(corpse.zombie);
          const materials = new Set();
          corpse.zombie.traverse(child => { if (child.isMesh) { child.geometry.dispose(); materials.add(child.material); } });
          for (const material of materials) material.dispose();
          corpses.splice(i, 1);
        }
      }
    }
    function shoot() {
      if (!playing || dead || reloading || shootingCooldown || switching>0 || !networkReady) return;
      ensureAudio();
      if (ammo <= 0) return reload();
      ammo--; advanceTutorial(ads?'ads':'shoot'); updateHud(); sfx.gun(); recoil = 1; pitch -= 0.007 + Math.random() * 0.004;
      muzzle.visible = true; muzzleLight.intensity = 12; muzzleTimer = 0.05;
      shootingCooldown = true; schedule(() => shootingCooldown = false, weaponConfig().interval*1000);
      if(online){sendInput(true);sendAction('fire');return;}
      raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
      const targets = [];
      zombies.forEach((z) => { if (!z.userData.dead) z.traverse((c) => { if (c.isMesh) targets.push(c); }); });
      const hit = raycaster.intersectObjects(targets, false)[0]; if (!hit) return;
      if(obstacles.some(box=>{const point=raycaster.ray.intersectBox(box,zDir);return point && point.distanceTo(raycaster.ray.origin)<hit.distance;}))return;
      const z = hit.object.userData.zombie; if (!z || z.userData.dead) return;
      const headshot = hit.object.userData.headshot === true;
      z.userData.health -= headshot ? weaponConfig().headDamage : weaponConfig().damage; showHit(); if(headshot)sfx.headshot();else sfx.hit();
      if(headshot){const msg=$('kill-message');msg.textContent=t('headshot');msg.classList.remove('show');void msg.offsetWidth;msg.classList.add('show');}
      if(training && tutorialStep===5){if(headshot)tutorialHead=true;else tutorialBody=true;if(tutorialHead&&tutorialBody)advanceTutorial('hits');}
      if (z.userData.health <= 0) killZombie(z, headshot);
    }
    function reload() {
      if(!playing || reloading || dead || switching>0 || ammo===weaponConfig().magazine || reserve<=0)return;
      if(online){sendInput(true);sendAction('reload');}
      reloading=true;ads=false;reloadAge=0;reloadTransferred=false;$("reload-message").textContent=t('reloading');$("reload-message").classList.add('show');sfx.reload();
    }
    function switchWeapon() {
      if(!playing || reloading || switching>0 || dead || !ownedRifle)return;
      if(online)sendAction('switch');
      weaponAmmo[weaponKind]={ammo,reserve};weaponKind=weaponKind==='pistol'?'ak47':'pistol';
      viewScene.remove(weapon);weapon=assets.viewmodel(weaponKind);weapon.position.set(.18,-.4,-.55);weapon.scale.setScalar(.65);viewScene.add(weapon);muzzle=weapon.userData.flash;muzzleLight.position.copy(muzzle.position);
      ({ammo,reserve}=weaponAmmo[weaponKind]);switching=.4;ads=false;updateHud();
    }
    let ownedRifle=!!playerProfile?.weapons?.ak47;

    const forward = new THREE.Vector3(), right = new THREE.Vector3(), dir = new THREE.Vector3();
    function updatePlayer(delta) {
      camera.rotation.y = yaw; camera.rotation.x = pitch;
      forward.set(-Math.sin(yaw),0,-Math.cos(yaw)); right.set(Math.cos(yaw),0,-Math.sin(yaw)); dir.set(0,0,0);
      dir.addScaledVector(forward,-touchMove.y);dir.addScaledVector(right,touchMove.x);
      if (keys.KeyW) dir.add(forward); if (keys.KeyS) dir.sub(forward); if (keys.KeyA) dir.sub(right); if (keys.KeyD) dir.add(right);
      const moving = dir.lengthSq() > 0;
      if(training && moving){tutorialMoved+=delta;if(tutorialMoved>1.5&&tutorialLook>.3)advanceTutorial('move');}
      if (moving) { dir.normalize(); const speed = (keys.ShiftLeft || keys.ShiftRight) && !ads && !reloading ? 8 : ads ? 3 : 5; moveWithCollision(camera.position,dir.x*speed*delta,dir.z*speed*delta); }
      camera.position.x = THREE.MathUtils.clamp(camera.position.x,-42,42); camera.position.z = THREE.MathUtils.clamp(camera.position.z,-42,42);
      verticalVelocity -= 14 * delta; camera.position.y += verticalVelocity * delta;
      if (camera.position.y <= playerHeight) { camera.position.y = playerHeight; verticalVelocity = 0; grounded = true; }
      weaponPhase += delta * 7;
      const t = weaponPhase, amount = moving ? 1 : 0.15;
      const blend = 1 - Math.exp(-12*delta);
      const sprint = moving && (keys.ShiftLeft || keys.ShiftRight) && !ads;
      const nearWall = blocked(camera.position.x-Math.sin(yaw)*.9,camera.position.z-Math.cos(yaw)*.9,.1);
      const tx = ads && !reloading ? 0 : .18 + Math.sin(t*.55)*.008*amount;
      const ty = ads && !reloading ? -.049 : -.16 + Math.abs(Math.cos(t))*.01*amount - (sprint || nearWall ? .12 : 0);
      weapon.position.x += (tx-weapon.position.x)*blend; weapon.position.y += (ty-weapon.position.y)*blend;
      recoil = Math.max(0,recoil-delta*11);
      weapon.position.z += ((ads ? -.46 : -.55)+recoil*weaponConfig().recoil-weapon.position.z)*blend;
      weapon.rotation.x += (recoil*.1+(sprint || nearWall ? -.35 : 0)-weapon.rotation.x)*blend;
      weapon.rotation.z += ((reloading ? -.25 : 0)-weapon.rotation.z)*blend;
      if(switching>0) {switching=Math.max(0,switching-delta);weapon.position.y-=Math.sin(switching/.4*Math.PI)*.2;}
      if(reloading) {
        reloadAge += delta; const p=Math.min(reloadAge/weaponConfig().reload,1);
        const r=weapon.userData, reach=Math.sin(Math.min(p/.75,1)*Math.PI);
        r.leftHand.position.copy(r.leftHome);r.leftHand.position.y-=reach*.15;r.leftHand.position.z+=reach*.15;
        r.magazine.position.y=r.magazineY-(p>.18 && p<.72 ? Math.sin((p-.18)/.54*Math.PI)*.32 : 0);
        r.magazine.visible=!(p>.35 && p<.52);
        if(p>=.76 && !reloadTransferred){const count=Math.min(weaponConfig().magazine-ammo,reserve);if(!online){ammo+=count;reserve-=count;}reloadTransferred=true;updateHud();}
        r.slide.position.z=(weaponKind==='ak47'?-.2:-.11)+(p>.8 && p<.96 ? Math.sin((p-.8)/.16*Math.PI)*.055:0);
        r.bolt.position.z=-.15+(p>.8 && p<.96 ? Math.sin((p-.8)/.16*Math.PI)*.09:0);
        if(p>=1){advanceTutorial('reload');reloading=false;r.leftHand.position.copy(r.leftHome);r.magazine.position.y=r.magazineY;r.magazine.visible=true;$("reload-message").classList.remove('show');}
      }
      if(fireHeld && weaponKind==='ak47')shoot();

    }

    document.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if(e.code==='KeyR' && !e.repeat)reload();
      if(e.code==='Digit1' || e.code==='Digit2' || e.code==='KeyQ')switchWeapon();
      if(e.code==='Space' && playing)e.preventDefault();
      if (e.code === "Space" && playing && grounded) { verticalVelocity = 5.5; grounded = false;advanceTutorial('jump');if(online)sendAction('jump'); }
    });
    document.addEventListener("keyup", (e) => keys[e.code] = false);
    function clearKeys() { for (const code of Object.keys(keys)) keys[code] = false; fireHeld=false;ads=false;touchMove.x=touchMove.y=0; }
    window.addEventListener("blur", () => { clearKeys(); if (document.pointerLockElement) document.exitPointerLock(); });
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      tutorialLook+=Math.abs(e.movementX*settings.sensitivity);
      yaw -= e.movementX * settings.sensitivity; pitch -= e.movementY * settings.sensitivity;
      pitch = THREE.MathUtils.clamp(pitch,-1.42,1.42);
    });
    document.addEventListener("mousedown", (e) => { if (e.button === 0 && document.pointerLockElement === renderer.domElement) shoot(); });

    const touchDevice=matchMedia('(pointer:coarse)').matches;
    const touchMove={x:0,y:0};
    let dragLook = false, dragging = false;
    const touchControls=document.createElement('div');touchControls.className='touch-controls';touchControls.hidden=!touchDevice;
    touchControls.innerHTML='<div id="move-zone"><div id="joystick"><i></i></div></div><div id="look-zone"></div><div class="touch-actions"><button data-touch="fire" data-i18n="fire"></button><button data-touch="ads" data-i18n="aim"></button><button data-touch="reload" data-i18n="reload"></button><button data-touch="jump" data-i18n="jump"></button><button data-touch="switch" data-i18n="switchWeapon"></button></div><button class="touch-pause" data-touch="pause" data-i18n="pause"></button>';
    document.body.appendChild(touchControls);window.HordeUI.translate(touchControls);
    const orientation=document.createElement('p');orientation.className='orientation-hint';orientation.textContent=t('rotate');document.body.appendChild(orientation);
    let movePointer=null,lookPointer=null,originX=0,originY=0,lastX=0,lastY=0;
    const moveZone=$('move-zone'),stick=$('joystick'),lookZone=$('look-zone');
    moveZone.addEventListener('pointerdown',e=>{if(!playing||movePointer!==null)return;e.preventDefault();movePointer=e.pointerId;originX=e.clientX;originY=e.clientY;moveZone.setPointerCapture(e.pointerId);stick.style.left=originX+'px';stick.style.top=originY+'px';stick.classList.add('active');});
    moveZone.addEventListener('pointermove',e=>{if(e.pointerId!==movePointer)return;e.preventDefault();let x=e.clientX-originX,y=e.clientY-originY;const length=Math.hypot(x,y),max=48;if(length>max){x*=max/length;y*=max/length;}touchMove.x=Math.abs(x)<6?0:x/max;touchMove.y=Math.abs(y)<6?0:y/max;stick.firstChild.style.transform='translate('+x+'px,'+y+'px)';});
    const releaseMove=e=>{if(e.pointerId!==movePointer)return;movePointer=null;touchMove.x=touchMove.y=0;stick.classList.remove('active');stick.firstChild.style.transform='none';};
    moveZone.addEventListener('pointerup',releaseMove);moveZone.addEventListener('pointercancel',releaseMove);
    lookZone.addEventListener('pointerdown',e=>{if(!playing||lookPointer!==null)return;e.preventDefault();lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;lookZone.setPointerCapture(e.pointerId);});
    lookZone.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer||!playing)return;e.preventDefault();const dx=(e.clientX-lastX)*settings.sensitivity,dy=(e.clientY-lastY)*settings.sensitivity;yaw-=dx;tutorialLook+=Math.abs(dx);pitch=THREE.MathUtils.clamp(pitch-dy,-1.42,1.42);lastX=e.clientX;lastY=e.clientY;});
    const releaseLook=e=>{if(e.pointerId===lookPointer)lookPointer=null;};lookZone.addEventListener('pointerup',releaseLook);lookZone.addEventListener('pointercancel',releaseLook);
    touchControls.querySelectorAll('[data-touch]').forEach(button=>{
      button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();button.setPointerCapture(e.pointerId);const action=button.dataset.touch;
        if(action==='pause'){playing=false;clearKeys();pauseScreen.hidden=false;return;}if(!playing)return;
        if(action==='fire'){fireHeld=true;shoot();}if(action==='reload')reload();if(action==='switch')switchWeapon();
        if(action==='jump'&&grounded){verticalVelocity=5.5;grounded=false;advanceTutorial('jump');}
        if(action==='ads'&&!reloading)ads=settings.adsMode==='hold'?true:!ads;
      });
      const release=()=>{if(button.dataset.touch==='fire')fireHeld=false;if(button.dataset.touch==='ads'&&settings.adsMode==='hold')ads=false;};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);
    });
    document.addEventListener('mousedown',e=>{if(!playing||touchDevice)return;if(e.button===0)fireHeld=true;if(e.button===2&&!reloading)ads=settings.adsMode==='hold'?true:!ads;});
    document.addEventListener('mouseup',e=>{if(e.button===0)fireHeld=false;if(e.button===2&&settings.adsMode==='hold')ads=false;});
    function startPlaying() {
      playing = true; audioApi.setMusic(boss&&!boss.userData.dead?'boss':'battle'); enterScreen.hidden = true; pauseScreen.hidden = true; closeSettingsIfOpen();
    }
    function pointerFallback() {
      dragLook = true; startPlaying();
      const notice = document.createElement('p'); notice.className = 'input-notice'; notice.textContent = t('pointerError');
      document.body.appendChild(notice); setTimeout(() => notice.remove(), 7000);
    }
    renderer.domElement.addEventListener('pointerdown', e => {
      if (!dragLook || !playing) return;
      dragging = true; renderer.domElement.setPointerCapture(e.pointerId);
      if (e.button === 0) shoot();
    });
    renderer.domElement.addEventListener('pointermove', e => {
      if (!dragLook || !dragging || !playing) return;
      yaw -= e.movementX * settings.sensitivity; pitch = THREE.MathUtils.clamp(pitch - e.movementY * settings.sensitivity, -1.42, 1.42);
    });
    renderer.domElement.addEventListener('pointerup', () => dragging = false);
    renderer.domElement.addEventListener('pointercancel', () => dragging = false);
    document.addEventListener('keydown', e => {
      if (e.code === 'Escape' && dragLook && !settingsDialog.open && !dead) {
        playing = !playing; pauseScreen.hidden = playing; clearKeys();
      }
    });
    async function requestPointer() {
      ensureAudio();
      if(touchDevice){startPlaying();return;}
      if (dragLook || !renderer.domElement.requestPointerLock) { pointerFallback(); return; }
      try { await renderer.domElement.requestPointerLock(); } catch { pointerFallback(); }
    }

    function closeSettingsIfOpen() {
      if (settingsDialog?.open) settingsDialog.close();
    }

    document.addEventListener("pointerlockchange", () => {
      clearKeys();
      if (dead) return;
      if (document.pointerLockElement === renderer.domElement) {
        playing = true; enterScreen.hidden = true; pauseScreen.hidden = true; closeSettingsIfOpen();
      } else if (!loading.hidden) {
        playing = false;
      } else {
        playing = false; pauseScreen.hidden = false;
      }
    });

    $("enter-game").addEventListener("click", requestPointer);
    $("resume-game").addEventListener("click", requestPointer);
    $("exit-game").addEventListener("click", async () => {
      const button=$('exit-game');button.disabled=true;
      try{if(online)await window.HordeNetwork.api(`rooms/${matchId}/leave`,{});location.href='./index.html';}
      catch{button.disabled=false;networkLabel.textContent=t('networkError');}
    });
    $("restart-game").addEventListener("click", () => location.reload());

    // Settings modal pauses the game. After closing, user can press Continue.
    document.querySelectorAll("[data-open-settings]").forEach((button) => {
      button.addEventListener("click", () => { if (document.pointerLockElement) document.exitPointerLock(); });
    });
    settingsDialog?.addEventListener("close", () => { if (!dead) pauseScreen.hidden = false; });
    window.addEventListener("deadsector:settings", (e) => { settings = e.detail; updateHud(); });
    window.addEventListener('horde:language', updateHud);
    window.addEventListener('horde:fov-preview', e => { settings = { ...settings, fov: e.detail }; });

    window.addEventListener("resize", () => {
      viewCamera.aspect=innerWidth/innerHeight;viewCamera.updateProjectionMatrix();
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    });

    function endGame() {
      dead = true; playing = false;
      gameTimers.length = 0;
      if (document.pointerLockElement) document.exitPointerLock();
      pauseScreen.hidden = true; $("final-score").textContent = score; gameOverScreen.hidden = false;
    }

    const remoteModels=new Map(),enemyModels=new Map();let lastHitSeq=0;
    const networkLabel=document.createElement('p');networkLabel.className='network-label';networkLabel.textContent=online?t('connecting'):t('offline');document.body.appendChild(networkLabel);
    let invitePollTimer=0;
    const inviteNotice=document.createElement('aside');inviteNotice.className='game-invite';inviteNotice.hidden=true;document.body.appendChild(inviteNotice);
    async function pollInvites(){
      if(!online||training||dead||document.hidden)return;
      try{
        const social=await window.HordeNetwork.api('social'),invite=social.invites?.[0];
        if(!invite){inviteNotice.hidden=true;return;}
        inviteNotice.replaceChildren();
        const copy=document.createElement('span');copy.textContent=`${invite.displayName} · ${Math.max(0,Math.ceil((invite.expiresAt-Date.now())/1000))}s`;
        const accept=document.createElement('button');accept.className='menu-button';accept.textContent=t('accept');
        const decline=document.createElement('button');decline.className='menu-button';decline.textContent=t('decline');
        accept.addEventListener('click',async()=>{accept.disabled=decline.disabled=true;try{const room=await window.HordeNetwork.api('invites/respond',{id:invite.id,accept:true});location.href=`./app.html?mode=multiplayer&room=${encodeURIComponent(room.id)}`;}catch(error){inviteNotice.textContent=t(error.message||'networkError');setTimeout(()=>{inviteNotice.hidden=true;},2200);}});
        decline.addEventListener('click',async()=>{accept.disabled=decline.disabled=true;try{await window.HordeNetwork.api('invites/respond',{id:invite.id,accept:false});inviteNotice.hidden=true;}catch(error){inviteNotice.textContent=t(error.message||'networkError');}});
        inviteNotice.append(copy,accept,decline);inviteNotice.hidden=false;
      }catch{ /* A background social refresh should never interrupt the match. */ }
    }
    const settlement=document.createElement('p');settlement.className='settlement-note';settlement.textContent=t(online?'syncing':'noReward');document.querySelector('#game-over .pause-card').appendChild(settlement);
    function sendInput(force=false){
      if(!connection || (!force && performance.now()-lastInput<100))return;lastInput=performance.now();
      const x=playing?dir.x:0,z=playing?dir.z:0;
      connection.send({type:'input',seq:++sequence,x,z,yaw,pitch,ads,sprint:!!(keys.ShiftLeft||keys.ShiftRight),paused:!playing});
    }
    function updateRemote(delta){
      const blend=1-Math.exp(-12*delta);
      for(const [id,model]of remoteModels){const p=model.userData.target;if(!p)continue;model.position.x+=(p.x-model.position.x)*blend;model.position.z+=(p.z-model.position.z)*blend;model.position.y+=(p.y-1.7-model.position.y)*blend;let angle=p.yaw-model.rotation.y;angle=Math.atan2(Math.sin(angle),Math.cos(angle));model.rotation.y+=angle*blend;
        assets.animatePlayer(model,delta,performance.now()/1000,{moving:Math.hypot(p.moveX,p.moveZ)>.1,sprint:p.sprint,ads:p.ads,reload:p.reload>0,fire:performance.now()<model.userData.fireUntil});model.userData.head.rotation.x=p.pitch;model.visible=p.health>0;
      }
      for(const model of enemyModels.values()){const e=model.userData.target;model.position.x+=(e.x-model.position.x)*blend;model.position.z+=(e.z-model.position.z)*blend;model.userData.walk+=delta*7;model.rotation.z=Math.sin(model.userData.walk)*.025;
        for(let i=2;i<model.children.length;i++)model.children[i].rotation.x=(i%2===0?Math.PI/2.2:0)+Math.sin(model.userData.walk+(i<4?0:Math.PI))*(i%2===0?.08:.3);
        if(e.boss){bossBanner.hidden=false;bossBanner.textContent=t(e.skill==='windup'?'bossWarning':'boss')+' · '+Math.ceil(e.health);warning.visible=e.skill==='windup';if(warning.visible)warning.position.set(e.slamX,.04,e.slamZ);}
      }
    }
    function receive(data){
      if(data.type==='settled'){settlement.textContent=t('settlement');void window.HordeNetwork.api('me').then(p=>{settlement.textContent=t('currency')+' '+p.currency+' · '+t('level')+' '+p.playerLevel;}).catch(()=>{});return;}
      if(data.type!=='snapshot')return;const state=data.state,p=state.players[playerProfile.playerId];if(!p)return;serverPlayer=p;networkReady=true;sequence=Math.max(sequence,p.seq);
      health=p.health;score=p.score;wave=state.wave;
      if(p.weapon!==weaponKind&&!reloading){viewScene.remove(weapon);weaponKind=p.weapon;weapon=assets.viewmodel(weaponKind);weapon.scale.setScalar(.65);weapon.position.set(.18,-.16,-.55);viewScene.add(weapon);muzzle=weapon.userData.flash;muzzleLight.position.copy(muzzle.position);}
      ammo=p.ammo[weaponKind];reserve=p.reserve[weaponKind];updateHud();
      if(Math.hypot(camera.position.x-p.x,camera.position.z-p.z)>1){camera.position.x+=(p.x-camera.position.x)*.6;camera.position.z+=(p.z-camera.position.z)*.6;}
      if(p.hit&&p.hit.seq>lastHitSeq){lastHitSeq=p.hit.seq;showHit();if(p.hit.headshot){sfx.headshot();const msg=$('kill-message');msg.textContent=t('headshot');msg.classList.remove('show');void msg.offsetWidth;msg.classList.add('show');}else sfx.hit();}
      if(training){tutorialStep=p.tutorialStep;tutorialBanner.textContent=t(tutorialHints[tutorialStep]||'tutorialDone');if(tutorialStep>=6){playing=false;enterScreen.hidden=true;pauseScreen.hidden=false;document.querySelector('#pause-screen .eyebrow').textContent=t('tutorialDone');document.querySelector('#pause-screen h2').textContent=t('name');document.querySelector('#resume-game').textContent=t('back');setTimeout(()=>location.href='./index.html',1200);}}
      const ids=new Set();for(const e of state.enemies){ids.add(e.id);let model=enemyModels.get(e.id);if(!model){createZombie();model=zombies.pop();model.position.set(e.x,0,e.z);if(e.boss)model.scale.setScalar(2.1);enemyModels.set(e.id,model);}model.userData.target=e;model.userData.health=e.health;}
      let hasBoss=false;for(const [id,model]of enemyModels){if(!ids.has(id)){model.userData.dead=true;corpses.push({zombie:model,age:0});enemyModels.delete(id);}else if(model.userData.target.boss)hasBoss=true;}
      if(!hasBoss){bossBanner.hidden=true;warning.visible=false;}audioApi.setMusic(hasBoss?'boss':'battle');
      const players=new Set();for(const [id,remote]of Object.entries(state.players)){if(id===playerProfile.playerId)continue;players.add(id);let model=remoteModels.get(id);if(!model){model=assets.player(remote.weapon);model.position.set(remote.x,remote.y-1.7,remote.z);scene.add(model);remoteModels.set(id,model);}
        if(model.userData.kind!==remote.weapon){model.userData.socket.remove(model.userData.gun);model.userData.gun=assets.weapon(remote.weapon);model.userData.gun.scale.setScalar(.85);model.userData.socket.add(model.userData.gun);model.userData.kind=remote.weapon;}
        if(remote.event&&remote.event.seq>(model.userData.eventSeq||0)){model.userData.eventSeq=remote.event.seq;if(remote.event.type==='fire')model.userData.fireUntil=performance.now()+100;}model.userData.target=remote;
      }
      for(const[id,model]of remoteModels)if(!players.has(id)){scene.remove(model);remoteModels.delete(id);}
      if((health<=0||state.status==='finished')&&!dead)endGame();
    }
    if(online){connection=window.HordeNetwork.connect(matchId,receive,(state,ping)=>{networkLabel.textContent=typeof ping==='number'?t('ping')+' '+ping+' ms':t(state);if(state!=='online')networkReady=false;});if(!training){void pollInvites();invitePollTimer=window.setInterval(pollInvites,10000);}}
    window.addEventListener('pagehide',()=>{window.clearInterval(invitePollTimer);connection?.close();});

    // FPS-capped game/render loop.
    let lastTick = performance.now();
    let lastRender = performance.now();
    let fpsStart = lastRender, frameCount = 0;
    function animate(now) {
      requestAnimationFrame(animate);
      const interval = 1000 / settings.fps;
      if (now - lastRender < interval) return;
      let delta = (now - lastTick) / 1000;
      lastTick = now; lastRender = now - ((now - lastRender) % interval);
      delta = Math.min(delta, 0.05);
      const desiredFov=ads?settings.fov*weaponConfig().ads:settings.fov;
      camera.fov += (desiredFov - camera.fov) * (1 - Math.exp(-12 * delta));
      camera.updateProjectionMatrix();
      if (playing && !dead) {
        advanceTimers(delta); updatePlayer(delta); if(!online){updateZombies(delta);updateBoss(delta);} updateCorpses(delta);
        growlTimer-=delta;if(growlTimer<=0){const z=zombies.find(z=>!z.userData.dead);if(z)audioApi.zombie(z.position,camera.position,yaw);growlTimer=2.5;}

        if (muzzleTimer > 0) { muzzleTimer -= delta; if (muzzleTimer <= 0) { muzzle.visible = false; muzzleLight.intensity = 0; } }
      }
      if(online){sendInput();updateRemote(delta);}
      renderer.clear();renderer.render(scene,camera);renderer.clearDepth();renderer.render(viewScene,viewCamera);
      frameCount++;
      if (now - fpsStart >= 750) {
        $("fps-display").textContent = `${Math.round(frameCount * 1000 / (now - fpsStart))} FPS`;
        frameCount = 0; fpsStart = now;
      }
    }

    updateHud();
    if(!online)spawnWave();
    requestAnimationFrame(animate);

    progress.value=3;
    await renderer.compileAsync(scene,camera);await renderer.compileAsync(viewScene,viewCamera);
    progress.value=4;loadingStage('loadingReady');loading.classList.add('fade-out');
    setTimeout(()=>{loading.hidden=true;enterScreen.hidden=false;},320);
  } catch (error) {
    fail(error);
  }
})();
