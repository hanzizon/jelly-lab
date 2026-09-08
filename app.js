import * as THREE from "https://unpkg.com/three@0.167.1/build/three.module.js";

const canvas = document.querySelector("#scene");
const hint = document.querySelector("#hint");

const ui = {
  mass: document.querySelector("#mass"),
  firmness: document.querySelector("#firmness"),
  damping: document.querySelector("#damping"),
  smoothing: document.querySelector("#smoothing"),
  massValue: document.querySelector("#massValue"),
  firmnessValue: document.querySelector("#firmnessValue"),
  dampingValue: document.querySelector("#dampingValue"),
  smoothingValue: document.querySelector("#smoothingValue"),
  nudge: document.querySelector("#nudge"),
  reset: document.querySelector("#reset"),
  autorotate: document.querySelector("#autorotate"),
  shadowToggle: document.querySelector("#shadowToggle"),
};

const settings = {
  mass: Number(ui.mass.value),
  stiffness: Number(ui.firmness.value),
  damping: Number(ui.damping.value),
  smoothing: Number(ui.smoothing.value),
};

function syncOutputs() {
  ui.massValue.value = Number(ui.mass.value).toFixed(2);
  ui.firmnessValue.value = Number(ui.firmness.value).toFixed(2);
  ui.dampingValue.value = Number(ui.damping.value).toFixed(2);
  ui.smoothingValue.value = Number(ui.smoothing.value).toFixed(2);
}

syncOutputs();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xececec);
scene.fog = new THREE.Fog(0xececec, 12, 20);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.1, 6.6);

const hemi = new THREE.HemisphereLight(0xffffff, 0xd7d7d7, 1.25);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
keyLight.position.set(4, 6, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.radius = 5;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 18;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
scene.add(keyLight);

const fillLight = new THREE.PointLight(0xffc3df, 18, 18, 2);
fillLight.position.set(-3, 1.5, 4);
scene.add(fillLight);

const backLight = new THREE.PointLight(0xffffff, 8, 20, 2);
backLight.position.set(0, 3, -6);
scene.add(backLight);

const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.16 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 64), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.45;
ground.receiveShadow = true;
scene.add(ground);

const jellyGroup = new THREE.Group();
scene.add(jellyGroup);

// Weld triangle corners so the spring network shares vertices across faces.
const sourceGeometry = new THREE.IcosahedronGeometry(1.8, 5);
const uniqueVertices = [];
const vertexLookup = new Map();
const triangleIndices = [];
const sourcePositions = sourceGeometry.attributes.position;
for (let i = 0; i < sourcePositions.count; i += 1) {
  const vertex = new THREE.Vector3().fromBufferAttribute(sourcePositions, i);
  const key = vertex.toArray().map((value) => Math.round(value * 1e5)).join(",");
  if (!vertexLookup.has(key)) {
    vertexLookup.set(key, uniqueVertices.length);
    uniqueVertices.push(vertex);
  }
  triangleIndices.push(vertexLookup.get(key));
}
const jellyGeometry = new THREE.BufferGeometry().setFromPoints(uniqueVertices);
jellyGeometry.setIndex(triangleIndices);
jellyGeometry.computeVertexNormals();
sourceGeometry.dispose();
const positionAttr = jellyGeometry.attributes.position;
const vertexCount = positionAttr.count;
const rest = [];
const current = [];
const velocity = [];
const neighborMap = Array.from({ length: vertexCount }, () => new Set());

const index = jellyGeometry.index;
if (index) {
  const idx = index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i];
    const b = idx[i + 1];
    const c = idx[i + 2];
    neighborMap[a].add(b);
    neighborMap[a].add(c);
    neighborMap[b].add(a);
    neighborMap[b].add(c);
    neighborMap[c].add(a);
    neighborMap[c].add(b);
  }
}
const neighbors = neighborMap.map((set) => [...set]);

for (let i = 0; i < vertexCount; i += 1) {
  const v = new THREE.Vector3().fromBufferAttribute(positionAttr, i);
  rest.push(v.clone());
  current.push(v.clone());
  velocity.push(new THREE.Vector3());
}

const jellyMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xff2e93,
  roughness: 0.14,
  metalness: 0.0,
  transmission: 0.94,
  thickness: 2.1,
  ior: 1.18,
  transparent: true,
  opacity: 0.96,
  clearcoat: 0.8,
  clearcoatRoughness: 0.14,
  attenuationColor: new THREE.Color(0xff87c6),
  attenuationDistance: 2.2,
  envMapIntensity: 1.1,
});

const jellyMesh = new THREE.Mesh(jellyGeometry, jellyMaterial);
jellyMesh.castShadow = true;
jellyGroup.add(jellyMesh);
jellyGroup.position.y = -0.1;

const innerCore = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.72, 3),
  new THREE.MeshPhysicalMaterial({
    color: 0xa30051,
    roughness: 0.2,
    transmission: 0.48,
    thickness: 1.4,
    transparent: true,
    opacity: 0.3,
  }),
);
innerCore.position.set(-0.28, -0.48, 0.08);
jellyGroup.add(innerCore);

const accentCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.17, 24, 24),
  new THREE.MeshStandardMaterial({
    color: 0x2d1030,
    emissive: 0x280820,
    roughness: 0.18,
    metalness: 0.08,
  }),
);
accentCore.position.set(-0.8, -0.95, 0.6);
jellyGroup.add(accentCore);

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane();
const planeHit = new THREE.Vector3();
const localGrabPoint = new THREE.Vector3();
const pullVector = new THREE.Vector3();
const tempVecA = new THREE.Vector3();
const tempVecB = new THREE.Vector3();
const avgNeighbor = new THREE.Vector3();

let dragging = false;
let dragRadius = 0.9;
let dragStrength = 0.18;
let idlePhase = 0;
let motionVelocity = new THREE.Vector3();
let moveMomentum = new THREE.Vector3();

function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function applyImpulseAt(localPoint, impulse, radius = 1.0) {
  for (let i = 0; i < vertexCount; i += 1) {
    const dist = current[i].distanceTo(localPoint);
    if (dist > radius) continue;
    const falloff = 1 - dist / radius;
    velocity[i].addScaledVector(impulse, falloff * 0.7);
    const outward = tempVecA.copy(current[i]).sub(localPoint).normalize();
    velocity[i].addScaledVector(outward, falloff * impulse.length() * 0.04);
  }
}

function resetShape() {
  for (let i = 0; i < vertexCount; i += 1) {
    current[i].copy(rest[i]);
    velocity[i].set(0, 0, 0);
  }
  jellyGroup.position.set(0, -0.1, 0);
  jellyGroup.rotation.set(0.1, -0.3, 0.06);
  moveMomentum.set(0, 0, 0);
  motionVelocity.set(0, 0, 0);
  dragging = false;
  pullVector.set(0, 0, 0);
}

resetShape();

function onPointerDown(event) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(jellyMesh, false)[0];
  if (!hit) return;
  dragging = true;
  hint.style.opacity = "0";
  localGrabPoint.copy(jellyMesh.worldToLocal(hit.point.clone()));
  dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tempVecA).normalize(), hit.point);
}

function onPointerMove(event) {
  if (!dragging) return;
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;
  const targetLocal = jellyMesh.worldToLocal(planeHit.clone());
  pullVector.copy(targetLocal).sub(localGrabPoint);
  applyImpulseAt(localGrabPoint, pullVector.clone().multiplyScalar(dragStrength / settings.mass), dragRadius);
  moveMomentum.addScaledVector(jellyMesh.localToWorld(tempVecB.copy(pullVector)).sub(jellyGroup.position), 0.0006);
}

function endDrag() {
  if (!dragging) return;
  dragging = false;
  applyImpulseAt(localGrabPoint, pullVector.clone().multiplyScalar(0.2), dragRadius * 1.2);
  pullVector.set(0, 0, 0);
}

canvas.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);

