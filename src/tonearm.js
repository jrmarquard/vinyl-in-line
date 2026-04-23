import * as THREE from 'three';

// Pivot is at world position (3.0, 0, 2.4) — rear-right of platter.
// Stylus world pos = (pivot.x - L*sin(θ), 0, pivot.z - L*cos(θ)) where L=3.12.
// ARM_START_ANGLE=0.35 → stylus at r≈2.0 (outer groove)
// ARM_END_ANGLE=0.90   → stylus at r≈0.72 (inner groove)
export const PIVOT = new THREE.Vector3(3.0, 0, 2.4);
export const ARM_START_ANGLE = 0.35;   // radians — on the record
export const ARM_END_ANGLE   = 0.90;   // radians — near label

export function createTonearm() {
  const group = new THREE.Group();
  group.position.copy(PIVOT);

  const metal = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.25, metalness: 0.85 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });

  // ── Pivot base (bearing housing) ──
  const bearingGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.10, 24);
  const bearing = new THREE.Mesh(bearingGeo, metal);
  bearing.position.y = 0.05;
  group.add(bearing);

  // ── Arm tube ── offset so pivot is at one end
  const armLen = 2.9;
  const armGeo = new THREE.CylinderGeometry(0.035, 0.028, armLen, 12);
  const arm = new THREE.Mesh(armGeo, metal);
  // Lay horizontal, point along -Z (local), offset so base is at group origin
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, 0.06, -armLen / 2);
  group.add(arm);

  // ── Headshell connector ── slight angle at tip
  const connGeo = new THREE.BoxGeometry(0.10, 0.055, 0.28);
  const conn = new THREE.Mesh(connGeo, darkMetal);
  conn.position.set(0, 0.06, -armLen - 0.06);
  conn.rotation.x = 0.12;
  group.add(conn);

  // ── Cartridge body ──
  const cartGeo = new THREE.BoxGeometry(0.09, 0.07, 0.22);
  const cartMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.1 });
  const cart = new THREE.Mesh(cartGeo, cartMat);
  cart.position.set(0, 0.02, -armLen - 0.14);
  group.add(cart);

  // ── Stylus cantilever ──
  const stylGeo = new THREE.CylinderGeometry(0.008, 0.004, 0.14, 8);
  const stylMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.9 });
  const styl = new THREE.Mesh(stylGeo, stylMat);
  styl.rotation.x = -Math.PI / 2 + 0.3;
  styl.position.set(0, -0.02, -armLen - 0.22);
  group.add(styl);

  // ── Counterweight ──
  const cwGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 20);
  const cw = new THREE.Mesh(cwGeo, darkMetal);
  cw.rotation.x = Math.PI / 2;
  cw.position.set(0, 0.06, 0.22);
  group.add(cw);

  // Start at rest position
  group.rotation.y = ARM_START_ANGLE;

  return group;
}

// Returns the world-space stylus tip position for a given arm group
export function getStylusTip(armGroup) {
  const armLen = 2.9;
  const local = new THREE.Vector3(0, 0, -armLen - 0.22);
  return local.applyMatrix4(armGroup.matrixWorld);
}
