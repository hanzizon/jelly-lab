import * as THREE from "https://unpkg.com/three@0.167.1/build/three.module.js";

import { Jelly } from "./physics.js?v=volume-01";
import { RGBELoader } from "https://unpkg.com/three@0.167.1/examples/jsm/loaders/RGBELoader.js";

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
  const distance = 3.2 / (Math.tan(THREE.MathUtils.degToRad(17)) * Math.min(camera.aspect, 1));
  camera.position.set(0, 3.6, distance);
  camera.lookAt(0, 0.15, 0);
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
new RGBELoader().load("https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/poly_haven_studio_1k.hdr", texture => {
  const hdr = pmrem.fromEquirectangular(texture);
  scene.environment = hdr.texture; texture.dispose(); environment.dispose(); pmrem.dispose();
}, undefined, () => pmrem.dispose());
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
  color: 0xd5e6ff, roughness: 0.035, metalness: 0,
  transmission: 1, thickness: 3.1, ior: 1.24,
  opacity: 1, clearcoat: 1, clearcoatRoughness: 0.04,
  attenuationColor: new THREE.Color(0x2f6bff), attenuationDistance: 1.8,
  envMapIntensity: 1.0,
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


const body = new Jelly();
const skins = points.map(p => body.skin(p.toArray()));
jellyGroup.position.set(0,0,0);
const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(), hitPoint = new THREE.Vector3();
let activePointer = null, accumulator = 0, capturedIndex = -1;
const dragOffset = new THREE.Vector3();
function pointerRay(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  raycaster.setFromCamera(pointer,camera);
}
canvas.addEventListener('pointerdown', event => {
  if(activePointer !== null) return;
  pointerRay(event);
  const hit = raycaster.intersectObject(jellyMesh)[0];
  if(!hit) return;
  const face = hit.face, ids=[face.a,face.b,face.c];
  const index=ids.reduce((a,b)=>new THREE.Vector3().fromBufferAttribute(positionAttr,a).distanceToSquared(hit.point)<new THREE.Vector3().fromBufferAttribute(positionAttr,b).distanceToSquared(hit.point)?a:b);
  const captured=new THREE.Vector3(...body.sample(skins[index]));
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),hit.point);
  dragOffset.copy(captured).sub(hit.point);
  capturedIndex=index; body.pin(skins[index],captured.toArray());
  activePointer=event.pointerId; canvas.setPointerCapture(activePointer);
  hint.classList.add('hidden'); canvas.style.cursor='grabbing';
});
canvas.addEventListener('pointermove', event => {
  if(event.pointerId !== activePointer)return;
  pointerRay(event);
  if(raycaster.ray.intersectPlane(plane,hitPoint)){
    hitPoint.add(dragOffset);
    hitPoint.x=THREE.MathUtils.clamp(hitPoint.x,-4,4);
    hitPoint.y=THREE.MathUtils.clamp(hitPoint.y,-1.35,4);
    hitPoint.z=THREE.MathUtils.clamp(hitPoint.z,-3,3);
    body.grab.target=hitPoint.toArray();
  }
});
function release(){capturedIndex=-1;body.grab=null;if(activePointer!==null && canvas.hasPointerCapture(activePointer))canvas.releasePointerCapture(activePointer);activePointer=null;canvas.style.cursor='grab';}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden){release();accumulator=0;}});
for(const name of Object.keys(defaults))ui[name].addEventListener('input',syncOutputs);
ui.nudge.addEventListener('click',()=>{release();body.nudge();});
ui.reset.addEventListener('click',()=>{release();body.reset();for(const name of Object.keys(defaults))ui[name].value=defaults[name];syncOutputs();ui.autorotate.checked=true;ui.shadowToggle.checked=true;});
let last=performance.now();
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000,.04);last=now;accumulator+=dt;
  while(accumulator>=1/120){body.step(1/120,settings);accumulator-=1/120;}
  // The render skin has more detail than the internal volume mesh.
  for(let i=0;i<vertexCount;i++){
    const p=body.sample(skins[i]);current[i].set(...p);
  }
  const smooth=settings.smoothing*1.8;
  for(let i=0;i<vertexCount;i++){
    const p=current[i];let x=0,y=0,z=0;
    for(const j of neighbors[i]){x+=current[j].x;y+=current[j].y;z+=current[j].z;}
    const n=neighbors[i].length;
    positionAttr.setXYZ(i,p.x*(1-smooth)+x/n*smooth,p.y*(1-smooth)+y/n*smooth,p.z*(1-smooth)+z/n*smooth);
  }
  if(body.grab && capturedIndex>=0) positionAttr.setXYZ(capturedIndex,...body.grab.target);
  positionAttr.needsUpdate=true;jellyGeometry.computeVertexNormals();jellyGeometry.computeBoundingSphere();
  const center=body.p.reduce((a,p)=>a.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(1/body.p.length);
  ground.position.x=center.x;ground.position.z=center.z;
  ground.material.opacity=1/(1+Math.max(0,center.y+.97)*.65);ground.visible=ui.shadowToggle.checked;
  if(ui.autorotate.checked&&!body.grab){for(let i=0;i<body.p.length;i++){const p=body.p[i],a=dt*.025,x=p[0]-center.x,z=p[2]-center.z;p[0]=center.x+x*Math.cos(a)+z*Math.sin(a);p[2]=center.z+z*Math.cos(a)-x*Math.sin(a);}}
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
