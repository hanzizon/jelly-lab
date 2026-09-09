// Hand-built reliefs based on the two circled reference characters.
const ellipse=(x,z,cx,cz,rx,rz)=>Math.sqrt(((x-cx)/rx)**2+((z-cz)/rz)**2)-1;
const soft=(d,w=.06)=>1/(1+Math.exp(Math.max(-40,Math.min(40,d/w))));
function polygon(x,z,points){
  let inside=false,distance=10;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside?-distance:distance;
}
function line(x,z,points,width=.026){
  let d=10;for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
    d=Math.min(d,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }return Math.exp(-((d/width)**2));
}
const bangsDJ=[[-.72,-.69],[-.54,-1.03],[.03,-1.12],[.53,-.91],[.73,-.52],[.55,-.18],[.32,-.29],[.12,-.52],[.03,-.15],[-.17,-.34],[-.25,-.62],[-.48,-.26],[-.66,-.08]];
const bangsVocal=[[-.72,-.47],[-.64,-.92],[-.3,-1.13],[.21,-1.1],[.61,-.87],[.71,-.14],[.5,-.3],[.38,-.63],[.18,-.44],[-.11,-.34],[-.46,-.37],[-.51,-.07]];
// Rounded face and two ears only; no facial relief on the cat soap shape.
const catOutline=[[-.98,.04],[-.96,-.22],[-.87,-.46],[-.85,-.86],[-.82,-1.02],[-.76,-1.06],[-.67,-1.02],[-.39,-.78],[-.2,-.81],[0,-.82],[.2,-.81],[.39,-.78],[.67,-1.02],[.76,-1.06],[.82,-1.02],[.85,-.86],[.87,-.46],[.96,-.22],[.98,.04],[.94,.32],[.79,.56],[.55,.73],[.28,.83],[0,.86],[-.28,.83],[-.55,.73],[-.79,.56],[-.94,.32]];
function silhouette(x,z,kind){
  if(kind==='cat')return polygon(x,z,catOutline);
  let d=ellipse(x,z,0,-.38,.76,.78);
  if(kind==='vocal'){
    d=Math.min(d,ellipse(x,z,-.57,.31,.23,.64),ellipse(x,z,.57,.31,.23,.64),ellipse(x,z,0,.67,.43,.42),ellipse(x,z,-.23,.99,.25,.2),ellipse(x,z,.23,.99,.25,.2),ellipse(x,z,-.4,-1.09,.29,.15));
  }else{
    d=Math.min(d,polygon(x,z,[[-.82,.36],[.82,.36],[.87,1.05],[-.87,1.05]])*2,polygon(x,z,[[-.64,-.89],[-.91,-.58],[-.71,-.51],[-.81,-.2],[-.59,-.24],[.69,-.12],[.91,-.3],[.72,-.41],[.78,-.7],[.47,-1.06]])*2);
  }return d;
}