ui.mass.addEventListener("input", () => {
  settings.mass = Number(ui.mass.value);
  syncOutputs();
});
ui.firmness.addEventListener("input", () => {
  settings.stiffness = Number(ui.firmness.value);
  syncOutputs();
});
ui.damping.addEventListener("input", () => {
  settings.damping = Number(ui.damping.value);
  syncOutputs();
});
ui.smoothing.addEventListener("input", () => {
  settings.smoothing = Number(ui.smoothing.value);
  syncOutputs();
});
ui.nudge.addEventListener("click", () => {
  const direction = new THREE.Vector3((Math.random() - 0.5) * 0.35, Math.random() * 0.2 + 0.04, (Math.random() - 0.5) * 0.22);
  const localPoint = new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.9, (Math.random() - 0.5) * 0.8);
  applyImpulseAt(localPoint, direction, 1.15);
  moveMomentum.add(direction.clone().multiplyScalar(0.09));
  hint.style.opacity = "0";
});
ui.reset.addEventListener("click", resetShape);
ui.shadowToggle.addEventListener("change", () => {
  ground.visible = ui.shadowToggle.checked;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function updateSoftBody(dt) {
  const stiffness = settings.stiffness * 60 * dt;
  const damping = Math.pow(settings.damping, dt * 60);
  const smoothing = settings.smoothing * 60 * dt;

  for (let i = 0; i < vertexCount; i += 1) {
    avgNeighbor.set(0, 0, 0);
    const linked = neighbors[i];
    for (let j = 0; j < linked.length; j += 1) {
      avgNeighbor.add(current[linked[j]]);
    }
    if (linked.length > 0) avgNeighbor.multiplyScalar(1 / linked.length);
    else avgNeighbor.copy(current[i]);

    const spring = tempVecA.copy(rest[i]).sub(current[i]).multiplyScalar(stiffness / settings.mass);
    const cohesive = tempVecB.copy(avgNeighbor).sub(current[i]).multiplyScalar(smoothing);
    velocity[i].add(spring).add(cohesive);
    velocity[i].y -= 0.0012 * settings.mass;
    velocity[i].multiplyScalar(damping);
  }

  for (let i = 0; i < vertexCount; i += 1) {
    current[i].add(velocity[i]);
    positionAttr.setXYZ(i, current[i].x, current[i].y, current[i].z);
  }
  positionAttr.needsUpdate = true;
  jellyGeometry.computeVertexNormals();
  jellyGeometry.computeBoundingSphere();
}

function updateGlobalMotion(dt) {
  motionVelocity.lerp(moveMomentum, 0.08);
  moveMomentum.multiplyScalar(0.94);
  jellyGroup.position.x += motionVelocity.x * 0.03;
  jellyGroup.position.y += motionVelocity.y * 0.03;
  jellyGroup.position.z += motionVelocity.z * 0.03;

  jellyGroup.position.x += (0 - jellyGroup.position.x) * 0.045;
  jellyGroup.position.y += (-0.1 - jellyGroup.position.y) * 0.04;
  jellyGroup.position.z += (0 - jellyGroup.position.z) * 0.04;

  jellyGroup.rotation.z += motionVelocity.x * 0.01;
  jellyGroup.rotation.x += motionVelocity.z * 0.008;
  jellyGroup.rotation.x += (0.1 - jellyGroup.rotation.x) * 0.015;
  jellyGroup.rotation.y += (-0.3 - jellyGroup.rotation.y) * 0.015;
  jellyGroup.rotation.z += (0.06 - jellyGroup.rotation.z) * 0.018;

  const energy = Math.min(1, motionVelocity.length() * 12 + pullVector.length() * 0.9);
  const stretch = 1 + energy * 0.07;
  jellyMesh.scale.set(1 - energy * 0.04, stretch, 1 - energy * 0.02);
  innerCore.scale.setScalar(1 + energy * 0.05);
  accentCore.scale.setScalar(1 + energy * 0.08);

  if (ui.autorotate.checked && !dragging) {
    idlePhase += dt;
    jellyGroup.rotation.y += 0.0025 + Math.sin(idlePhase * 0.6) * 0.0007;
    jellyGroup.position.x += Math.sin(idlePhase * 0.8) * 0.0025;
    jellyGroup.position.y += Math.cos(idlePhase * 1.1) * 0.0018;
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  updateSoftBody(dt);
  updateGlobalMotion(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
