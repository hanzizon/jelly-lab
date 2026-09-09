// A small volumetric XPBD mesh. Positions are world-space: a pinch lifts the body.
export class Jelly {
  constructor(mapper=null) {
    this.n = 9; this.h = 5; this.floor = -1.55;
    this.rest = []; this.edges = []; this.tets = []; this.grab = null;
    const id = (x,y,z) => (y*this.n+z)*this.n+x;
    for(let y=0;y<this.h;y++) for(let z=0;z<this.n;z++) for(let x=0;x<this.n;x++) {
      const u=x/4-1, v=z/4-1;
      this.rest.push([1.64*u*Math.sqrt(1-v*v/2), y/4*1.16-.58, 1.64*v*Math.sqrt(1-u*u/2)]);
    }
    if(mapper)this.rest=this.rest.map(p=>mapper(p));
    const seen=new Set();
    for(let y=0;y<4;y++) for(let z=0;z<8;z++) for(let x=0;x<8;x++) {
      const c=[id(x,y,z),id(x+1,y,z),id(x,y+1,z),id(x+1,y+1,z),id(x,y,z+1),id(x+1,y,z+1),id(x,y+1,z+1),id(x+1,y+1,z+1)];
      for(const t of [[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]]) {
        const q=t.map(i=>c[i]);
        if(this.volume(q,this.rest)<0) [q[1],q[2]]=[q[2],q[1]];
        this.tets.push({q,volume:this.volume(q,this.rest),lambda:0});
        for(let a=0;a<4;a++) for(let b=a+1;b<4;b++) {
          const i=Math.min(q[a],q[b]), j=Math.max(q[a],q[b]), key=i+','+j;
          if(!seen.has(key)){ seen.add(key); this.edges.push({i,j,length:Math.hypot(...this.rest[i].map((v,k)=>v-this.rest[j][k])),lambda:0}); }
        }
      }
    }
    this.reset();
  }
  volume(q,p=this.p) {
    const [a,b,c,d]=q.map(i=>p[i]);
    const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),w=d.map((v,k)=>v-a[k]);
    return (u[0]*(v[1]*w[2]-v[2]*w[1])+u[1]*(v[2]*w[0]-v[0]*w[2])+u[2]*(v[0]*w[1]-v[1]*w[0]))/6;
  }
  reset(){this.p=this.rest.map(p=>[p[0],p[1]+this.floor+.59,p[2]]);this.v=this.p.map(()=>[0,0,0]);this.grab=null;}
  skin(point, surfacePoint=point) {
    const x=point[0]/1.64,z=point[2]/1.64;
    const inv=(a,b)=>Math.sign(a)*Math.sqrt(Math.max(0,((2+a*a-b*b)-Math.sqrt(Math.max(0,(2+a*a-b*b)**2-8*a*a)))/2));
    const g=[(inv(x,z)+1)*4,(point[1]+.58)/1.16*4,(inv(z,x)+1)*4].map((v,k)=>Math.max(0,Math.min(k===1?4:8,v)));
    const base=g.map((v,k)=>Math.min(k===1?3:7,Math.floor(v))), f=g.map((v,k)=>v-base[k]);
    const ids=[],weights=[];
    for(let y=0;y<2;y++)for(let z=0;z<2;z++)for(let x=0;x<2;x++){
      ids.push(((base[1]+y)*9+base[2]+z)*9+base[0]+x);
      weights.push((x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]));
    }
    const offset=surfacePoint.map((v,k)=>v-ids.reduce((s,id,i)=>s+this.rest[id][k]*weights[i],0));
    const cubic=(t)=>[-.5*t+t*t-.5*t*t*t,1-2.5*t*t+1.5*t*t*t,.5*t+2*t*t-1.5*t*t*t,-.5*t*t+.5*t*t*t];
    const w=g.map((v,k)=>cubic(v-base[k])), smoothIds=[],smoothWeights=[];
    for(let y=0;y<4;y++)for(let z=0;z<4;z++)for(let x=0;x<4;x++){
      const ix=Math.max(0,Math.min(8,base[0]+x-1)),iy=Math.max(0,Math.min(4,base[1]+y-1)),iz=Math.max(0,Math.min(8,base[2]+z-1));
      smoothIds.push((iy*9+iz)*9+ix);smoothWeights.push(w[0][x]*w[1][y]*w[2][z]);
    }
    return {ids,weights,offset,smoothIds,smoothWeights,surfacePoint};
  }
  sample(s){return s.offset.map((v,k)=>v+s.ids.reduce((sum,id,i)=>sum+this.p[id][k]*s.weights[i],0));}
  renderSample(s,out){
    for(let k=0;k<3;k++){let v=s.surfacePoint[k];for(let i=0;i<s.smoothIds.length;i++){const id=s.smoothIds[i];v+=(this.p[id][k]-this.rest[id][k])*s.smoothWeights[i];}out[k]=v;}return out;
  }
  pin(s,target){
    // Constrain exactly the same continuous skin that is drawn on screen.
    const merged=new Map();s.smoothIds.forEach((id,i)=>merged.set(id,(merged.get(id)||0)+s.smoothWeights[i]));
    const ids=[...merged.keys()],weights=[...merged.values()];
    const offset=s.surfacePoint.map((v,k)=>v-ids.reduce((sum,id,i)=>sum+this.rest[id][k]*weights[i],0));
    this.grab={...s,ids,weights,offset,target:[...target]};
  }
  frame(){
    const center=[0,0,0],restCenter=[0,0,0],n=this.p.length;
    for(let i=0;i<n;i++)for(let k=0;k<3;k++){center[k]+=this.p[i][k]/n;restCenter[k]+=this.rest[i][k]/n;}
    let a=Array(9).fill(0);
    for(let i=0;i<n;i++)for(let r=0;r<3;r++)for(let c=0;c<3;c++)a[r*3+c]+=(this.p[i][r]-center[r])*(this.rest[i][c]-restCenter[c]);
    const scale=Math.sqrt(a.reduce((s,v)=>s+v*v,0));a=a.map(v=>v/scale);
    for(let iter=0;iter<12;iter++){
      const [a0,b,c,d,e,f,g,h,i]=a;
      const co=[e*i-f*h,f*g-d*i,d*h-e*g,c*h-b*i,a0*i-c*g,b*g-a0*h,b*f-c*e,c*d-a0*f,a0*e-b*d];
      const det=a0*co[0]+b*co[1]+c*co[2];if(Math.abs(det)<1e-12)break;
      a=a.map((v,j)=>(v+co[j]/det)*.5);
    }
    if(!a.every(Number.isFinite))a=[1,0,0,0,1,0,0,0,1];
    return {center,restCenter,rotation:a,normal:[a[1],a[4],a[7]]};
  }
  recover(dt){
    if(this.grab)return;
    const f=this.frame(),rate=1-Math.exp(-8*dt);
    for(let i=0;i<this.p.length;i++)for(let k=0;k<3;k++){
      let goal=f.center[k];for(let j=0;j<3;j++)goal+=f.rotation[k*3+j]*(this.rest[i][j]-f.restCenter[j]);
      this.p[i][k]+=(goal-this.p[i][k])*rate;
    }
    if(!this.grab){
      const origin=[0,0,0];for(let i=0;i<81;i++)for(let k=0;k<3;k++)origin[k]+=this.p[i][k]/81;
      for(let i=0;i<81;i++){
        const d=this.p[i].reduce((s,v,k)=>s+(v-origin[k])*f.normal[k],0);
        for(let k=0;k<3;k++)this.p[i][k]-=d*f.normal[k];
      }
      const low=Math.min(...this.p.map(p=>p[1]));if(low<this.floor)for(const p of this.p)p[1]+=this.floor-low;
    }
  }
  backPlane(){
    const normal=this.frame().normal,origin=[0,0,0];
    for(let i=0;i<81;i++)for(let k=0;k<3;k++)origin[k]+=this.p[i][k]/81;
    return {normal,origin};
  }
  release(){
    if(!this.grab)return;this.grab=null;
    for(const v of this.v){const speed=Math.hypot(...v);if(speed>3.5)for(let k=0;k<3;k++)v[k]*=3.5/speed;}
  }
  nudge(){for(let i=0;i<this.p.length;i++){const p=this.p[i];this.v[i]=[.1,3.3-p[2]*2.8,(p[1]-this.floor-.58)*2.8];}}
  step(dt,settings){
    const old=this.p.map(p=>[...p]), mass=settings.mass;
    for(let i=0;i<this.p.length;i++)for(let k=0;k<3;k++){
      this.v[i][k]*=Math.exp(-.55*dt);
      if(k===1)this.v[i][k]-=13.5*dt;
      this.p[i][k]+=this.v[i][k]*dt;
    }
    const alpha=(.000055+.0007*(settings.firmness/.4)**2)*mass/(dt*dt);
    for(const e of this.edges)e.lambda=0;
    for(const t of this.tets)t.lambda=0;
    for(let iteration=0;iteration<4;iteration++){
      for(const e of this.edges){
        const a=this.p[e.i],b=this.p[e.j],d=b.map((v,k)=>v-a[k]),len=Math.hypot(...d);
        if(len<1e-8)continue;
        const dl=(-(len-e.length)-alpha*e.lambda)/(2+alpha);e.lambda+=dl;
        for(let k=0;k<3;k++){const c=dl*d[k]/len;a[k]-=c;b[k]+=c;}
      }
      for(const t of this.tets){
        const a=this.p[t.q[0]],b=this.p[t.q[1]],c=this.p[t.q[2]],d=this.p[t.q[3]];
        const bx=b[0]-a[0],by=b[1]-a[1],bz=b[2]-a[2],cx=c[0]-a[0],cy=c[1]-a[1],cz=c[2]-a[2],dx=d[0]-a[0],dy=d[1]-a[1],dz=d[2]-a[2];
        const g1x=(cy*dz-cz*dy)/6,g1y=(cz*dx-cx*dz)/6,g1z=(cx*dy-cy*dx)/6;
        const g2x=(dy*bz-dz*by)/6,g2y=(dz*bx-dx*bz)/6,g2z=(dx*by-dy*bx)/6;
        const g3x=(by*cz-bz*cy)/6,g3y=(bz*cx-bx*cz)/6,g3z=(bx*cy-by*cx)/6;
        const g0x=-g1x-g2x-g3x,g0y=-g1y-g2y-g3y,g0z=-g1z-g2z-g3z;
        const va=.00000004*mass/(dt*dt);
        const den=va+g0x*g0x+g0y*g0y+g0z*g0z+g1x*g1x+g1y*g1y+g1z*g1z+g2x*g2x+g2y*g2y+g2z*g2z+g3x*g3x+g3y*g3y+g3z*g3z;
        const dl=(-(bx*g1x+by*g1y+bz*g1z-t.volume)-va*t.lambda)/den;t.lambda+=dl;
        a[0]+=dl*g0x;a[1]+=dl*g0y;a[2]+=dl*g0z;b[0]+=dl*g1x;b[1]+=dl*g1y;b[2]+=dl*g1z;
        c[0]+=dl*g2x;c[1]+=dl*g2y;c[2]+=dl*g2z;d[0]+=dl*g3x;d[1]+=dl*g3y;d[2]+=dl*g3z;
      }
      for(const p of this.p){p[1]=Math.max(this.floor,p[1]);p[0]=Math.max(-3,Math.min(3,p[0]));p[2]=Math.max(-2,Math.min(2,p[2]));}
      if(this.grab){
        const g=this.grab,here=this.sample(g),den=g.weights.reduce((s,w)=>s+w*w,0);
        g.ids.forEach((id,i)=>{for(let k=0;k<3;k++)this.p[id][k]+=(g.target[k]-here[k])*g.weights[i]/den;});
      }
    }
    this.recover(dt);
    for(let i=0;i<this.p.length;i++){
      for(let k=0;k<3;k++)this.v[i][k]=(this.p[i][k]-old[i][k])/dt;
      if(this.p[i][1]<=this.floor+.001){this.v[i][0]*=.94;this.v[i][2]*=.94;this.v[i][1]=Math.max(this.v[i][1],-this.v[i][1]*.12);}
    }
    // Damp relative motion along springs, preserving flight and rotation.
    const viscosity=1-Math.exp(-(10+(settings.damping-.75)*100)*dt);
    for(const e of this.edges){const d=this.p[e.j].map((v,k)=>v-this.p[e.i][k]),l=Math.hypot(...d);if(l<1e-8)continue;
      const speed=d.reduce((s,v,k)=>s+v/l*(this.v[e.j][k]-this.v[e.i][k]),0)*viscosity;
      for(let k=0;k<3;k++){this.v[e.i][k]+=d[k]/l*speed;this.v[e.j][k]-=d[k]/l*speed;}}
  }
}




