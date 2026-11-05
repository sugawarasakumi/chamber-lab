import {Rational,fieldFromSpec,parseFieldExpression,polynomialRoots} from './plinth-field.js';
export const cross=(a,b,F)=>[F.sub(F.mul(a[1],b[2]),F.mul(a[2],b[1])),F.sub(F.mul(a[2],b[0]),F.mul(a[0],b[2])),F.sub(F.mul(a[0],b[1]),F.mul(a[1],b[0]))];
const dot=(a,b,F)=>a.reduce((s,x,i)=>F.add(s,F.mul(x,b[i])),F.zero);
const det=(a,b,c,F)=>dot(a,cross(b,c,F),F);
export function normalize(v,F){const lead=v.find(x=>!F.is0(x));if(!lead)throw Error('零ベクトルは射影座標にできません');return v.map(x=>F.div(x,lead));}
const same=(a,b,F)=>cross(a,b,F).every(F.is0);
const signature=groups=>groups.map(p=>(p.lines||p).slice().sort((a,b)=>a-b).join(',')).sort().join('|');
export function projectiveArrangement(raw,F=Rational){
  if(!Array.isArray(raw)||raw.length>28)throw Error('Plinth Lab の入力は射影28直線までです');
  const lines=raw.map(v=>{if(!Array.isArray(v)||v.length!==3)throw Error('直線の係数は a,b,c の3値です');return normalize(v.map(x=>typeof x==='string'?parseFieldExpression(x,F):F.from(x)),F);});
  const keys=new Set();for(const l of lines){const key=l.map(F.str).join(';');if(keys.has(key))throw Error('重複する射影直線があります');keys.add(key);}
  return {lines,field:F,points:singularities(lines,F)};
}
export function singularities(lines,F){
  const points=new Map();for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const p=normalize(cross(lines[i],lines[j],F),F),key=p.map(F.str).join(';');if(!points.has(key))points.set(key,{p,lines:[]});
  }
  const result=[...points.values()];result.forEach((v,i)=>{v.id='P'+(i+1);v.lines=lines.map((l,j)=>F.is0(dot(l,v.p,F))?j:-1).filter(j=>j>=0);});return result;
}
function lineBasis(line,F){const k=line.findIndex(x=>!F.is0(x)),free=[0,1,2].filter(j=>j!==k);return free.map(j=>{const v=[F.zero,F.zero,F.zero];v[j]=F.one;v[k]=F.div(F.neg(line[j]),line[k]);return v;});}
export function deconeProjective(lines,index,F){
  if(!Number.isInteger(index)||!lines[index])throw Error('無限遠にする直線を選んでください');
  const line=lines[index],basis=lineBasis(line,F),lead=line.findIndex(x=>!F.is0(x)),W=[F.zero,F.zero,F.zero];W[lead]=F.div(F.one,line[lead]);
  const columns=[...basis,W],indices=lines.map((_,i)=>i).filter(i=>i!==index),free=[0,1,2].filter(i=>i!==lead);
  return {lines:indices.map(i=>lines[i].map((_,j)=>dot(lines[i],columns[j],F))),indices,point:p=>{const z=dot(line,p,F);return F.is0(z)?null:free.map(i=>F.div(p[i],z));}};
}
export function makePlinth(base,support,pivotPairs){
  const {field:F,lines,points}=base,r=support.length;
  if(r<3||r>8||r>lines.length)throw Error('plinth の長さは3–8、かつ基礎配置の直線数以下です');
  if(support.some(i=>!Number.isInteger(i)||i<0||i>=lines.length)||new Set(support).size!==r)throw Error('support には異なる直線を選んでください');
  if(pivotPairs.length!==r)throw Error('support と pivot の個数をそろえてください');
  const pivots=pivotPairs.map((pair,i)=>{if(!Array.isArray(pair)||pair.length<2||new Set(pair).size<2)throw Error('pivot を基礎配置の交点から選んでください');const p=points.find(p=>pair.every(j=>p.lines.includes(j)));if(!p)throw Error('指定した直線は一つの pivot で交わりません');if(p.lines.includes(support[i])||p.lines.includes(support[(i+1)%r]))throw Error(`P${i+1} が隣接する support 上にあります`);return p;});
  if(new Set(pivots.map(p=>p.id)).size!==r)throw Error('pivot は異なる交点を選んでください');
  const basis=lineBasis(lines[support[0]],F),corners=[basis],edges=[];let current=basis;
  for(let i=0;i<r;i++){const edge=current.map(p=>cross(p,pivots[i].p,F));edges.push(edge);current=edge.map(e=>cross(e,lines[support[(i+1)%r]],F));corners.push(current);}
  const S=lines[support[0]],first=edges[0],last=edges.at(-1),coefficients=[det(S,first[0],last[0],F),F.add(det(S,first[0],last[1],F),det(S,first[1],last[0],F)),det(S,first[1],last[1],F)];
  const leading=coefficients.slice().reverse().find(x=>!F.is0(x));if(leading)for(let i=0;i<3;i++)coefficients[i]=F.div(coefficients[i],leading);
  return {base,support:support.slice(),pivots,r,basis,corners,edges,coefficients};
}
export function tracePolygon(plinth,s,t,F=plinth.base.field){
  const at=pair=>normalize(pair[0].map((x,i)=>F.add(F.mul(F.from(x),s),F.mul(F.from(pair[1][i]),t))),F);
  return {corners:plinth.corners.map(at),edges:plinth.edges.map(at),pivots:plinth.pivots.map(v=>v.p.map(x=>F.from(x))),closed:same(at(plinth.corners[0]),at(plinth.corners.at(-1)),F)};
}
function expectedGroups(plinth,closed){
  const n=plinth.base.lines.length,groups=plinth.base.points.map(p=>[...p.lines,...plinth.pivots.flatMap((v,i)=>v.id===p.id?[n+i]:[])]),r=plinth.r;
  for(let i=closed?0:1;i<r;i++)groups.push([plinth.support[i],n+(i+r-1)%r,n+i]);
  const pairs=new Map();for(const group of groups)for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){const key=[group[i],group[j]].sort((a,b)=>a-b).join(',');if(pairs.has(key))return null;pairs.set(key,true);}
  for(let i=0;i<n+r;i++)for(let j=i+1;j<n+r;j++)if(!pairs.has(i+','+j))groups.push([i,j]);return groups;
}
export function checkPolygon(plinth,root,F=plinth.base.field){
  let trace;try{
    trace=tracePolygon(plinth,root.s,root.t,F);const old=plinth.base.lines.map(l=>l.map(x=>F.from(x))),lines=[...old,...trace.edges],keys=lines.map(l=>l.map(F.str).join(';'));
    if(new Set(keys).size!==keys.length)return {...trace,valid:false,status:'degenerate',issues:['追加直線どうし、または基礎配置の直線と重複'],lines};
    const points=singularities(lines,F),expected=expectedGroups(plinth,trace.closed),valid=!!expected&&signature(points)===signature(expected);
    const wanted=new Set((expected||[]).map(p=>p.slice().sort((a,b)=>a-b).join(','))),unexpected=points.filter(p=>!wanted.has(p.lines.join(',')));
    const counts={};for(const p of points)counts[p.lines.length]=(counts[p.lines.length]||0)+1;
    return {...trace,valid,status:valid?(trace.closed?'splitting':'nonsplitting'):'degenerate',issues:valid?[]:['指定した pivot・corner 以外の交点条件が発生'],unexpected:unexpected.map(p=>p.lines),lines,points,counts,signature:signature(points)};
  }catch(e){return {...trace,valid:false,status:'degenerate',issues:[e.message]};}
}
export function matrixRank(M,F,n=M[0]?.length||0){
  const a=M.map(row=>row.slice());let r=0;for(let c=0;c<n&&r<a.length;c++){let p=r;while(p<a.length&&F.is0(a[p][c]))p++;if(p===a.length)continue;[a[p],a[r]]=[a[r],a[p]];const v=a[r][c];for(let j=c;j<n;j++)a[r][j]=F.div(a[r][j],v);for(let i=r+1;i<a.length;i++)if(!F.is0(a[i][c])){const v=a[i][c];for(let j=c;j<n;j++)a[i][j]=F.sub(a[i][j],F.mul(v,a[r][j]));}r++;}return r;
}
export function rigidityCertificate(base){
  const {lines,points,field:F}=base,n=lines.length,free=lines.map(l=>[0,1,2].filter(j=>j!==l.findIndex(x=>!F.is0(x)))),rows=[];let frame=null;
  for(let a=0;a<n&&!frame;a++)for(let b=a+1;b<n&&!frame;b++)for(let c=b+1;c<n&&!frame;c++)for(let d=c+1;d<n;d++){
    if([[a,b,c],[a,b,d],[a,c,d],[b,c,d]].every(ids=>!F.is0(det(...ids.map(i=>lines[i]),F)))){frame=[a,b,c,d];break;}
  }
  for(const point of points){const [i,j,...rest]=point.lines;for(const k of rest){const ids=[i,j,k],row=Array(2*n).fill(F.zero);ids.forEach((idx,a)=>{const cofactor=cross(lines[ids[(a+1)%3]],lines[ids[(a+2)%3]],F);free[idx].forEach((c,b)=>row[2*idx+b]=cofactor[c]);});rows.push(row);}}
  const rank=matrixRank(rows,F,2*n),tangentDimension=2*n-rank,certified=!!frame&&tangentDimension===8;
  return {certified,variables:2*n,equations:rows.length,jacobianRank:rank,tangentDimension,projectiveOrbitDimension:frame?8:null,frame,reason:certified?'4直線の projective frame と tangent dimension 8 により、PGL₃ で割った局所モジュライは孤立点':'この接空間検査では rigidity を認証していません',matrix:rows.map(row=>row.map(F.str))};
}
export function analyzePlinth(base,support,pivotPairs,{rigidity=true}={}){
  const plinth=makePlinth(base,support,pivotPairs),F=base.field,solutions=polynomialRoots(plinth.coefficients,F),branches=solutions.roots.map(root=>({root,...checkPolygon(plinth,root,solutions.field)}));
  let witness=null;if(solutions.kind!=='identity')for(let i=0;i<65;i++){const k=i%2?-(i+1)/2:i/2,t=F.from(k),value=F.add(plinth.coefficients[0],F.add(F.mul(plinth.coefficients[1],t),F.mul(plinth.coefficients[2],F.mul(t,t))));if(F.is0(value))continue;const trial=checkPolygon(plinth,{s:F.one,t},F);if(trial.valid&&!trial.closed){witness={parameter:String(k),...trial};break;}}
  const certificate=rigidity?rigidityCertificate(base):null,valid=branches.filter(b=>b.valid&&b.closed),sameLattice=valid.length===2&&valid[0].signature===valid[1].signature;
  return {plinth,solutions,branches,witness,rigidity:certificate,sameLattice,orderedSeparated:sameLattice&&!!witness&&!!certificate?.certified};
}
export function modelFromJSON(model){if(!Array.isArray(model?.lines)||model.lines.length<3||!Array.isArray(model.support)||model.support.length<3||model.support.length>8||!Array.isArray(model.pivots))throw Error('3本以上の基礎配置と、長さ3–8の support・pivot が必要です');const F=fieldFromSpec(model.field);return projectiveArrangement(model.lines,F);}
export function serializeAnalysis(result){
  const {plinth,solutions,branches,witness,rigidity}=result,F=plinth.base.field,G=solutions.field;
  const polygon=(x,K)=>({valid:x.valid,closed:x.closed,status:x.status,issues:x.issues,unexpected:x.unexpected,counts:x.counts,lines:x.lines?.map(l=>l.map(K.str)),corners:x.corners?.map(p=>p.map(K.str)),pivots:x.pivots?.map(p=>p.map(K.str)),points:x.points?.map(p=>({p:p.p.map(K.str),lines:p.lines})),signature:x.signature});
  return {field:F.spec,resultField:G.spec,support:plinth.support,pivots:plinth.pivots.map(p=>p.lines),basis:plinth.basis.map(p=>p.map(F.str)),coefficients:plinth.coefficients.map(F.str),kind:solutions.kind,discriminant:solutions.discriminant===null?null:F.str(solutions.discriminant),branches:branches.map(b=>({...polygon(b,G),root:{s:G.str(b.root.s),t:G.str(b.root.t),label:b.root.label,multiplicity:b.root.multiplicity}})),witness:witness?{parameter:witness.parameter,...polygon(witness,F)}:null,rigidity,sameLattice:result.sameLattice,orderedSeparated:result.orderedSeparated,convention:'Q1(s,t)=s U+t V; lambda=t/s; Qi lies on Si, Ei joins Qi and Pi; an infinite root is retained; all incidence predicates exact'};
}
