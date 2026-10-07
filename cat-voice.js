// Gesture-only synthesized cat voice; one voice at a time keeps rapid taps quiet.
export function nextCatMood(state,now){
 state.count=now-state.last>2.5?1:Math.min(8,state.count+1);state.last=now;
 return state.count>=6?'hiss':state.count>=3?'annoyed':'meow';
}
export function catVoice(ctx,mood){
 const now=ctx.currentTime,duration=mood==='hiss'?.65:mood==='annoyed'?.62:.5;
 const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(mood==='hiss'?.1:.09,now+.035);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);gain.connect(ctx.destination);
 const filter=ctx.createBiquadFilter();filter.type=mood==='hiss'?'highpass':'bandpass';filter.Q.value=mood==='hiss'?.7:1.7;
 filter.frequency.setValueAtTime(mood==='hiss'?1800:1450,now);filter.frequency.exponentialRampToValueAtTime(mood==='hiss'?3200:650,now+duration);filter.connect(gain);
 let source;
 if(mood==='hiss'){
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(.65+.35*Math.sin(i/ctx.sampleRate*31)**2);
  source=ctx.createBufferSource();source.buffer=buffer;
 }else{
  source=ctx.createOscillator();source.type='sawtooth';const base=mood==='annoyed'?320:470;
  for(let i=0;i<=50;i++){const t=i/50;const pitch=base*(.85+.7*Math.sin(Math.PI*t))*(1-.35*t)+(mood==='annoyed'?30:8)*Math.sin(t*duration*90);source.frequency.setValueAtTime(pitch,now+t*duration);}
 }
 source.connect(filter);source.start(now);source.stop(now+duration+.02);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 return ()=>{gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(.0001,ctx.currentTime,.008);source.stop(ctx.currentTime+.035);};
}
