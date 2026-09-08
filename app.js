import * as THREE from "https://unpkg.com/three@0.167.1/build/three.module.js";

const canvas = document.querySelector("#scene");
const hint = document.querySelector("#hint");
const ui = Object.fromEntries(["mass", "firmness", "damping", "smoothing", "massValue", "firmnessValue", "dampingValue", "smoothingValue", "nudge", "reset", "autorotate", "shadowToggle"].map(id => [id, document.getElementById(id)]));
const defaults = { mass: 1.25, firmness: 0.12, damping: 0.90, smoothing: 0.08 };
const settings = { ...defaults };
function syncOutputs() {
  for (const name of Object.keys(defaults)) {
    settings[name] = Number(ui[name].value);
    ui[name + "Value"].value = settings[name].toFixed(2);
  }
}
syncOutputs();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef2f7);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
function resizeScene() {
  const { width, height } = canvas.parentElement.getBoundingClientRect();
  camera.aspect = width / Math.max(height, 1);
  const distance = 2.55 / (Math.tan(THREE.MathUtils.degToRad(17)) * Math.min(camera.aspect, 1));
  camera.position.set(0, 3.6, distance);
  camera.lookAt(0, -0.35, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
resizeScene();
window.addEventListener("resize", resizeScene);

// A small procedural studio: broad softboxes produce real reflected highlights.
const studio = new THREE.Scene();
studio.background = new THREE.Color(0x7b8496);
function softbox(width, height, position, strength) {
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(strength), side: THREE.DoubleSide }));
  panel.position.set(...position);
  panel.lookAt(0, 0, 0);
  studio.add(panel);
}
softbox(4, 6, [-4, 4, 5], 5);
softbox(1.3, 5, [4, 1, 2], 3.5);
softbox(3, 3, [1, 5, -3], 4);
softbox(5, 1.5, [-1, -3, 4], 1.8);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(studio, 0.01);
scene.environment = environment.texture;
pmrem.dispose();
studio.traverse(object => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
scene.add(new THREE.HemisphereLight(0xe9f3ff, 0x8c98b0, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(-3, 5, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfd8ff, 1.5);
rim.position.set(3, 2, -3); scene.add(rim);

// A feathered contact shadow avoids hard opaque shadow-map silhouettes.
const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = shadowCanvas.height = 128;
const ctx = shadowCanvas.getContext("2d");
const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
gradient.addColorStop(0, "rgba(34,50,78,0.27)");
gradient.addColorStop(0.45, "rgba(34,50,78,0.13)");
gradient.addColorStop(1, "rgba(34,50,78,0)");
ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.8),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.55; scene.add(ground);

const jellyGroup = new THREE.Group(); scene.add(jellyGroup);
// Closed, rounded flat cylinder. Dense concentric rings allow a fine pinch.
const profile = [];
for (let i = 0; i <= 12; i++) profile.push(new THREE.Vector2(1.4 * i / 12, -0.58));
for (let i = 1; i <= 10; i++) {
  const a = -Math.PI / 2 + i / 10 * Math.PI / 2;
  profile.push(new THREE.Vector2(1.4 + 0.24 * Math.cos(a), -0.34 + 0.24 * Math.sin(a)));
}
for (let i = 1; i <= 6; i++) profile.push(new THREE.Vector2(1.64, -0.34 + i / 6 * 0.68));
for (let i = 1; i <= 10; i++) {
  const a = i / 10 * Math.PI / 2;
  profile.push(new THREE.Vector2(1.4 + 0.24 * Math.cos(a), 0.34 + 0.24 * Math.sin(a)));
}
for (let i = 11; i >= 0; i--) profile.push(new THREE.Vector2(1.4 * i / 12, 0.58));
const source = new THREE.LatheGeometry(profile, 80).toNonIndexed();
const lookup = new Map(), points = [], indices = [];
for (let i = 0; i < source.attributes.position.count; i++) {
  const v = new THREE.Vector3().fromBufferAttribute(source.attributes.position, i);
  const hash = v.toArray().map(x => Math.round(x * 1e5)).join(",");
  if (!lookup.has(hash)) { lookup.set(hash, points.length); points.push(v); }
  indices.push(lookup.get(hash));
}
source.dispose();
const jellyGeometry = new THREE.BufferGeometry().setFromPoints(points);
jellyGeometry.setIndex(indices); jellyGeometry.computeVertexNormals();
const positionAttr = jellyGeometry.attributes.position;
positionAttr.setUsage(THREE.DynamicDrawUsage);
const vertexCount = points.length;
const rest = points.map(v => v.clone());
const current = points.map(v => v.clone());
const velocity = points.map(() => new THREE.Vector3());
const links = points.map(() => new Set());
for (let i = 0; i < indices.length; i += 3) {
  const [a, b, c] = indices.slice(i, i + 3);
  links[a].add(b).add(c); links[b].add(a).add(c); links[c].add(a).add(b);
}
const neighbors = links.map(set => [...set]);
const jellyMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xf1f6ff, roughness: 0.05, metalness: 0,
  transmission: 1, thickness: 2.8, ior: 1.24,
  opacity: 1, clearcoat: 1, clearcoatRoughness: 0.04,
  attenuationColor: new THREE.Color(0x2f6bff), attenuationDistance: 4.2,
  envMapIntensity: 1.15,
});
// Approximate the shorter optical path at the silhouette; keep the rim clear.
// Pinned to the Three.js r167 transmission chunk used above.
jellyMaterial.onBeforeCompile = shader => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <transmission_fragment>",
    THREE.ShaderChunk.transmission_fragment.replace("material.thickness = thickness;",
      "material.thickness = thickness * (0.08 + 0.92 * pow(abs(dot(normal, normalize(vViewPosition))), 1.6));")
  );
};
jellyMaterial.customProgramCacheKey = () => "jelly-optical-depth-v1";
const jellyMesh = new THREE.Mesh(jellyGeometry, jellyMaterial);
jellyGroup.add(jellyMesh);
jellyGroup.position.y = -0.08;

