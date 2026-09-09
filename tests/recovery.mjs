import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
import assert from 'node:assert/strict';
const settings={mass:1.25,firmness:.06,damping:.95};
function error(b){const f=b.frame();return Math.sqrt(b.p.reduce((sum,p,i)=>sum+p.reduce((s,v,k)=>{let target=f.center[k];for(let j=0;j<3;j++)target+=f.rotation[k*3+j]*(b.rest[i][j]-f.restCenter[j]);return s+(v-target)**2;},0),0)/b.p.length);}
for(const kind of ['cat','vocal','dj']){
 const map=shapeMapper(kind),b=new Jelly(map),point=[.7,.58,-.25],skin=b.skin(point,map(point));
 for(let cycle=0;cycle<3;cycle++){
  let start=[0,0,0];b.renderSample(skin,start);b.pin(skin,start);
  for(let i=0;i<100;i++){b.grab.target=start.map((v,k)=>v+(k===1?2.1:k===0?.7:0)*Math.min(1,i/50));b.step(1/90,settings);}
  const drawn=b.renderSample(skin,[0,0,0]);assert(Math.hypot(...drawn.map((v,k)=>v-b.grab.target[k]))<1e-6,'pin/render mismatch');
  b.release();for(let i=0;i<450;i++)b.step(1/90,settings);
  const e=error(b),plane=b.backPlane(),flat=Math.max(...b.p.slice(0,81).map(p=>Math.abs(p.reduce((s,v,k)=>s+(v-plane.origin[k])*plane.normal[k],0))));
  console.log(kind,cycle,{shapeError:e,backDeviation:flat});assert(e<.06);assert(flat<.001);assert(b.p.flat().every(Number.isFinite));
 }
}
