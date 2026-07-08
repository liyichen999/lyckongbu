import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createWallTexture, createFloorTexture, createBloodTexture, createWindowRainTexture } from './textures.js';

// ================== 音频引擎（含3D空间音效） ==================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
const listener = new THREE.AudioListener();
function initAudio() {
  if(!audioCtx) audioCtx = new AudioCtx();
  if(audioCtx.state==='suspended') audioCtx.resume();
}
function playSpatialSound(buffer, loop=false, volume=0.5, refDistance=10) {
  const sound = new THREE.PositionalAudio(listener);
  sound.setBuffer(buffer);
  sound.setRefDistance(refDistance);
  sound.setLoop(loop);
  sound.setVolume(volume);
  return sound;
}
// 简单音效生成
function generateToneBuffer(freq, type, duration) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;
    switch(type) {
      case 'sine': sample = Math.sin(2*Math.PI*freq*t); break;
      case 'square': sample = Math.sign(Math.sin(2*Math.PI*freq*t)); break;
      case 'sawtooth': sample = 2*(t*freq%1)-1; break;
      case 'noise': sample = Math.random()*2-1; break;
    }
    data[i] = sample * Math.exp(-3*t); // 衰减
  }
  return buffer;
}
function sfx(freq, type, dur, vol=0.1) {
  if(!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type=type; osc.frequency.value=freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime+dur+0.05);
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

// 预生成常用音效buffer
let rainBuffer, thunderBuffer, heartbeatBuffer, scareBuffer;
function prepareBuffers() {
  if(!audioCtx) return;
  rainBuffer = generateToneBuffer(0, 'noise', 2);
  thunderBuffer = generateToneBuffer(50, 'sawtooth', 1.5);
  heartbeatBuffer = generateToneBuffer(40, 'sine', 0.3);
  scareBuffer = generateToneBuffer(200, 'square', 0.8);
}

// ================== 场景初始化 ==================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040404, 0.008);
scene.background = new THREE.Color(0x040404);
camera.add(listener);

const camera = new THREE.PerspectiveCamera(68, innerWidth/innerHeight, 0.1, 60);
camera.position.set(0, 1.7, 8);
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
const fuseHud = document.getElementById('fuseHud');
const healthHud = document.getElementById('healthHud');
const batteryHud = document.getElementById('batteryHud');
const medkitHud = document.getElementById('medkitHud');
const objectiveEl = document.getElementById('objective');

// ================== 游戏状态 ==================
let gameStarted=false, gameOver=false, fusesCollected=0, totalFuses=4;
let flashlightOn=true, battery=100, playerHealth=100, medkits=0;
let lastFootstep=0, lastHeartbeat=0, shakeAmount=0;
const playerRadius=0.4;

// ================== 纹理 ==================
const wallTex = createWallTexture();
const basementWallTex = createWallTexture('basement');
const floorTex = createFloorTexture();
const bloodTex = createBloodTexture();
const windowTex = createWindowRainTexture();

const wallMat = new THREE.MeshStandardMaterial({map:wallTex, roughness:0.85});
const bWallMat = new THREE.MeshStandardMaterial({map:basementWallTex, roughness:0.9});
const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.75});
const ceilingMat = new THREE.MeshStandardMaterial({color:0x3a3a3a, roughness:0.9});
const bloodMat = new THREE.MeshStandardMaterial({map:bloodTex, roughness:0.8, transparent:true, opacity:0.7, depthWrite:false});
const windowMat = new THREE.MeshStandardMaterial({map:windowTex, emissive:0x112233, emissiveIntensity:0.5});

// ================== 碰撞系统 ==================
const colliders = [];
function boxCollider(x,y,z,w,h,d) {
  const half = new THREE.Vector3(w/2,h/2,d/2);
  colliders.push({min:new THREE.Vector3(x-half.x,y-half.y,z-half.z), max:new THREE.Vector3(x+half.x,y+half.y,z+half.z)});
}
function addColMesh(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  colliders.push({min:box.min.clone(), max:box.max.clone()});
}

// ================== 世界构建 ==================
const world = new THREE.Group(); scene.add(world);
function createWall(x,y,z,w,h,d,mat=wallMat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z); m.castShadow=m.receiveShadow=true;
  world.add(m); boxCollider(x,y,z,w,h,d);
  return m;
}
function createFloor(x,y,z,w,d) { createWall(x,0,z,w,0.1,d,floorMat); }
function createCeiling(x,y,z,w,d) { createWall(x,3.2,z,w,0.1,d,ceilingMat); }
const CH = 3.2;

