import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
import assert from 'node:assert/strict';
for(const kind of ['cat','vocal','dj']){
 const map=shapeMapper(kind),b=new Jelly(map),cfg={mass:1.25,firmness:.06,damping:.95};
 const p=[.7,.58,-.25],skin=b.skin(p,map(p));b.prepareRender();const start=b.renderSample(skin,[0,0,0]);b.pin(skin,start);
 for(let i=0;i<180;i++){b.grab.target=[start[0],start[1]+2*Math.min(1,i/90),start[2]];b.step(1/90,cfg);}
 const target=[...b.grab.target];
 for(let i=1;i<=12;i++){b.grab.target=[target[0]+.5*i/12,target[1],target[2]];b.step(1/90,cfg);}
 const samples=[];
 for(let i=0;i<90;i++){b.step(1/90,cfg);samples.push(b.p.reduce((s,p)=>s+p[0],0)/b.p.length);}
 const movement=Math.max(...samples.slice(10))-Math.min(...samples.slice(10));
 const delta=samples.map((x,i)=>i?x-samples[i-1]:0);const reversals=delta.slice(1).filter((x,i)=>x*delta[i]<0&&Math.abs(x)>.00001).length;
 console.log(kind,{movement,reversals});assert(movement>.015,'free body must keep moving after hand stops');assert(reversals>0,'free body should rebound while held');assert(b.grab,'must still be held');
}
