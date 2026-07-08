import * as THREE from 'three';

export function createWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  // 剥落墙皮
  ctx.fillStyle = '#4a5a4a'; ctx.fillRect(0,0,512,512);
  for(let i=0;i<400;i++) {
    ctx.fillStyle = `rgba(30,40,30,${0.15+Math.random()*0.4})`;
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*18+3, 0, Math.PI*2); ctx.fill();
  }
  // 水渍条纹
  for(let i=0;i<30;i++) {
    ctx.fillStyle = `rgba(50,60,50,${0.1+Math.random()*0.25})`;
    ctx.beginPath(); ctx.ellipse(Math.random()*512, Math.random()*512, Math.random()*60+15, Math.random()*30+5, Math.random()*Math.PI, 0, Math.PI*2); ctx.fill();
  }
  // 裂缝
  ctx.strokeStyle = '#1a251a'; ctx.lineWidth = 1.3;
  for(let i=0;i<25;i++) {
    ctx.beginPath(); ctx.moveTo(Math.random()*512, Math.random()*512);
    ctx.lineTo(Math.random()*512, Math.random()*512); ctx.stroke();
  }
  // 伪法线细节（暗色斑点）
  ctx.fillStyle = '#0f150f';
  for(let i=0;i<150;i++) {
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*4+1, 0, Math.PI*2); ctx.fill();
  }
  // 随机血迹
  if(Math.random()<0.5) {
    ctx.fillStyle = 'rgba(90,10,10,0.3)';
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*25+8, 0, Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1c1410'; ctx.fillRect(0,0,512,512);
  for(let y=0; y<512; y+=48) {
    ctx.fillStyle = y%96===0 ? '#2a1e18' : '#1f1712';
    ctx.fillRect(0,y,512,48);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for(let i=0;i<350;i++) {
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*7+1, 0, Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createBloodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(100,8,8,0.8)';
  ctx.beginPath(); ctx.arc(64,64,45,0,Math.PI*2); ctx.fill();
  for(let i=0;i<40;i++) {
    ctx.fillStyle = 'rgba(70,4,4,0.55)';
    ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, Math.random()*16+4, 0, Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createNoteTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e0d5c0'; ctx.fillRect(0,0,256,128);
  ctx.fillStyle = '#3a2a1a'; ctx.font = '14px "Courier New"';
  const lines = text.split('\n');
  lines.forEach((line, i) => ctx.fillText(line, 15, 25 + i * 18));
  return new THREE.CanvasTexture(canvas);
}