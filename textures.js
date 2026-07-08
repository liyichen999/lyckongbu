import * as THREE from 'three';

export function createWallTexture(type = 'old') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = type==='basement' ? '#2a2a2a' : '#3a4a3a';
  ctx.fillRect(0,0,512,512);
  for (let i=0;i<500;i++) {
    ctx.fillStyle = `rgba(${type==='basement'?'20,20,20':'20,30,20'},${0.2+Math.random()*0.4})`;
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*20+4, 0, Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle = '#1a251a'; ctx.lineWidth = 1.5;
  for (let i=0;i<30;i++) {
    ctx.beginPath(); ctx.moveTo(Math.random()*512, Math.random()*512);
    ctx.lineTo(Math.random()*512, Math.random()*512); ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1c1410'; ctx.fillRect(0,0,512,512);
  for (let y=0; y<512; y+=48) {
    ctx.fillStyle = y%96===0 ? '#2a1e18' : '#1f1712';
    ctx.fillRect(0,y,512,48);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i=0;i<400;i++) {
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*8+1, 0, Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createBloodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(100,8,8,0.85)';
  ctx.beginPath(); ctx.arc(64,64,45,0,Math.PI*2); ctx.fill();
  for (let i=0;i<60;i++) {
    ctx.fillStyle = 'rgba(80,5,5,0.6)';
    ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, Math.random()*18+5, 0, Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createWindowRainTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a14'; ctx.fillRect(0,0,512,512);
  ctx.fillStyle = '#1a2a3a'; 
  for (let i=0;i<20;i++) {
    ctx.fillRect(Math.random()*512, Math.random()*512, Math.random()*60+20, Math.random()*4+1);
  }
  // 雨滴
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.5;
  for (let i=0;i<100;i++) {
    const x = Math.random()*512, y = Math.random()*512;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-2, y+10); ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}