import {q,normalizeLine,autoFlag} from './math.js';

// The camera is numerical; the arrangement itself remains in its exact field.
export const wrapAngle=a=>{const value=Number(a);return Number.isFinite(value)?Math.atan2(Math.sin(value),Math.cos(value)):0;};
export const toView=(p,angle=0)=>{const c=Math.cos(angle),s=Math.sin(angle),x=Number(p[0]),y=Number(p[1]);return [c*x-s*y,s*x+c*y];};
export const fromView=(p,angle=0)=>toView(p,-angle);
export function projectPoint(p,view,width,height){const a=toView([Number(p[0])-view.cx,Number(p[1])-view.cy],view.angle||0);return [width*(.5+a[0]/view.w),height*(.5-a[1]/view.h)];}
export function unprojectPoint(p,view,width,height){const a=fromView([(p[0]/width-.5)*view.w,(.5-p[1]/height)*view.h],view.angle||0);return [view.cx+a[0],view.cy+a[1]];}
export const viewportCorners=(view,width,height)=>[[0,height],[width,height],[width,0],[0,0]].map(p=>unprojectPoint(p,view,width,height));
export function clipLineToView(line,view,width,height){
  const [a,b,c]=line.map(Number),angle=view.angle||0,co=Math.cos(angle),si=Math.sin(angle),A=a*co-b*si,B=a*si+b*co,C=a*view.cx+b*view.cy+c,points=[],x0=-view.w/2,x1=view.w/2,y0=-view.h/2,y1=view.h/2;
  const tolerance=Math.max(view.w,view.h)*1e-10;
  if(Math.abs(B)>Math.hypot(A,B)*1e-13)for(const x of [x0,x1]){const y=(-A*x-C)/B;if(y>=y0-tolerance&&y<=y1+tolerance)points.push([x,y]);}
  if(Math.abs(A)>Math.hypot(A,B)*1e-13)for(const y of [y0,y1]){const x=(-B*y-C)/A;if(x>=x0-tolerance&&x<=x1+tolerance)points.push([x,y]);}
  const unique=points.filter((p,i)=>!points.slice(0,i).some(v=>Math.hypot(p[0]-v[0],p[1]-v[1])<tolerance));
  return unique.length>=2?unique.slice(0,2).map(p=>[width*(.5+p[0]/view.w),height*(.5-p[1]/view.h)]):null;
}
export function fitRotatedPoints(points,aspect,angle=0){
  const ps=points.map(p=>toView(p,angle)).filter(p=>p.every(Number.isFinite));if(ps.length<2)ps.push([-2,-2],[2,2]);
  const minx=Math.min(...ps.map(p=>p[0])),maxx=Math.max(...ps.map(p=>p[0])),miny=Math.min(...ps.map(p=>p[1])),maxy=Math.max(...ps.map(p=>p[1]));
  let w=Math.max(2,maxx-minx)*1.32,h=Math.max(2,maxy-miny)*1.32;if(w/h<aspect)w=h*aspect;else h=w/aspect;
  const center=fromView([(minx+maxx)/2,(miny+maxy)/2],angle);return {cx:center[0],cy:center[1],w,h,angle:wrapAngle(angle)};
}
export function flagBottomView(data,aspect){
  if(!data.adapted)throw Error('flag を全有限交点の外側に置いてください');
  const [a,b,c]=data.flag.map(Number),length=Math.hypot(a,b);let side=1;
  for(const v of data.vertices){const value=data.flag[0].mul(v.p[0]).add(data.flag[1].mul(v.p[1])).add(data.flag[2]);if(value.n){side=value.n<0n?-1:1;break;}}
  if(!data.vertices.length&&c<0)side=-1;
  const angle=wrapAngle(Math.PI/2-Math.atan2(side*b,side*a)),flagPoint=data.p.map(Number),flagHeight=toView(flagPoint,angle)[1];
  const points=[...data.vertices.map(v=>v.p),...data.cuts.map(v=>data.point(v.t)),data.f0].map(p=>toView(p,angle));
  if(!data.vertices.length){const up=[flagPoint[0]+side*a/length*3,flagPoint[1]+side*b/length*3];points.push(toView(up,angle));}
  const minx=Math.min(...points.map(p=>p[0])),maxx=Math.max(...points.map(p=>p[0])),maxy=Math.max(flagHeight+1,...points.map(p=>p[1]));
  const h=Math.max(2.5,(maxy-flagHeight)/.72,Math.max(2,maxx-minx)*1.2/aspect),w=h*aspect,center=fromView([(minx+maxx)/2,flagHeight+.34*h],angle);
  return {cx:center[0],cy:center[1],w,h,angle};
}

export function projectToExactLine(point,line){
  const p=point.map(q),l=line.map(q),amount=l[0].mul(p[0]).add(l[1].mul(p[1])).add(l[2]).div(l[0].mul(l[0]).add(l[1].mul(l[1])));
  return [p[0].sub(amount.mul(l[0])),p[1].sub(amount.mul(l[1]))];
}
export function pivotForLine(data,index,view,preferVertex=true){
  const vertices=data.vertices.filter(v=>v.lines.includes(index));
  if(preferVertex&&vertices.length)return vertices.reduce((best,v)=>Math.hypot(Number(v.p[0])-view.cx,Number(v.p[1])-view.cy)<Math.hypot(Number(best.p[0])-view.cx,Number(best.p[1])-view.cy)?v:best).p.slice();
  return projectToExactLine([q(String(Math.round(view.cx*4)/4)),q(String(Math.round(view.cy*4)/4))],data.lines[index]);
}
export function lineAtAngle(pivot,angle){
  if(!Number.isFinite(angle))throw Error('回転角を読み取れません');
  // Bounded rational direction avoids repeatedly adjoining trigonometric numbers
  // or multiplying ever-growing rotation denominators. The exact pivot is kept.
  const dx=q(Math.round(Math.cos(angle)*1000000)),dy=q(Math.round(Math.sin(angle)*1000000)),p=pivot.map(q),a=dy.neg(),b=dx;
  return normalizeLine([a,b,a.mul(p[0]).add(b.mul(p[1])).neg()]);
}
export const tangentAngle=line=>Math.atan2(-Number(line[0]),Number(line[1]));
export function rotatedLine(line,pivot,delta){return Math.abs(Math.sin(delta))<1e-9?line.map(q):lineAtAngle(pivot,tangentAngle(line)+delta);}
export function flagAfterLineEdit(lines,previousDirection){
  if(previousDirection){try{return autoFlag(lines,previousDirection);}catch{}}
  for(let d=2;d<48;d++){try{return autoFlag(lines,[q(1),q('1/'+d)]);}catch{}}
  throw Error('回転後の flag を設定できませんでした');
}