// ---- 大厅区域 ----
createFloor(0,0,0, 8,10); createCeiling(0,0,0,8,10);
createWall(-4,CH/2,0,0.2,CH,10); createWall(4,CH/2,0,0.2,CH,10);
createWall(0,CH/2,-5,8,CH,0.2);
// 入口雨窗
const win1 = new THREE.Mesh(new THREE.PlaneGeometry(2,1.5), windowMat);
win1.position.set(-3,1.5,-4.9); world.add(win1);
const win2 = win1.clone(); win2.position.set(3,1.5,-4.9); world.add(win2);

// 左侧走廊 -> 病房区
createFloor(-6,0,-10, 2,12); createCeiling(-6,0,-10,2,12);
createWall(-7,CH/2,-10,0.2,CH,12); createWall(-5,CH/2,-10,0.2,CH,12);
createWall(-6,CH/2,-16,2,CH,0.2);
// 病房1
const ward1 = {x:-8, z:-13};
createFloor(ward1.x,0,ward1.z, 3,5); createCeiling(ward1.x,0,ward1.z,3,5);
createWall(ward1.x-1.5,CH/2,ward1.z,0.2,CH,5);
createWall(ward1.x+1.5,CH/2,ward1.z,0.2,CH,5);
createWall(ward1.x,CH/2,ward1.z-2.5,3,CH,0.2);
// 床
const bed = new THREE.Group();
const bmat = new THREE.MeshStandardMaterial({color:0x5a5a5a, roughness:0.4, metalness:0.7});
for(let ix of[-0.6,0.6]) for(let iz of[-0.9,0.9]){
  const l=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.5,6),bmat);
  l.position.set(ix,0.25,iz); bed.add(l);
}
bed.add(new THREE.Mesh(new THREE.BoxGeometry(1.4,0.05,2.2),bmat)).position.y=0.5;
bed.add(new THREE.Mesh(new THREE.BoxGeometry(1.2,0.1,2),new THREE.MeshStandardMaterial({color:0x9a8a7a}))).position.y=0.58;
bed.position.set(ward1.x,0,ward1.z);
world.add(bed); addColMesh(bed);

// 右侧走廊 -> 手术区
createFloor(6,0,-10, 2,12); createCeiling(6,0,-10,2,12);
createWall(5,CH/2,-10,0.2,CH,12); createWall(7,CH/2,-10,0.2,CH,12);
createWall(6,CH/2,-16,2,CH,0.2);
const op = {x:8, z:-13};
createFloor(op.x,0,op.z,3,5); createCeiling(op.x,0,op.z,3,5);
createWall(op.x-1.5,CH/2,op.z,0.2,CH,5);
createWall(op.x+1.5,CH/2,op.z,0.2,CH,5);
createWall(op.x,CH/2,op.z-2.5,3,CH,0.2);
const optable = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.1,2.4),new THREE.MeshStandardMaterial({color:0x7a7a7a, roughness:0.3, metalness:0.9}));
optable.position.set(op.x,0.8,op.z); world.add(optable); addColMesh(optable);

// ---- 停尸房（地下室入口） ----
const morgueZ = -18;
createFloor(0,0,morgueZ, 6,4); createCeiling(0,0,morgueZ,6,4);
createWall(-3,CH/2,morgueZ,0.2,CH,4);
createWall(3,CH/2,morgueZ,0.2,CH,4);
createWall(0,CH/2,morgueZ-2,6,CH,0.2);
// 停尸柜
for(let i=0;i<3;i++){
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.4,0.8), new THREE.MeshStandardMaterial({color:0x4a4a4a, roughness:0.4, metalness:0.8}));
  drawer.position.set(-1.5+i*1.5,1.2,morgueZ-1.8); world.add(drawer); addColMesh(drawer);
}
// 地下室活板门
const trapdoor = new THREE.Mesh(new THREE.BoxGeometry(1,0.05,1), new THREE.MeshStandardMaterial({color:0x4a3a2a}));
trapdoor.position.set(0,0.05,morgueZ-1); trapdoor.rotation.x=-Math.PI/2;
world.add(trapdoor); trapdoor.userData.isTrapdoor=true;

