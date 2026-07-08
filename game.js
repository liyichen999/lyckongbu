import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createWallTexture, createFloorTexture, createBloodTexture, createNoteTexture } from './textures.js';

// ================== 音频 ==================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() { if(!audioCtx) audioCtx = new AudioCtx(); if(audioCtx.state==='suspended') audioCtx.resume(); }
function sfx(f,t,d,v=0.1){ if(!audioCtx)return; const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type=t; o.frequency.value=f; g.gain.setValueAtTime(v,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+d); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+d+0.05); }
let ambientGain, ambientOsc;
function startAmbient(){ if(!audioCtx)return; ambientOsc=audioCtx.createOscillator(); ambientGain=audioCtx.createGain(); ambientOsc.type='sine'; ambientOsc.frequency.value=36; ambientGain.gain.value=0.05; ambientOsc.connect(ambientGain); ambientGain.connect(audioCtx.destination); ambientOsc.start(); }
function stopAmbient(){ try{ambientOsc.stop();}catch(e){} }

// ================== 场景 ==================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040404, 0.012);
scene.background = new THREE.Color(0x040404);

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

// DOM
const introScreen = document.getElementById('introScreen');
const hud = document.getElementById('hud');
const deathScreen = document.getElementById('deathScreen');
const winScreen = document.getElementById('winScreen');
const messageEl = document.getElementById('message');
const bloodOverlay = document.getElementById('bloodOverlay');
const objectiveEl = document.getElementById('objective');
const keyHud = document.getElementById('keyHud');
const healthHud = document.getElementById('healthHud');
const batteryHud = document.getElementById('batteryHud');

// ================== 状态 ==================
let gameStarted=false, gameOver=false, keysCollected=0, totalKeys=3;
let flashlightOn=true, battery=100, playerHealth=100;
let lastFootstep=0, lastHeartbeat=0, shakeAmount=0;
const playerRadius=0.4;

// ================== 纹理 ==================
const wallTex=createWallTexture(), floorTex=createFloorTexture(), bloodTex=createBloodTexture();
const noteTex1=createNoteTexture('调查员笔记\n钥匙在痛苦最深的房间。\n关闭光源可短暂骗过它们。');
const noteTex2=createNoteTexture('病人日记\n昨晚又有人被拖走了。\n护士长说地下有东西。');
const noteTex3=createNoteTexture('院长的信\n我打开了不该开的门。\n愿主宽恕我们。');

const wallMat=new THREE.MeshStandardMaterial({map:wallTex,roughness:0.85});
const floorMat=new THREE.MeshStandardMaterial({map:floorTex,roughness:0.75});
const ceilingMat=new THREE.MeshStandardMaterial({color:0x3a3a3a,roughness:0.9});
const bloodMat=new THREE.MeshStandardMaterial({map:bloodTex,roughness:0.8,transparent:true,opacity:0.7,depthWrite:false});

// ================== 碰撞系统 ==================
const colliders=[];
function boxCollider(x,y,z,w,h,d){
  const half=new THREE.Vector3(w/2,h/2,d/2);
  colliders.push({min:new THREE.Vector3(x-half.x,y-half.y,z-half.z),max:new THREE.Vector3(x+half.x,y+half.y,z+half.z)});
}
function addColMesh(mesh){
  const box=new THREE.Box3().setFromObject(mesh);
  colliders.push({min:box.min.clone(),max:box.max.clone()});
}

// ================== 世界构建 ==================
const world=new THREE.Group(); scene.add(world);
function wall(x,y,z,w,h,d){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wallMat);
  m.position.set(x,y,z); m.castShadow=m.receiveShadow=true;
  world.add(m); boxCollider(x,y,z,w,h,d);
}
function floor(x,y,z,w,d){ wall(x,y,z,w,0.15,d); } // 简化
const CH=3.2, CW=3.2;

// --- 中央大厅 ---
floor(0,0,0, 6, 10); // 出生点大厅
wall(0,CH,0,6,0.15,10);
wall(-3,CH/2,0,0.2,CH,10);
wall(3,CH/2,0,0.2,CH,10);
wall(0,CH/2,-5,6,CH,0.2);
wall(-3,CH/2,5,0.2,CH,2); // 入口门洞
wall(3,CH/2,5,0.2,CH,2);

