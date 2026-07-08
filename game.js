import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createWallTexture, createFloorTexture, createBloodDecalTexture } from './textures.js';

// ================== 音频引擎 ==================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, type, dur, vol=0.1) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime+dur+0.05);
}
let droneOsc, droneGain;
function startDrone() {
  if (!audioCtx) return;
  droneOsc = audioCtx.createOscillator();
  droneGain = audioCtx.createGain();
  droneOsc.type = 'sine'; droneOsc.frequency.value = 35;
  droneGain.gain.value = 0.05;
  droneOsc.connect(droneGain);
  droneGain.connect(audioCtx.destination);
  droneOsc.start();
}
function stopDrone() { try{droneOsc.stop();}catch(e){} }

// ================== 场景初始化 ==================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.02);
scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 40);
camera.position.set(0, 1.7, 6);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);

// DOM 元素
const startScreen = document.getElementById('startScreen');
const deathScreen = document.getElementById('deathScreen');
const centerMsg = document.getElementById('centerMsg');
const keyHud = document.getElementById('keyHud');
const healthHud = document.getElementById('healthHud');

// ================== 游戏状态 ==================
let gameStarted = false, gameOver = false;
let keysCollected = 0, totalKeys = 3;
let flashlightOn = true;
let playerHealth = 100;
let lastFootstep = 0, lastHeartbeat = 0;
let shakeAmount = 0;
const playerRadius = 0.45;

// ================== 纹理资源 ==================
const wallTex = createWallTexture();
const floorTex = createFloorTexture();
const bloodTex = createBloodDecalTexture();

const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 });
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
const bloodMat = new THREE.MeshStandardMaterial({ map: bloodTex, roughness: 0.8, transparent: true, opacity: 0.7, depthWrite: false });

// ================== 碰撞体管理 ==================
const colliders = [];
function addCollider(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  colliders.push({ min: box.min.clone(), max: box.max.clone() });
}
function addBoxCollider(x,y,z,w,h,d) {
  const half = new THREE.Vector3(w/2, h/2, d/2);
  colliders.push({
    min: new THREE.Vector3(x-half.x, y-half.y, z-half.z),
    max: new THREE.Vector3(x+half.x, y+half.y, z+half.z)
  });
}

// ================== 高级模型构建函数 ==================
function createHospitalBed(x, y, z) {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.4, metalness: 0.7 });
  const mattressMat = new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: 0.9 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xdad5cc, roughness: 0.8 });

  // 床腿
  const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
  for (let ix of [-0.7, 0.7]) {
    for (let iz of [-1.0, 1.0]) {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(ix, 0.3, iz);
      leg.castShadow = true; leg.receiveShadow = true;
      group.add(leg);
    }
  }
  // 床架边框
  const frameGeo = new THREE.BoxGeometry(1.6, 0.08, 2.2);
  const frame = new THREE.Mesh(frameGeo, metalMat);
  frame.position.set(0, 0.62, 0);
  frame.castShadow = true; frame.receiveShadow = true;
  group.add(frame);
  // 床板
  const boardGeo = new THREE.BoxGeometry(1.5, 0.06, 2.1);
  const board = new THREE.Mesh(boardGeo, metalMat);
  board.position.set(0, 0.5, 0);
  board.receiveShadow = true;
  group.add(board);
  // 床垫
  const mattressGeo = new THREE.BoxGeometry(1.3, 0.15, 1.9);
  const mattress = new THREE.Mesh(mattressGeo, mattressMat);
  mattress.position.set(0, 0.63, 0);
  mattress.castShadow = true; mattress.receiveShadow = true;
  group.add(mattress);
  // 枕头
  const pillowGeo = new THREE.BoxGeometry(0.5, 0.12, 0.7);
  const pillow = new THREE.Mesh(pillowGeo, pillowMat);
  pillow.position.set(0, 0.73, -0.7);
  pillow.castShadow = true; pillow.receiveShadow = true;
  group.add(pillow);
  // 床头板
  const headboardGeo = new THREE.BoxGeometry(1.5, 0.7, 0.08);
  const headboard = new THREE.Mesh(headboardGeo, metalMat);
  headboard.position.set(0, 1.0, -1.15);
  headboard.castShadow = true; headboard.receiveShadow = true;
  group.add(headboard);

  group.position.set(x, y, z);
  return group;
}