// ---- 地下室 ----
const basementGroup = new THREE.Group();
basementGroup.position.set(0, -4, morgueZ-5);
const bmatWall = bWallMat;
function bwall(x,y,z,w,h,d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), bmatWall);
  m.position.set(x,y,z); basementGroup.add(m);
  const wp = m.position.clone().add(basementGroup.position);
  boxCollider(wp.x,wp.y,wp.z,w,h,d);
}
bwall(0,0,0, 5,0.1,8); bwall(0,2.8,0,5,0.1,8);
bwall(-2.5,1.4,0,0.2,2.8,8); bwall(2.5,1.4,0,0.2,2.8,8);
bwall(0,1.4,-4,5,2.8,0.2);
world.add(basementGroup);
// 发电机（出口）
const generator = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,1.2,8), new THREE.MeshStandardMaterial({color:0x6a6a6a, roughness:0.5, metalness:0.7}));
generator.position.set(0, -4+0.6, morgueZ-9);
world.add(generator); generator.userData.isGenerator=true;

// ================== 物品：保险丝（带光柱） ==================
const fuses = [];
function createFuse(x,y,z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:0xccaa44, roughness:0.3, metalness:0.8, emissive:0x332200});
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.2,8), mat));
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.15,0.6,6), new THREE.MeshBasicMaterial({color:0xffcc88, transparent:true, opacity:0.5, depthWrite:false}));
  glow.position.y=0.4; g.add(glow);
  g.position.set(x,y,z); g.userData.isFuse=true; g.userData.baseY=y;
  world.add(g); fuses.push(g);
}
createFuse(ward1.x, 0.8, ward1.z-1.8);  // 病房
createFuse(op.x, 0.9, op.z-1.6);       // 手术室
createFuse(-2, 0.7, morgueZ);          // 停尸房
createFuse(1.5, -4+0.8, morgueZ-7);    // 地下室

// 医疗包
const medkitMeshes = [];
function createMedkit(x,y,z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:0xcc3333, roughness:0.6});
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3,0.2,0.2), mat));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05,0.1,0.1), new THREE.MeshStandardMaterial({color:0xffffff})));
  g.position.set(x,y,z); g.userData.isMedkit=true;
  world.add(g); medkitMeshes.push(g);
}
createMedkit(ward1.x+0.8, 0.5, ward1.z+0.5);
createMedkit(op.x-0.8, 0.5, op.z+0.5);

// 笔记
const notes = [];
function addNote(x,y,z,tex) {
  const n = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.2), new THREE.MeshBasicMaterial({map:tex}));
  n.position.set(x,y,z); n.userData.isNote=true; world.add(n); notes.push(n);
}
import { createNoteTexture } from './textures.js';
addNote(ward1.x,1.2,ward1.z+1.5, createNoteTexture('调查员笔记\n保险丝被它们藏在\n各处。注意身后。'));
addNote(op.x-1,1.0,op.z, createNoteTexture('手术日志\n病人死前都提到了\n"影子"。'));
addNote(0,1.1,morgueZ-0.5, createNoteTexture('停尸房值班记录\n今晚又多了三具。'));

// ================== 灯光与天气 ==================
const flashlight = new THREE.SpotLight(0xffeedd);
flashlight.angle=0.4; flashlight.penumbra=0.3; flashlight.decay=1.5; flashlight.distance=18;
flashlight.intensity=1.6; flashlight.castShadow=true;
flashlight.shadow.mapSize.set(512,512);
camera.add(flashlight);
flashlight.target.position.set(0,0,-1.5); camera.add(flashlight.target);

scene.add(new THREE.AmbientLight(0x0a0a18, 0.2));
const flickerLights = [];
for(let i=0;i<12;i++) {
  const l = new THREE.PointLight(0xcc9966, 0.4, 7, 1.5);
  l.position.set((Math.random()-0.5)*10, CH-0.3, (Math.random()-0.5)*20);
  world.add(l); flickerLights.push(l);
}
// 窗户闪电
let lightningTimer=0;
function triggerLightning() {
  const l = new THREE.PointLight(0xffffff, 2, 15, 2);
  l.position.set(0,5,-4); world.add(l);
  setTimeout(()=>world.remove(l), 150);
  sfx(30,'sawtooth',0.5,0.15);
}

// 下雨声
let rainSound;
function startRain() {
  if(!audioCtx||!rainBuffer) return;
  rainSound = playSpatialSound(rainBuffer, true, 0.2, 8);
  rainSound.position.set(0,5,-5);
  world.add(rainSound);
}

