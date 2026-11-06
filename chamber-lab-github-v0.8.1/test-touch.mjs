// Browser regression test; Node 22+ and a running Chromium CDP endpoint, no npm dependencies.
// Serve docs/ over HTTP and start Chromium with --remote-debugging-port=9223.
// Usage: node test-touch.mjs http://127.0.0.1:8000 http://127.0.0.1:9223
import assert from 'node:assert/strict';

const appURL=process.argv[2]||'http://127.0.0.1:8000';
const debugURL=process.argv[3]||'http://127.0.0.1:9223';
const targets=await (await fetch(debugURL+'/json/list')).json();
const target=targets.find(t=>t.type==='page');
assert(target,'Start Chromium with --remote-debugging-port=9223 first');
const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map(),exceptions=[];
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let nextID=0;
ws.addEventListener('message',({data})=>{
  const message=JSON.parse(data);
  if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);
  const request=pending.get(message.id);
  if(request){pending.delete(message.id);message.error?request.reject(Error(JSON.stringify(message.error))):request.resolve(message.result);}
});
function call(method,params={}){
  const id=++nextID;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);
    pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function js(expression){
  const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  assert(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const pause=(ms=40)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){
  for(let i=0;i<100;i++){const value=await js(expression);if(value)return value;await pause(100);}
  throw Error('Page timeout: '+expression);
}
async function touch(type,touchPoints){await call('Input.dispatchTouchEvent',{type,touchPoints});await pause();}
const finger=(id,x,y)=>({id,x,y,radiusX:4,radiusY:4,force:1});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const near=(actual,expected,label,tolerance=1.5)=>assert(distance(actual,expected)<tolerance,`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
async function screenPoint(selector){
  return js(`(()=>{const selector=${JSON.stringify(selector)};let e,p;if(selector==='plinth-intersection'){const a=document.querySelector('#pl-canvas [data-pl-base-line=\"0\"]'),b=document.querySelector('#pl-canvas [data-pl-base-line=\"1\"]');if(!a||!b)return null;const equation=l=>{const [x,y,u,v]=['x1','y1','x2','y2'].map(n=>l[n].baseVal.value);return [y-v,u-x,x*v-u*y]},[A,B,C]=equation(a),[D,E,F]=equation(b),det=A*E-B*D;if(!det)return null;e=a;p=new DOMPoint((B*F-C*E)/det,(C*D-A*F)/det)}else{e=document.querySelector(selector);if(!e)return null;p=new DOMPoint(e.cx.baseVal.value,e.cy.baseVal.value)}p=p.matrixTransform(e.getScreenCTM());return [p.x,p.y]})()`);
}
async function plotCenter(selector){
  return js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width*.54,r.top+r.height*.52]})()`);
}
async function exactGeometry(lab){
  return js(`(()=>{const m=JSON.parse(localStorage.getItem(${JSON.stringify(lab+'-lab-v1')}));return JSON.stringify(${lab==='chamber'?'{lines:m.lines,flag:m.flag}':'{lines:m.lines,support:m.support,pivots:m.pivots,field:m.field}'})})()`);
}
async function pinch(plot,marker,scale,{shift=[12,7],cancel=false,prePan=false}={}){
  let midpoint=await plotCenter(plot),before=await screenPoint(marker);
  const geometry=await exactGeometry(plot==='#stage'?'chamber':'plinth');
  assert(before,'Expected a rendered arrangement marker: '+marker);
  const a=finger(0,midpoint[0]-45,midpoint[1]),b=finger(1,midpoint[0]+45,midpoint[1]);
  await touch('touchStart',[a]);
  if(prePan){a.x+=12;a.y+=9;await touch('touchMove',[a]);before=await screenPoint(marker);midpoint=[(a.x+b.x)/2,(a.y+b.y)/2];}
  const dx=(b.x-a.x)/2,dy=(b.y-a.y)/2;
  await touch('touchStart',[a,b]);
  for(let step=1;step<=4;step++){
    const t=step/4,s=1+(scale-1)*t,x=midpoint[0]+shift[0]*t,y=midpoint[1]+shift[1]*t;
    Object.assign(a,{x:x-dx*s,y:y-dy*s});Object.assign(b,{x:x+dx*s,y:y+dy*s});
    await touch('touchMove',[a,b]);
  }
  const after=await screenPoint(marker);
  near(after,[midpoint[0]+shift[0]+(before[0]-midpoint[0])*scale,midpoint[1]+shift[1]+(before[1]-midpoint[1])*scale],'Pinch scale and moving midpoint');
  if(cancel){await touch('touchCancel',[]);}
  else{
    await touch('touchEnd',[a]);
    a.x+=25;a.y+=18;await touch('touchMove',[a]);
    near(await screenPoint(marker),after,'Remaining finger must not move or edit the plot');
    await touch('touchEnd',[]);
  }
  assert.equal(await exactGeometry(plot==='#stage'?'chamber':'plinth'),geometry,'Pinch must preserve exact arrangement data');
  assert.equal(await js('visualViewport.scale'),1,'Pinch must zoom the diagram, not the page');
  return after;
}