function createWheelchair(x, y, z) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.4, metalness: 0.8 });
  const wheelGeo = new THREE.TorusGeometry(0.28, 0.05, 8, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.6, metalness: 0.4 });

  // 大轮
  const wheelL = new THREE.Mesh(wheelGeo, wheelMat);
  wheelL.rotation.x = Math.PI/2;
  wheelL.position.set(-0.45, 0.3, 0);
  group.add(wheelL);
  const wheelR = wheelL.clone();
  wheelR.position.set(0.45, 0.3, 0);
  group.add(wheelR);
  // 小轮
  const smallWheelGeo = new THREE.TorusGeometry(0.12, 0.04, 6, 12);
  const swL = new THREE.Mesh(smallWheelGeo, wheelMat);
  swL.rotation.x = Math.PI/2;
  swL.position.set(-0.35, 0.1, 0.6);
  group.add(swL);
  const swR = swL.clone();
  swR.position.set(0.35, 0.1, 0.6);
  group.add(swR);
  // 框架
  const frame1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), metal);
  frame1.position.set(-0.4, 0.65, 0.2);
  group.add(frame1);
  const frame2 = frame1.clone();
  frame2.position.set(0.4, 0.65, 0.2);
  group.add(frame2);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), metal);
  seat.position.set(0, 0.55, 0.2);
  group.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.08), metal);
  back.position.set(0, 0.8, -0.05);
  group.add(back);

  group.position.set(x, y, z);
  return group;
}

function createIVStand(x, y, z) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.3, metalness: 0.9 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), poleMat);
  pole.position.y = 1.1;
  group.add(pole);
  const hookGeo = new THREE.TorusGeometry(0.15, 0.04, 6, 12);
  const hook = new THREE.Mesh(hookGeo, poleMat);
  hook.position.y = 2.15;
  group.add(hook);
  const baseGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.1, 8);
  const base = new THREE.Mesh(baseGeo, poleMat);
  base.position.y = 0.05;
  group.add(base);
  group.position.set(x, y, z);
  return group;
}

function createSurgeryLight(x, y, z) {
  const group = new THREE.Group();
  const armMat = new THREE.MeshStandardMaterial({ color: 0x888, roughness: 0.3, metalness: 0.8 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.5, emissive: 0x222222 });
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), armMat);
  arm1.position.set(0, 2.0, 0);
  arm1.rotation.x = Math.PI/2;
  group.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), armMat);
  arm2.position.set(0.4, 1.6, 0);
  arm2.rotation.z = Math.PI/2;
  group.add(arm2);
  const lampGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.15, 16);
  const lamp = new THREE.Mesh(lampGeo, lightMat);
  lamp.position.set(0.8, 1.6, 0);
  group.add(lamp);
  group.position.set(x, y, z);
  return group;
}

function createBodyBag(x, y, z) {
  const group = new THREE.Group();
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 2.0), bagMat);
  bag.position.y = 0.2;
  group.add(bag);
  const zipperGeo = new THREE.BoxGeometry(0.05, 0.05, 1.8);
  const zipperMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.9 });
  const zipper = new THREE.Mesh(zipperGeo, zipperMat);
  zipper.position.set(0, 0.35, 0);
  group.add(zipper);
  group.position.set(x, y, z);
  return group;
}

// ================== 场景构建 ==================
const world = new THREE.Group();
scene.add(world);

// 走廊
const CW = 3.2, CH = 3.2, CL = 15;
function addWallSegment(x, y, z, w, h, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  world.add(mesh);
  addBoxCollider(x, y, z, w, h, d);
}

addWallSegment(0, 0, 0, CW, 0.15, CL); // floor
addWallSegment(0, CH, 0, CW, 0.15, CL); // ceiling
addWallSegment(-CW/2, CH/2, 0, 0.2, CH, CL); // left wall
addWallSegment(CW/2, CH/2, 0, 0.2, CH, CL); // right wall
addWallSegment(0, CH/2, -CL/2, CW, CH, 0.2); // back wall

// 前墙门洞
addWallSegment(-CW/2-0.5, CH/2, CL/2, 0.6, CH, 0.2);
addWallSegment(CW/2+0.5, CH/2, CL/2, 0.6, CH, 0.2);