// ================== 幽灵AI（更狡猾） ==================
const ghost = new THREE.Group();
const gMat = new THREE.MeshStandardMaterial({color:0x1a2a1a, roughness:0.3, transparent:true, opacity:0.5, emissive:0x0a1a0a});
ghost.add(new THREE.Mesh(new THREE.ConeGeometry(0.45,1.7,8), gMat)).position.y=0.85;
ghost.add(new THREE.Mesh(new THREE.SphereGeometry(0.33,8,6), gMat)).position.y=1.75;
const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshBasicMaterial({color:0xff2200}));
eye.position.set(-0.12,1.8,0.28); ghost.add(eye);
eye.clone().position.set(0.12,1.8,0.28); ghost.add(eye);
ghost.position.set(2,0,-5);
world.add(ghost);
const ghostAI = {
  pos: new THREE.Vector3(2,0,-5),
  patrol: [new THREE.Vector3(2,0,-8), new THREE.Vector3(-3,0,-4), new THREE.Vector3(5,0,0), new THREE.Vector3(-5,0,-10)],
  idx:0, chase:false, speed:0.5, chaseSpeed:2.4, lastScare:0, stuckTimer:0
};

// ================== 游戏逻辑 ==================
function showMessage(text, dur=2.5) {
  messageEl.textContent=text; messageEl.style.opacity=1;
  clearTimeout(window._msgT); window._msgT=setTimeout(()=>messageEl.style.opacity=0, dur*1000);
}
function updateHUD() {
  fuseHud.textContent = `⚡ 保险丝 ${fusesCollected}/${totalFuses}`;
  healthHud.textContent = `❤️ 血量 ${Math.floor(playerHealth)}`;
  batteryHud.textContent = `🔋 手电筒 ${Math.floor(battery)}%`;
  medkitHud.textContent = `💊 医疗包 ${medkits}`;
  if(playerHealth<30) healthHud.classList.add('danger'); else healthHud.classList.remove('danger');
  if(battery<20) batteryHud.classList.add('danger'); else batteryHud.classList.remove('danger');
  if(fusesCollected>=totalFuses) objectiveEl.textContent='🚪 去地下室启动发电机！';
}
function checkCollision(pos) {
  for(const c of colliders) {
    if(pos.x+playerRadius>c.min.x && pos.x-playerRadius<c.max.x &&
       pos.y+0.25>c.min.y && pos.y-1.5<c.max.y &&
       pos.z+playerRadius>c.min.z && pos.z-playerRadius<c.max.z) return true;
  }
  return false;
}
function interact() {
  if(!gameStarted||gameOver) return;
  const p = camera.position;
  // 捡保险丝
  for(let i=fuses.length-1;i>=0;i--) {
    if(p.distanceTo(fuses[i].position)<2.5) {
      world.remove(fuses[i]); fuses.splice(i,1); fusesCollected++;
      sfx(660,'sine',0.15); sfx(880,'sine',0.2);
      showMessage(`⚡ 保险丝 (${fusesCollected}/${totalFuses})`);
      updateHUD(); return;
    }
  }
  // 捡医疗包
  for(let i=medkitMeshes.length-1;i>=0;i--) {
    if(p.distanceTo(medkitMeshes[i].position)<2.0) {
      world.remove(medkitMeshes[i]); medkitMeshes.splice(i,1); medkits++;
      showMessage('💊 获得医疗包，按Q使用');
      return;
    }
  }
  // 活板门
  if(p.distanceTo(trapdoor.position)<2.5) {
    if(fusesCollected>=totalFuses) {
      showMessage('你打开了活板门，进入地下室...');
      camera.position.set(0, -4+1.7, morgueZ-4);
      objectiveEl.textContent='🎯 找到地下室发电机并按E启动';
    } else showMessage(`活板门锁着，需要${totalFuses-fusesCollected}个保险丝`);
  }
  // 发电机
  if(camera.position.y<-3 && p.distanceTo(generator.position)<2.5) {
    winScreen.style.display='flex'; gameOver=true; stopAmbient(); controls.unlock();
  }
}
function useMedkit() {
  if(medkits>0 && playerHealth<100) {
    playerHealth=Math.min(100, playerHealth+40); medkits--;
    showMessage('使用了医疗包');
    updateHUD();
  }
}
function playerDeath() {
  if(gameOver) return;
  gameOver=true; deathScreen.style.display='flex'; stopAmbient(); controls.unlock();
  sfx(200,'sawtooth',0.9); sfx(40,'sawtooth',2);
}

