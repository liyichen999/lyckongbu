import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createWallTexture, createFloorTexture, createBloodTexture, createNoteTexture } from './textures.js';

// ================== 音频 ==================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
  if(!audioCtx) audioCtx = new AudioCtx();
  if(audioCtx.state === 'suspended') audioCtx.resume();
}
function sfx(freq, type, dur, vol=0.1) {
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+dur+0.05);
}
let ambientGain, ambientOsc;
function startAmbient() {
  if(!audioCtx) return;
  ambientOsc = audioCtx.createOscillator();
  ambientGain = audioCtx.createGain();
  ambientOsc.type='sine'; ambientOsc.frequency.value=36;
  ambientGain.gain.value=0.05;
  ambientOsc.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  ambientOsc.start();
}
function stopAmbient() { try{ambientOsc.stop();}catch(e){} }

// ================== 场景初始化 ==================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040404, 0.015);
scene.background = new THREE.Color(0x040404);

const camera = new THREE.PerspectiveCamera(68, innerWidth/innerHeight, 0.1, 50);
camera.position.set(0, 1.7, 5);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);

// DOM元素
const introScreen = document.getElementById('introScreen');
const hud = document.getElementById('hud');
const deathScreen = document.getElementById('deathScreen');
const winScreen = document.getElementById('winScreen');
const messageEl = document.getElementById('message');
const bloodOverlay = document.getElementById('bloodOverlay');
const noteHud = document.getElementById('noteHud');
const objectiveEl = document.getElementById('objective');

// ================== 游戏状态 ==================
let gameStarted = false, gameOver = false;
let keysCollected = 0, totalKeys = 3;
let flashlightOn = true, battery = 100;
let playerHealth = 100;
let lastFootstep = 0, lastHeartbeat = 0;
let shakeAmount = 0;
const playerRadius = 0.4;
let nearNote = null;

// ================== 纹理 ==================
const wallTex = createWallTexture();
const floorTex = createFloorTexture();
const bloodTex = createBloodTexture();
const noteTex1 = createNoteTexture('调查员笔记 #3\n它们害怕光，但更恨光。\n钥匙在痛苦的房间。\n地下室入口在停尸房。');
const noteTex2 = createNoteTexture('病人日记\n护士长总是半夜尖叫。\n她说墙里有眼睛。');
const noteTex3 = createNoteTexture('院长的忏悔\n我打开了不该开的门。\n愿上帝宽恕我们。');

const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness:0.85 });
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness:0.75 });
const ceilingMat = new THREE.MeshStandardMaterial({ color:0x3a3a3a, roughness:0.9 });
const bloodMat = new THREE.MeshStandardMaterial({ map: bloodTex, roughness:0.8, transparent:true, opacity:0.7, depthWrite:false });

// ================== 碰撞系统 ==================
const colliders = [];
function addCollider(meshOrFunc) {
  if(typeof meshOrFunc === 'function') {
    const box = meshOrFunc();
    colliders.push({ min:box.min.clone(), max:box.max.clone() });
  } else {
    const box = new THREE.Box3().setFromObject(meshOrFunc);
    colliders.push({ min:box.min.clone(), max:box.max.clone() });
  }
}
function boxCollider(x,y,z,w,h,d) {
  const half = new THREE.Vector3(w/2,h/2,d/2);
  colliders.push({
    min: new THREE.Vector3(x-half.x, y-half.y, z-half.z),
    max: new THREE.Vector3(x+half.x, y+half.y, z+half.z)
  });
}

// ================== 世界构建（三层结构） ==================
const world = new THREE.Group();
scene.add(world);

function wall(x,y,z,w,h,d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
  m.position.set(x,y,z); m.castShadow=m.receiveShadow=true;
  world.add(m); boxCollider(x,y,z,w,h,d);
}

const CH = 3.2;

// --- 一层：主走廊与病房区 ---
const CW = 3.2, CL = 18;
wall(0,0,0, CW,0.15, CL); // floor
wall(0,CH,0, CW,0.15, CL); // ceiling
wall(-CW/2, CH/2, 0, 0.2, CH, CL);
wall(CW/2, CH/2, 0, 0.2, CH, CL);
wall(0, CH/2, -CL/2, CW, CH, 0.2);

