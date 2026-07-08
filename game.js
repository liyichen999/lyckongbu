import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createWallTexture, createFloorTexture, createBloodTexture, createNoteTexture } from './textures.js';

// 检测移动端
const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || window.innerWidth < 768;

// ================== 音频 ==================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() { if(!audioCtx) audioCtx = new AudioCtx(); if(audioCtx.state==='suspended') audioCtx.resume(); }
function sfx(freq, type, dur, vol=0.1) {
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+dur+0.05);
}
let ambientGain, ambientOsc;
function startAmbient() {
  if(!audioCtx) return;
  ambientOsc=audioCtx.createOscillator(); ambientGain=audioCtx.createGain();
  ambientOsc.type='sine'; ambientOsc.frequency.value=36; ambientGain.gain.value=0.05;
  ambientOsc.connect(ambientGain); ambientGain.connect(audioCtx.destination); ambientOsc.start();
}
function stopAmbient() { try{ambientOsc.stop();}catch(e){} }

// ================== 场景 ==================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040404, 0.008);
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

// 控制器：桌面用指针锁定，移动用自定义
let controls;
if (!isMobile) {
  controls = new PointerLockControls(camera, renderer.domElement);
}

// DOM
const introScreen = document.getElementById('introScreen');
const hud = document.getElementById('hud');
const deathScreen = document.getElementById('deathScreen');
const winScreen = document.getElementById('winScreen');
const messageEl = document.getElementById('message');
const bloodOverlay = document.getElementById('bloodOverlay');
const mobileControlsDiv = document.getElementById('mobileControls');
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

// 移动端输入状态
let mobileMoveX=0, mobileMoveY=0, mobileLookX=0, mobileLookY=0;
let mobileFlashlight=false, mobileInteract=false, mobileUseMedkit=false;

// ================== 纹理 ==================
const wallTex = createWallTexture();
const basementWallTex = createWallTexture('basement');
const floorTex = createFloorTexture();
const bloodTex = createBloodTexture();
const wallMat = new THREE.MeshStandardMaterial({map:wallTex, roughness:0.85});
const bWallMat = new THREE.MeshStandardMaterial({map:basementWallTex, roughness:0.9});
const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.75});
const ceilingMat = new THREE.MeshStandardMaterial({color:0x3a3a3a, roughness:0.9});
const bloodMat = new THREE.MeshStandardMaterial({map:bloodTex, roughness:0.8, transparent:true, opacity:0.7, depthWrite:false});

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

// ================== 世界构建（与之前相同） ==================
const world = new THREE.Group(); scene.add(world);
function createWall(x,y,z,w,h,d,mat=wallMat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z); m.castShadow=m.receiveShadow=true;
  world.add(m); boxCollider(x,y,z,w,h,d);
}
function createFloor(x,y,z,w,d) { createWall(x,0,z,w,0.1,d,floorMat); }
function createCeiling(x,y,z,w,d) { createWall(x,3.2,z,w,0.1,d,ceilingMat); }
const CH = 3.2;

// 大厅
createFloor(0,0,0, 8,10); createCeiling(0,0,0,8,10);
createWall(-4,CH/2,0,0.2,CH,10); createWall(4,CH/2,0,0.2,CH,10);
createWall(0,CH/2,-5,8,CH,0.2);

// 左侧病房
const ward1x=-6, ward1z=-13;
createFloor(ward1x,0,ward1z, 3,5); createCeiling(ward1x,0,ward1z,3,5);
createWall(ward1x-1.5,CH/2,ward1z,0.2,CH,5);
createWall(ward1x+1.5,CH/2,ward1z,0.2,CH,5);
createWall(ward1x,CH/2,ward1z-2.5,3,CH,0.2);
// 床
const bed = new THREE.Group();
const bmat = new THREE.MeshStandardMaterial({color:0x5a5a5a, roughness:0.4, metalness:0.7});
for(let ix of[-0.6,0.6]) for(let iz of[-0.9,0.9]){
  bed.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.5,6),bmat)).position.set(ix,0.25,iz);
}
bed.add(new THREE.Mesh(new THREE.BoxGeometry(1.4,0.05,2.2),bmat)).position.y=0.5;
bed.add(new THREE.Mesh(new THREE.BoxGeometry(1.2,0.1,2),new THREE.MeshStandardMaterial({color:0x9a8a7a}))).position.y=0.58;
bed.position.set(ward1x,0,ward1z);
world.add(bed); addColMesh(bed);