try{
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:412,height:915,deviceScaleFactor:2,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.navigate',{url:appURL});
  await until("document.querySelector('#complex-counts')?.textContent");
  await js("localStorage.removeItem('chamber-lab-v1');localStorage.removeItem('plinth-lab-v1');location.reload()");
  await until("document.querySelector('#complex-counts')?.textContent");
  const chamberMarker='#stage circle[fill="#c5913c"]';
  await pinch('#stage',chamberMarker,1.4);
  await pinch('#stage',chamberMarker,1.2,{prePan:true});
  await pinch('#stage',chamberMarker,.8);
  await pinch('#stage',chamberMarker,1.1,{cancel:true});
  await pinch('#stage',chamberMarker,.9);
  await js("document.querySelector('#view-rotation').value=90;document.querySelector('#view-rotation').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#view-rotation').dispatchEvent(new Event('change',{bubbles:true}))");
  await pinch('#stage',chamberMarker,1.12);
  // A pinch in drawing mode must not create an initial point or a line.
  await js("document.querySelector('#mode-draw').click()");
  await pinch('#stage',chamberMarker,1.15);
  assert.equal(await js("document.querySelectorAll('#stage circle[fill=\"#0c8ea4\"]').length"),0,'Pinch must not leave a drawing point');
  await js("document.querySelector('#mode-select').click()");
  const center=await plotCenter('#stage');
  await touch('touchStart',[finger(0,...center)]);await touch('touchEnd',[]);
  assert(await js("document.querySelector('#stage polygon[stroke=\"#0f7889\"]')!==null"),'A fresh tap must select a chamber after pinching');
  const beforeWheel=await screenPoint(chamberMarker);
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:center[0],y:center[1],deltaX:0,deltaY:100});await pause(100);
  assert(distance(beforeWheel,await screenPoint(chamberMarker))>1,'Desktop wheel zoom must still work');
  console.log('Passed Chamber: spread/fold, midpoint anchoring, cancellation, remaining finger, pan-to-pinch transition, rotated camera, draw safety, fresh tap and wheel.');
  await js("document.querySelector('[data-lab=plinth]').click()");
  await until("document.querySelector('#pl-canvas svg')");
  const plinthMarker='plinth-intersection';
  await pinch('#pl-canvas svg',plinthMarker,1.4);
  await pinch('#pl-canvas svg',plinthMarker,.8);
  await pinch('#pl-canvas svg',plinthMarker,1.1,{cancel:true});
  await pinch('#pl-canvas svg',plinthMarker,.9);
  // Existing zoom controls must remain usable after the touch sequence.
  const beforeButton=await js("JSON.parse(localStorage.getItem('plinth-lab-v1')).plotZoom");
  await js("document.querySelector('#pl-zoom-in').click()");
  assert((await js("JSON.parse(localStorage.getItem('plinth-lab-v1')).plotZoom"))>beforeButton,'Plinth zoom button must still work');
  await js("document.querySelector('#pl-preset').value='maclane';document.querySelector('#pl-preset').dispatchEvent(new Event('change',{bubbles:true}))");
  await until("document.querySelector('#pl-canvas svg[data-pl-plot=schematic]')");
  await pinch('#pl-canvas svg[data-pl-plot=schematic]','#pl-canvas svg[data-pl-plot=schematic] [data-pl-corner-marker=\"0\"] circle',1.3);
  await pinch('#pl-canvas svg[data-pl-plot=schematic]','#pl-canvas svg[data-pl-plot=schematic] [data-pl-corner-marker=\"0\"] circle',.85);
  await js("document.querySelector('#pl-canvas details').open=true");
  await pinch('#pl-canvas svg[data-pl-plot=incidence]','#pl-canvas svg[data-pl-plot=incidence] [data-pl-base-line=\"0\"] circle',1.3);
  await pinch('#pl-canvas svg[data-pl-plot=incidence]','#pl-canvas svg[data-pl-plot=incidence] [data-pl-base-line=\"0\"] circle',.85);
  assert.equal(exceptions.length,0,'Unexpected browser exceptions: '+JSON.stringify(exceptions));
  console.log('Passed Plinth: real plot, complex schematic and incidence graph spread/fold; midpoint anchoring, cancellation, remaining finger, exact data and zoom controls.');
}finally{ws.close();}
