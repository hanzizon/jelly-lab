import assert from 'node:assert/strict';import {nextCatMood,catVoice} from '../cat-voice.js';
const state={count:0,last:-Infinity};assert.deepEqual([0,.2,.4,.6,.8,1].map(t=>nextCatMood(state,t)),['meow','meow','annoyed','annoyed','annoyed','hiss']);assert.equal(nextCatMood(state,4),'meow');
const calls=[];const param={value:0,setValueAtTime(v){assert(Number.isFinite(v))},exponentialRampToValueAtTime(v){assert(v>0)},cancelScheduledValues(){},setTargetAtTime(){}};
const node=()=>({frequency:param,Q:{value:0},gain:param,connect(){},disconnect(){},start(){calls.push('start')},stop(){calls.push('stop')}});
const ctx={currentTime:0,sampleRate:48000,destination:{},createGain:node,createBiquadFilter:node,createOscillator:node,createBufferSource:node,createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)})};
for(const mood of ['meow','annoyed','hiss'])catVoice(ctx,mood)();assert.equal(calls.filter(x=>x==='start').length,3);console.log('PASS gentle/annoyed/hiss progression, pause reset and finite bounded voices');
