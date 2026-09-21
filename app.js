import * as THREE from "https://unpkg.com/three@0.167.1/build/three.module.js";

import { Jelly } from "./physics.js?v=chrome-aa-12";
import { shapeMapper } from "./shapes.js?v=chrome-aa-12";

const canvas = document.querySelector("#scene");
const hint = document.querySelector("#hint");
const ui = Object.fromEntries(["mass", "firmness", "brightness", "zoom", "massValue", "firmnessValue", "brightnessValue", "zoomValue", "nudge", "reset", "autorotate", "shadowToggle"].map(id => [id, document.getElementById(id)]));
const defaults = { mass: 1.25, firmness: 0.06, brightness: 1, zoom: 1 };
const settings = { ...defaults, damping: .95 };
function syncOutputs() {
  for (const name of Object.keys(defaults)) {
    settings[name] = Number(ui[name].value);
    ui[name + "Value"].value = settings[name].toFixed(2);
  }
}
syncOutputs();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
const renderScale=Math.max(1,Math.min(1.5,window.devicePixelRatio||1));
let refractionScale=.65;
renderer.setPixelRatio(renderScale);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef2f7);
const rearTarget = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
rearTarget.samples = 2;
rearTarget.depthTexture = new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
const bufferSize = new THREE.Vector2();
const frontTarget=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
frontTarget.texture.colorSpace=THREE.SRGBColorSpace;
const outputScene=new THREE.Scene(),outputCamera=new THREE.Camera();
const outputMaterial=new THREE.ShaderMaterial({
  uniforms:{source:{value:frontTarget.texture},resolution:{value:bufferSize}},depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:`uniform sampler2D source;uniform vec2 resolution;varying vec2 vUv;
  void main(){
    vec2 px=1.0/resolution;vec3 luma=vec3(.299,.587,.114);
    vec3 c=texture2D(source,vUv).rgb;
    float m=dot(c,luma),nw=dot(texture2D(source,vUv+vec2(-1.,1.)*px).rgb,luma),ne=dot(texture2D(source,vUv+px).rgb,luma),sw=dot(texture2D(source,vUv-px).rgb,luma),se=dot(texture2D(source,vUv+vec2(1.,-1.)*px).rgb,luma);
    float lo=min(m,min(min(nw,ne),min(sw,se))),hi=max(m,max(max(nw,ne),max(sw,se)));
    if(hi-lo<max(.006,hi*.04)){gl_FragColor=linearToOutputTexel(vec4(c,1.));return;}
    vec2 dir=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
    float reduce=max((nw+ne+sw+se)*.03125,.0078125);
    dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-8.),vec2(8.))*px;
    vec3 a=.5*(texture2D(source,vUv-dir/6.).rgb+texture2D(source,vUv+dir/6.).rgb);
    vec3 b=a*.5+.25*(texture2D(source,vUv-dir*.5).rgb+texture2D(source,vUv+dir*.5).rgb);
    float lb=dot(b,luma);gl_FragColor=linearToOutputTexel(vec4(lb<lo||lb>hi?a:b,1.));
  }`});
outputScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),outputMaterial));
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
function resizeScene() {
  const { width, height } = canvas.parentElement.getBoundingClientRect();
  camera.aspect = width / Math.max(height, 1);
  const distance = 3.2 / (Math.tan(THREE.MathUtils.degToRad(17)) * Math.min(camera.aspect, 1));
  const character=document.getElementById('shape')?.value !== 'cylinder';
  camera.position.set(0, character?7:5, distance*(character?.62:1));
  camera.lookAt(0, .15-.95*THREE.MathUtils.clamp((settings.zoom-1)/.5,0,1), 0);
  camera.zoom=settings.zoom;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.getDrawingBufferSize(bufferSize);
  frontTarget.setSize(bufferSize.x,bufferSize.y);
  rearTarget.setSize(Math.max(1,Math.round(bufferSize.x*refractionScale)),Math.max(1,Math.round(bufferSize.y*refractionScale)));
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
// A framed window, with dark mullions separating nine bright panes.
function windowLight(position,width,height,strength){
  const frame=new THREE.Group();frame.position.set(...position);frame.lookAt(0,0,0);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(width/3-.09,height/3-.09),new THREE.MeshBasicMaterial({color:new THREE.Color().setScalar(strength),side:THREE.DoubleSide}));
    pane.position.set((col-1)*width/3,(row-1)*height/3,0);frame.add(pane);
  }studio.add(frame);
}
studio.background=new THREE.Color(0x444c5c);
windowLight([-3,5,4],4.5,6,4.5);
windowLight([4,2,-3],2,3.2,2.2);
const pmrem=new THREE.PMREMGenerator(renderer);
const environment=pmrem.fromScene(studio,0);
scene.environment=environment.texture;pmrem.dispose();
studio.traverse(object => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
scene.add(new THREE.HemisphereLight(0xe9f3ff, 0x8c98b0, 0.65));
const key = new THREE.DirectionalLight(0xffffff, 1.3);
key.position.set(-3, 5, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfd8ff, 0.8);
rim.position.set(3, 2, -3); scene.add(rim);

// A feathered contact shadow avoids hard opaque shadow-map silhouettes.
const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = shadowCanvas.height = 128;
const ctx = shadowCanvas.getContext("2d");
const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
gradient.addColorStop(0, "rgba(19,40,92,0.48)");
gradient.addColorStop(0.45, "rgba(40,68,125,0.20)");
gradient.addColorStop(1, "rgba(34,50,78,0)");
ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.8),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.545; scene.add(ground);
// Fine floor seams give the transparent center a visible refracted reference.
const floorCanvas=document.createElement('canvas');floorCanvas.width=floorCanvas.height=256;
const floorContext=floorCanvas.getContext('2d');floorContext.fillStyle='#eef2f7';floorContext.fillRect(0,0,256,256);
floorContext.strokeStyle='rgba(90,112,148,.28)';floorContext.lineWidth=3;
floorContext.beginPath();floorContext.moveTo(0,0);floorContext.lineTo(256,0);floorContext.moveTo(0,0);floorContext.lineTo(0,256);floorContext.stroke();
const floorTexture=new THREE.CanvasTexture(floorCanvas);floorTexture.wrapS=floorTexture.wrapT=THREE.RepeatWrapping;floorTexture.repeat.set(666,666);floorTexture.colorSpace=THREE.SRGBColorSpace;
const floorMesh=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshBasicMaterial({map:floorTexture,toneMapped:false}));floorMesh.rotation.x=-Math.PI/2;floorMesh.position.y=-1.56;scene.add(floorMesh);


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
for (let i = 39; i >= 0; i--) profile.push(new THREE.Vector2(1.4 * i / 40, 0.58));
const source = new THREE.LatheGeometry(profile, 160).toNonIndexed();
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
// Render the exit surface first. Standard screen-space transmission omits it.
const rearMaterial = new THREE.MeshPhysicalMaterial({
  color:0x2f6bff, roughness:.025, metalness:0, side:THREE.BackSide,
  transparent:true, opacity:.08, depthWrite:true, envMapIntensity:1.3,
  clearcoat:.25, clearcoatRoughness:.025
});
rearMaterial.onBeforeCompile = shader => {
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
    'diffuseColor.a = 0.025 + 0.28 * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);\n#include <opaque_fragment>');
};
const rearMesh=new THREE.Mesh(jellyGeometry,rearMaterial);jellyGroup.add(rearMesh);
const transmissionTint=new THREE.Color(0x2f6bff);
const jellyMaterial = new THREE.MeshPhysicalMaterial({
  color:0xffffff, roughness:.012, metalness:0, transmission:0, transparent:true, depthWrite:false,
  thickness:1, ior:1.36, clearcoat:.18, clearcoatRoughness:.025, envMapIntensity:1.15
});
// Supply our own transmission buffer, avoiding a redundant built-in scene pass.
jellyMaterial.defines={...jellyMaterial.defines,USE_TRANSMISSION:''};
jellyMaterial.onBeforeCompile = shader => {
  Object.assign(shader.uniforms,{
    transmission:{value:1},thickness:{value:1},attenuationDistance:{value:2.8},
    attenuationColor:{value:transmissionTint},
    jellyRear:{value:rearTarget.texture},jellyDepth:{value:rearTarget.depthTexture},
    jellyScreenSize:{value:bufferSize},jellyNear:{value:camera.near},jellyFar:{value:camera.far}
  });
  let pars=THREE.ShaderChunk.transmission_pars_fragment
    .replace('uniform sampler2D transmissionSamplerMap;', 'uniform sampler2D jellyRear;\nuniform sampler2D jellyDepth;\nuniform vec2 jellyScreenSize;\nuniform float jellyNear;\nuniform float jellyFar;')
    .replace('return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );','return texture2D(jellyRear, clamp(fragCoord.xy, vec2(0.001), vec2(0.999)));')
    .replace('vec3 attenuatedColor = transmittance * transmittedLight.rgb;',
      '#ifdef ENVMAP_TYPE_CUBE_UV\nvec3 throughDirection = refract(-v, n, 1.0 / ior);\nvec3 throughRoom = textureCubeUV(envMap, envMapRotation * throughDirection, roughness).rgb;\ntransmittedLight.rgb = mix(transmittedLight.rgb, throughRoom, 0.03);\n#endif\nvec3 attenuatedColor = transmittance * transmittedLight.rgb;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_pars_fragment>',pars)
    .replace('#include <transmission_fragment>',THREE.ShaderChunk.transmission_fragment.replace('material.thickness = thickness;',
      'float exitDepth = texture2D(jellyDepth, gl_FragCoord.xy / jellyScreenSize).r;\nfloat exitZ = -perspectiveDepthToViewZ(exitDepth, jellyNear, jellyFar);\nmaterial.thickness = clamp(exitZ - vViewPosition.z, 0.015, 3.8);'));
};
const compileTransmission=jellyMaterial.onBeforeCompile;
jellyMaterial.onBeforeCompile=shader=>{
  compileTransmission(shader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
    '#include <opaque_fragment>\ngl_FragColor.a = 0.48 + 0.5 * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);');
};
jellyMaterial.customProgramCacheKey=()=> 'jelly-clear-film-v3';
const jellyMesh=new THREE.Mesh(jellyGeometry,jellyMaterial);jellyGroup.add(jellyMesh);
const characterColors={vocal:0x162ae3,dj:0x3c458f};
function updateAppearance(kind,mapper){
  const isCharacter=kind==='vocal'||kind==='dj';
  const base=new THREE.Color(isCharacter?characterColors[kind]:0x2f6bff),white=new THREE.Color(0xffffff);
  transmissionTint.copy(base);rearMaterial.color.copy(base);
  ground.material.color.copy(isCharacter?base.clone().lerp(white,.5):white);
  rim.color.copy(isCharacter?base.clone().lerp(white,.82):new THREE.Color(0xbfd8ff));
  key.intensity=isCharacter?2.1:1.3;
}

