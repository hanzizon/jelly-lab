import * as THREE from "https://unpkg.com/three@0.167.1/build/three.module.js";

import { Jelly } from "./physics.js?v=carbonation-24";
import { shapeMapper } from "./shapes.js?v=carbonation-24";

const canvas = document.querySelector("#scene");

const ui = Object.fromEntries(["mass", "firmness", "brightness", "zoom", "viewAngle", "opacity", "photoScale", "massValue", "firmnessValue", "brightnessValue", "zoomValue", "viewAngleValue", "opacityValue", "photoScaleValue", "nudge", "reset", "autorotate", "shadowToggle"].map(id => [id, document.getElementById(id)]));
const defaults = { mass: 1.25, firmness: 0.06, brightness: 1, zoom: 1, viewAngle:45, opacity:50, photoScale:100 };
const settings = { ...defaults, damping: .95 };
function syncOutputs() {
  for (const name of Object.keys(defaults)) {
    settings[name] = Number(ui[name].value);
    ui[name + "Value"].value = name==='viewAngle'?`${settings[name]}°`:['opacity','photoScale'].includes(name)?`${settings[name]}%`:settings[name].toFixed(2);
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
let updatePhotoLayout=()=>{};
const cameraFocus=new THREE.Vector3(0,-.8,0);
function updateCameraPose(){
  const radius=2.9/(Math.tan(THREE.MathUtils.degToRad(17))*Math.min(camera.aspect,1));
  const angle=THREE.MathUtils.degToRad(settings.viewAngle);
  camera.up.set(0,Math.cos(angle),-Math.sin(angle));
  camera.position.set(0,cameraFocus.y+Math.sin(angle)*radius,Math.cos(angle)*radius);
  camera.lookAt(cameraFocus);camera.zoom=settings.zoom;camera.updateProjectionMatrix();
}
function resizeScene() {
  const { width, height } = canvas.parentElement.getBoundingClientRect();
  camera.aspect = width / Math.max(height, 1);
  updateCameraPose();
  renderer.setSize(width, height);
  renderer.getDrawingBufferSize(bufferSize);
  frontTarget.setSize(bufferSize.x,bufferSize.y);
  rearTarget.setSize(Math.max(1,Math.round(bufferSize.x*refractionScale)),Math.max(1,Math.round(bufferSize.y*refractionScale)));
  updatePhotoLayout();
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
windowLight([-3,6,-4],4.5,6,4.5);
windowLight([5,3,2],2,3.2,1.4);
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

// The uploaded photo lives on the same 3D floor, never on a flat CSS backdrop.
const photoMaterial=new THREE.MeshBasicMaterial({toneMapped:false,transparent:true,opacity:.7,depthWrite:false});
const photoFloor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),photoMaterial);
photoFloor.rotation.x=-Math.PI/2;photoFloor.position.y=-1.558;photoFloor.visible=false;photoFloor.renderOrder=-1;scene.add(photoFloor);
const backgroundInput=document.getElementById('backgroundPhoto');
const backgroundReset=document.getElementById('backgroundReset');
const backgroundStatus=document.getElementById('backgroundStatus');
let photoAspect=1,photoRequest=0;
updatePhotoLayout=()=>{
  if(!photoFloor.visible)return;
  camera.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),floor=new THREE.Plane(new THREE.Vector3(0,1,0),1.558),hits=[];
  // Cover the whole allowed orbit once; do not slide the photo as the view tilts.
  const probe=camera.clone(),radius=camera.position.distanceTo(cameraFocus);probe.zoom=.75;
  for(const degrees of [0,15,30,45,60,75,90]){
    const angle=THREE.MathUtils.degToRad(degrees);
    probe.up.set(0,Math.cos(angle),-Math.sin(angle));
    probe.position.set(0,cameraFocus.y+Math.sin(angle)*radius,Math.cos(angle)*radius);
    probe.lookAt(cameraFocus);probe.updateProjectionMatrix();probe.updateMatrixWorld(true);
    for(const x of [-1,1])for(const y of [-1,1]){
      ray.setFromCamera(new THREE.Vector2(x,y),probe);
      const hit=ray.ray.intersectPlane(floor,new THREE.Vector3());if(hit)hits.push(hit);
    }
  }
  if(hits.length<4)return;
  const minX=Math.min(...hits.map(p=>p.x)),maxX=Math.max(...hits.map(p=>p.x));
  const minZ=Math.min(...hits.map(p=>p.z)),maxZ=Math.max(...hits.map(p=>p.z));
  const width=Math.max(2*Math.max(Math.abs(minX),Math.abs(maxX)),2*Math.max(Math.abs(minZ),Math.abs(maxZ))*photoAspect)*1.08;
  const scale=settings.photoScale/100;
  photoFloor.scale.set(width*scale,width/photoAspect*scale,1);
  const center=body.frame().center;
  photoFloor.position.set(center[0],-1.558,center[2]);
};
backgroundInput.addEventListener('change',async()=>{
  const file=backgroundInput.files?.[0];if(!file)return;
  const request=++photoRequest;
  if(!/^image\/(jpeg|png|webp|avif)$/.test(file.type)){backgroundStatus.textContent='JPG, PNG, WebP 또는 AVIF 사진을 선택해 주세요.';return;}
  backgroundStatus.textContent='사진을 적용하고 있습니다…';
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    if(request!==photoRequest)return;
    const limit=Math.min(2048,renderer.capabilities.maxTextureSize),ratio=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
    const surface=document.createElement('canvas');surface.width=Math.max(1,Math.round(image.naturalWidth*ratio));surface.height=Math.max(1,Math.round(image.naturalHeight*ratio));
    const context=surface.getContext('2d');context.fillStyle='#eef2f7';context.fillRect(0,0,surface.width,surface.height);
    context.drawImage(image,0,0,surface.width,surface.height);
    const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    photoMaterial.map?.dispose();photoMaterial.map=texture;photoMaterial.needsUpdate=true;
    photoAspect=surface.width/surface.height;photoFloor.visible=true;floorMesh.visible=true;updatePhotoLayout();
    backgroundReset.disabled=false;backgroundStatus.textContent='사진이 원근감 있는 바닥 배경으로 적용되었습니다.';
  }catch(error){if(request===photoRequest)backgroundStatus.textContent='사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.';}
  finally{URL.revokeObjectURL(url);backgroundInput.value='';}
});
backgroundReset.addEventListener('click',()=>{
  photoRequest++;photoFloor.visible=false;floorMesh.visible=true;
  photoMaterial.map?.dispose();photoMaterial.map=null;photoMaterial.needsUpdate=true;
  backgroundInput.value='';backgroundReset.disabled=true;backgroundStatus.textContent='기본 배경으로 돌아왔습니다.';
});


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
const jellyOpacity={value:.5};
const rearMaterial = new THREE.MeshPhysicalMaterial({
  color:0x2f6bff, roughness:.025, metalness:0, side:THREE.BackSide,
  transparent:true, opacity:.08, depthWrite:true, envMapIntensity:1.3,
  clearcoat:.25, clearcoatRoughness:.025
});
rearMaterial.onBeforeCompile = shader => {
  shader.uniforms.jellyOpacity=jellyOpacity;
  shader.fragmentShader='uniform float jellyOpacity;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
    'diffuseColor.a = (0.025 + 0.28 * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0))*jellyOpacity/0.5;\n#include <opaque_fragment>');
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
const windowBrightness={value:1};
jellyMaterial.onBeforeCompile=shader=>{
  compileTransmission(shader);
  shader.uniforms.windowBrightness=windowBrightness;
  shader.uniforms.jellyOpacity=jellyOpacity;
  shader.vertexShader='varying vec3 jellyWorldPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\njellyWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='uniform float windowBrightness;\nuniform float jellyOpacity;\nvarying vec3 jellyWorldPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
    `// Add only the bright window panes. Changing their strength must not
     // increase clearcoat energy loss or deepen the transmitted rear surface.
       vec3 windowRay=inverseTransformDirection(reflect(-normalize(vViewPosition),normal),viewMatrix);
       vec3 windowCenter=vec3(-2.5,6.0,-7.0);
       vec3 windowNormal=normalize(-windowCenter);
       vec3 windowRight=normalize(cross(vec3(0.0,1.0,0.0),windowNormal));
       vec3 windowUp=cross(windowNormal,windowRight);
       float windowDen=dot(windowRay,windowNormal);
       if(abs(windowDen)>0.0001){
         float windowT=dot(windowCenter-jellyWorldPosition,windowNormal)/windowDen;
         vec3 windowHit=jellyWorldPosition+windowRay*windowT-windowCenter;
         vec2 windowUv=vec2(dot(windowHit,windowRight)/4.5,dot(windowHit,windowUp)/5.5)+0.5;
         vec2 edgeWidth=max(fwidth(windowUv)*1.5,vec2(0.003));
         vec2 outer=smoothstep(vec2(0.0),edgeWidth,windowUv)*(1.0-smoothstep(vec2(1.0)-edgeWidth,vec2(1.0),windowUv));
         vec2 pane=fract(windowUv*vec2(2.0,3.0));
         vec2 bars=smoothstep(vec2(0.035),vec2(0.055)+edgeWidth,pane)*(1.0-smoothstep(vec2(0.945)-edgeWidth,vec2(0.965),pane));
         float panes=outer.x*outer.y*bars.x*bars.y*step(0.0,windowT);
         outgoingLight+=vec3(1.0,0.98,0.94)*panes*windowBrightness*0.85;
       }
     #include <opaque_fragment>
     float edgeGlow=pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.0);
     gl_FragColor.a = mix(jellyOpacity,max(jellyOpacity,0.62),edgeGlow);`);
};
jellyMaterial.customProgramCacheKey=()=> 'jelly-window-highlight-v4';
const jellyMesh=new THREE.Mesh(jellyGeometry,jellyMaterial);jellyGroup.add(jellyMesh);
const characterColors={vocal:0x162ae3,dj:0x3c458f};
const colorInput=document.getElementById('jellyColor'),bubbleToggle=document.getElementById('bubbles');
let customColor=null;
function updateAppearance(kind,mapper){
  const isCharacter=kind==='vocal'||kind==='dj';
  const base=new THREE.Color(customColor||(isCharacter?characterColors[kind]:0x2f6bff)),white=new THREE.Color(0xffffff);
  colorInput.value='#'+base.getHexString();
  transmissionTint.copy(base);rearMaterial.color.copy(base);
  ground.material.color.copy(isCharacter?base.clone().lerp(white,.5):white);
  rim.color.copy(isCharacter?base.clone().lerp(white,.82):new THREE.Color(0xbfd8ff));
  key.intensity=isCharacter?2.1:1.3;
}

