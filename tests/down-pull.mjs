import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
import assert from 'node:assert/strict';
for(const kind of ['cat','vocal','dj']){
 const map=shapeMapper(kind),b=new Jelly(map),cfg={mass:1.25,firmness:.06,damping:.95};
 for(let i=0;i<90;i++)b.step(1/90,cfg);
 b.prepareRender();const p=[.7,.58,-.25],skin=b.skin(p,map(p)),start=b.renderSample(skin,[0,0,0]);
 const base=b.p.reduce((s,p)=>s+p[1],0)/b.p.length;b.pin(skin,start);
 for(let i=0;i<75;i++){b.grab.target=[start[0],start[1]-2*Math.min(1,i/45),start[2]];b.step(1/90,cfg);assert(Math.min(...b.p.map(p=>p[1]))>=b.floor-1e-8);}
 b.release();let peak=-Infinity;
 for(let i=0;i<180;i++){b.step(1/90,cfg);peak=Math.max(peak,b.p.reduce((s,p)=>s+p[1],0)/b.p.length-base);}
 console.log(kind,'down-pull release peak',peak);assert(peak<.15,'down-pull launched body');
}