// --- 左侧走廊（连接病房区）---
const leftCorridorZ = -8;
floor(-5, 0, leftCorridorZ, 2, 8);
wall(-6, CH/2, leftCorridorZ, 0.2, CH, 8);
wall(-4, CH/2, leftCorridorZ, 0.2, CH, 8);
wall(-5, CH/2, leftCorridorZ-4, 2, CH, 0.2);

// 病房1
const ward1x=-5, ward1z=leftCorridorZ-6;
floor(ward1x,0,ward1z, 4,5);
wall(ward1x-2, CH/2, ward1z, 0.2,CH,5);
wall(ward1x+2, CH/2, ward1z, 0.2,CH,5);
wall(ward1x, CH/2, ward1z-2.5, 4,CH,0.2);
// 病床
const bed1=new THREE.Group();
const bmat=new THREE.MeshStandardMaterial({color:0x5a5a5a,roughness:0.4,metalness:0.7});
for(let ix of[-0.7,0.7])for(let iz of[-1,1]){
  const l=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.5,6),bmat);
  l.position.set(ix,0.25,iz); bed1.add(l);
}
bed1.add(new THREE.Mesh(new THREE.BoxGeometry(1.5,0.05,2.2),bmat)).position.y=0.5;
bed1.add(new THREE.Mesh(new THREE.BoxGeometry(1.3,0.12,2),new THREE.MeshStandardMaterial({color:0x9a8a7a}))).position.y=0.6;
bed1.position.set(ward1x,0,ward1z);
world.add(bed1); addColMesh(bed1);

// --- 右侧走廊（连接手术区）---
const rightCorridorZ = -8;
floor(5, 0, rightCorridorZ, 2, 8);
wall(4, CH/2, rightCorridorZ, 0.2, CH, 8);
wall(6, CH/2, rightCorridorZ, 0.2, CH, 8);
wall(5, CH/2, rightCorridorZ-4, 2, CH, 0.2);
// 手术室
const opx=5, opz=rightCorridorZ-6;
floor(opx,0,opz, 4,5);
wall(opx-2, CH/2, opz, 0.2,CH,5);
wall(opx+2, CH/2, opz, 0.2,CH,5);
wall(opx, CH/2, opz-2.5, 4,CH,0.2);
const optable=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.1,2.4),new THREE.MeshStandardMaterial({color:0x7a7a7a,roughness:0.3,metalness:0.9}));
optable.position.set(opx,0.8,opz); world.add(optable); addColMesh(optable);

// --- 庭院（中间区域）---
const courtyardZ = 12;
floor(0,0,courtyardZ, 8,8);
wall(-4,CH/2,courtyardZ,0.2,CH,8);
wall(4,CH/2,courtyardZ,0.2,CH,8);
wall(0,CH/2,courtyardZ+4,8,CH,0.2);
// 雕像
const statue = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.4,1.5,8), new THREE.MeshStandardMaterial({color:0x4a4a4a,roughness:0.6}));
statue.position.set(0,0.75,courtyardZ);
world.add(statue); addColMesh(statue);

// --- 地下室区域（通过庭院角落活板门）---
const basementEntrance = new THREE.Vector3(3, 0, courtyardZ+3);
const trapdoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.05,0.8), new THREE.MeshStandardMaterial({color:0x4a3a2a}));
trapdoorMesh.position.copy(basementEntrance);
trapdoorMesh.rotation.x=-Math.PI/2;
world.add(trapdoorMesh);
trapdoorMesh.userData.isTrapdoor=true;

const basementGroup = new THREE.Group();
basementGroup.position.set(3, -3.5, courtyardZ+6);
const bmat2 = new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.9});
function bwall(x,y,z,w,h,d){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bmat2);
  m.position.set(x,y,z); basementGroup.add(m);
  const wp=m.position.clone().add(basementGroup.position);
  boxCollider(wp.x,wp.y,wp.z,w,h,d);
}
bwall(0,0,0, 6,0.1,8);
bwall(0,2.8,0,6,0.1,8);
bwall(-3,1.4,0,0.2,2.8,8);
bwall(3,1.4,0,0.2,2.8,8);
bwall(0,1.4,-4,6,2.8,0.2);
world.add(basementGroup);

