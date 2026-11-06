import assert from 'node:assert/strict';
import {attachPinchZoom} from './docs/pinch-zoom.js';

// Model pointer delivery on the persistent plot element, without a browser or
// application geometry. Bubble listeners stand in for existing editing tools.
class Plot {
  listeners=new Map();
  captures=new Set();
  addEventListener(type,listener,options=false){
    const capture=typeof options==='boolean'?options:!!options.capture;
    const list=this.listeners.get(type)||[];
    list.push({listener,capture});this.listeners.set(type,list);
  }
  removeEventListener(type,listener){
    this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x.listener!==listener));
  }
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);}
  fire(type,options={}){
    const e={type,pointerId:1,pointerType:'touch',button:0,clientX:0,clientY:0,
      target:this,currentTarget:this,cancelable:true,detail:1,defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true;},
      stopPropagation(){this.propagationStopped=true;},
      stopImmediatePropagation(){this.immediateStopped=true;this.propagationStopped=true;},
      ...options};
    const list=this.listeners.get(type)||[];
    for(const entry of [...list.filter(x=>x.capture),...list.filter(x=>!x.capture)]){
      if(e.immediateStopped)break;entry.listener(e);
    }
    return e;
  }
}
const midpoint=p=>({clientX:p.clientX,clientY:p.clientY});
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
function fixture(options={},window=null){
  const plot=new Plot(),moves=[],starts=[],ends=[],single=[];
  if(window)plot.ownerDocument={defaultView:window};
  const pinch=attachPinchZoom(plot,{
    onStart:e=>starts.push(e),onMove:e=>moves.push(e),onEnd:()=>ends.push(true),...options
  });
  for(const type of ['pointerdown','pointermove','pointerup','click'])plot.addEventListener(type,e=>single.push(e.type));
  const event=(type,id,x=0,y=0,extra={})=>plot.fire(type,{pointerId:id,clientX:x,clientY:y,...extra});
  return {plot,pinch,moves,starts,ends,single,event};
}

// A single finger, mouse, or pen retains the original editor interactions.
{
  const f=fixture();
  for(const pointerType of ['touch','mouse','pen']){
    f.event('pointerdown',1,20,30,{pointerType});
    f.event('pointermove',1,40,30,{pointerType});
    f.event('pointerup',1,40,30,{pointerType});
    assert(!f.plot.fire('click',{pointerType}).defaultPrevented);
  }
  assert.equal(f.starts.length,0);assert.equal(f.moves.length,0);assert.equal(f.ends.length,0);
  assert.equal(f.single.length,12);assert.equal(f.pinch.active,false);
}

// The incremental scale and moving midpoint together describe both zoom and
// two-finger translation, including an off-center gesture.
{
  const f=fixture();
  f.event('pointerdown',1,20,30);
  const second=f.event('pointerdown',2,120,30);
  assert.equal(f.starts.length,1);assert(f.pinch.active);assert(second.defaultPrevented);
  assert(f.plot.hasPointerCapture(1)&&f.plot.hasPointerCapture(2));
  const delivered=f.single.length;
  f.event('pointermove',2,220,30);
  const a=f.moves.at(-1);close(a.scale,2);
  assert.deepEqual(midpoint(a.from),{clientX:70,clientY:30});assert.deepEqual(midpoint(a.to),{clientX:120,clientY:30});
  f.event('pointermove',1,40,30);
  const b=f.moves.at(-1);close(b.scale,.9);
  assert.deepEqual(midpoint(b.from),{clientX:120,clientY:30});assert.deepEqual(midpoint(b.to),{clientX:130,clientY:30});
  f.event('pointerup',2,220,30);
  assert.equal(f.ends.length,0);assert(f.pinch.active);
  const count=f.moves.length;
  f.event('pointermove',1,80,50);
  assert.equal(f.moves.length,count,'remaining finger must not resume camera/edit actions');
  assert(f.plot.fire('click').defaultPrevented);
  f.event('pointerup',1,80,50);
  assert.equal(f.ends.length,1);assert(!f.pinch.active);
  assert.equal(f.single.length,delivered,'pinch must not leak into original pointer handlers');
  assert(f.plot.fire('click').defaultPrevented,'post-gesture synthetic click must not select or draw');
  assert(!f.plot.fire('click',{detail:0,pointerType:''}).defaultPrevented,'keyboard activation remains available');
  f.event('pointerdown',3,70,60);f.event('pointerup',3,70,60);
  assert(!f.plot.fire('click').defaultPrevented,'a fresh tap must work');
}