// Small inclusions make refraction visible, with delayed motion inside the gel.
const inclusions = new THREE.Group();
jellyGroup.add(inclusions);
const beadMaterial = new THREE.MeshPhysicalMaterial({ color: 0x173b9a, roughness: 0.1, metalness: 0.12, clearcoat: 1 });
for (const [x, y, z, radius] of [[-0.72,-0.22,0.28,0.085],[0.63,-0.16,-0.1,0.05],[-0.4,0.18,-0.42,0.035]]) {
  const bead = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 12), beadMaterial);
  bead.position.set(x, y, z); inclusions.add(bead);
}
const coreVelocity = new THREE.Vector3();
const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(), planeHit = new THREE.Vector3();
const grabRest = new THREE.Vector3(), grabStart = new THREE.Vector3();
const targetWorld = new THREE.Vector3(), easedWorld = new THREE.Vector3();
const grabOffset = new THREE.Vector3(), targetLocal = new THREE.Vector3();
const pullVector = new THREE.Vector3(), smoothedPull = new THREE.Vector3();
const pointerVelocity = new THREE.Vector3(), lastPointerWorld = new THREE.Vector3();
const average = new THREE.Vector3(), force = new THREE.Vector3(), temp = new THREE.Vector3();
const centerOffset = new THREE.Vector3(), worldPoint = new THREE.Vector3();
const bodyVelocity = new THREE.Vector3(), angularVelocity = new THREE.Vector3();
const spin = new THREE.Quaternion(), inverseRotation = new THREE.Quaternion();
const grabWeights = new Float32Array(vertexCount);
const floorY = -1.55;
let activePointer = null, dragging = false, accumulator = 0, grabIndex = 0;
let lastPointerTime = 0, simulationTime = 0;

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
function onPointerDown(event) {
  if (activePointer !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
  jellyGroup.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  setPointer(event);
  const hit = raycaster.intersectObject(jellyMesh, false)[0];
  if (!hit) return;
  dragging = true; activePointer = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = "grabbing"; hint.style.opacity = "0";
  grabStart.copy(jellyMesh.worldToLocal(hit.point.clone()));
  let distance = Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const d = current[i].distanceToSquared(grabStart);
    if (d < distance) { distance = d; grabIndex = i; }
  }
  grabRest.copy(rest[grabIndex]);
  grabOffset.copy(current[grabIndex]).sub(grabStart);
  // A fingertip-sized tip, with a gentle transition into the surrounding skin.
  for (let i = 0; i < vertexCount; i++) {
    const d = rest[i].distanceTo(grabRest);
    grabWeights[i] = Math.exp(-d * d / 0.085);
  }
  targetWorld.copy(hit.point); easedWorld.copy(hit.point); lastPointerWorld.copy(hit.point);
  pointerVelocity.set(0, 0, 0); bodyVelocity.set(0, 0, 0); angularVelocity.set(0, 0, 0);
  lastPointerTime = performance.now();
  dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(temp), hit.point);
}
function onPointerMove(event) {
  if (event.pointerId !== activePointer) return;
  setPointer(event);
  if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;
  // Bound extreme off-screen stretches without changing a stationary target.
  temp.copy(planeHit).sub(jellyGroup.position).clampLength(0, 4.5);
  targetWorld.copy(jellyGroup.position).add(temp);
  const now = performance.now(), dt = Math.max((now - lastPointerTime) / 1000, 0.008);
  pointerVelocity.lerp(temp.copy(targetWorld).sub(lastPointerWorld).divideScalar(dt).clampLength(0, 12), 0.4);
  lastPointerWorld.copy(targetWorld); lastPointerTime = now;
}
function endDrag(event, cancel = false) {
  if (event && event.pointerId !== undefined && event.pointerId !== activePointer) return;
  const wasDragging = dragging, id = activePointer;
  activePointer = null; dragging = false;
  if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  canvas.style.cursor = "grab";
  if (wasDragging && !cancel) {
    const freshness = Math.exp(-Math.max(0, performance.now() - lastPointerTime - 40) / 100);
    temp.copy(pointerVelocity).multiplyScalar(0.4 * freshness);
    worldPoint.copy(current[grabIndex]).sub(rest[grabIndex]).applyQuaternion(jellyGroup.quaternion);
    temp.addScaledVector(worldPoint, 0.5).clampLength(0, 5.5);
    bodyVelocity.addScaledVector(temp, 1 / Math.sqrt(settings.mass));
    const lever = worldPoint.copy(grabRest).applyQuaternion(jellyGroup.quaternion);
    angularVelocity.copy(lever).cross(temp).multiplyScalar(1.3 / settings.mass).clampLength(0, 7);
  }
  pullVector.set(0, 0, 0);
}
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", event => endDrag(event, true));
canvas.addEventListener("lostpointercapture", event => endDrag(event, true));
window.addEventListener("blur", () => endDrag(undefined, true));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) endDrag(undefined, true);
  accumulator = 0; clock.getDelta();
});
function applyImpulseAt(point, impulse, radius = 0.9) {
  for (let i = 0; i < vertexCount; i++) {
    const weight = Math.exp(-rest[i].distanceToSquared(point) / (radius * radius));
    velocity[i].addScaledVector(impulse, weight / settings.mass);
  }
}
function uploadSurface() {
  for (let i = 0; i < vertexCount; i++) positionAttr.setXYZ(i, current[i].x, current[i].y, current[i].z);
  positionAttr.needsUpdate = true;
  jellyGeometry.computeVertexNormals();
  jellyGeometry.computeBoundingSphere();
}
function resetShape() {
  endDrag(undefined, true);
  for (const name of Object.keys(defaults)) ui[name].value = defaults[name];
  syncOutputs();
  for (let i = 0; i < vertexCount; i++) { current[i].copy(rest[i]); velocity[i].set(0, 0, 0); }
  smoothedPull.set(0, 0, 0); inclusions.position.set(0, 0, 0); coreVelocity.set(0, 0, 0);
  bodyVelocity.set(0, 0, 0); angularVelocity.set(0, 0, 0);
  jellyGroup.position.set(0, floorY + 0.58, 0); jellyGroup.rotation.set(0, -0.22, 0);
  accumulator = 0; simulationTime = 0;
  ui.autorotate.checked = true; ui.shadowToggle.checked = true; ground.visible = true;
  hint.style.opacity = "1"; uploadSurface(); jellyGroup.updateMatrixWorld(true);
}
for (const name of Object.keys(defaults)) ui[name].addEventListener("input", syncOutputs);
ui.reset.addEventListener("click", resetShape);
ui.shadowToggle.addEventListener("change", () => { ground.visible = ui.shadowToggle.checked; });
ui.nudge.addEventListener("click", () => {
  if (dragging) return;
  applyImpulseAt(new THREE.Vector3(-0.8, 0.4, 0.8), new THREE.Vector3(0.5, 1.5, -0.3));
  bodyVelocity.add(new THREE.Vector3(0.3, 5.6, 0.1)).clampLength(0, 6.5);
  angularVelocity.add(new THREE.Vector3(6.8, 0.4, -1.4)).clampLength(0, 7);
  hint.style.opacity = "0";
});

