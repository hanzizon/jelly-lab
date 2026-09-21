import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
import assert from 'node:assert/strict';
for(const kind of ['cat','vocal','dj']){
 const map=shapeMapper(kind),b=new Jelly(map),cfg={mass:1.25,firmness:.06,damping:.95};
 const p=[.7,.58,-.25],skin=b.skin(p,map(p));b.prepareRender();const start=b.renderSample(skin,[0,0,0]);b.pin(skin,start);
 const heights=[];
 for(const height of [3.2,4.2,3.4]){
  const origin=[...b.grab.target];
  for(let i=1;i<=120;i++){
   b.grab.target=origin.map((v,k)=>k===1?v+(height-v)*Math.min(1,i/80):v);
   b.step(1/90,cfg);
  }
  b.prepareRender();const grabbed=b.renderSample(skin,[0,0,0]);assert(Math.abs(grabbed[1]-height)<1e-5,'pin must follow above former ceiling');
  assert(b.p.flat().every(Number.isFinite));heights.push(b.p.reduce((s,p)=>s+p[1],0)/b.p.length);
 }
 assert(heights[1]>heights[0]+.5,'body must follow upward');assert(heights[2]<heights[1]-.4,'body must follow downward');
 console.log('PASS stretched body follows hand up/down',kind,heights);
}
