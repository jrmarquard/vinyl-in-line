import * as THREE from 'three';
import { createVinyl, createPlatter } from './vinyl.js';
import { createTonearm, PIVOT, ARM_START_ANGLE, ARM_END_ANGLE } from './tonearm.js';
import { VinylAudio } from './audio.js';

// ── Scene ──────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f0f);
scene.fog = new THREE.Fog(0x0f0f0f, 18, 30);

// ── Isometric camera ───────────────────────────────────────────────────────
const aspect = window.innerWidth / window.innerHeight;
const camSize = 5.5;
const camera = new THREE.OrthographicCamera(
  -camSize * aspect, camSize * aspect,
  camSize, -camSize,
  0.1, 100
);
// Classic isometric angle
camera.position.set(7, 7, 7);
camera.lookAt(0, 0, 0);

// ── Renderer ───────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// ── Lighting ───────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xfff4e0, 1.4);
key.position.set(6, 10, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 30;
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
key.shadow.bias = -0.001;
scene.add(key);

const fill = new THREE.DirectionalLight(0xc8d8ff, 0.3);
fill.position.set(-5, 4, -3);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xfff4e0, 0.2);
rim.position.set(0, -3, -6);
scene.add(rim);

// ── Objects ────────────────────────────────────────────────────────────────
const platter = createPlatter();
platter.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(platter);

const vinyl = createVinyl();
vinyl.position.y = 0.025;
vinyl.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(vinyl);

const tonearm = createTonearm();
tonearm.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(tonearm);

// ── State ──────────────────────────────────────────────────────────────────
let sideDuration = 30 * 60 * 1000; // ms
let elapsed = 0;
let lastTime = null;
let isPlaying = true;
let isDragging = false;
let dragPivotAngle = 0;
let dragMouseStart = new THREE.Vector2();
let vinylRpm = 33.3;

const audio = new VinylAudio();

// ── Raycasting helpers ─────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Collect tonearm meshes for hit-testing
const armMeshes = [];
tonearm.traverse(o => { if (o.isMesh) armMeshes.push(o); });

// Invisible wide hit area for easier arm grabbing
const hitGeo = new THREE.BoxGeometry(0.4, 0.15, 2.9);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const hitMesh = new THREE.Mesh(hitGeo, hitMat);
hitMesh.position.set(0, 0.06, -2.9 / 2);
tonearm.add(hitMesh);
armMeshes.push(hitMesh);

// ── Arm progress helpers ───────────────────────────────────────────────────
function clampAngle(a) {
  return Math.max(ARM_END_ANGLE, Math.min(ARM_START_ANGLE, a));
}

function progress() {
  return (ARM_START_ANGLE - tonearm.rotation.y) / (ARM_START_ANGLE - ARM_END_ANGLE);
}

// ── Skip logic ─────────────────────────────────────────────────────────────
let keyHistory = [];
function handleKeyMash() {
  const now = Date.now();
  keyHistory = keyHistory.filter(t => now - t < 400);
  keyHistory.push(now);
  if (keyHistory.length >= 5) {
    skipSide();
    keyHistory = [];
  }
}

function skipSide() {
  // Snap arm toward centre quickly then reset
  const remaining = ARM_END_ANGLE - tonearm.rotation.y;
  const steps = 60;
  let s = 0;
  const snap = setInterval(() => {
    tonearm.rotation.y += remaining / steps;
    if (++s >= steps) {
      clearInterval(snap);
      setTimeout(resetSide, 400);
    }
  }, 16);
}

function resetSide() {
  elapsed = 0;
  tonearm.rotation.y = ARM_START_ANGLE;
  updateStatus();
}

// ── Arm-drag mouse/touch handling ──────────────────────────────────────────
function toNDC(clientX, clientY) {
  return new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1,
  );
}

function hitTestArm(ndcX, ndcY) {
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  return raycaster.intersectObjects(armMeshes).length > 0;
}

// Project mouse onto a horizontal plane at arm height to get drag angle
function armAngleFromMouse(ndcX, ndcY) {
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PIVOT.y);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  if (!hit) return null;
  const dx = hit.x - PIVOT.x;
  const dz = hit.z - PIVOT.z;
  return Math.atan2(dx, -dz);
}

