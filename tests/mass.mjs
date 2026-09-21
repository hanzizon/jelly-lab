import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
import assert from 'node:assert/strict';
const center=b=>b.p.reduce((s,p)=>s+p[1],0)/b.p.length;
for(const kind of ['cat','vocal','dj']){
 const heights=[];
 for(const mass of [.3,1.25,1.8]){
  const b=new Jelly(shapeMapper(kind)),settings={mass,firmness:.06,damping:.95};
  for(let i=0;i<180;i++)b.step(1/90,settings);
  const base=center(b);b.nudge(mass);let peak=0;
  for(let i=0;i<180;i++){b.step(1/90,settings);peak=Math.max(peak,center(b)-base);}
  assert(b.p.flat().every(Number.isFinite));heights.push(peak);
 }
 assert(heights[2]<heights[0]*.5);assert(heights[1]<heights[0]);console.log(kind,'same nudge, light/default/heavy rise:',heights);
}