const initialMapper=shapeMapper('cat');
let body = new Jelly(initialMapper);
let bubbleMapper=initialMapper;
let skins = points.map(p => body.skin(p.toArray(),initialMapper(p.toArray())));
const shapeSelect=document.getElementById('shape');
function changeShape(){
  release();const mapper=shapeMapper(shapeSelect.value);body=new Jelly(mapper);bubbleMapper=mapper;buildBubblePaths();
  skins=points.map(p=>body.skin(p.toArray(),mapper(p.toArray())));updateAppearance(shapeSelect.value,mapper);resizeScene();
}
shapeSelect.addEventListener('change',changeShape);
colorInput.addEventListener('input',()=>{customColor=colorInput.value;updateAppearance(shapeSelect.value,bubbleMapper);});
// Bubbles are sampled from interior material coordinates, so they stay inside
// the deforming volume. Paths are cached when the shape changes.
const bubbleCount=34;
let bubbleExcitement=0;
const bubbleMesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.04,metalness:0,transparent:true,opacity:.8,depthWrite:false,envMapIntensity:2}),bubbleCount);
const popMesh=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.07,5,16),new THREE.MeshBasicMaterial({color:0xf1f8ff,transparent:true,opacity:.5,depthWrite:false}),bubbleCount);
bubbleMesh.material.onBeforeCompile=shader=>{
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
 float rim=pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.0);
 float gleam=pow(max(0.0,dot(normal,normalize(vec3(-.5,.7,.5)))),32.0);
 gl_FragColor.rgb=mix(vec3(.025,.055,.13),vec3(1.55),smoothstep(.08,.43,rim))+gleam*2.4;
 gl_FragColor.a=clamp(.13+rim*1.05+gleam*.95,0.0,.98);`);
};
bubbleMesh.renderOrder=1;popMesh.renderOrder=1;jellyMesh.renderOrder=2;
bubbleMesh.frustumCulled=false;popMesh.frustumCulled=false;scene.add(bubbleMesh,popMesh);
const bubbleTransform=new THREE.Object3D(),bubbleRay=new THREE.Raycaster(),bubbleStates=[];
const bubbleBounds=new THREE.Box3(),bubbleUp=new THREE.Vector3(0,1,0);
function buildBubblePaths(){bubbleStates.length=0;}
buildBubblePaths();
function updateBubbles(dt){
 bubbleMesh.visible=popMesh.visible=bubbleToggle.checked;if(!bubbleToggle.checked){bubbleExcitement=0;return;}
 bubbleExcitement*=Math.exp(-dt/.65);
 jellyGeometry.computeBoundingBox();bubbleBounds.copy(jellyGeometry.boundingBox);
 const size=bubbleBounds.getSize(new THREE.Vector3()),middle=bubbleBounds.getCenter(new THREE.Vector3());
 // Bin projected triangles once, instead of raycasting the whole mesh per bubble.
 const bins=Array.from({length:256},()=>[]),positions=jellyGeometry.attributes.position,index=jellyGeometry.index;
 const gx=x=>Math.max(0,Math.min(15,Math.floor((x-bubbleBounds.min.x)/Math.max(size.x,.001)*16)));
 const gz=z=>Math.max(0,Math.min(15,Math.floor((z-bubbleBounds.min.z)/Math.max(size.z,.001)*16)));
 for(let f=0;f<(index?index.count:positions.count);f+=3){
 const ids=[0,1,2].map(k=>index?index.getX(f+k):f+k),xs=ids.map(i=>positions.getX(i)),zs=ids.map(i=>positions.getZ(i));
 const determinant=(zs[1]-zs[2])*(xs[0]-xs[2])+(xs[2]-xs[1])*(zs[0]-zs[2]);if(Math.abs(determinant)<1e-10)continue;
 const triangle={xs,zs,ys:ids.map(i=>positions.getY(i)),determinant};
 for(let z=gz(Math.min(...zs));z<=gz(Math.max(...zs));z++)for(let x=gx(Math.min(...xs));x<=gx(Math.max(...xs));x++)bins[z*16+x].push(triangle);
 }
 for(let i=0;i<bubbleCount;i++){
  const activity=i<18?1:THREE.MathUtils.smoothstep(bubbleExcitement,(i-18)/20,(i-18)/20+.22);
  if(activity<.005){bubbleStates[i]=null;bubbleTransform.scale.setScalar(0);bubbleTransform.updateMatrix();bubbleMesh.setMatrixAt(i,bubbleTransform.matrix);popMesh.setMatrixAt(i,bubbleTransform.matrix);continue;}
  let b=bubbleStates[i];
  if(!b)b=bubbleStates[i]={x:middle.x+(Math.random()-.5)*size.x*.86,z:middle.z+(Math.random()-.5)*size.z*.86,y:null,seed:Math.random()*20,r:.016+Math.random()*.014,age:0,seeded:bubbleStates.length>=bubbleCount};
  b.age+=dt;
  const x=b.x+Math.sin(b.age*2.2+b.seed)*.014,z=b.z+Math.cos(b.age*1.8+b.seed)*.014;
  const intersections=[];
  for(const {xs,zs,ys,determinant} of bins[gz(z)*16+gx(x)]){
   const u=((zs[1]-zs[2])*(x-xs[2])+(xs[2]-xs[1])*(z-zs[2]))/determinant;
   const v=((zs[2]-zs[0])*(x-xs[2])+(xs[0]-xs[2])*(z-zs[2]))/determinant;
   if(u>=0&&v>=0&&u+v<=1)intersections.push(u*ys[0]+v*ys[1]+(1-u-v)*ys[2]);
  }
  intersections.sort((a,b)=>a-b);const levels=[];
  for(const y of intersections)if(!levels.length||y-levels[levels.length-1]>.0001)levels.push(y);
  let low=0,high=0;
  for(let j=0;j+1<levels.length;j+=2){if(levels[j+1]-levels[j]>.09){low=levels[j]+.065;high=levels[j+1]-.065;if(b.y!==null&&b.y>=low&&b.y<=high)break;}}
  let radius=0,ring=0;
  if(high>low){
   if(b.y===null)b.y=low+(b.seeded?0:Math.random()*(high-low)*.9);
   b.y+=dt*(.07+b.r*3); // World +Y, never the object's rotated local axis.
   const t=THREE.MathUtils.clamp((b.y-low)/(high-low),0,1);
   radius=Math.min(.055,b.r*(.65+t*.6)*(1+bubbleExcitement*.65),(high-low)*.2)*activity;
   if(b.y>=high){ring=radius*1.35;radius=0;bubbleStates[i]=null;}
   else if(b.y<low){radius=0;bubbleStates[i]=null;}
   bubbleTransform.position.set(x,Math.min(b.y,high),z);
  }else bubbleStates[i]=null;
  bubbleTransform.quaternion.copy(camera.quaternion);bubbleTransform.scale.setScalar(radius);bubbleTransform.updateMatrix();bubbleMesh.setMatrixAt(i,bubbleTransform.matrix);
  bubbleTransform.scale.setScalar(ring);bubbleTransform.updateMatrix();popMesh.setMatrixAt(i,bubbleTransform.matrix);
 }
 bubbleMesh.instanceMatrix.needsUpdate=true;popMesh.instanceMatrix.needsUpdate=true;
}
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
  if(event.pointerType==='mouse'&&event.button!==0)return;
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
  canvas.style.cursor='grabbing';exciteFizz(.8);
});
canvas.addEventListener('pointermove', event => {
  if(event.pointerId !== activePointer)return;
  // Recover even when the browser missed pointerup while leaving the canvas.
  if(event.pointerType==='mouse'&&event.buttons===0){release();return;}
  pointerRay(event);
  if(raycaster.ray.intersectPlane(plane,hitPoint)){
    hitPoint.add(dragOffset);
    // Follow the pointer continuously; a world-space ceiling made a stretched
    // jelly stop following the hand. The solver limits strain, not hand position.
    const travel=hitPoint.distanceTo(new THREE.Vector3(...(body.grab.desired||body.grab.target)));
    if(travel>.002)exciteFizz(Math.min(1,travel*4));
    body.grab.desired=hitPoint.toArray();
  }
});
function release(){
  const pointerId=activePointer;
  activePointer=null;capturedIndex=-1;body.release();canvas.style.cursor='grab';
  // Clear state first: releasing capture can synchronously dispatch capture loss.
  if(pointerId!==null&&canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
}
function endPointer(event){if(event.pointerId===activePointer)release();}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);
window.addEventListener('pointerup',endPointer,true);
window.addEventListener('pointercancel',endPointer,true);
window.addEventListener('mouseup',()=>{if(activePointer!==null)release();},true);
window.addEventListener('touchend',event=>{if(event.touches.length===0)release();},{capture:true,passive:true});
window.addEventListener('touchcancel',release,{capture:true,passive:true});
window.addEventListener('blur',release);
document.addEventListener('visibilitychange',()=>{if(document.hidden){release();accumulator=0;last=performance.now();}});
function updateViewControls(){
  updateCameraPose();
  updatePhotoLayout();
  const b=settings.brightness;
  windowBrightness.value=b;
  jellyOpacity.value=settings.opacity/100;
  // Keep transmission, rear shading and energy-conserving coat fixed.
  jellyMaterial.envMapIntensity=.35;rearMaterial.envMapIntensity=1.3;
  jellyMaterial.specularIntensity=.4;rearMaterial.specularIntensity=1;
  jellyMaterial.clearcoat=.08;rearMaterial.clearcoat=.25;
}
updateViewControls();
for(const name of Object.keys(defaults))ui[name].addEventListener('input',()=>{syncOutputs();updateViewControls();});
ui.nudge.addEventListener('click',()=>{release();body.nudge(settings.mass);exciteFizz(.8);});
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
  if(photoFloor.visible){photoFloor.position.x=center.x;photoFloor.position.z=center.z;}
  updateBubbles(dt);
  ground.position.x=center.x;ground.position.z=center.z;
  ground.material.opacity=1/(1+Math.max(0,center.y+.97)*.65);ground.visible=ui.shadowToggle.checked;
  if(ui.autorotate.checked&&!body.grab){for(let i=0;i<body.p.length;i++){const p=body.p[i],a=dt*.025,x=p[0]-center.x,z=p[2]-center.z;p[0]=center.x+x*Math.cos(a)+z*Math.sin(a);p[2]=center.z+z*Math.cos(a)-x*Math.sin(a);}}
  {
    jellyMesh.visible=false;rearMesh.visible=true;
    renderer.setRenderTarget(rearTarget);renderer.render(scene,camera);
  }
  jellyMesh.visible=true;rearMesh.visible=false;
  // Draw the interior detail below the transparent front surface as well as its refraction.
  bubbleMesh.visible=popMesh.visible=bubbleToggle.checked;
  renderer.setRenderTarget(frontTarget);renderer.render(scene,camera);
  renderer.setRenderTarget(null);renderer.render(outputScene,outputCamera);
}
requestAnimationFrame(animate);




const panelToggle=document.getElementById('panelToggle');
panelToggle.addEventListener('click',()=>{
 const closed=panelToggle.parentElement.classList.toggle('is-collapsed');
 panelToggle.setAttribute('aria-expanded',String(!closed));panelToggle.textContent=closed?'젤리 설정 펼치기 ▴':'설정 접기 ▾';
});
// Locally synthesized fizz: no downloads, microphone or background playback.
const soundToggle=document.getElementById('bubbleSound');let fizzContext,fizzGain,fizzTimer;
function stopFizz(){clearInterval(fizzTimer);fizzTimer=null;if(fizzContext){fizzGain.gain.cancelScheduledValues(fizzContext.currentTime);fizzGain.gain.setValueAtTime(0,fizzContext.currentTime);fizzContext.suspend();}}
async function syncFizz(){
 if(!bubbleToggle.checked||!soundToggle.checked||document.hidden){stopFizz();return;}
 try{
 if(!fizzContext){
 const AudioEngine=window.AudioContext||window.webkitAudioContext;if(!AudioEngine)return;
 fizzContext=new AudioEngine();fizzGain=fizzContext.createGain();fizzGain.gain.value=0;fizzGain.connect(fizzContext.destination);
 const buffer=fizzContext.createBuffer(1,fizzContext.sampleRate*2,fizzContext.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.15;
 const source=fizzContext.createBufferSource();source.buffer=buffer;source.loop=true;
 const filter=fizzContext.createBiquadFilter();filter.type='highpass';filter.frequency.value=2800;source.connect(filter);filter.connect(fizzGain);source.start();
 }
 await fizzContext.resume();if(fizzTimer)return;
 fizzTimer=setInterval(()=>{if(fizzContext.state!=='running')return;const now=fizzContext.currentTime,osc=fizzContext.createOscillator(),gain=fizzContext.createGain();
 osc.frequency.setValueAtTime(900+Math.random()*2100,now);osc.frequency.exponentialRampToValueAtTime(450,now+.035);
 gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.12+Math.random()*.15,now+.003);gain.gain.exponentialRampToValueAtTime(.001,now+.045);
 osc.connect(gain);gain.connect(fizzGain);osc.start(now);osc.stop(now+.05);osc.onended=()=>{osc.disconnect();gain.disconnect();};},95);
 }catch{soundToggle.checked=false;stopFizz();}
}
bubbleToggle.addEventListener('change',syncFizz);soundToggle.addEventListener('change',syncFizz);document.addEventListener('visibilitychange',syncFizz);window.addEventListener('pagehide',stopFizz);

function exciteFizz(strength){
 if(bubbleToggle.checked&&!document.hidden)bubbleExcitement=Math.min(1,Math.max(bubbleExcitement,strength)+.12);
 if(!bubbleToggle.checked||!soundToggle.checked||document.hidden)return;
 if(!fizzContext||fizzContext.state!=='running'){syncFizz().then(()=>{if(fizzContext?.state==='running')exciteFizz(strength);});return;}
 const now=fizzContext.currentTime,gain=fizzGain.gain;
 gain.cancelScheduledValues(now);gain.setTargetAtTime(.06+.13*strength,now,.045);
 gain.setTargetAtTime(0,now+.05,.65);
}