const initialMapper=shapeMapper('cat');
let body = new Jelly(initialMapper);
let skins = points.map(p => body.skin(p.toArray(),initialMapper(p.toArray())));
const shapeSelect=document.getElementById('shape');
function changeShape(){
  release();const mapper=shapeMapper(shapeSelect.value);body=new Jelly(mapper);
  skins=points.map(p=>body.skin(p.toArray(),mapper(p.toArray())));updateAppearance(shapeSelect.value,mapper);resizeScene();
}
shapeSelect.addEventListener('change',changeShape);
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
  const captured=new THREE.Vector3().fromBufferAttribute(positionAttr,index);
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
    hitPoint.x=THREE.MathUtils.clamp(hitPoint.x,-2.7,2.7);
    hitPoint.y=THREE.MathUtils.clamp(hitPoint.y,-1.35,2.5);
    hitPoint.z=THREE.MathUtils.clamp(hitPoint.z,-1.6,1.6);
    body.grab.desired=hitPoint.toArray();
  }
});
function release(){capturedIndex=-1;body.release();if(activePointer!==null && canvas.hasPointerCapture(activePointer))canvas.releasePointerCapture(activePointer);activePointer=null;canvas.style.cursor='grab';}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden){release();accumulator=0;last=performance.now();}});
function updateViewControls(){
  camera.zoom=settings.zoom;camera.lookAt(0,.15-.95*THREE.MathUtils.clamp((settings.zoom-1)/.5,0,1),0);camera.updateProjectionMatrix();
  const b=settings.brightness;
  jellyMaterial.envMapIntensity=1.15*b;rearMaterial.envMapIntensity=1.3*b;
  for(const mat of [jellyMaterial,rearMaterial])mat.specularIntensity=b;
  jellyMaterial.clearcoat=.18*b;rearMaterial.clearcoat=.25*b;
}
for(const name of Object.keys(defaults))ui[name].addEventListener('input',()=>{syncOutputs();updateViewControls();});
ui.nudge.addEventListener('click',()=>{release();body.nudge(settings.mass);});
ui.reset.addEventListener('click',()=>{release();body.reset();for(const name of Object.keys(defaults))ui[name].value=defaults[name];syncOutputs();updateViewControls();ui.autorotate.checked=true;ui.shadowToggle.checked=true;});
const renderPoint=[0,0,0];
let last=performance.now(),qualityFrames=0,qualityTime=0;
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.max(.0001,Math.min((now-last)/1000,.15));last=now;
  // Only lower resolution after a sustained slow interval; never alternate sizes.
  if(!document.hidden){
    qualityFrames++;qualityTime+=dt;
    if(qualityFrames>=45){
      if(qualityTime/qualityFrames>.021 && refractionScale>.5){refractionScale=Math.max(.5,refractionScale*.82);resizeScene();}
      qualityFrames=0;qualityTime=0;
    }
  }
  // Consume ordinary frame time in full, including 15–25 fps frames.
  const steps=Math.max(1,Math.ceil(dt/(1/90))), stepDt=dt/steps;
  for(let step=0;step<steps;step++){
    if(body.grab?.desired)for(let k=0;k<3;k++)body.grab.target[k]+=(body.grab.desired[k]-body.grab.target[k])*(1-Math.exp(-48/(.6+settings.mass)*stepDt));
    body.step(stepDt,settings);
  }
  body.prepareRender();
  // The render skin has more detail than the internal volume mesh.
  for(let i=0;i<vertexCount;i++){
    body.renderSample(skins[i],renderPoint);current[i].set(...renderPoint);
  }
  const smooth=.10;
  for(let i=0;i<vertexCount;i++){
    const p=current[i];let x=0,y=0,z=0;
    for(const j of neighbors[i]){x+=current[j].x;y+=current[j].y;z+=current[j].z;}
    const n=neighbors[i].length;
    let surfaceY=p.y*(1-smooth)+y/n*smooth;
    positionAttr.setXYZ(i,p.x*(1-smooth)+x/n*smooth,surfaceY,p.z*(1-smooth)+z/n*smooth);
  }
  // The entire unsculpted back is one plane, including when tilted above the floor.
  if(!body.grab){
    const {normal,origin}=body.backPlane();
    for(let i=0;i<vertexCount;i++)if(points[i].y<-.579){
      const p=[positionAttr.getX(i),positionAttr.getY(i),positionAttr.getZ(i)];
      const distance=p.reduce((s,v,k)=>s+(v-origin[k])*normal[k],0)*(1-Math.exp(-Math.pow(body.releaseAge/.12,2)));
      positionAttr.setXYZ(i,...p.map((v,k)=>v-distance*normal[k]));
    }
  }
  positionAttr.needsUpdate=true;jellyGeometry.computeVertexNormals();jellyGeometry.computeBoundingSphere();
  const center=body.p.reduce((a,p)=>a.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(1/body.p.length);
  ground.position.x=center.x;ground.position.z=center.z;
  ground.material.opacity=1/(1+Math.max(0,center.y+.97)*.65);ground.visible=ui.shadowToggle.checked;
  if(ui.autorotate.checked&&!body.grab){for(let i=0;i<body.p.length;i++){const p=body.p[i],a=dt*.025,x=p[0]-center.x,z=p[2]-center.z;p[0]=center.x+x*Math.cos(a)+z*Math.sin(a);p[2]=center.z+z*Math.cos(a)-x*Math.sin(a);}}
  {
    jellyMesh.visible=false;rearMesh.visible=true;
    renderer.setRenderTarget(rearTarget);renderer.render(scene,camera);
  }
  jellyMesh.visible=true;rearMesh.visible=false;
  renderer.setRenderTarget(frontTarget);renderer.render(scene,camera);
  renderer.setRenderTarget(null);renderer.render(outputScene,outputCamera);
}
requestAnimationFrame(animate);