// 房间1：病房（左侧）
const r1x = -4.2, r1z = -3.5, r1w = 4.4, r1d = 5.5;
addWallSegment(r1x,0,r1z, r1w,0.15,r1d); // floor
addWallSegment(r1x,CH,r1z, r1w,0.15,r1d); // ceiling
addWallSegment(r1x-r1w/2, CH/2, r1z, 0.2, CH, r1d);
addWallSegment(r1x+r1w/2, CH/2, r1z, 0.2, CH, r1d);
addWallSegment(r1x, CH/2, r1z-r1d/2, r1w, CH, 0.2);

const bed = createHospitalBed(r1x-0.6, 0, r1z-0.8);
world.add(bed); addCollider(bed);
const wheelchair = createWheelchair(r1x+1.0, 0, r1z+1.0);
world.add(wheelchair); addCollider(wheelchair);
const ivStand = createIVStand(r1x-0.8, 0, r1z+1.4);
world.add(ivStand); addCollider(ivStand);
const bloodDecal1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.6), bloodMat);
bloodDecal1.rotation.x = -Math.PI/2;
bloodDecal1.position.set(r1x-0.5,0.1,r1z+0.3);
world.add(bloodDecal1);

// 房间2：手术室（右侧）
const r2x = 4.2, r2z = 2.8, r2w = 4.4, r2d = 5.0;
addWallSegment(r2x,0,r2z, r2w,0.15,r2d);
addWallSegment(r2x,CH,r2z, r2w,0.15,r2d);
addWallSegment(r2x-r2w/2, CH/2, r2z, 0.2, CH, r2d);
addWallSegment(r2x+r2w/2, CH/2, r2z, 0.2, CH, r2d);
addWallSegment(r2x, CH/2, r2z+r2d/2, r2w, CH, 0.2);

const surgeryLight = createSurgeryLight(r2x, 2.4, r2z-0.2);
world.add(surgeryLight); addCollider(surgeryLight);
const bodyBag = createBodyBag(r2x+0.8, 0, r2z-0.5);
world.add(bodyBag); addCollider(bodyBag);
const table = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.1,2.4), new THREE.MeshStandardMaterial({color:0x7a7a7a, roughness:0.3, metalness:0.8}));
table.position.set(r2x,0.8,r2z-0.3);
world.add(table); addCollider(table);

// 房间3：储藏室（尽头）
const r3z = -CL/2 + 2.8, r3w = CW-0.8, r3d = 3.2;
addWallSegment(0,0,r3z, r3w,0.15,r3d);
addWallSegment(0,CH,r3z, r3w,0.15,r3d);
addWallSegment(-r3w/2, CH/2, r3z, 0.2, CH, r3d);
addWallSegment(r3w/2, CH/2, r3z, 0.2, CH, r3d);
addWallSegment(0, CH/2, r3z-r3d/2, r3w, CH, 0.2);

// 出口门
const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(1.3,2.4,0.12), new THREE.MeshStandardMaterial({color:0x4a2a1a, roughness:0.6}));
exitDoor.position.set(0,1.2,-CL/2+0.06);
world.add(exitDoor); addCollider(exitDoor);

// 钥匙（带发光）
const keyMeshes = [];
function createKey(x,y,z) {
  const group = new THREE.Group();
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xe0c060, roughness:0.3, metalness:0.7, emissive:0x332200 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.08,12), keyMat);
  head.rotation.x = Math.PI/2; group.add(head);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.45,0.05), keyMat);
  shaft.position.y = -0.26; group.add(shaft);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.06,0.05), keyMat);
  tooth.position.set(0.04,-0.42,0); group.add(tooth);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8), new THREE.MeshBasicMaterial({color:0xffdd88, transparent:true, opacity:0.4, depthWrite:false}));
  group.add(glow);
  group.position.set(x,y,z);
  group.userData.isKey = true;
  world.add(group);
  keyMeshes.push(group);
}
createKey(r1x-0.5, 0.9, r1z-1.8);
createKey(r2x+0.3, 0.85, r2z+1.6);
createKey(0.7, 1.1, r3z+1.0);

// 手电筒
const flashlight = new THREE.SpotLight(0xffeedd);
flashlight.angle = 0.45; flashlight.penumbra = 0.35; flashlight.decay = 1.8; flashlight.distance = 20;
flashlight.intensity = 1.8; flashlight.castShadow = true;
flashlight.shadow.mapSize.set(512,512);
camera.add(flashlight);
flashlight.target.position.set(0,0,-1.5);
camera.add(flashlight.target);