function features(x,z,kind){
  const hair=soft(polygon(x,z,kind==='vocal'?bangsVocal:bangsDJ),.035);
  const face=soft(ellipse(x,z,0,-.24,.61,.55),.065);
  let eyes=0,pupils=0,stitches=0,ears=0,feet=0;
  for(const side of [-1,1]){
    const ex=side*.27;
    ears=Math.max(ears,soft(ellipse(x,z,side*.67,-.1,.105,.16),.12));
    if(kind==='vocal'){
      eyes=Math.max(eyes,soft(ellipse(x,z,ex,-.105,.093,.105),.14));
      pupils=Math.max(pupils,soft(ellipse(x,z,ex-.022,-.145,.023,.027),.2));
      feet=Math.max(feet,soft(ellipse(x,z,side*.235,.985,.19,.135),.12));
      for(let i=0;i<3;i++)stitches=Math.max(stitches,line(x,z,[[side*(.37+i*.04),.035],[side*(.385+i*.04),.095]],.015));
    }else{
      const eye=[ [ex-.13,-.16],[ex+.13,-.13],[ex+.105,.045],[ex-.095,.04] ];
      eyes=Math.max(eyes,soft(polygon(x,z,eye),.022));
      pupils=Math.max(pupils,soft(polygon(x,z,[[ex-.055,-.09],[ex+.055,-.08],[ex+.048,-.035],[ex-.055,-.04]]),.012));
    }
  }
  const mouth=kind==='vocal'?soft(polygon(x,z,[[-.2,.16],[.2,.16],[.17,.28],[.08,.34],[-.06,.35],[-.17,.28]]),.025):soft(polygon(x,z,[[-.13,.14],[.14,.14],[.015,.35]]),.025);
  if(kind==='vocal')for(let i=0;i<7;i++){const u=-.18+i*.06;stitches=Math.max(stitches,line(x,z,[[u,.125],[u+.017,.2]],.014));}
  const clothes=kind==='vocal'?soft(polygon(x,z,[[-.38,.48],[.38,.48],[.33,.88],[-.33,.88]]),.04):soft(polygon(x,z,[[-.8,.42],[.8,.42],[.82,1],[-.82,1]]),.04);
  let seam=kind==='vocal'?line(x,z,[[-.27,.54],[0,.66],[.27,.54]],.025):line(x,z,[[-.68,.52],[.67,.52]],.025);
  if(kind==='vocal'){
    for(let i=0;i<21;i++){const angle=Math.PI+i/20*Math.PI;const cx=.70*Math.cos(angle),cz=-.36+.75*Math.sin(angle);seam=Math.max(seam,line(x,z,[[cx*.965,cz-.025],[cx*1.015,cz+.025]],.012));}
  }else for(const ex of [-.43,.43])seam=Math.max(seam,Math.exp(-((ellipse(x,z,ex,.75,.17,.13)/.16)**2)));
  const mic=soft(ellipse(x,z,kind==='vocal'?.54:.64,.24,.078,.105),.16);
  const stem=kind==='vocal'?line(x,z,[[.54,.31],[.49,.86]],.032):line(x,z,[[.65,.31],[.77,.42]],.027);
  return {hair,face,eyes,pupils,mouth,stitches,ears,feet,clothes,seam,mic,stem};
}
function relief(x,z,kind){
  const f=features(x,z,kind);
  // Rounded tier changes replace narrow, steep ridges that glittered when moving.
  let h=.20*f.face*(1-f.hair)+.30*f.hair+.08*f.ears;
  h+=.085*f.eyes-.025*f.pupils-.085*f.mouth-.025*f.stitches;
  h+=.14*f.clothes+.12*f.feet-.035*f.seam+.13*f.mic+.07*f.stem;
  return h;
}
export function characterTone(point,kind){
  if(kind==='cylinder')return {shade:1,light:0};
  const x=point[0]/1.32,z=point[2]/1.32,f=features(x,z,kind);
  const front=1-soft(point[1]-.10,.06);
  let shade=.70,light=0;
  // All tones are derived from the selected character's one base hue.
  shade+=.30*f.face;light=.22*f.face;
  shade*=1-.48*f.hair;light*=1-f.hair;
  const dark=Math.max(f.eyes*.90,f.mouth*.72,f.stitches*.75,f.seam*.40,f.mic*.85,f.stem*.65,f.feet*.40,f.clothes*(kind==='dj'?.45:.18));
  shade*=1-dark;light*=1-dark;
  light=Math.max(light,f.pupils*.48);
  return {shade:1+(shade-1)*front,light:light*front};
}
// Bake a gently sanded height field once per character, not every animation frame.
const reliefCache=new Map();
function roundedRelief(kind){
  if(reliefCache.has(kind))return reliefCache.get(kind);
  const n=128,extent=1.5,step=extent*2/(n-1),weights=[1,4,6,4,1];
  let values=new Float32Array(n*n),temp=new Float32Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++)values[j*n+i]=relief(i*step-extent,j*step-extent,kind);
  for(const axis of [0,1]){
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      let h=0;for(let k=-2;k<=2;k++){
        const x=axis===0?Math.max(0,Math.min(n-1,i+k)):i;
        const z=axis===1?Math.max(0,Math.min(n-1,j+k)):j;
        h+=values[z*n+x]*weights[k+2]/16;
      }temp[j*n+i]=h;
    }[values,temp]=[temp,values];
  }
  const sample=(x,z)=>{
    const u=Math.max(0,Math.min(n-1.001,(x+extent)/step)),v=Math.max(0,Math.min(n-1.001,(z+extent)/step));
    const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
    return (values[j*n+i]*(1-a)+values[j*n+i+1]*a)*(1-b)+(values[(j+1)*n+i]*(1-a)+values[(j+1)*n+i+1]*a)*b;
  };reliefCache.set(kind,sample);return sample;
}
export function shapeMapper(kind){
  if(kind==='cylinder')return p=>[...p];
  const count=512,radii=[];
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2;let lo=0,hi=1.7;
    for(let j=0;j<18;j++){const mid=(lo+hi)/2;if(silhouette(Math.cos(a)*mid,Math.sin(a)*mid,kind)<0)lo=mid;else hi=mid;}
    radii.push(lo);
  }
  const radius=kind==='cat'?5:12,sigma=kind==='cat'?10:48;
  const rounded=radii.map((v,i)=>{let sum=0,weight=0;for(let k=-radius;k<=radius;k++){const w=Math.exp(-k*k/sigma);sum+=radii[(i+k+count)%count]*w;weight+=w;}return sum/weight;});
  const height=kind==='cat'?null:roundedRelief(kind);
  return p=>{
    const r=Math.hypot(p[0],p[2])/1.64,a=Math.atan2(p[2],p[0]);
    const at=((a+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*count,index=Math.floor(at),mix=at-index;
    const lo=rounded[index]*(1-mix)+rounded[(index+1)%count]*mix;
    const x=Math.cos(a)*lo*r,z=Math.sin(a)*lo*r;
    if(kind==='cat')return [x*1.64,p[1],z*1.64];
    const dome=.22+.15*Math.sqrt(Math.max(0,1-r*r)),top=dome+height(x,z);
    return [x*1.32,-.58+(p[1]+.58)/1.16*(top+.58),z*1.32];
  };
}

