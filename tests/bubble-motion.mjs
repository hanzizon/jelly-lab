import assert from 'node:assert/strict';
import {bindBubble,bubbleDisplacement} from '../bubble-motion.js';
const nodes=[[0,0,0],[2,0,0],[0,2,0],[0,0,2]],tets=[{q:[0,1,2,3]}],point=[.3,.4,.5];
const binding=bindBubble(point,nodes,tets);
for(const angle of [0,Math.PI/2,Math.PI]){
 const transform=p=>[p[0]*Math.cos(angle)-p[1]*Math.sin(angle)+3,p[0]*Math.sin(angle)+p[1]*Math.cos(angle)+1,p[2]-2];
 const moved=nodes.map(transform),delta=bubbleDisplacement(binding,moved),expected=transform(point);
 assert(Math.hypot(...delta.map((v,k)=>v+point[k]-expected[k]))<1e-9,'bubble must travel and rotate with jelly');
 const risen=expected.map((v,k)=>v+(k===1?.01:0));assert(risen[1]>expected[1],'buoyancy stays world-up');
}
const deformed=nodes.map(p=>[p[0]*1.6,p[1]+p[0]*.4,p[2]*.8]);
const delta=bubbleDisplacement(binding,deformed);assert(Math.abs(point[0]+delta[0]-.48)<1e-9);assert(Math.abs(point[1]+delta[1]-.52)<1e-9);
assert.deepEqual(bubbleDisplacement(bindBubble(point,nodes,tets),nodes),[0,0,0]);
console.log('PASS bubble translation, rotation, stretching and world-up buoyancy');
