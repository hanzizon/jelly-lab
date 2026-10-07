import assert from 'node:assert/strict';import {nextCatMood,catVoice,hissStart} from '../cat-voice.js';
const state={count:0,last:-Infinity};assert.deepEqual([0,.2,.4,.6,.8,1,1.2].map(t=>nextCatMood(state,t)),['meow','meow','annoyed','annoyed','angry','angry','hiss']);assert.equal(nextCatMood(state,4),'meow');
const data=new Float32Array(48000*3);for(let i=48000;i<96000;i++)data[i]=i%2?.5:-.5;const buffer={sampleRate:48000,numberOfChannels:1,duration:3,getChannelData:()=>data};assert(hissStart(buffer)>.8&&hissStart(buffer)<1.2);
const starts=[],levels=[],rates=[];const param={value:1,setValueAtTime(){},linearRampToValueAtTime(value){levels.push(value)},cancelScheduledValues(){},setTargetAtTime(){}};const ctx={currentTime:0,destination:{},createGain:()=>({gain:param,connect(){},disconnect(){}}),createBufferSource:()=>({playbackRate:{value:1},connect(){},disconnect(){},start(...a){starts.push(a);rates.push(this.playbackRate.value)},stop(){}})};
for(const mood of ['meow','annoyed','angry','hiss'])catVoice(ctx,mood,{meow:buffer,hiss:buffer})();assert.equal(starts.length,4);assert.deepEqual(rates,[1,.9,.7,1]);assert(starts[3][2]<=.97);assert(Math.abs(starts[3][1]-hissStart(buffer)-.18)<1e-6);assert(Math.max(...levels)<=.081);console.log('PASS recorded-buffer playback, selected hiss burst, stages and pause reset');


