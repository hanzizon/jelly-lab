import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
import assert from 'node:assert/strict';
for(const kind of ['cat','vocal','dj']){
 const map=shapeMapper(kind),b=new Jelly(map),cfg={mass:1.25,firmness:.06,damping:.95};
 for(let i=0;i<90;i++)b.step(1/90,cfg);
 b.prepareRender();const point=[.7,.58,-.25],skin=b.skin(point,map(point)),start=b.renderSample(skin,[0,0,0]);
 const base=b.p.reduce((s,p)=>s+p[1],0)/b.p.length;b.pin(skin,start);
 for(let i=0;i<120;i++){
  b.grab.target=start.map((v,k)=>v+(k===1?1.5:0)*Math.min(1,i/60));b.step(1/90,cfg);
  assert(b.p.flat().every(Number.isFinite),'nonfinite surface');
  for(const t of b.tets)if(t.volume>1e-7)assert(b.volume(t.q)>0,'inverted volume');
 }
 const rise=b.p.reduce((s,p)=>s+p[1],0)/b.p.length-base;
 assert(rise<1,'body followed the pinch instead of stretching');
 b.release();for(let i=0;i<108;i++)b.step(1/90,cfg);b.prepareRender();
 const frame=b.frame(),actual=b.renderSample(skin,[0,0,0]);
 const expected=frame.center.map((v,k)=>v+skin.surfacePoint.reduce((sum,v,j)=>sum+frame.rotation[k*3+j]*(v-frame.restCenter[j]),0));
 assert(Math.hypot(...actual.map((v,k)=>v-expected[k]))<.0001,'persistent pinch dent');
 console.log('PASS weighted stretch / no volume inversion / recovery',kind,rise);
}
