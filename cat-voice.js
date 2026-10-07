// Original recordings and license details: audio-credits.html.
const urls={meow:'https://upload.wikimedia.org/wikipedia/commons/6/62/Meow.ogg',hiss:'https://upload.wikimedia.org/wikipedia/commons/6/67/Gru%C3%B1ido_gato_%28Chacha%29.ogg'};
const downloads=new Map(),decoded=new WeakMap();
export function nextCatMood(state,now){state.count=now-state.last>2.5?1:Math.min(8,state.count+1);state.last=now;return state.count>=7?'hiss':state.count>=5?'angry':state.count>=3?'annoyed':'meow';}
export function preloadCatVoice(){for(const [key,url] of Object.entries(urls))if(!downloads.has(key))downloads.set(key,fetch(url).then(r=>{if(!r.ok)throw Error('Cat audio unavailable');return r.arrayBuffer();}).catch(e=>{downloads.delete(key);throw e;}));return Promise.all([...downloads.values()]);}
export async function loadCatVoice(ctx){
 await preloadCatVoice();if(!decoded.has(ctx))decoded.set(ctx,Promise.all(['meow','hiss'].map(async key=>{const buffer=await ctx.decodeAudioData((await downloads.get(key)).slice(0));return [key,buffer];})).then(entries=>Object.fromEntries(entries)));
 return decoded.get(ctx);
}
// Select the strongest short breath/noise burst in the original hiss recording.
export function hissStart(buffer){const d=buffer.getChannelData(0),n=Math.floor(buffer.sampleRate*.9);let sum=0,best=-1,start=0;for(let i=1;i<d.length;i++){const diff=d[i]-d[i-1];sum+=diff*diff;if(i>n){const old=d[i-n]-d[i-n-1];sum-=old*old;}if(i>=n&&sum>best){best=sum;start=(i-n)/buffer.sampleRate;}}return Math.max(0,start-.08);}
export function catVoice(ctx,mood,buffers){
 const buffer=buffers[mood==='hiss'?'hiss':'meow'],offset=mood==='hiss'?Math.min(hissStart(buffer)+.18,Math.max(0,buffer.duration-.02)):0;
 const duration=mood==='hiss'?Math.min(.97,buffer.duration-offset):buffer.duration;
 const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.playbackRate.value=mood==='angry'?.7:mood==='annoyed'?.9:1;
 let peak=.01;for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=Math.floor(offset*buffer.sampleRate);i<Math.min(d.length,(offset+duration)*buffer.sampleRate);i++)peak=Math.max(peak,Math.abs(d[i]));}
 const volume=Math.min(3,.04/peak),now=ctx.currentTime,end=duration/source.playbackRate.value;
 gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(volume,now+.015);gain.gain.setValueAtTime(volume,now+Math.max(.02,end-.06));gain.gain.linearRampToValueAtTime(0,now+end);
 source.connect(gain);gain.connect(ctx.destination);source.start(now,offset,duration);source.onended=()=>{source.disconnect();gain.disconnect();};
 return ()=>{gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(0,ctx.currentTime,.008);source.stop(ctx.currentTime+.035);};
}


