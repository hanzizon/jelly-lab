import assert from 'node:assert/strict';
import {Jelly} from '../physics.js';
import {shapeMapper} from '../shapes.js';
for(const kind of ['cat','vocal','dj']){
  const map=shapeMapper(kind),b=new Jelly(map),cfg={mass:1.25,firmness:.2,damping:.95};
  const point=[.7,.58,-.25],skin=b.skin(point,map(point));
  b.prepareRender();const start=b.renderSample(skin,[0,0,0]);b.pin(skin,start);
  const samples=[];
  for(let i=0;i<720;i++){
    const t=i/90;
    b.grab.target=[start[0]+(i>120?2.5*Math.sin((t-120/90)*Math.PI*10):0),start[1]+2*Math.min(1,i/90),start[2]];
    b.step(1/90,cfg);
    if(i>630)samples.push(b.p[0][0]-b.p[404][0]);
  }
  const motion=Math.max(...samples)-Math.min(...samples);
  assert(motion>.1,kind+': rapid shaking must not lock the held shape');
  assert(b.p.flat().every(Number.isFinite));
  b.release();for(let i=0;i<270;i++)b.step(1/90,cfg);b.prepareRender();
  assert(Math.min(...b.p.map(p=>p[1]))<b.floor+.02,'released jelly must land');
  const f=b.frame(),actual=b.renderSample(skin,[0,0,0]);
  const rest=f.center.map((v,k)=>v+skin.surfacePoint.reduce((sum,v,j)=>sum+f.rotation[k*3+j]*(v-f.restCenter[j]),0));
  assert(Math.hypot(...actual.map((v,k)=>v-rest[k]))<.0001,'shaking must not leave a permanent dent');
  console.log('PASS rapid shaking, landing and recovery',kind,{motion});
}
