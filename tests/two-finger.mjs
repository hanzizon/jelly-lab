import assert from 'node:assert/strict';
import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
for(const kind of ['cat','paw','vocal','dj']){
 const map=shapeMapper(kind),b=new Jelly(map),cfg={mass:1.25,firmness:.2,damping:.95};b.prepareRender();
 const skins=[-1,1].map(x=>{const p=[x,.58,0];return b.skin(p,map(p));});
 const starts=skins.map(s=>b.renderSample(s,[0,0,0]));
 const grips=skins.map((s,i)=>b.pin(s,starts[i],i>0));assert.equal(b.grabs.length,2);
 const initial=Math.hypot(...starts[1].map((v,k)=>v-starts[0][k]));
 for(let i=0;i<150;i++){
  grips.forEach((g,j)=>g.target=starts[j].map((v,k)=>v+(k===0?(j?1:-1)*.8*Math.min(1,i/80):k===1?.25:0)));
  b.step(1/90,cfg);
  assert(b.p.flat().every(Number.isFinite));
  assert(b.tets.every(t=>t.volume<=1e-7||b.volume(t.q)>0),'folded '+kind);
 }
 const points=grips.map(g=>b.sample(g)),distance=Math.hypot(...points[1].map((v,k)=>v-points[0][k]));
 assert(distance>initial+.6,'two grips did not stretch '+kind);
 b.release(grips[0]);assert.equal(b.grab,grips[1]);assert.equal(b.grabs.length,1);
 for(let i=0;i<30;i++)b.step(1/90,cfg);
 b.release(grips[1]);assert.equal(b.grab,null);
 for(let i=0;i<150;i++)b.step(1/90,cfg);b.prepareRender();
 const f=b.frame(),actual=b.renderSample(skins[0],[0,0,0]);
 const expected=f.center.map((v,k)=>v+skins[0].surfacePoint.reduce((sum,v,j)=>sum+f.rotation[k*3+j]*(v-f.restCenter[j]),0));
 assert(Math.hypot(...actual.map((v,k)=>v-expected[k]))<.001,'residual dent');
 console.log('PASS two-finger stretch, partial release and recovery',kind,distance-initial);
}