// 左侧病房
const r1x = -4.2, r1z = -4, r1w=4.2, r1d=6;
wall(r1x,0,r1z, r1w,0.15,r1d);
wall(r1x,CH,r1z, r1w,0.15,r1d);
wall(r1x-r1w/2, CH/2, r1z, 0.2,CH,r1d);
wall(r1x+r1w/2, CH/2, r1z, 0.2,CH,r1d);
wall(r1x, CH/2, r1z-r1d/2, r1w,CH,0.2);

// 右侧手术室
const r2x = 4.2, r2z = 3.5, r2w=4.2, r2d=5.5;
wall(r2x,0,r2z, r2w,0.15,r2d);
wall(r2x,CH,r2z, r2w,0.15,r2d);
wall(r2x-r2w/2, CH/2, r2z, 0.2,CH,r2d);
wall(r2x+r2w/2, CH/2, r2z, 0.2,CH,r2d);
wall(r2x, CH/2, r2z+r2d/2, r2w,CH,0.2);

// --- 二层：走廊延伸至停尸房（地下室入口） ---
const morgueZ = -CL/2 - 3;
wall(0,0,morgueZ, CW,0.15, 5);
wall(0,CH,morgueZ, CW,0.15, 5);
wall(-CW/2, CH/2, morgueZ, 0.2,CH,5);
wall(CW/2, CH/2, morgueZ, 0.2,CH,5);
wall(0, CH/2, morgueZ-2.5, CW,CH,0.2);

// --- 三层：地下室（通过停尸房活板门进入） ---
const basementY = -3.2;
const baseGroup = new THREE.Group();
baseGroup.position.set(0, basementY, morgueZ-4);
const BW = 4.5, BH = 2.8, BL = 7;
const baseWallMat = new THREE.MeshStandardMaterial({ color:0x2a2a2a, roughness:0.9 });
function bwall(x,y,z,w,h,d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), baseWallMat);
  m.position.set(x,y,z); m.castShadow=m.receiveShadow=true;
  baseGroup.add(m);
  // 碰撞体需转换到世界坐标
  const worldPos = m.position.clone().add(baseGroup.position);
  boxCollider(worldPos.x, worldPos.y, worldPos.z, w, h, d);
}
bwall(0,0,0, BW,0.1, BL);
bwall(0,BH,0, BW,0.1, BL);
bwall(-BW/2, BH/2, 0, 0.2, BH, BL);
bwall(BW/2, BH/2, 0, 0.2, BH, BL);
bwall(0, BH/2, -BL/2, BW, BH, 0.2);
world.add(baseGroup);

// 地下室活板门（可交互）
const trapdoor = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.05,0.8), new THREE.MeshStandardMaterial({color:0x4a3a2a}));
trapdoor.position.set(0,0.05, morgueZ-1.5);
trapdoor.rotation.x = -Math.PI/2;
world.add(trapdoor);
trapdoor.userData.isTrapdoor = true;

// ================== 模型与家具 ==================
// 病床
function bed(x,y,z) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({color:0x5a5a5a, roughness:0.4, metalness:0.7});
  for(let ix of[-0.7,0.7]) for(let iz of[-1.1,1.1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.5,6), m);
    leg.position.set(ix,0.25,iz); g.add(leg);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.06,2.4), m);
  frame.position.set(0,0.5,0); g.add(frame);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.14,2.2), new THREE.MeshStandardMaterial({color:0x9a8a7a}));
  mattress.position.set(0,0.6,0); g.add(mattress);
  g.position.set(x,y,z);
  world.add(g); addCollider(g);
}
bed(r1x-0.5,0,r1z-1);
bed(r1x+0.8,0,r1z+1.2);

// 手术台
const opTable = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.1,2.6), new THREE.MeshStandardMaterial({color:0x7a7a7a, roughness:0.3, metalness:0.9}));
opTable.position.set(r2x,0.8,r2z-0.2);
world.add(opTable); addCollider(opTable);