// 地下室出口门（胜利点）
const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(1.3,2.2,0.1),new THREE.MeshStandardMaterial({color:0x4a2a1a}));
exitDoor.position.set(3, -3.5+1.1, courtyardZ+2);
world.add(exitDoor);
exitDoor.userData.isExit=true;

// 血迹与笔记
const bloodDecal1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.5), bloodMat);
bloodDecal1.rotation.x=-Math.PI/2; bloodDecal1.position.set(ward1x,0.1,ward1z);
world.add(bloodDecal1);
const note1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.2), new THREE.MeshBasicMaterial({map:noteTex1}));
note1.position.set(ward1x,1.2,ward1z+1.5); note1.userData.isNote=true; world.add(note1);
const note2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.2), new THREE.MeshBasicMaterial({map:noteTex2}));
note2.position.set(opx-1,1.0,opz); note2.userData.isNote=true; world.add(note2);
const note3 = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.2), new THREE.MeshBasicMaterial({map:noteTex3}));
note3.position.set(0,0.9,courtyardZ-2); note3.userData.isNote=true; world.add(note3);

// ================== 钥匙（高亮光柱）==================
const keys=[];
function createKey(x,y,z){
  const g=new THREE.Group();
  const kMat=new THREE.MeshStandardMaterial({color:0xe0c060,roughness:0.2,metalness:0.8,emissive:0x332200});
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.06,8),kMat));
  const shaft=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.4,0.04),kMat); shaft.position.y=-0.22; g.add(shaft);
  const tooth=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.05,0.04),kMat); tooth.position.set(0.03,-0.36,0); g.add(tooth);
  // 光柱粒子
  const pillarGeo=new THREE.CylinderGeometry(0.1,0.15,0.8,6);
  const pillar=new THREE.Mesh(pillarGeo,new THREE.MeshBasicMaterial({color:0xffdd88,transparent:true,opacity:0.4,depthWrite:false}));
  pillar.position.y=0.4; g.add(pillar);
  // 上下浮动动画标记
  g.userData.isKey=true;
  g.userData.baseY=y;
  g.position.set(x,y,z);
  world.add(g);
  keys.push(g);
}
createKey(ward1x+0.5, 0.85, ward1z-1.5); // 病房
createKey(opx-0.3, 0.9, opz-1.8); // 手术室
createKey(1.5, 0.7, courtyardZ-2.5); // 庭院

// ================== 灯光 ==================
const flashlight=new THREE.SpotLight(0xffeedd);
flashlight.angle=0.4; flashlight.penumbra=0.3; flashlight.decay=1.5; flashlight.distance=18;
flashlight.intensity=1.6; flashlight.castShadow=true;
flashlight.shadow.mapSize.set(512,512);
camera.add(flashlight);
flashlight.target.position.set(0,0,-1.5); camera.add(flashlight.target);

scene.add(new THREE.AmbientLight(0x0a0a18,0.25));
const flickerLights=[];
for(let i=0;i<10;i++){
  const l=new THREE.PointLight(0xcc9966,0.5,8,1.5);
  l.position.set((Math.random()-0.5)*10,CH-0.3,(Math.random()-0.5)*20);
  world.add(l);
  flickerLights.push(l);
}

// ================== 幽灵（降低伤害，增加躲避） ==================
const ghost=new THREE.Group();
const gMat=new THREE.MeshStandardMaterial({color:0x1a2a1a,roughness:0.3,transparent:true,opacity:0.55,emissive:0x0a1a0a});
ghost.add(new THREE.Mesh(new THREE.ConeGeometry(0.45,1.7,8),gMat)).position.y=0.85;
ghost.add(new THREE.Mesh(new THREE.SphereGeometry(0.33,8,6),gMat)).position.y=1.75;
const eye=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6),new THREE.MeshBasicMaterial({color:0xff2200}));
eye.position.set(-0.12,1.8,0.28); ghost.add(eye);
eye.clone().position.set(0.12,1.8,0.28); ghost.add(eye);
ghost.position.set(2,0,-2);
world.add(ghost);
const ghostAI={
  pos:new THREE.Vector3(2,0,-2),
  patrol:[new THREE.Vector3(2,0,-4),new THREE.Vector3(-2,0,-2),new THREE.Vector3(4,0,2),new THREE.Vector3(-4,0,-3),new THREE.Vector3(0,0,5)],
  idx:0,chase:false,speed:0.5,chaseSpeed:2.2,lastScare:0,stuckTimer:0
};