// A third finger and replacement of one tracked finger rebase the pair: they
// must not create a zoom jump or a second undo/history transaction.
{
  const f=fixture();
  f.event('pointerdown',1,0,0);f.event('pointerdown',2,100,0);f.event('pointerdown',3,200,0);
  f.event('pointerup',2,100,0);
  f.event('pointermove',3,300,0);
  const move=f.moves.at(-1);close(move.scale,1.5);
  assert.deepEqual(midpoint(move.from),{clientX:100,clientY:0});assert.deepEqual(midpoint(move.to),{clientX:150,clientY:0});
  assert.equal(f.starts.length,1);
  f.event('pointerup',1);f.event('pointerup',3);
  assert.equal(f.ends.length,1);assert(!f.pinch.active);
}

// Cancellation, lost capture, and explicit cancellation permit a clean next
// gesture, without stale captures or a stuck editing/click suppression state.
for(const cancel of ['pointercancel','lostpointercapture','explicit']){
  const f=fixture();
  f.event('pointerdown',1,0,0);f.event('pointerdown',2,100,0);
  if(cancel==='explicit')f.pinch.cancel();else f.event(cancel,1,0,0);
  assert(!f.pinch.active,cancel);assert.equal(f.ends.length,1,cancel);
  assert.equal(f.plot.captures.size,0,cancel);
  f.event('pointerdown',3,10,10);f.event('pointerdown',4,110,10);
  f.event('pointermove',4,210,10);
  close(f.moves.at(-1).scale,2);
  f.event('pointerup',3);f.event('pointerup',4);
  assert.equal(f.starts.length,2,cancel);assert.equal(f.ends.length,2,cancel);
}

// A redraw may drop a single finger's implicit capture before a pinch starts.
// Its release outside the element must not leave a phantom second contact.
{
  const window=new Plot(),f=fixture({},window);
  f.event('pointerdown',1,0,0);
  window.fire('pointerup',{pointerId:1,target:{}});
  f.event('pointerdown',2,10,10);
  assert.equal(f.starts.length,0,'the released outside contact must be forgotten');
  f.event('pointerdown',3,110,10);assert.equal(f.starts.length,1);
  window.fire('pointerup',{pointerId:2});window.fire('pointerup',{pointerId:3});
  assert.equal(f.ends.length,1);assert(!f.pinch.active);
}

// Degenerate contact positions cannot produce NaN/Infinity or corrupt the
// next valid pinch, and losing capture on a replaced child SVG is harmless.
{
  const f=fixture();
  f.event('pointerdown',1,20,20);f.event('pointerdown',2,20,20);
  f.event('pointermove',2,20,20);
  assert.equal(f.moves.length,0);
  f.event('lostpointercapture',1,20,20,{target:{}});
  assert(f.pinch.active,'child replacement is not loss of the stable container capture');
  f.event('pointermove',2,120,20);f.event('pointermove',2,220,20);
  assert(f.moves.every(m=>Number.isFinite(m.scale)&&m.scale>0));close(f.moves.at(-1).scale,2);
  f.event('pointerup',1);f.event('pointerup',2);
}

// Rejected regions (for example a non-SVG explanation) keep normal scrolling
// and clicks; the accepted plot still supports a later gesture.
{
  const f=fixture({accept:e=>e.target.plot===true}),inside={plot:true},outside={plot:false};
  f.event('pointerdown',1,0,0,{target:outside});f.event('pointerdown',2,100,0,{target:outside});
  assert.equal(f.starts.length,0);assert(!f.pinch.active);
  f.event('pointerup',1);f.event('pointerup',2);
  f.event('pointerdown',3,0,0,{target:inside});f.event('pointerdown',4,100,0,{target:inside});
  assert.equal(f.starts.length,1);f.event('pointerup',3);f.event('pointerup',4);
}

console.log('pinch: incremental zoom and midpoint, single-pointer isolation, survivor/click suppression, three-finger rebasing, cancellation recovery, and accepted regions passed');
