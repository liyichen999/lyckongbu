import * as THREE from 'three';

export function createWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  // 基底：剥落的绿色墙漆
  ctx.fillStyle = '#3a4a3a'; ctx.fillRect(0,0,512,512);
  // 深色污渍
  for (let i=0;i<300;i++) {
    ctx.fillStyle = `rgba(20,30,20,${0.1+Math.random()*0.3})`;
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*14+2, 0, Math.PI*2);
    ctx.fill();
  }
  // 水渍
  for (let i=0;i<20;i++) {
    ctx.fillStyle = `rgba(40,50,40,${0.1+Math.random()*0.2})`;
    ctx.beginPath(); ctx.ellipse(Math.random()*512, Math.random()*512, Math.random()*50+10, Math.random()*25+5, Math.random()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  }
  // 裂缝
  ctx.strokeStyle = '#1a241a'; ctx.lineWidth = 1.2;
  for (let i=0;i<18;i++) {
    ctx.beginPath(); ctx.moveTo(Math.random()*512, Math.random()*512);
    ctx.lineTo(Math.random()*512, Math.random()*512); ctx.stroke();
  }
  // 偶尔的血迹
  if (Math.random()<0.4) {
    ctx.fillStyle = 'rgba(80,10,10,0.25)';
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*25+10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(50,5,5,0.3)';
    for (let i=0;i<6;i++) {
      ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*8+3, 0, Math.PI*2); ctx.fill();
    }
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
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i=0;i<250;i++) {
    ctx.beginPath(); ctx.arc(Math.random()*512, Math.random()*512, Math.random()*6+1, 0, Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export function createBloodDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(90,8,8,0.7)';
  ctx.beginPath(); ctx.arc(64,64,40,0,Math.PI*2); ctx.fill();
  for (let i=0;i<30;i++) {
    ctx.fillStyle = 'rgba(60,4,4,0.5)';
    ctx.beginPath(); ctx.arc(Math.random()*128, Math.random()*128, Math.random()*14+3, 0, Math.PI*2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}