// ================== 动画循环 ==================
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(),0.15);
  if(gameStarted&&!gameOver&&controls.isLocked) {
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
      if(Date.now()-lastFootstep>400){sfx(70+Math.random()*30,'triangle',0.04); lastFootstep=Date.now();}
    }
    // 手电筒
    if(flashlightOn) battery-=2.5*delta;
    if(battery<=0){battery=0; flashlightOn=false; flashlight.intensity=0.03; showMessage('⚠ 手电筒没电了！');}
    else flashlight.intensity=flashlightOn?1.6:0.03;
    updateHUD();

    // 闪电
    lightningTimer+=delta;
    if(lightningTimer>8 && Math.random()<0.03) { triggerLightning(); lightningTimer=0; }

    // 幽灵AI
    const gp = ghostAI.pos;
    const dist = gp.distanceTo(camera.position);
    ghostAI.chase = (dist<9 && flashlightOn) || dist<4;
    const target = ghostAI.chase ? camera.position.clone() : ghostAI.patrol[ghostAI.idx];
    const dir = new THREE.Vector3().subVectors(target, gp).normalize();
    gp.add(dir.multiplyScalar((ghostAI.chase?2.4:0.5)*delta));
    ghost.position.copy(gp);
    ghost.lookAt(camera.position.x, gp.y, camera.position.z);
    if(dist<0.9) {
      playerHealth -= 35*delta;
      bloodOverlay.style.opacity=0.5;
      shakeAmount=Math.max(shakeAmount,0.2);
      if(playerHealth<=0) playerDeath();
    } else bloodOverlay.style.opacity=0;
    if(dist>10) playerHealth=Math.min(100, playerHealth+5*delta);
    if(dist<7&&Date.now()-ghostAI.lastScare>7000){ghostAI.lastScare=Date.now(); sfx(180,'sawtooth',0.5); showMessage('有什么东西在靠近...',1.5);}
    if(dist<8&&Date.now()-lastHeartbeat>800){sfx(45,'sine',0.2); lastHeartbeat=Date.now();}

    // 物品浮动动画
    [...fuses, ...medkitMeshes].forEach(obj => {
      if(obj.userData.baseY!==undefined) obj.position.y = obj.userData.baseY + Math.sin(Date.now()*0.005)*0.1;
    });

    // 屏幕震动
    if(shakeAmount>0.001){
      camera.position.x+=(Math.random()-0.5)*shakeAmount*0.05;
      camera.position.y+=(Math.random()-0.5)*shakeAmount*0.03;
      shakeAmount*=Math.exp(-5*delta);
    }
  }
  flickerLights.forEach(l=>l.intensity=0.3+Math.sin(Date.now()*0.003)*0.2+Math.random()*0.2);
  renderer.render(scene,camera);
}

// ================== 输入 ==================
const keyState={w:false,a:false,s:false,d:false};
document.addEventListener('keydown',e=>{
  if(!gameStarted||gameOver) return;
  switch(e.code){
    case'KeyW':keyState.w=true;break; case'KeyA':keyState.a=true;break;
    case'KeyS':keyState.s=true;break; case'KeyD':keyState.d=true;break;
    case'KeyF':if(battery>0){flashlightOn=!flashlightOn; showMessage(flashlightOn?'手电筒开启':'手电筒关闭');} else showMessage('没电了'); break;
    case'Space':interact();break;
    case'KeyQ':useMedkit();break;
    case'KeyE':interact();break; // 发电机
  }
});
document.addEventListener('keyup',e=>{
  switch(e.code){case'KeyW':keyState.w=false;break;case'KeyA':keyState.a=false;break;case'KeyS':keyState.s=false;break;case'KeyD':keyState.d=false;break;}
});

// ================== 启动 ==================
document.getElementById('continueButton').addEventListener('click',()=>{
  introScreen.style.display='none'; hud.style.display='flex'; gameStarted=true;
  initAudio(); prepareBuffers(); startAmbient(); startRain();
  showMessage('点击屏幕锁定鼠标，开始探索');
  document.addEventListener('click',()=>{controls.lock(); document.removeEventListener('click',arguments.callee);});
  controls.addEventListener('lock',()=>showMessage(''));
  controls.addEventListener('unlock',()=>{if(gameStarted&&!gameOver) showMessage('点击屏幕重新锁定');});
});
document.getElementById('restartButton').addEventListener('click',()=>location.reload());
document.getElementById('restartButtonWin').addEventListener('click',()=>location.reload());

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);});
animate();