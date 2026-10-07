// Carry bubbles with the material, then let buoyancy move them in world +Y.
export function bindBubble(point,nodes,tets,previous=null){
 const weightsFor=q=>{
  const a=nodes[q[0]],u=nodes[q[1]].map((v,k)=>v-a[k]),v=nodes[q[2]].map((v,k)=>v-a[k]),w=nodes[q[3]].map((v,k)=>v-a[k]),d=point.map((v,k)=>v-a[k]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
  const vw=cross(v,w),det=dot(u,vw);if(Math.abs(det)<1e-10)return null;
  const b=dot(d,vw)/det,c=dot(u,cross(d,w))/det,e=dot(u,cross(v,d))/det,weights=[1-b-c-e,b,c,e];
  return weights.every(x=>x>=-.00001&&x<=1.00001)?weights:null;
 };
 let ids=previous?.ids,weights=ids&&weightsFor(ids);
 if(!weights)for(const t of tets){weights=weightsFor(t.q);if(weights){ids=t.q;break;}}
 // Rounded render surfaces can extend just beyond the physics mesh.
 if(!weights){const near=nodes.map((p,id)=>({id,d:p.reduce((s,v,k)=>s+(v-point[k])**2,0)})).sort((a,b)=>a.d-b.d).slice(0,4);ids=near.map(x=>x.id);weights=near.map(x=>1/Math.max(x.d,.00001));const sum=weights.reduce((a,b)=>a+b,0);weights=weights.map(w=>w/sum);}
 const sample=[0,1,2].map(k=>ids.reduce((sum,id,i)=>sum+nodes[id][k]*weights[i],0));
 return {ids,weights,sample};
}
export function bubbleDisplacement(binding,nodes){return [0,1,2].map(k=>binding.ids.reduce((sum,id,i)=>sum+nodes[id][k]*binding.weights[i],0)-binding.sample[k]);}
