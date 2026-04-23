import * as THREE from 'three';

// ── Label texture (procedural canvas) ──────────────────────────────────────
function buildLabelTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1209';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  const cx = size / 2, cy = size / 2;

  // Concentric rings — muted ochre
  const rings = [0.38, 0.3, 0.22, 0.15];
  rings.forEach((r, i) => {
    ctx.strokeStyle = `rgba(200,169,110,${0.12 + i * 0.06})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * size, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Thin arc segments (abstract deep house geometry)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const len = 0.28 + Math.random() * 0.08;
    ctx.strokeStyle = `rgba(200,169,110,${0.2 + Math.random() * 0.15})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, len * size, angle, angle + 0.45);
    ctx.stroke();
  }

  // Centre spindle hole
  ctx.fillStyle = '#0a0804';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// ── Groove texture (procedural canvas) ────────────────────────────────────
function buildGrooveTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.48;
  const innerR = size * 0.22;
  const grooveCount = 80;

  for (let i = 0; i <= grooveCount; i++) {
    const t = i / grooveCount;
    const r = innerR + (outerR - innerR) * t;
    const alpha = 0.06 + (Math.sin(t * Math.PI) * 0.04);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// ── Vinyl record group ─────────────────────────────────────────────────────
export function createVinyl() {
  const group = new THREE.Group();

  const diskMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.3,
    metalness: 0.15,
    map: buildGrooveTexture(),
  });

  // Main disc — radius 2, height 0.04
  const diskGeo = new THREE.CylinderGeometry(2, 2, 0.04, 128, 1);
  const disk = new THREE.Mesh(diskGeo, diskMat);
  group.add(disk);

  // Slightly raised label area
  const labelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.045, 64);
  const labelMat = new THREE.MeshStandardMaterial({
    map: buildLabelTexture(),
    roughness: 0.7,
    metalness: 0.0,
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.y = 0.001;
  group.add(label);

  // Spindle hole (dark cylinder punched through)
  const holeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.06, 32);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
  const hole = new THREE.Mesh(holeGeo, holeMat);
  hole.position.y = 0.001;
  group.add(hole);

  return group;
}

// ── Turntable platter / base ───────────────────────────────────────────────
export function createPlatter() {
  const group = new THREE.Group();

  // Platter rim (slightly larger than vinyl)
  const platGeo = new THREE.CylinderGeometry(2.12, 2.12, 0.06, 128);
  const platMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.4,
  });
  const platter = new THREE.Mesh(platGeo, platMat);
  platter.position.y = -0.05;
  group.add(platter);

  // Base platform
  const baseGeo = new THREE.BoxGeometry(5.8, 0.12, 5.8);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x141414,
    roughness: 0.8,
    metalness: 0.05,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = -0.14;
  group.add(base);

  // Spindle post
  const spindleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 16);
  const spindleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 });
  const spindle = new THREE.Mesh(spindleGeo, spindleMat);
  spindle.position.y = 0.05;
  group.add(spindle);

  return group;
}