// 右侧手术区
const opx=6, opz=-13;
createFloor(opx,0,opz,3,5); createCeiling(opx,0,opz,3,5);
createWall(opx-1.5,CH/2,opz,0.2,CH,5);
createWall(opx+1.5,CH/2,opz,0.2,CH,5);
createWall(opx,CH/2,opz-2.5,3,CH,0.2);
const optable = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.1,2.4),new THREE.MeshStandardMaterial({color:0x7a7a7a,roughness:0.3,metalness:0.9}));
optable.position.set(opx,0.8,opz); world.add(optable); addColMesh(optable);

// 停尸房
const morgueZ = -18;
createFloor(0,0,morgueZ, 6,4); createCeiling(0,0,morgueZ,6,4);
createWall(-3,CH/2,morgueZ,0.2,CH,4);
createWall(3,CH/2,morgueZ,0.2,CH,4);
createWall(0,CH/2,morgueZ-2,6,CH,0.2);
const trapdoor = new THREE.Mesh(new THREE.BoxGeometry(1,0.05,1), new THREE.MeshStandardMaterial({color:0x4a3a2a}));
trapdoor.position.set(0,0.05,morgueZ-1); trapdoor.rotation.x=-Math.PI/2;
world.add(trapdoor); trapdoor.userData.isTrapdoor=true;

// 地下室
const basementGroup = new THREE.Group();
basementGroup.position.set(0, -4, morgueZ-5);
function bwall(x,y,z,w,h,d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), bWallMat);
  m.position.set(x,y,z); basementGroup.add(m);
  boxCollider(m.position.x+basementGroup.position.x, m.position.y+basementGroup.position.y, m.position.z+basementGroup.position.z, w,h,d);
}
bwall(0,0,0,5,0.1,8); bwall(0,2.8,0,5,0.1,8);
bwall(-2.5,1.4,0,0.2,2.8,8); bwall(2.5,1.4,0,0.2,2.8,8);
bwall(0,1.4,-4,5,2.8,0.2);
world.add(basementGroup);
const generator = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,1.2,8), new THREE.MeshStandardMaterial({color:0x6a6a6a,roughness:0.5,metalness:0.7}));
generator.position.set(0,-4+0.6,morgueZ-9);
world.add(generator); generator.userData.isGenerator=true;

// 保险丝和医疗包
const fuses = [];
function createFuse(x,y,z) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.2,8), new THREE.MeshStandardMaterial({color:0xccaa44, roughness:0.3, metalness:0.8})));
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.15,0.6,6), new THREE.MeshBasicMaterial({color:0xffcc88, transparent:true, opacity:0.5, depthWrite:false}));
  glow.position.y=0.4; g.add(glow);
  g.position.set(x,y,z); g.userData.isFuse=true; g.userData.baseY=y;
  world.add(g); fuses.push(g);
}
createFuse(ward1x,0.8,ward1z-1.8);
createFuse(opx,0.9,opz-1.6);
createFuse(-2,0.7,morgueZ);
createFuse(1.5,-4+0.8,morgueZ-7);

const medkitMeshes = [];
function createMedkit(x,y,z) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3,0.2,0.2), new THREE.MeshStandardMaterial({color:0xcc3333})));
  g.position.set(x,y,z); g.userData.isMedkit=true;
  world.add(g); medkitMeshes.push(g);
}
createMedkit(ward1x+0.8,0.5,ward1z+0.5);
createMedkit(opx-0.8,0.5,opz+0.5);

