import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
import assert from 'node:assert/strict';
const settings={mass:1.25,firmness:.06,damping:.95};
for(const kind of ['cat','vocal','dj']){
 const map=shapeMapper(kind),b=new Jelly(map),skins=[];
 for(let j=0;j<64;j++)for(let r=.1;r<=1.4;r+=.2)for(const y of [-.58,.58]){const p=[r*Math.cos(j*Math.PI/32),y,r*Math.sin(j*Math.PI/32)];skins.push(b.skin(p,map(p)));}
 // A rigid upside-down rotation must leave every visible detail undistorted.
 b.p=b.rest.map(p=>[-p[0],-p[1]+2,p[2]]);b.prepareRender();
 let error=0;for(const skin of skins){const p=b.renderSample(skin,[0,0,0]),q=skin.surfacePoint;error=Math.max(error,Math.hypot(p[0]+q[0],p[1]+q[1]-2,p[2]-q[2]));}assert(error<1e-6);console.log(kind,'rotated skin error',error);
 b.reset();const point=[.7,.58,-.25],skin=b.skin(point,map(point));
 for(let cycle=0;cycle<3;cycle++){
  b.prepareRender();const start=b.renderSample(skin,[0,0,0]);b.pin(skin,start);
  for(let i=0;i<100;i++){b.grab.target=start.map((v,k)=>v+(k===1?2.1:k===0?.7:0)*Math.min(1,i/50));b.step(1/90,settings);}
  assert(Math.hypot(...b.renderSample(skin,[0,0,0]).map((v,k)=>v-b.grab.target[k]))<1e-6);
  b.release();for(let i=0;i<450;i++)b.step(1/90,settings);b.prepareRender();
  const f=b.frame();let peak=0;for(const skin of skins){const p=b.renderSample(skin,[0,0,0]);let q=f.center.map((v,k)=>v+skin.surfacePoint.reduce((sum,v,j)=>sum+f.rotation[k*3+j]*(v-f.restCenter[j]),0));peak=Math.max(peak,Math.hypot(...p.map((v,k)=>v-q[k])));}
  assert(peak<.08);console.log(kind,'cycle',cycle,'visible shape residual',peak);
 }
}
for(const fps of [15,30,60]){
 const b=new Jelly(shapeMapper('cat'));for(const p of b.p)p[1]+=1.8;let contact=0;
 for(let frame=1;frame<=fps;frame++){
  const n=Math.ceil(90/fps);for(let i=0;i<n;i++)b.step(1/fps/n,settings);
  if(!contact&&Math.min(...b.p.map(p=>p[1]))<=b.floor+.001)contact=frame/fps;
 }assert(contact>0&&contact<=.65);console.log('drop',fps,contact);
}
