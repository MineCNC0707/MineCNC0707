// Shared procedural assets for the lobby, viewmodel and remote players.
export function createAssets(THREE) {
  const materials = {
    metal: new THREE.MeshStandardMaterial({ color:0x626d70, metalness:0.35, roughness:0.3 }),
    dark: new THREE.MeshStandardMaterial({ color:0x333d3b, metalness:0.2, roughness:0.6 }),
    cloth: new THREE.MeshStandardMaterial({ color:0x48564a, roughness:0.94 }),
    leather: new THREE.MeshStandardMaterial({ color:0x242a25, roughness:0.85 }),
    skin: new THREE.MeshStandardMaterial({ color:0xa1846c, roughness:0.88 }),
    wood: new THREE.MeshStandardMaterial({ color:0x68412b, roughness:0.7 })
  };
  function box(parent, size, position, mat = materials.metal) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); m.position.set(...position); parent.add(m); m.castShadow = true; return m;
  }
  function cylinder(parent, radius, length, position, mat = materials.dark) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,10), mat); m.rotation.x = Math.PI/2; m.position.set(...position); parent.add(m); return m;
  }
  function weapon(kind = 'pistol') {
    const group = new THREE.Group();
    const rifle = kind === 'ak47';
    const slide = box(group, rifle ? [.14,.15,.53] : [.11,.12,.31], [0,0,rifle ? -.2 : -.11]);
    const grip = box(group,[.1,.22,.12],[0,-.15,.02], materials.dark); grip.rotation.x = -.22;
    const magazine = box(group,rifle ? [.105,.3,.17] : [.07,.18,.09],[0,rifle ? -.22 : -.16,rifle ? -.19 : .02],materials.dark);
    magazine.rotation.x = rifle ? -.18 : -.22;
    cylinder(group, rifle ? .024 : .023, rifle ? .5 : .12, [0,0,rifle ? -.67 : -.3]);
    box(group,[.023,.04,.025],[0,.082,rifle ? -.85 : -.24],materials.dark);
    box(group,[.065,.025,.025],[0,.075,.02],materials.dark);
    const bolt = box(group,[.08,.025,.035],[.075,0,-.15],materials.dark);
    if (rifle) {
      box(group,[.15,.13,.27],[0,-.02,-.47],materials.wood);
      box(group,[.1,.16,.29],[0,-.035,.2],materials.wood);
    }
    const flash = new THREE.Mesh(new THREE.ConeGeometry(.07,.15,6),new THREE.MeshBasicMaterial({color:0xffbd69,transparent:true,opacity:.9}));
    flash.rotation.x = -Math.PI/2; flash.position.z = rifle ? -.95 : -.4; flash.visible = false; group.add(flash);
    group.userData = { kind, slide, magazine, bolt, flash, magazineY:magazine.position.y };
    return group;
  }
  function hand(parent, side) {
    const group = new THREE.Group(); parent.add(group);
    const forearm = cylinder(group,.047,.36,[0,-.045,.18],materials.cloth); forearm.rotation.z = side*.15;
    box(group,[.09,.075,.1],[0,0,-.025],materials.leather);
    for (let i=0;i<4;i++) {
      const finger = cylinder(group,.009,.067,[-.03+i*.02,-.015,-.085],materials.leather); finger.rotation.x = .35;
    }
    const thumb = cylinder(group,.014,.06,[side*.046,.015,-.025],materials.leather); thumb.rotation.z=side*.7;
    return group;
  }
  function viewmodel(kind) {
    const group = weapon(kind), rifle = kind === 'ak47';
    const right = hand(group,1); right.position.set(.06,-.14,.06);
    const left = hand(group,-1); left.position.set(-.065,rifle ? -.1 : -.14,rifle ? -.43 : -.04);
    left.rotation.z = rifle ? -.3 : -.13;
    group.userData.rightHand = right; group.userData.leftHand = left; group.userData.leftHome = left.position.clone();
    return group;
  }
  function player(kind = 'pistol') {
    const group = new THREE.Group();
    const body = new THREE.Group(); body.position.y=1.13; group.add(body);
    box(body,[.48,.56,.28],[0,0,0],materials.cloth);
    box(body,[.42,.36,.09],[0,.03,-.17],materials.leather);
    for (const x of [-.13,0,.13]) box(body,[.1,.17,.07],[x,-.06,-.23],materials.cloth);
    const head = new THREE.Group(); head.position.y=.48; body.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.145,14,12),materials.skin); skull.scale.set(.85,1.12,.94); head.add(skull);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(.16,14,10,0,Math.PI*2,0,Math.PI*.58),materials.dark); helmet.position.y=.055; head.add(helmet);
    box(head,[.19,.055,.04],[0,.015,-.14],materials.dark);
    const legs = [], arms = [];
    for (const side of [-1,1]) {
      const leg = new THREE.Group(); leg.position.set(side*.135,.86,0); group.add(leg);
      box(leg,[.19,.68,.23],[0,-.32,0],materials.cloth); box(leg,[.205,.13,.32],[0,-.78,-.035],materials.dark); legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side*.28,.17,0); body.add(arm);
      const upper = cylinder(arm,.075,.28,[0,-.1,-.11],materials.cloth); upper.rotation.x=.65;
      const lower = cylinder(arm,.06,.3,[side*-.04,-.22,-.27],materials.cloth); lower.rotation.x=1.35;
      box(arm,[.1,.075,.1],[side*-.05,-.25,-.39],materials.leather); arms.push(arm);
    }
    const socket = new THREE.Group(); socket.position.set(.2,-.08,-.39); body.add(socket);
    const gun = weapon(kind); gun.scale.setScalar(.85); socket.add(gun);
    group.userData = { body, head, legs, arms, socket, gun, kind, phase:Math.random()*6 };
    return group;
  }
  function animatePlayer(model, dt, time, state={}) {
    const r = model.userData, moving = state.moving || false;
    const walk = time*(state.sprint ? 11 : 7)+r.phase;
    r.body.position.y=1.13+Math.sin(time*1.7+r.phase)*.009+(moving ? Math.abs(Math.sin(walk))*.025 : 0);
    r.head.rotation.y=Math.sin(time*.5+r.phase)*.04;
    r.body.rotation.x=(state.ads ? -.05 : 0)+(state.fire ? .025 : 0);
    for (let i=0;i<2;i++) r.legs[i].rotation.x=moving ? Math.sin(walk+i*Math.PI)*.42 : 0;
    r.socket.rotation.x = (state.reload ? -.45 : 0) + (state.fire ? .06 : 0);
    r.arms[0].rotation.x = state.reload ? -.55 : 0;
    r.gun.userData.flash.visible=!!state.fire;
    r.body.rotation.z=Math.sin(time*.8+r.phase)*.008;
  }
  return { materials, box, cylinder, weapon, viewmodel, player, animatePlayer };
}
