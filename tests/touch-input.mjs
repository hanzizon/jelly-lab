import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const handlers={},windowHandlers={},captures=new Set();let current=0;
class V{constructor(...v){this.v=v.length?v:[0,0,0]}set(...v){this.v=v}copy(o){this.v=[...o.v];return this}sub(){return this}add(){return this}fromBufferAttribute(_,i){this.v=[i,0,0];return this}distanceToSquared(){return 0}distanceTo(){return .1}toArray(){return [...this.v]}}
class Ray{constructor(){this.ray={intersectPlane:(_,out)=>out.copy({v:[current,1,0]})}}setFromCamera(){}intersectObject(){return [{face:{a:0,b:1,c:2},point:new V()}]}}
const body={grabs:[],pin(_,target){const g={target};this.grabs.push(g);return g},release(g){this.grabs=this.grabs.filter(x=>x!==g)}};
const canvas={style:{},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),addEventListener:(n,f)=>handlers[n]=f,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>{captures.delete(id);handlers.lostpointercapture({pointerId:id})}};
const ctx={THREE:{Vector2:V,Vector3:V,Raycaster:Ray,Plane:class{setFromNormalAndCoplanarPoint(){}}},canvas,body,camera:{getWorldDirection:()=>new V()},jellyMesh:{},positionAttr:{},skins:[{}, {}, {}],shapeSelect:{value:'cat'},exciteFizz(){},window:{addEventListener:(n,f)=>windowHandlers[n]=f},document:{addEventListener(){}},performance:{now:()=>0}};
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');vm.runInNewContext(source.slice(source.indexOf('const pointer ='),source.indexOf('function updateViewControls')),ctx);
const event=id=>({pointerId:id,pointerType:'touch',clientX:10,clientY:10});
handlers.pointerdown(event(1));handlers.pointerdown(event(2));handlers.pointerdown(event(3));assert.equal(body.grabs.length,2);
current=4;handlers.pointermove(event(1));current=-4;handlers.pointermove(event(2));assert.equal(body.grabs[0].desired[0],4);assert.equal(body.grabs[1].desired[0],-4);
windowHandlers.pointerup(event(1));assert.equal(body.grabs.length,1);assert(captures.has(2));handlers.pointermove(event(2));handlers.pointercancel(event(2));assert.equal(body.grabs.length,0);assert.equal(captures.size,0);
handlers.pointerdown(event(4));handlers.pointerdown(event(5));windowHandlers.blur();assert.equal(body.grabs.length,0);console.log('PASS independent touch targets, third touch ignored, partial release, cancellation and blur');