// ================== 游戏逻辑 ==================
function showMessage(text,dur=2.5){
  messageEl.textContent=text; messageEl.style.opacity=1;
  clearTimeout(window._msgT); window._msgT=setTimeout(()=>messageEl.style.opacity=0,dur*1000);
}
function updateHUD(){
  keyHud.textContent=`🔑 钥匙 ${keysCollected}/${totalKeys}`;
  healthHud.textContent=`❤️ 理智 ${Math.floor(playerHealth)}`;
  batteryHud.textContent=`🔋 手电筒 ${Math.floor(battery)}%`;
  if(playerHealth<30) healthHud.classList.add('danger'); else healthHud.classList.remove('danger');
  if(battery<20) batteryHud.classList.add('danger'); else batteryHud.classList.remove('danger');
  if(keysCollected>=totalKeys) objectiveEl.textContent='🚪 前往庭院角落的活板门！';
}

function checkCollision(pos){
  for(const c of colliders){
    if(pos.x+playerRadius>c.min.x && pos.x-playerRadius<c.max.x &&
       pos.y+0.25>c.min.y && pos.y-1.5<c.max.y &&
       pos.z+playerRadius>c.min.z && pos.z-playerRadius<c.max.z) return true;
  }
  return false;
}

function interact(){
  if(!gameStarted||gameOver)return;
  const p=camera.position;
  // 捡钥匙
  for(let i=keys.length-1;i>=0;i--){
    if(p.distanceTo(keys[i].position)<2.5){
      world.remove(keys[i]); keys.splice(i,1); keysCollected++;
      sfx(660,'sine',0.15); sfx(880,'sine',0.2);
      showMessage(`🔑 你找到了钥匙！ (${keysCollected}/${totalKeys})`);
      updateHUD(); return;
    }
  }
  // 活板门
  if(p.distanceTo(trapdoorMesh.position)<2.5){
    if(keysCollected>=totalKeys){
      showMessage('你打开了活板门，进入地下室...');
      camera.position.set(3, -3.5+1.7, courtyardZ+5.5);
      objectiveEl.textContent='🎯 在地下室找到出口！';
    }else{
      showMessage(`活板门紧锁，还需要 ${totalKeys-keysCollected} 把钥匙`);
    }
  }
  // 出口
  if(p.distanceTo(exitDoor.position)<2.2){
    winScreen.style.display='flex'; gameOver=true; stopAmbient(); controls.unlock();
  }
}

function playerDeath(){
  if(gameOver)return;
  gameOver=true; deathScreen.style.display='flex'; stopAmbient(); controls.unlock();
  sfx(200,'sawtooth',0.9); sfx(40,'sawtooth',2);
}

