import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
import assert from 'node:assert/strict';
for(const kind of ['cat','vocal','dj']){
 const map=shapeMapper(kind),b=new Jelly(map),cfg={mass:1.25,firmness:.06,damping:.95};
 for(let i=0;i<90;i++)b.step(1/90,cfg);
 b.prepareRender();const point=[.7,.58,-.25],skin=b.skin(point,map(point)),start=b.renderSample(skin,[0,0,0]);b.pin(skin,start);
 for(let i=0;i<60;i++){b.grab.target=start.map((v,k)=>v+(k===0?1.4:k===1?.5:0)*Math.min(1,i/40));b.step(1/90,cfg);}
 b.release();const tail=[];
 for(let i=0;i<270;i++){b.step(1/90,cfg);if(i>=180)tail.push(b.p.reduce((s,p)=>s+p[1],0)/b.p.length);}
 const wobble=Math.max(...tail)-Math.min(...tail);console.log(kind,'late landing height variation',wobble);assert(wobble<.06,'repeated late bouncing');
 assert(b.p.flat().every(Number.isFinite));
}