// 环境光与闪烁灯
scene.add(new THREE.AmbientLight(0x0a0a18, 0.3));
const corridorLights = [];
for (let i=0;i<5;i++) {
  const light = new THREE.PointLight(0xcc9966, 0.6, 9, 1.5);
  light.position.set(0, CH-0.4, -CL/2+2+i*2.5);
  world.add(light);
  corridorLights.push({light, base:0.6, speed:0.03+Math.random()*0.07, phase:Math.random()*Math.PI*2});
}

// 幽灵模型（复杂）
const ghostGroup = new THREE.Group();
const ghostMat = new THREE.MeshStandardMaterial({color:0x1a2a1a, roughness:0.4, metalness:0.1, transparent:true, opacity:0.6, emissive:0x0a1a0a});
const body = new THREE.Mesh(new THREE.ConeGeometry(0.5,1.7,10), ghostMat);
body.position.y = 0.85; ghostGroup.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.35,10,8), ghostMat);
head.position.y = 1.75; ghostGroup.add(head);
// 破烂布料
for (let i=0;i<6;i++) {
  const ragGeo = new THREE.CylinderGeometry(0.08,0.15,0.6,6);
  const rag = new THREE.Mesh(ragGeo, ghostMat);
  rag.position.set((Math.random()-0.5)*0.7, 0.4+Math.random()*0.6, (Math.random()-0.5)*0.7);
  rag.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
  ghostGroup.add(rag);
}
const eyeGeo = new THREE.SphereGeometry(0.1,8,8);
const eyeMat = new THREE.MeshBasicMaterial({color:0xff2200});
const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
leftEye.position.set(-0.13,1.82,0.28); ghostGroup.add(leftEye);
const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
rightEye.position.set(0.13,1.82,0.28); ghostGroup.add(rightEye);
ghostGroup.position.set(2,0,-2);
world.add(ghostGroup);

const ghostAI = {
  pos: new THREE.Vector3(2,0,-2),
  patrolPoints: [new THREE.Vector3(2,0,-3), new THREE.Vector3(-1.5,0,-1), new THREE.Vector3(3.5,0,2.5), new THREE.Vector3(-3,0,-4), new THREE.Vector3(0,0,2)],
  idx:0, chase:false, speed:0.7, chaseSpeed:2.6, lastScare:0
};

// 粒子
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(500*3);
for(let i=0;i<500*3;i+=3){dustPos[i]=(Math.random()-0.5)*16; dustPos[i+1]=Math.random()*3.5; dustPos[i+2]=(Math.random()-0.5)*16;}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos,3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({color:0x999999, size:0.025, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending}));
world.add(dust);

// ================== 游戏逻辑 ==================
function toggleFlashlight() { flashlightOn=!flashlightOn; flashlight.intensity=flashlightOn?1.8:0.03; }
function showMsg(t,d=2){centerMsg.textContent=t;centerMsg.style.opacity=1;clearTimeout(window._t);window._t=setTimeout(()=>centerMsg.style.opacity=0,d*1000);}
function updateHUD() {
  keyHud.textContent = `🔑 钥匙 ${keysCollected}/${totalKeys}`;
  healthHud.textContent = `❤️ 理智 ${Math.floor(playerHealth)}`;
  healthHud.classList.toggle('danger', playerHealth<30);
}

function interact() {
  if(!gameStarted||gameOver) return;
  const p = camera.position;
  for(let i=keyMeshes.length-1;i>=0;i--) {
    if(p.distanceTo(keyMeshes[i].position)<2.0) {
      world.remove(keyMeshes[i]); keyMeshes.splice(i,1); keysCollected++;
      playTone(660,'sine',0.15); playTone(880,'sine',0.2);
      showMsg(`🔑 找到钥匙！(${keysCollected}/${totalKeys})`);
      updateHUD(); return;
    }
  }
  if(p.distanceTo(exitDoor.position)<2.5) {
    if(keysCollected>=totalKeys) {
      showMsg('大门打开了！你逃出去了！',3); gameOver=true; stopDrone();
      setTimeout(()=>{alert('🏆 你成功逃离了圣玛丽疗养院！');location.reload();},2000);
    } else showMsg(`🔒 还需要 ${totalKeys-keysCollected} 把钥匙`);
  }
}

function playerDeath() {
  if(gameOver) return;
  gameOver=true; deathScreen.style.display='flex'; controls.unlock(); stopDrone();
  playTone(200,'sawtooth',0.8); playTone(40,'sawtooth',2);
}