// ================== 动画循环 ==================
const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const delta=Math.min(clock.getDelta(),0.15);
  if(gameStarted&&!gameOver&&controls.isLocked){
    // 移动
    const move=new THREE.Vector3();
    if(keyState.w)move.z-=1; if(keyState.s)move.z+=1;
    if(keyState.a)move.x-=1; if(keyState.d)move.x+=1;
    if(move.length()>0){
      move.normalize();
      const old=camera.position.clone();
      controls.moveRight(move.x*3.8*delta);
      controls.moveForward(-move.z*3.8*delta);
      if(checkCollision(camera.position)) camera.position.copy(old);
      if(Date.now()-lastFootstep>400){sfx(70+Math.random()*30,'triangle',0.05); lastFootstep=Date.now();}
    }
    // 手电筒
    if(flashlightOn) battery-=2.5*delta;
    if(battery<=0){battery=0; flashlightOn=false; flashlight.intensity=0.03; showMessage('⚠ 手电筒没电了！');}
    else flashlight.intensity=flashlightOn?1.6:0.03;
    updateHUD();

    // 幽灵AI（关键：关灯时幽灵会短时间迷失方向）
    const gp=ghostAI.pos;
    const dist=gp.distanceTo(camera.position);
    ghostAI.chase=(dist<8 && flashlightOn) || dist<4;
    if(!flashlightOn && ghostAI.chase && dist<8 && Math.random()<0.01) ghostAI.chase=false; // 关灯迷惑
    const target=ghostAI.chase?camera.position.clone():ghostAI.patrol[ghostAI.idx];
    const dir=new THREE.Vector3().subVectors(target,gp).normalize();
    gp.add(dir.multiplyScalar((ghostAI.chase?2.2:0.5)*delta));
    ghost.position.copy(gp);
    ghost.lookAt(camera.position.x,gp.y,camera.position.z);
    if(dist<0.9){
      playerHealth-=35*delta; // 伤害降低
      bloodOverlay.style.opacity=0.5;
      shakeAmount=Math.max(shakeAmount,0.2);
      if(playerHealth<=0) playerDeath();
    }else bloodOverlay.style.opacity=0;
    if(dist>8) playerHealth=Math.min(100,playerHealth+5*delta); // 恢复加快
    if(dist<6&&Date.now()-ghostAI.lastScare>7000){ghostAI.lastScare=Date.now(); sfx(180,'sawtooth',0.5); showMessage('有什么在靠近...',1.5);}
    if(dist<7&&Date.now()-lastHeartbeat>800){sfx(45,'sine',0.2); lastHeartbeat=Date.now();}
    // 钥匙浮动动画
    keys.forEach(k=>{
      k.position.y=k.userData.baseY+Math.sin(Date.now()*0.005)*0.1;
      k.rotation.y+=0.02;
    });
    // 屏幕震动
    if(shakeAmount>0.001){
      camera.position.x+=(Math.random()-0.5)*shakeAmount*0.05;
      camera.position.y+=(Math.random()-0.5)*shakeAmount*0.03;
      shakeAmount*=Math.exp(-5*delta);
    }
  }
  flickerLights.forEach(l=>l.intensity=0.4+Math.sin(Date.now()*0.005)*0.2+Math.random()*0.2);
  renderer.render(scene,camera);
}

// ================== 输入 ==================
const keyState={w:false,a:false,s:false,d:false};
document.addEventListener('keydown',e=>{
  if(!gameStarted||gameOver)return;
  switch(e.code){
    case'KeyW':keyState.w=true;break; case'KeyA':keyState.a=true;break;
    case'KeyS':keyState.s=true;break; case'KeyD':keyState.d=true;break;
    case'KeyF':if(battery>0){flashlightOn=!flashlightOn; showMessage(flashlightOn?'手电筒开启':'手电筒关闭 (可迷惑幽灵)',1);} else showMessage('没电了'); break;
    case'Space':interact();break;
  }
});
document.addEventListener('keyup',e=>{
  switch(e.code){case'KeyW':keyState.w=false;break;case'KeyA':keyState.a=false;break;case'KeyS':keyState.s=false;break;case'KeyD':keyState.d=false;break;}
});

// ================== 启动 ==================
document.getElementById('continueButton').addEventListener('click',()=>{
  introScreen.style.display='none'; hud.style.display='flex'; gameStarted=true;
  initAudio(); startAmbient();
  showMessage('点击屏幕锁定鼠标，然后开始探索');
  document.addEventListener('click',()=>{controls.lock(); document.removeEventListener('click',arguments.callee);});
  controls.addEventListener('lock',()=>showMessage(''));
  controls.addEventListener('unlock',()=>{if(gameStarted&&!gameOver) showMessage('点击屏幕重新锁定');});
});
document.getElementById('restartButton').addEventListener('click',()=>location.reload());
document.getElementById('restartButtonWin').addEventListener('click',()=>location.reload());

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);});
animate();