// 笔记
const notes = [];
function addNote(x,y,z,tex) {
  const n = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.2), new THREE.MeshBasicMaterial({map:tex}));
  n.position.set(x,y,z); n.userData.isNote=true; world.add(n); notes.push(n);
}
addNote(ward1x,1.2,ward1z+1.5, createNoteTexture('调查员笔记\n保险丝被它们藏在\n各处。注意身后。'));
addNote(opx-1,1.0,opz, createNoteTexture('手术日志\n病人死前都提到了\n"影子"。'));
addNote(0,1.1,morgueZ-0.5, createNoteTexture('停尸房值班记录\n今晚又多了三具。'));

// 手电筒
const flashlight = new THREE.SpotLight(0xffeedd);
flashlight.angle=0.4; flashlight.penumbra=0.3; flashlight.decay=1.5; flashlight.distance=18;
flashlight.intensity=1.6; flashlight.castShadow=true;
flashlight.shadow.mapSize.set(512,512);
camera.add(flashlight);
flashlight.target.position.set(0,0,-1.5); camera.add(flashlight.target);
scene.add(new THREE.AmbientLight(0x0a0a18,0.2));

// 幽灵
const ghost = new THREE.Group();
const gMat = new THREE.MeshStandardMaterial({color:0x1a2a1a, roughness:0.3, transparent:true, opacity:0.5, emissive:0x0a1a0a});
ghost.add(new THREE.Mesh(new THREE.ConeGeometry(0.45,1.7,8),gMat)).position.y=0.85;
ghost.add(new THREE.Mesh(new THREE.SphereGeometry(0.33,8,6),gMat)).position.y=1.75;
ghost.position.set(2,0,-5);
world.add(ghost);
const ghostAI = {
  pos: new THREE.Vector3(2,0,-5),
  patrol: [new THREE.Vector3(2,0,-8),new THREE.Vector3(-3,0,-4),new THREE.Vector3(5,0,0)],
  idx:0,chase:false,speed:0.5,chaseSpeed:2.4,lastScare:0
};