renderer.domElement.addEventListener('mousedown', e => {
  const ndc = toNDC(e.clientX, e.clientY);
  if (!hitTestArm(ndc.x, ndc.y)) return;
  isDragging = true;
  dragPivotAngle = tonearm.rotation.y;
  dragMouseStart = ndc.clone();
  renderer.domElement.style.cursor = 'grabbing';
  audio.resume();
  if (!audio.started) audio.start();
});

window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const ndc = toNDC(e.clientX, e.clientY);
  const angle = armAngleFromMouse(ndc.x, ndc.y);
  if (angle !== null) {
    tonearm.rotation.y = clampAngle(angle);
    elapsed = progress() * sideDuration;
  }
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    renderer.domElement.style.cursor = '';
  }
});

// Touch equivalents
renderer.domElement.addEventListener('touchstart', e => {
  const t = e.touches[0];
  const ndc = toNDC(t.clientX, t.clientY);
  if (!hitTestArm(ndc.x, ndc.y)) return;
  isDragging = true;
  e.preventDefault();
  audio.resume();
  if (!audio.started) audio.start();
}, { passive: false });

window.addEventListener('touchmove', e => {
  if (!isDragging) return;
  const t = e.touches[0];
  const ndc = toNDC(t.clientX, t.clientY);
  const angle = armAngleFromMouse(ndc.x, ndc.y);
  if (angle !== null) {
    tonearm.rotation.y = clampAngle(angle);
    elapsed = progress() * sideDuration;
  }
  e.preventDefault();
}, { passive: false });

window.addEventListener('touchend', () => { isDragging = false; });

// Key mash
window.addEventListener('keydown', e => {
  // Start audio on first keypress
  audio.resume();
  if (!audio.started) audio.start();
  handleKeyMash();
});

// Click canvas to start audio
renderer.domElement.addEventListener('click', () => {
  audio.resume();
  if (!audio.started) audio.start();
});

// ── Status label ───────────────────────────────────────────────────────────
const statusEl = document.getElementById('status');
function updateStatus() {
  const p = progress();
  const remaining = (1 - p) * sideDuration;
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  statusEl.textContent = `side a — ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Config panel ───────────────────────────────────────────────────────────
const configBtn = document.getElementById('config-btn');
const configPanel = document.getElementById('config-panel');
configBtn.addEventListener('click', () => configPanel.classList.toggle('open'));

function bindSlider(id, valId, onChange) {
  const slider = document.getElementById(id);
  const label = document.getElementById(valId);
  slider.addEventListener('input', () => {
    label.textContent = slider.value;
    onChange(parseInt(slider.value) / 100);
    audio.resume();
    if (!audio.started) audio.start();
  });
}

bindSlider('crackle', 'crackle-val', v => audio.setCrackle(v));
bindSlider('hiss', 'hiss-val', v => audio.setHiss(v));
bindSlider('volume', 'vol-val', v => audio.setMaster(v));

const durSlider = document.getElementById('duration');
const durVal = document.getElementById('dur-val');
durSlider.addEventListener('input', () => {
  durVal.textContent = durSlider.value;
  sideDuration = parseInt(durSlider.value) * 60 * 1000;
  elapsed = progress() * sideDuration;
});

document.getElementById('reset-btn').addEventListener('click', resetSide);

// ── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const a = window.innerWidth / window.innerHeight;
  camera.left = -camSize * a;
  camera.right = camSize * a;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Animation loop ─────────────────────────────────────────────────────────
const vinylRadPerMs = (vinylRpm / 60) * 2 * Math.PI * 0.001;

function animate(now) {
  requestAnimationFrame(animate);

  if (lastTime !== null && isPlaying) {
    const dt = now - lastTime;

    // Spin vinyl
    vinyl.rotation.y += vinylRadPerMs * dt;

    // Drift arm (only when not dragging)
    if (!isDragging) {
      elapsed += dt;
      if (elapsed >= sideDuration) {
        elapsed = sideDuration;
        isPlaying = false;
        setTimeout(() => { resetSide(); isPlaying = true; }, 1500);
      }
      const t = elapsed / sideDuration;
      // Ease-in slightly — real vinyl drifts non-linearly due to groove geometry
      const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      tonearm.rotation.y = ARM_START_ANGLE + (ARM_END_ANGLE - ARM_START_ANGLE) * easedT;
    }

    if (now % 1000 < 20) updateStatus();
  }

  lastTime = now;
  renderer.render(scene, camera);
}

updateStatus();
requestAnimationFrame(animate);
