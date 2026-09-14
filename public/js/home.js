(async function () {
  "use strict";

  const { t, translate } = window.HordeUI;
  const { api } = window.HordeNetwork;
  const audio=window.DeadSectorAudio.create(()=>window.DeadSectorSettings.load());document.addEventListener('pointerdown',()=>{audio.ensureAudio();audio.setMusic('home');},{once:true});window.addEventListener('pagehide',audio.dispose);
  const main = document.querySelector('.menu-shell');
  const panel = document.createElement('section'); panel.className='lobby-panel'; panel.hidden=true; main.appendChild(panel);
  const notice=document.createElement('p'); notice.className='lobby-notice'; notice.setAttribute('role','status'); main.appendChild(notice);
  const profileBar=document.createElement('div'); profileBar.className='profile-bar'; main.appendChild(profileBar);
  const social=document.createElement('aside'); social.className='social-panel'; social.hidden=true; main.appendChild(social);
  const loading=document.createElement('div'); loading.className='screen-layer loading-screen';
  loading.innerHTML='<div class="loading-mark" data-i18n="name"></div><progress max="3" value="0"></progress><p data-i18n="loadingSession"></p>'; document.body.appendChild(loading);
  let profile=null, current='home', actor, assets, room=null, socket=null, poll;
  const button=(key, action, extra='')=>`<button class="menu-button ${extra}" data-action="${action}" data-i18n="${key}"></button>`;
  function message(key) { notice.textContent=t(key); }
  async function busy(element, callback) {
    if(element?.disabled) return;
    if(element) { element.disabled=true; element.setAttribute('aria-busy','true'); }
    try { await callback(); } catch(error) { message(error.message); }
    finally { if(element) { element.disabled=false; element.removeAttribute('aria-busy'); } }
  }
  function renderProfile() {
    profileBar.replaceChildren();
    const label=document.createElement('span'); label.textContent=profile ? `${profile.displayName} · ${t('level')} ${profile.playerLevel} · ${profile.currency} ◈` : t('authNote'); profileBar.appendChild(label);
    const login=document.createElement('button'); login.className='menu-button'; login.dataset.action=profile ? 'logout':'login'; login.textContent=t(profile ? 'logout':'login'); profileBar.appendChild(login);
    social.hidden=!profile;
    if(actor && assets && actor.userData.kind !== (profile?.equipped || 'pistol')) {
      actor.userData.socket.remove(actor.userData.gun);
      actor.userData.gun=assets.weapon(profile?.equipped || 'pistol'); actor.userData.gun.scale.setScalar(.85); actor.userData.socket.add(actor.userData.gun); actor.userData.kind=profile?.equipped || 'pistol';
    }
  }
  function show(name) {
    current=name; panel.hidden=name==='home'; main.classList.toggle('panel-open',name!=='home');
    if(name==='home') return;
    let content='';
    if(name==='login' || name==='register') {
      content=`<form id="auth-form"><label><span data-i18n="username"></span><input name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+"><small data-i18n="usernameHint"></small></label>
      ${name==='register' ? '<label><span data-i18n="displayName"></span><input name="displayName" autocomplete="nickname" minlength="2" maxlength="24" required><small data-i18n="displayHint"></small></label>':''}
      <label><span data-i18n="password"></span><input name="password" type="password" autocomplete="${name==='login'?'current-password':'new-password'}" required minlength="10" maxlength="128"><small data-i18n="passwordHint"></small></label>
      <button class="menu-button primary" type="submit" data-i18n="${name}"></button></form>${button(name==='login'?'register':'login',name==='login'?'register':'login')}`;
    } else if(name==='play') {
      content=`<label class="difficulty-label"><select id="difficulty">${window.HordeConfig.difficulties.solo.map(d=>`<option value="${d.id}" data-i18n="${d.id}"></option>`).join('')}</select></label>`;
      if(profile) content+=profile.tutorialCompleted ? button('solo','solo','primary')+button('multiplayer','multiplayer') : `<p data-i18n="tutorialRequired"></p>${button('tutorial','tutorial','primary')}`;
      else content+=button('login','login','primary');
      if(window.HordeConfig.offlineTrial) content+=button('trial','trial')+'<small data-i18n="trialHint"></small>';
    } else if(name==='armory' || name==='market') {
      for(const [kind,w] of Object.entries(window.HordeConfig.weapons)) {
        const owned=!!profile?.weapons?.[kind];
        content+=`<article class="weapon-card"><div class="weapon-silhouette ${kind}" aria-hidden="true"><i></i><b></b><em></em></div><h3 data-i18n="${kind}"></h3><p>${w.magazine} / ${w.reserve} · ${w.damage} DMG</p>
        <p>${name==='market' ? `${w.price} ◈` : `${t('weaponExp')} ${profile?.weapons?.[kind]?.exp || 0} · Lv ${profile?.weapons?.[kind]?.level || 1}`}</p>
        ${!profile ? button('loginRequired','login') : owned ? button(profile.equipped===kind?'equipped':'equip',`equip:${kind}`,profile.equipped===kind?'selected':'') : button('buy',`buy:${kind}`)}</article>`;
      }
    } else if(name==='multiplayer') {
      content=room ? `<div id="room-members"></div>${button('readyAction','ready')}${button('startMatch','startMatch','primary')}${button('leaveRoom','leaveRoom')}` : button('createRoom','createRoom','primary');
    }
    panel.innerHTML=`<div class="panel-head"><h2 data-i18n="${name}"></h2>${button('back','home')}</div><div class="panel-content">${content}</div>`; translate(panel);
    document.getElementById('auth-form')?.addEventListener('submit',e=>{
      e.preventDefault(); const data=Object.fromEntries(new FormData(e.currentTarget));
      void busy(e.submitter,async()=>{ profile=await api(`auth/${name}`,data); renderProfile(); show('play'); await refreshSocial(); });
    });
    if(room) renderRoom(room);
  }
  function launch(mode) {
    const difficulty=document.getElementById('difficulty')?.value || 'normal';
    location.href=`./app.html?mode=${mode}&difficulty=${difficulty}${room ? `&room=${encodeURIComponent(room.id)}`:''}`;
  }
  function renderRoom(data) {
    room=data; const list=document.getElementById('room-members'); if(!list) return; list.replaceChildren();
    for(const member of data.members || []) { const line=document.createElement('p'); line.textContent=`${member.displayName} · ${t(member.ready?'ready':'waiting')}`; list.appendChild(line); }
  }
  function connectRoom() {
    socket?.close(); socket=window.HordeNetwork.connect(room.id,data=>{
      if(data.type==='room') renderRoom(data.room);
      if(data.type==='start') launch('multiplayer');
    },state=>message(state));
  }
  async function refreshSocial() {
    if(!profile || document.hidden) return;
    const data=await api('social'); social.replaceChildren();
    const heading=document.createElement('h3'); heading.textContent=t('friends'); social.appendChild(heading);
    const form=document.createElement('form'); form.innerHTML=`<input name="friend" aria-label="${t('username')}" placeholder="${t('username')}" required maxlength="24"><button class="menu-button" data-i18n="addFriend"></button>`;
    form.addEventListener('submit',e=>{e.preventDefault();void busy(form.querySelector('button'),async()=>{await api('friends',{username:new FormData(form).get('friend')});await refreshSocial();});}); social.appendChild(form);
    for(const friend of data.friends || []) {
      const row=document.createElement('div'); row.className='friend-row';
      const name=document.createElement('span'); name.textContent=`${friend.displayName} · ${t(friend.online?'online':'offline')}`; row.appendChild(name);
      const invite=document.createElement('button'); invite.className='menu-button'; invite.textContent=t('invite'); invite.disabled=!room || !friend.online; invite.title=!room?t('createRoom'):'';
      invite.addEventListener('click',()=>void busy(invite,()=>api('invites',{to:friend.id,roomId:room.id}))); row.appendChild(invite); social.appendChild(row);
    }
    for(const request of data.requests || []) {
      const row=document.createElement('div'); row.className='friend-row'; row.textContent=request.displayName;
      for(const accept of [true,false]) { const b=document.createElement('button'); b.className='menu-button'; b.textContent=t(accept?'accept':'decline'); b.onclick=()=>void busy(b,async()=>{await api('friends/respond',{id:request.id,accept});await refreshSocial();}); row.appendChild(b); } social.appendChild(row);
    }
    for(const invitation of data.invites || []) {
      const row=document.createElement('div'); row.className='invite-row'; row.textContent=`${invitation.displayName} · ${Math.max(0,Math.ceil((invitation.expiresAt-Date.now())/1000))}s`;
      for(const accept of [true,false]) { const b=document.createElement('button'); b.className='menu-button'; b.textContent=t(accept?'accept':'decline'); b.onclick=()=>void busy(b,async()=>{const result=await api('invites/respond',{id:invitation.id,accept}); if(accept){room=result;show('multiplayer');connectRoom();}await refreshSocial();});row.appendChild(b); }social.appendChild(row);
    }
    translate(social);
  }
  document.getElementById('start-game').addEventListener('click',e=>{e.preventDefault();show('play');});
  const nav=document.querySelector('.main-actions');
  nav.insertAdjacentHTML('beforeend',button('armory','armory')+button('market','market'));
  document.addEventListener('click',e=>{
    const element=e.target.closest('[data-action]'); if(!element) return;
    const [action,kind]=element.dataset.action.split(':');
    if(['home','login','register','play','armory','market','multiplayer'].includes(action)){ show(action);return; }
    void busy(element,async()=>{
      if(action==='logout'){await api('auth/logout',{});profile=null;socket?.close();room=null;renderProfile();show('home');}
      if(['trial','solo','tutorial'].includes(action))launch(action);
      if(action==='buy' || action==='equip'){profile=await api(action,{weapon:kind});renderProfile();show(current);}
      if(action==='createRoom'){room=await api('rooms',{difficulty:document.getElementById('difficulty')?.value || 'normal'});show('multiplayer');connectRoom();await refreshSocial();}
      if(action==='ready')socket?.send({type:'ready',ready:true});
      if(action==='startMatch')socket?.send({type:'start'});
      if(action==='leaveRoom'){await api(`rooms/${room.id}/leave`,{});socket?.close();room=null;show('multiplayer');}
    });
  });
  window.addEventListener('horde:language',()=>{renderProfile();if(current!=='home')show(current);void refreshSocial().catch(e=>message(e.message));});
  window.addEventListener('pagehide',()=>{clearInterval(poll);socket?.close();});
  try { profile=await api('me'); } catch(error) { if(error.status!==401)message(error.message); }
  renderProfile(); loading.querySelector('progress').value=1; loading.querySelector('p').textContent=t('loadingEngine');
  try {
    const THREE=await import('/vendor/three.module.js'); const { createAssets }=await import('./models.js'); assets=createAssets(THREE);
    loading.querySelector('progress').value=2; loading.querySelector('p').textContent=t('loadingScene');
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x17201e);scene.fog=new THREE.Fog(0x17201e,8,32);
    const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,80);camera.position.set(2.8,1.6,4.5);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.domElement.className='lobby-canvas';document.body.prepend(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd4e6e2,0x535a46,3));const sun=new THREE.DirectionalLight(0xf6d1a0,3);sun.position.set(3,5,2);scene.add(sun);
    const rim=new THREE.PointLight(0x87b5c1,12,12);rim.position.set(-2,2,-2);scene.add(rim);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:0x434944,roughness:.97}));ground.rotation.x=-Math.PI/2;scene.add(ground);
    for(let i=0;i<12;i++){const x=(i%6-3)*3.5;const h=3+i%4;assets.box(scene,[2.8,h,3],[x,h/2,-6-Math.floor(i/6)*6],assets.materials.dark);for(let y=1;y<h;y++)assets.box(scene,[.55,.7,.05],[x+.5,y,-4.48-Math.floor(i/6)*6],assets.materials.cloth);}
    for(let i=0;i<5;i++){assets.box(scene,[.8,.6,.7],[-1.8-i*.7,.3,-1.5],assets.materials.cloth);}
    actor=assets.player(profile?.equipped || 'pistol');actor.rotation.y=Math.PI+.25;scene.add(actor);
    const target=new THREE.Vector3(0,1,0);let previous=performance.now(),time=0,px=0,py=0;
    document.addEventListener('pointermove',e=>{px=(e.clientX/innerWidth-.5)*.2;py=(e.clientY/innerHeight-.5)*.1;});
    function frame(now){requestAnimationFrame(frame);const settings=window.DeadSectorSettings.load();const interval=1000/Math.min(settings.fps,60);if(now-previous<interval)return;const dt=Math.min((now-previous)/1000,.1);previous=now;if(document.hidden)return;time+=dt;
      assets.animatePlayer(actor,dt,time);const x=current==='armory'?1.5:2.8;camera.position.x+=(x+px-camera.position.x)*(1-Math.exp(-3*dt));camera.position.y+=(1.6+py-camera.position.y)*(1-Math.exp(-3*dt));camera.lookAt(target);renderer.render(scene,camera);}
    window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});requestAnimationFrame(frame);
    loading.querySelector('progress').value=3;loading.classList.add('fade-out');setTimeout(()=>loading.remove(),320);
  } catch(error){loading.querySelector('p').textContent=t('startupError');loading.insertAdjacentHTML('beforeend',button('retry','reloadPage'));loading.querySelector('button').onclick=()=>location.reload();message('startupError');console.error(error);}
  translate();
  if(profile)void refreshSocial().catch(e=>message(e.message));
  poll=setInterval(()=>void refreshSocial().catch(e=>message(e.message)),10000);
})();