// Fixed 120 Hz integration separates viscous surface deformation from body flight.
function updateSoftBody(dt) {
  simulationTime += dt;
  if (dragging) {
    easedWorld.lerp(targetWorld, 1 - Math.exp(-12 * dt));
    targetLocal.copy(easedWorld).sub(jellyGroup.position).applyQuaternion(inverseRotation.copy(jellyGroup.quaternion).invert()).add(grabOffset);
    smoothedPull.copy(targetLocal).sub(grabRest);
  }
  const stiffness = settings.firmness * 115;
  const drag = 3.0 + (settings.damping - 0.75) * 18;
  const decay = Math.exp(-drag * dt / Math.sqrt(settings.mass));
  centerOffset.set(0, 0, 0);
  for (let i = 0; i < vertexCount; i++) {
    average.set(0, 0, 0);
    for (const j of neighbors[i]) average.add(temp.copy(current[j]).sub(rest[j]));
    average.multiplyScalar(1 / neighbors[i].length);
    const displacement = temp.copy(current[i]).sub(rest[i]);
    force.copy(displacement).multiplyScalar(-stiffness);
    force.addScaledVector(average.sub(displacement), settings.smoothing * 550);
    if (dragging) {
      force.addScaledVector(average.copy(smoothedPull).sub(displacement), 145 * grabWeights[i]);
      // A tiny held shimmer moves the neck, never the captured fingertip.
      force.y += Math.sin(simulationTime * 5 + rest[i].x * 2) * 0.05 * grabWeights[i];
    }
    velocity[i].addScaledVector(force, dt / settings.mass).multiplyScalar(decay);
  }
  for (let i = 0; i < vertexCount; i++) {
    current[i].addScaledVector(velocity[i], dt);
    // The captured surface point stays at the target even when no move event arrives.
    if (dragging && i === grabIndex) {
      current[i].copy(targetLocal); velocity[i].set(0, 0, 0);
    }
    centerOffset.add(temp.copy(current[i]).sub(rest[i]));
  }
  centerOffset.multiplyScalar(1 / vertexCount);
  coreVelocity.addScaledVector(temp.copy(centerOffset).multiplyScalar(0.3).sub(inclusions.position), dt * 16).multiplyScalar(Math.exp(-5 * dt));
  inclusions.position.addScaledVector(coreVelocity, dt);
}
function updateBody(dt) {
  if (dragging) return;
  bodyVelocity.y -= 8.5 * dt;
  bodyVelocity.x += -jellyGroup.position.x * 0.65 * dt;
  bodyVelocity.z += -jellyGroup.position.z * 0.65 * dt;
  bodyVelocity.multiplyScalar(Math.exp(-0.65 * dt));
  jellyGroup.position.addScaledVector(bodyVelocity, dt);
  angularVelocity.multiplyScalar(Math.exp(-0.45 * dt));
  const angle = angularVelocity.length() * dt;
  if (angle > 0.000001) {
    spin.setFromAxisAngle(temp.copy(angularVelocity).normalize(), angle);
    jellyGroup.quaternion.premultiply(spin).normalize();
  }
  let lowest = Infinity, contact = 0;
  for (let i = 0; i < vertexCount; i++) {
    worldPoint.copy(current[i]).applyQuaternion(jellyGroup.quaternion);
    if (worldPoint.y < lowest) { lowest = worldPoint.y; contact = i; }
  }
  const penetration = floorY - jellyGroup.position.y - lowest;
  if (penetration > 0) {
    jellyGroup.position.y += penetration;
    const impact = Math.max(0, -bodyVelocity.y);
    if (bodyVelocity.y < 0) bodyVelocity.y = impact > 0.45 ? impact * 0.33 : 0;
    bodyVelocity.x *= Math.exp(-5 * dt); bodyVelocity.z *= Math.exp(-5 * dt);
    angularVelocity.multiplyScalar(Math.exp(-3.5 * dt));
    // Contact torque lets the cylinder fall onto either flat face.
    const up = worldPoint.set(0, 1, 0).applyQuaternion(jellyGroup.quaternion);
    const sign = up.y >= 0 ? 1 : -1;
    angularVelocity.addScaledVector(temp.copy(up).cross(new THREE.Vector3(0, sign, 0)), dt * 15);
    if (impact > 0.45) {
      const localImpulse = temp.set(0, -impact * 0.45, 0).applyQuaternion(inverseRotation.copy(jellyGroup.quaternion).invert());
      applyImpulseAt(rest[contact], localImpulse, 1.0);
    }
    if (ui.autorotate.checked) jellyGroup.rotateY(dt * 0.035);
  }
  ground.position.x = jellyGroup.position.x;
  ground.position.z = jellyGroup.position.z;
  const height = Math.max(0, jellyGroup.position.y + lowest - floorY);
  ground.scale.setScalar(1 + height * 0.14);
  ground.material.opacity = 1 / (1 + height * 0.6);
}
const clock = new THREE.Clock();
resetShape();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!document.hidden) {
    accumulator += dt;
    while (accumulator >= 1 / 120) {
      updateSoftBody(1 / 120); updateBody(1 / 120); accumulator -= 1 / 120;
    }
    uploadSurface();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}
animate();