// 轮椅（可移动动画）
const wheelchair = new THREE.Group();
const wMat = new THREE.MeshStandardMaterial({color:0x4a4a4a, roughness:0.5, metalness:0.8});
const wheelGeo = new THREE.TorusGeometry(0.22,0.04,6,10);
for(let ix of[-0.45,0.45]) {
  const w = new THREE.Mesh(wheelGeo, wMat);
  w.rotation.x=Math.PI/2; w.position.set(ix,0.25,0); wheelchair.add(w);
}
const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.8,6), wMat);
frame.position.set(-0.4,0.6,0.2); wheelchair.add(frame);
frame.clone().position.set(0.4,0.6,0.2); wheelchair.add(frame.clone());
const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.05,0.5), wMat);
seat.position.set(0,0.5,0.2); wheelchair.add(seat);
wheelchair.position.set(r1x+1.5,0,r1z-0.8);
world.add(wheelchair); addCollider(wheelchair);

// 笔记（可交互）
function addNote(x,y,z,tex) {
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.2), new THREE.MeshBasicMaterial({map:tex}));
  note.position.set(x,y,z);
  note.userData.isNote = true;
  world.add(note);
  return note;
}
const note1 = addNote(r1x, 1.2, r1z+1.8, noteTex1);
const note2 = addNote(r2x-0.8, 1.0, r2z-0.5, noteTex2);
const note3 = addNote(0, 0.9, morgueZ-0.8, noteTex3);

// 钥匙
const keys = [];
function key(x,y,z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:0xe0c060, roughness:0.3, metalness:0.7, emissive:0x332200});
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.06,8), mat));
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.4,0.04), mat);
  shaft.position.y=-0.22; g.add(shaft);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.05,0.04), mat);
  tooth.position.set(0.03,-0.36,0); g.add(tooth);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15,6,6), new THREE.MeshBasicMaterial({color:0xffdd88, transparent:true, opacity:0.6})));
  g.position.set(x,y,z); g.userData.isKey=true;
  world.add(g); keys.push(g);
}
key(r1x-1.2, 0.85, r1z-2.5);
key(r2x+1.2, 0.9, r2z+2.2);
key(1.1, 0.7, morgueZ-3.8); // 地下室

// ================== 灯光 ==================
const flashlight = new THREE.SpotLight(0xffeedd);
flashlight.angle=0.4; flashlight.penumbra=0.3; flashlight.decay=1.5; flashlight.distance=16;
flashlight.intensity=1.5; flashlight.castShadow=true;
flashlight.shadow.mapSize.set(512,512);
camera.add(flashlight);
flashlight.target.position.set(0,0,-1.5); camera.add(flashlight.target);

scene.add(new THREE.AmbientLight(0x0a0a18, 0.25));
const flickerLights = [];
for(let i=0;i<8;i++) {
  const l = new THREE.PointLight(0xcc9966, 0.5, 8, 1.5);
  l.position.set(0, CH-0.3, -CL/2+1.5 + i*2.3);
  world.add(l);
  flickerLights.push({light:l, base:0.5});
}

// ================== 幽灵 ==================
const ghost = new THREE.Group();
const gMat = new THREE.MeshStandardMaterial({color:0x1a2a1a, roughness:0.3, transparent:true, opacity:0.55, emissive:0x0a1a0a});
ghost.add(new THREE.Mesh(new THREE.ConeGeometry(0.5,1.7,8), gMat)).position.y=0.85;
ghost.add(new THREE.Mesh(new THREE.SphereGeometry(0.35,8,6), gMat)).position.y=1.75;
const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshBasicMaterial({color:0xff2200}));
eye.position.set(-0.12,1.8,0.28); ghost.add(eye);
eye.clone().position.set(0.12,1.8,0.28); ghost.add(eye);
ghost.position.set(2,0,-3);
world.add(ghost);
const ghostAI = {
  pos: new THREE.Vector3(2,0,-3),
  patrol: [new THREE.Vector3(2,0,-5), new THREE.Vector3(-2,0,-1), new THREE.Vector3(4,0,2), new THREE.Vector3(-4,0,-3)],
  idx:0, chase:false, speed:0.55, chaseSpeed:2.5, lastScare:0
};

