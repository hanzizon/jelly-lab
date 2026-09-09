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
function silhouette(x,z,kind){
  let d=ellipse(x,z,0,-.38,.76,.78);
  if(kind==='vocal'){
    d=Math.min(d,ellipse(x,z,-.57,.31,.23,.64),ellipse(x,z,.57,.31,.23,.64),ellipse(x,z,0,.67,.43,.42),ellipse(x,z,-.23,.99,.25,.2),ellipse(x,z,.23,.99,.25,.2),ellipse(x,z,-.4,-1.09,.29,.15));
  }else{
    d=Math.min(d,polygon(x,z,[[-.82,.36],[.82,.36],[.87,1.05],[-.87,1.05]])*2,polygon(x,z,[[-.64,-.89],[-.91,-.58],[-.71,-.51],[-.81,-.2],[-.59,-.24],[.69,-.12],[.91,-.3],[.72,-.41],[.78,-.7],[.47,-1.06]])*2);
  }return d;
}
function relief(x,z,kind){
  let h=.16*soft(ellipse(x,z,0,-.29,.61,.55),.07);
  h+=.14*soft(polygon(x,z,kind==='vocal'?bangsVocal:bangsDJ),.025);
  // Rounded ears, eyes cut into the face, and raised pupil centers.
  for(const side of [-1,1]){
    h+=.06*soft(ellipse(x,z,side*.67,-.1,.115,.18),.09);
    const ex=side*.27,ez=kind==='vocal'?-.12:-.06;
    h-=.105*soft(ellipse(x,z,ex,ez,.105,.105),.1);
    h+=.038*soft(ellipse(x,z,ex,ez+.015,.048,.06),.12);
    if(kind==='dj')h+=.085*line(x,z,[[ex-.13,ez-.1],[ex+.13,ez-.07]],.035);
    if(kind==='vocal'){
      h-=.055*line(x,z,[[side*.39,.01],[side*.49,.05],[side*.39,.08]],.018);
      h+=.07*soft(ellipse(x,z,side*.24,.94,.2,.14),.12);
      h-=.04*line(x,z,[[side*.52,-.15],[side*.59,.2],[side*.58,.62]],.022);
    }
  }
  if(kind==='vocal'){
    const mouth=[[-.2,.15],[.2,.15],[.16,.28],[.07,.34],[-.05,.35],[-.16,.28]];
    h-=.09*soft(polygon(x,z,mouth),.018);
    for(let i=0;i<7;i++){const u=-.18+i*.06;h+=.05*line(x,z,[[u,.115],[u+.018,.185]],.013);}
    for(let i=0;i<29;i++){const a=-Math.PI+i/28*Math.PI*1.45;const cx=.71*Math.cos(a),cz=-.36+.75*Math.sin(a);h-=.045*line(x,z,[[cx*.96,cz],[cx*1.04,cz+.035]],.012);}
    h+=.09*soft(polygon(x,z,[[-.37,.45],[.37,.45],[.32,.87],[-.32,.87]]),.03);
    h-=.05*line(x,z,[[-.29,.5],[0,.62],[.28,.5]],.023);
    // Microphone and stem are part of the same molded surface.
    h+=.09*soft(ellipse(x,z,.53,.27,.09,.13),.13);
    h+=.06*line(x,z,[[.53,.33],[.48,.84]],.035);
  }else{
    h-=.095*soft(polygon(x,z,[[-.13,.12],[.14,.12],[.01,.34]]),.016);
    h+=.12*soft(polygon(x,z,[[-.79,.42],[.79,.42],[.8,.98],[-.8,.98]]),.023);
    h-=.045*line(x,z,[[-.69,.51],[.68,.51]],.025);
    for(const ex of [-.43,.43])h-=.055*Math.exp(-((ellipse(x,z,ex,.74,.19,.14)/.15)**2));
    for(let i=0;i<3;i++)h+=.035*line(x,z,[[i*.07-.07,.64],[i*.07-.07,.87]],.017);
    h+=.08*soft(ellipse(x,z,.63,.19,.08,.11),.12);
    h+=.05*line(x,z,[[.63,.25],[.75,.39]],.025);
    h-=.04*line(x,z,[[.15,-1.01],[.32,-.76],[.4,-.51]],.018);
  }return h;
}
export function shapeMapper(kind){
  if(kind==='cylinder')return p=>[...p];
  return p=>{
    const r=Math.hypot(p[0],p[2])/1.64,a=Math.atan2(p[2],p[0]);
    let lo=0,hi=1.7;for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(silhouette(Math.cos(a)*mid,Math.sin(a)*mid,kind)<0)lo=mid;else hi=mid;}
    const x=Math.cos(a)*lo*r,z=Math.sin(a)*lo*r;
    const dome=.22+.15*Math.sqrt(Math.max(0,1-r*r)),top=dome+relief(x,z,kind);
    return [x*1.32,-.58+(p[1]+.58)/1.16*(top+.58),z*1.32];
  };
}