// ================== 交互逻辑 ==================
function showMessage(text, dur=2.5) {
  messageEl.textContent=text; messageEl.style.opacity=1;
  clearTimeout(window._msgT); window._msgT=setTimeout(()=>messageEl.style.opacity=0,dur*1000);
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
  for(let i=fuses.length-1;i>=0;i--) {
    if(p.distanceTo(fuses[i].position)<2.5) {
      world.remove(fuses[i]); fuses.splice(i,1); fusesCollected++;
      sfx(660,'sine',0.15); sfx(880,'sine',0.2);
      showMessage(`⚡ 保险丝 (${fusesCollected}/${totalFuses})`);
      updateHUD(); return;
    }
  }
  for(let i=medkitMeshes.length-1;i>=0;i--) {
    if(p.distanceTo(medkitMeshes[i].position)<2.0) {
      world.remove(medkitMeshes[i]); medkitMeshes.splice(i,1); medkits++;
      showMessage('💊 获得医疗包，按Q使用');
      return;
    }
  }
  if(p.distanceTo(trapdoor.position)<2.5) {
    if(fusesCollected>=totalFuses) {
      showMessage('进入地下室...');
      camera.position.set(0,-4+1.7,morgueZ-4);
      objectiveEl.textContent='🎯 找到发电机并按E启动';
    } else showMessage(`需要${totalFuses-fusesCollected}个保险丝`);
  }
  if(camera.position.y<-3 && p.distanceTo(generator.position)<2.5) {
    winScreen.style.display='flex'; gameOver=true; stopAmbient();
    if(!isMobile && controls) controls.unlock();
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
  gameOver=true; deathScreen.style.display='flex'; stopAmbient();
  if(!isMobile && controls) controls.unlock();
  sfx(200,'sawtooth',0.9); sfx(40,'sawtooth',2);
}

// ================== 移动端虚拟摇杆设置 ==================
function setupMobileControls() {
  const moveJoystick = document.getElementById('joystickMove');
  const moveThumb = document.getElementById('joystickMoveThumb');
  const lookJoystick = document.getElementById('joystickLook');
  const lookThumb = document.getElementById('joystickLookThumb');

  let moveActive=false, lookActive=false;
  function handleMoveStart(e) {
    moveActive=true;
    e.preventDefault();
  }
  function handleMoveEnd(e) {
    moveActive=false;
    moveThumb.style.left='30px'; moveThumb.style.top='30px';
    mobileMoveX=0; mobileMoveY=0;
  }
  function handleMoveMove(e) {
    if(!moveActive) return;
    const touch = e.touches[0];
    const rect = moveJoystick.getBoundingClientRect();
    const centerX = rect.left + rect.width/2;
    const centerY = rect.top + rect.height/2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const maxDist = 30;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if(dist > maxDist) { dx = dx/dist*maxDist; dy = dy/dist*maxDist; }
    moveThumb.style.left = (30+dx) + 'px';
    moveThumb.style.top = (30+dy) + 'px';
    mobileMoveX = dx/maxDist;
    mobileMoveY = dy/maxDist;
  }

  function handleLookStart(e) {
    lookActive=true;
    e.preventDefault();
  }
  function handleLookEnd(e) {
    lookActive=false;
    lookThumb.style.left='30px'; lookThumb.style.top='30px';
    mobileLookX=0; mobileLookY=0;
  }
  function handleLookMove(e) {
    if(!lookActive) return;
    const touch = e.touches[0];
    const rect = lookJoystick.getBoundingClientRect();
    const centerX = rect.left + rect.width/2;
    const centerY = rect.top + rect.height/2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const maxDist = 30;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if(dist > maxDist) { dx = dx/dist*maxDist; dy = dy/dist*maxDist; }
    lookThumb.style.left = (30+dx) + 'px';
    lookThumb.style.top = (30+dy) + 'px';
    mobileLookX = dx/maxDist;
    mobileLookY = dy/maxDist;
  }

  moveJoystick.addEventListener('touchstart', handleMoveStart);
  moveJoystick.addEventListener('touchend', handleMoveEnd);
  moveJoystick.addEventListener('touchmove', handleMoveMove);
  lookJoystick.addEventListener('touchstart', handleLookStart);
  lookJoystick.addEventListener('touchend', handleLookEnd);
  lookJoystick.addEventListener('touchmove', handleLookMove);

  document.getElementById('btnFlashlight').addEventListener('click', () => {
    if(battery>0) { flashlightOn=!flashlightOn; showMessage(flashlightOn?'手电筒开启':'手电筒关闭'); }
    else showMessage('没电了');
  });
  document.getElementById('btnInteract').addEventListener('click', interact);
  document.getElementById('btnMedkit').addEventListener('click', useMedkit);
}

// ================== 动画循环 ==================
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(),0.15);
  if(gameStarted&&!gameOver) {
    // 移动输入
    let moveX=0, moveZ=0, lookX=0, lookY=0;
    if(isMobile) {
      moveX = mobileMoveX; moveZ = mobileMoveY;
      lookX = mobileLookX * 2; lookY = mobileLookY * 2;
    } else {
      if(controls && controls.isLocked) {
        if(keyState.w) moveZ-=1; if(keyState.s) moveZ+=1;
        if(keyState.a) moveX-=1; if(keyState.d) moveX+=1;
      }
    }

    if(moveX!==0 || moveZ!==0) {
      const move = new THREE.Vector3(moveX, 0, moveZ).normalize();
      const old = camera.position.clone();
      camera.translateX(move.x * 3.8 * delta);
      camera.translateZ(move.z * 3.8 * delta);
      if(checkCollision(camera.position)) camera.position.copy(old);
      if(Date.now()-lastFootstep>400) { sfx(70+Math.random()*30,'triangle',0.04); lastFootstep=Date.now(); }
    }
    if(isMobile && (lookX!==0 || lookY!==0)) {
      camera.rotation.y -= lookX * delta * 1.5;
      camera.rotation.x -= lookY * delta * 1.2;
      camera.rotation.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, camera.rotation.x));
    }

    // 手电筒
    if(flashlightOn) battery-=2.5*delta;
    if(battery<=0){battery=0; flashlightOn=false; flashlight.intensity=0.03; showMessage('⚠ 手电筒没电了！');}
    else flashlight.intensity=flashlightOn?1.6:0.03;
    updateHUD();

    // 幽灵AI
    const gp = ghostAI.pos;
    const dist = gp.distanceTo(camera.position);
    ghostAI.chase = (dist<9 && flashlightOn) || dist<4;
    const target = ghostAI.chase ? camera.position.clone() : ghostAI.patrol[ghostAI.idx];
    const dir = new THREE.Vector3().subVectors(target, gp).normalize();
    gp.add(dir.multiplyScalar((ghostAI.chase?2.4:0.5)*delta));
    ghost.position.copy(gp);
    if(dist<0.9) {
      playerHealth -= 35*delta;
      bloodOverlay.style.opacity=0.5;
      shakeAmount=Math.max(shakeAmount,0.2);
      if(playerHealth<=0) playerDeath();
    } else bloodOverlay.style.opacity=0;
    if(dist>10) playerHealth=Math.min(100, playerHealth+5*delta);
    if(dist<7&&Date.now()-ghostAI.lastScare>7000){ghostAI.lastScare=Date.now(); sfx(180,'sawtooth',0.5); showMessage('有什么东西在靠近...',1.5);}

    [...fuses, ...medkitMeshes].forEach(o => {
      if(o.userData.baseY!==undefined) o.position.y = o.userData.baseY + Math.sin(Date.now()*0.005)*0.1;
    });
    if(shakeAmount>0.001){
      camera.position.x+=(Math.random()-0.5)*shakeAmount*0.04;
      camera.position.y+=(Math.random()-0.5)*shakeAmount*0.03;
      shakeAmount*=Math.exp(-5*delta);
    }
  }
  renderer.render(scene,camera);
}