// 碰撞检测与响应
function checkCollision(pos) {
  for(const c of colliders) {
    if(pos.x+playerRadius > c.min.x && pos.x-playerRadius < c.max.x &&
       pos.y+0.3 > c.min.y && pos.y-1.4 < c.max.y &&
       pos.z+playerRadius > c.min.z && pos.z-playerRadius < c.max.z) {
      return true;
    }
  }
  return false;
}

// 游戏循环
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(),0.15);
  
  if(gameStarted && !gameOver && controls.isLocked) {
    const move = new THREE.Vector3();
    if(keyState.w) move.z-=1; if(keyState.s) move.z+=1;
    if(keyState.a) move.x-=1; if(keyState.d) move.x+=1;
    if(move.length()>0) {
      move.normalize();
      const oldPos = camera.position.clone();
      controls.moveRight(move.x*3.8*delta);
      controls.moveForward(-move.z*3.8*delta);
      if(checkCollision(camera.position)) camera.position.copy(oldPos);
      if(Date.now()-lastFootstep>380){playTone(70+Math.random()*30,'triangle',0.06); lastFootstep=Date.now();}
    }
    // 幽灵AI
    const gp = ghostAI.pos;
    const dist = gp.distanceTo(camera.position);
    ghostAI.chase = (dist<7.5 && flashlightOn) || dist<4;
    const target = ghostAI.chase ? camera.position.clone() : ghostAI.patrolPoints[ghostAI.idx];
    const dir = new THREE.Vector3().subVectors(target, gp).normalize();
    gp.add(dir.multiplyScalar((ghostAI.chase?2.6:0.55)*delta));
    ghostGroup.position.copy(gp);
    ghostGroup.lookAt(camera.position.x, gp.y, camera.position.z);
    if(dist<0.9) { playerHealth-=50*delta; if(playerHealth<=0) playerDeath(); }
    if(dist<5 && Date.now()-ghostAI.lastScare>6000) { ghostAI.lastScare=Date.now(); playTone(180,'sawtooth',0.5); }
    if(dist<3 && Math.random()<0.01) showMsg('有什么东西在附近...',1.5);
    // 理智恢复
    if(dist>6) playerHealth=Math.min(100,playerHealth+4*delta);
    updateHUD();
  }
  // 闪烁灯
  corridorLights.forEach(l=>l.light.intensity=l.base*(0.5+Math.sin(performance.now()*0.01*l.speed+l.phase)*0.2+Math.random()*0.15));
  dust.rotation.y+=delta*0.02;
  renderer.render(scene, camera);
}

// 输入
const keyState={w:false,a:false,s:false,d:false};
document.addEventListener('keydown',e=>{
  if(!gameStarted||gameOver)return;
  switch(e.code){
    case'KeyW':keyState.w=true;break; case'KeyA':keyState.a=true;break;
    case'KeyS':keyState.s=true;break; case'KeyD':keyState.d=true;break;
    case'KeyF':toggleFlashlight();break; case'Space':interact();break;
  }
});
document.addEventListener('keyup',e=>{
  switch(e.code){case'KeyW':keyState.w=false;break;case'KeyA':keyState.a=false;break;case'KeyS':keyState.s=false;break;case'KeyD':keyState.d=false;break;}
});

document.getElementById('startButton').addEventListener('click', () => {
  initAudio();
  startDrone();
  startScreen.style.display = 'none';
  gameStarted = true;
  
  // 显示提示文字
  const hint = document.getElementById('hint');
  hint.textContent = '🖱️ 点击屏幕锁定鼠标';
  hint.style.display = 'block';
  
  // 添加一次性点击监听，直接绑定在 document 上确保触发
  function lockHandler() {
    controls.lock();
    document.removeEventListener('click', lockHandler);
  }
  document.addEventListener('click', lockHandler);
  
  // 如果用户按了ESC解锁，再次显示提示
  controls.addEventListener('unlock', () => {
    if (gameStarted && !gameOver) {
      hint.textContent = '🖱️ 点击屏幕重新锁定鼠标';
      hint.style.display = 'block';
      document.addEventListener('click', lockHandler, { once: true });
    }
  });
  
  controls.addEventListener('lock', () => {
    hint.style.display = 'none';
  });
});
document.getElementById('restartButton').onclick=()=>location.reload();
controls.addEventListener('unlock',()=>{if(gameStarted&&!gameOver) hintEl.style.display='block';});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

animate();