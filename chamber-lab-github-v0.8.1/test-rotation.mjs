import assert from 'node:assert/strict';
import {arrangement,PRESETS,q} from './docs/math.js';
import {wrapAngle,projectPoint,unprojectPoint,clipLineToView,fitRotatedPoints,flagBottomView,projectToExactLine,pivotForLine,rotatedLine,flagAfterLineEdit} from './docs/rotation.js';
const close=(a,b,tol=1e-9)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`),W=920,H=470;
for(const invalid of [undefined,'Infinity','oops',Infinity,NaN])assert.equal(wrapAngle(invalid),0);
for(const angle of [0,.7,-1.1,Math.PI/2,-Math.PI]){
  const view={cx:2,cy:-3,w:12,h:12*H/W,angle};
  for(const p of [[0,0],[3,-2],[-5,7]]){const out=unprojectPoint(projectPoint(p,view,W,H),view,W,H);p.forEach((v,i)=>close(out[i],v));}
  for(const line of [[1,0,-2],[0,1,3],[2,3,5]])for(const pixel of clipLineToView(line,view,W,H)||[]){const p=unprojectPoint(pixel,view,W,H);close(line[0]*p[0]+line[1]*p[1]+line[2],0);assert(pixel[0]>-1e-6&&pixel[0]<W+1e-6&&pixel[1]>-1e-6&&pixel[1]<H+1e-6);}
}
let count=0;
for(const preset of PRESETS){
  const d=arrangement(preset.lines),before=JSON.stringify(d.lines),v=flagBottomView(d,W/H),ends=clipLineToView(d.flag,v,W,H);
  assert(ends);close(ends[0][1],ends[1][1],1e-6);close(ends[0][1],H*.84,1e-6);
  for(const vertex of d.vertices)assert(projectPoint(vertex.p,v,W,H)[1]<H*.84+1e-6);
  assert.equal(JSON.stringify(d.lines),before,'view alignment must not mutate exact coordinates');
  if(d.n){const pivot=pivotForLine(d,0,v),l=rotatedLine(d.lines[0],pivot,.37);assert(l[0].mul(pivot[0]).add(l[1].mul(pivot[1])).add(l[2]).eq(0));assert.deepEqual(rotatedLine(d.lines[0],pivot,Math.PI).map(String),d.lines[0].map(String));}
  count++;
}
const a3=arrangement(PRESETS.find(p=>p.id==='a3').lines),pivot=[q(0),q(0)],line=rotatedLine(a3.lines[4],pivot,.3),raw=a3.lines.map(l=>l.map(String));raw[4]=line.map(String);
const changed=arrangement(raw,flagAfterLineEdit(raw,a3.u));assert(changed.verified);assert.notEqual(changed.b2,a3.b2);assert.equal(a3.b2,6);
const p=projectToExactLine([q('1/3'),q('2/7')],a3.lines[4]);assert(p[0].sub(p[1]).eq(0));
const fit=fitRotatedPoints([[0,0],[4,2]],W/H,.8);for(const point of [[0,0],[4,2]]){const px=projectPoint(point,fit,W,H);assert(px[0]>0&&px[0]<W&&px[1]>0&&px[1]<H);}
for(const preset of PRESETS.filter(p=>p.id==='icosidodecahedral'||p.field?.sourceGenerator==='r7'||p.field?.sourceGenerator==='rho').slice(0,4)){
  const d=arrangement(preset.lines),pivot=pivotForLine(d,0,flagBottomView(d,W/H)),lines=d.lines.map(l=>l.map(String));lines[0]=rotatedLine(d.lines[0],pivot,.21).map(String);
  assert(arrangement(lines,flagAfterLineEdit(lines,d.u)).verified,'rotation in an algebraic number field');
}
console.log(`rotation: camera inverses and clipping, horizontal bottom flag for ${count} exact presets, exact pivot retention, direction half-turn, edited incidence and universal complex verified`);