// ================== 键盘输入（桌面端） ==================
const keyState = {w:false,a:false,s:false,d:false};
document.addEventListener('keydown', e => {
  if(!gameStarted||gameOver) return;
  switch(e.code) {
    case'KeyW':keyState.w=true;break; case'KeyA':keyState.a=true;break;
    case'KeyS':keyState.s=true;break; case'KeyD':keyState.d=true;break;
    case'KeyF':if(battery>0){flashlightOn=!flashlightOn;showMessage(flashlightOn?'手电筒开启':'手电筒关闭');}else showMessage('没电了');break;
    case'Space':interact();break;
    case'KeyQ':useMedkit();break;
    case'KeyE':interact();break;
  }
});
document.addEventListener('keyup', e => {
  switch(e.code) {case'KeyW':keyState.w=false;break;case'KeyA':keyState.a=false;break;case'KeyS':keyState.s=false;break;case'KeyD':keyState.d=false;break;}
});

// ================== 启动流程 ==================
function startGame() {
  introScreen.style.display='none'; hud.style.display='flex'; gameStarted=true;
  initAudio(); startAmbient();
  if (isMobile) {
    mobileControlsDiv.style.display='block';
    setupMobileControls();
    showMessage('使用虚拟摇杆移动和视角');
  } else {
    showMessage('点击屏幕锁定鼠标');
    const lockHandler = () => {
      controls.lock();
      document.removeEventListener('click', lockHandler);
    };
    document.addEventListener('click', lockHandler);
    controls.addEventListener('lock', () => showMessage(''));
    controls.addEventListener('unlock', () => {
      if(gameStarted&&!gameOver) showMessage('点击屏幕重新锁定');
    });
  }
}

document.getElementById('continueButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', ()=>location.reload());
document.getElementById('restartButtonWin').addEventListener('click', ()=>location.reload());

window.addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

animate();