// ================== 交互逻辑 ==================
function showMessage(text, dur=2.5) {
  messageEl.textContent=text; messageEl.style.opacity=1;
  clearTimeout(window._msgT); window._msgT=setTimeout(()=>messageEl.style.opacity=0, dur*1000);
}
function updateHUD() {
  document.getElementById('keyHud').textContent = `🔑 钥匙 ${keysCollected}/${totalKeys}`;
  document.getElementById('healthHud').textContent = `❤️ 理智 ${Math.floor(playerHealth)}`;
  document.getElementById('batteryHud').textContent = `🔋 手电筒 ${Math.floor(battery)}%`;
  if(playerHealth<30) document.getElementById('healthHud').classList.add('danger');
  else document.getElementById('healthHud').classList.remove('danger');
  if(battery<20) document.getElementById('batteryHud').classList.add('danger');
  else document.getElementById('batteryHud').classList.remove('danger');
  if(keysCollected>=totalKeys) objectiveEl.textContent='🚪 前往地下室活板门！';
}
function checkCollision(pos) {
  for(const c of colliders) {
    if(pos.x+playerRadius > c.min.x && pos.x-playerRadius < c.max.x &&
       pos.y+0.25 > c.min.y && pos.y-1.5 < c.max.y &&
       pos.z+playerRadius > c.min.z && pos.z-playerRadius < c.max.z) return true;
  }
  return false;
}
function interact() {
  if(!gameStarted||gameOver) return;
  const p = camera.position;
  // 钥匙
  for(let i=keys.length-1;i>=0;i--) {
    if(p.distanceTo(keys[i].position)<2.2) {
      world.remove(keys[i]); keys.splice(i,1); keysCollected++;
      sfx(660,'sine',0.15); sfx(880,'sine',0.2);
      showMessage(`🔑 找到钥匙！(${keysCollected}/${totalKeys})`);
      updateHUD(); return;
    }
  }
  // 笔记
  for(const note of [note1,note2,note3]) {
    if(note && p.distanceTo(note.position)<2.0) {
      showMessage('你阅读了笔记...', 3);
      sfx(400,'sine',0.3);
      break;
    }
  }
  // 活板门（需钥匙）
  if(p.distanceTo(trapdoor.position)<2.5) {
    if(keysCollected>=totalKeys) {
      showMessage('你打开了活板门，进入地下室...', 2);
      camera.position.set(0, basementY+1.7, morgueZ-4);
      objectiveEl.textContent='🎯 在地下室找到出路！';
    } else {
      showMessage('活板门被锁住了，需要3把钥匙');
    }
  }
  // 出口（地下室尽头）
  if(camera.position.y < -2 && p.z < morgueZ-7) {
    winScreen.style.display='flex'; gameOver=true; stopAmbient(); controls.unlock();
  }
}

