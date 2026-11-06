// Keep gesture state on the container: drawing updates may replace SVG children.
export function attachPinchZoom(element,{onStart=()=>{},onMove=()=>{},onEnd=()=>{},accept=()=>true}={}){
  const touches=new Map();
  let active=false,previous=null,suppressClick=false;
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  function pair(){
    const [a,b]=touches.values();
    return b?{clientX:(a.clientX+b.clientX)/2,clientY:(a.clientY+b.clientY)/2,distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}:null;
  }
  function capture(id){if(!element.hasPointerCapture(id))element.setPointerCapture(id);}
  function release(id){if(element.hasPointerCapture(id))element.releasePointerCapture(id);}
  function finish(){
    const wasActive=active,ids=[...touches.keys()];
    active=false;previous=null;touches.clear();
    for(const id of ids)release(id);
    if(wasActive)onEnd();
  }
  element.addEventListener('pointerdown',e=>{
    if(!active&&!touches.size)suppressClick=false;
    if(e.pointerType!=='touch'||!accept(e))return;
    touches.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(touches.size<2&&!active)return;
    if(!active){
      active=true;suppressClick=true;
      onStart(e);
    }
    for(const id of touches.keys())capture(id);
    previous=pair();stop(e);
  },{capture:true,passive:false});
  element.addEventListener('pointermove',e=>{
    if(!touches.has(e.pointerId))return;
    touches.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
    if(!active)return;
    const current=pair();
    // Coincident contacts do not define a scale; rebase once they separate.
    if(previous?.distance>1&&current?.distance>1){
      onMove({scale:current.distance/previous.distance,from:previous,to:current});
    }
    previous=current;stop(e);
  },{capture:true,passive:false});
  function up(e){
    if(!touches.has(e.pointerId))return;
    touches.delete(e.pointerId);
    if(!active)return;
    release(e.pointerId);previous=pair();stop(e);
    // A remaining finger must not turn back into a drawing or rotation drag.
    if(!touches.size)finish();
  }
  // A lone contact may leave the plot before the second finger arrives.
  const releaseTarget=element.ownerDocument?.defaultView||element;
  releaseTarget.addEventListener('pointerup',up,{capture:true,passive:false});
  releaseTarget.addEventListener('pointercancel',e=>{
    if(!touches.has(e.pointerId))return;
    if(active){stop(e);finish();}else touches.delete(e.pointerId);
  },{capture:true,passive:false});
  element.addEventListener('lostpointercapture',e=>{
    if(active&&e.target===element&&touches.has(e.pointerId))finish();
  },true);
  element.addEventListener('click',e=>{
    if((active||suppressClick)&&(e.detail>0||e.pointerType==='touch'))stop(e);
  },true);
  return {cancel:finish,get active(){return active;}};
}