// ================== 动画循环 ==================
const clock = new THREE.Clock();
let timeAccum=0;
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.15);
  timeAccum += delta;

  if(gameStarted && !gameOver && controls.isLocked) {
    // 移动
    const move = new THREE.Vector3();
    if(keyState.w) move.z-=1; if(keyState.s) move.z+=1;
    if(keyState.a) move.x-=1; if(keyState.d) move.x+=1;
    if(move.length()>0) {
      move.normalize();
      const old = camera.position.clone();
      controls.moveRight(move.x*3.8*delta);
      controls.moveForward(-move.z*3.8*delta);
      if(checkCollision(camera.position)) camera.position.copy(old);
      if(Date.now()-lastFootstep>400){sfx(70+Math.random()*30,'triangle',0.05); lastFootstep=Date.now();}
    }
    // 手电筒
    if(flashlightOn) battery-=2.5*delta;
    if(battery<=0){battery=0; flashlightOn=false; flashlight.intensity=0.03; showMessage('⚠ 手电筒没电了！');}
    else flashlight.intensity=flashlightOn?1.5:0.03;
    updateHUD();

    // 幽灵AI
    const gp = ghostAI.pos;
    const dist = gp.distanceTo(camera.position);
    ghostAI.chase = (dist<7 && flashlightOn) || dist<3.5;
    const target = ghostAI.chase ? camera.position.clone() : ghostAI.patrol[ghostAI.idx];
    const dir = new THREE.Vector3().subVectors(target, gp).normalize();
    gp.add(dir.multiplyScalar((ghostAI.chase?2.8:0.55)*delta));
    ghost.position.copy(gp);
    ghost.lookAt(camera.position.x, gp.y, camera.position.z);
    if(dist<0.85) {
      playerHealth-=60*delta;
      bloodOverlay.style.opacity=0.5;
      shakeAmount=Math.max(shakeAmount,0.3);
      if(playerHealth<=0) playerDeath();
    } else bloodOverlay.style.opacity=0;
    if(dist>7) playerHealth=Math.min(100, playerHealth+3*delta);
    if(dist<5 && Date.now()-ghostAI.lastScare>8000) {
      ghostAI.lastScare=Date.now(); sfx(180,'sawtooth',0.5); showMessage('有什么东西在靠近...',1.5);
    }
    if(dist<6 && Date.now()-lastHeartbeat>700){sfx(45,'sine',0.2); lastHeartbeat=Date.now();}
    // 轮椅动画（惊吓）
    if(dist<6 && Math.random()<0.002) {
      wheelchair.position.x += (Math.random()-0.5)*0.2;
      sfx(80,'square',0.2);
    }
    // 屏幕震动
    if(shakeAmount>0.001){
      camera.position.x+=(Math.random()-0.5)*shakeAmount*0.06;
      camera.position.y+=(Math.random()-0.5)*shakeAmount*0.04;
      shakeAmount*=Math.exp(-5*delta);
    }
  }
  // 灯光闪烁
  flickerLights.forEach(l=>l.light.intensity=l.base*(0.4+Math.sin(timeAccum*2)*0.3+Math.random()*0.2));
  renderer.render(scene, camera);
}

function playerDeath() {
  gameOver=true; deathScreen.style.display='flex'; stopAmbient(); controls.unlock();
  sfx(200,'sawtooth',0.9); sfx(40,'sawtooth',2);
}

// ================== 输入 ==================
const keyState={w:false,a:false,s:false,d:false};
document.addEventListener('keydown',e=>{
  if(!gameStarted||gameOver) return;
  switch(e.code){
    case'KeyW':keyState.w=true;break; case'KeyA':keyState.a=true;break;
    case'KeyS':keyState.s=true;break; case'KeyD':keyState.d=true;break;
    case'KeyF': if(battery>0){flashlightOn=!flashlightOn; showMessage(flashlightOn?'手电筒开启':'手电筒关闭',1);} else showMessage('没电了'); break;
    case'Space':interact(); break;
    case'KeyE': if(nearNote) showMessage('阅读笔记...',2); break;
  }
});
document.addEventListener('keyup',e=>{
  switch(e.code){case'KeyW':keyState.w=false;break;case'KeyA':keyState.a=false;break;case'KeyS':keyState.s=false;break;case'KeyD':keyState.d=false;break;}
});

// ================== 启动 ==================
document.getElementById('continueButton').addEventListener('click', ()=>{
  introScreen.style.display='none';
  hud.style.display='flex';
  gameStarted=true;
  initAudio(); startAmbient();
  showMessage('点击屏幕锁定鼠标');
  document.addEventListener('click', ()=>{
    controls.lock();
    document.removeEventListener('click', arguments.callee);
  });
  controls.addEventListener('lock', ()=>showMessage(''));
  controls.addEventListener('unlock', ()=>{
    if(gameStarted&&!gameOver) showMessage('点击屏幕重新锁定');
  });
});
document.getElementById('restartButton').addEventListener('click',()=>location.reload());
document.getElementById('restartButtonWin').addEventListener('click',()=>location.reload());

window.addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

animate();