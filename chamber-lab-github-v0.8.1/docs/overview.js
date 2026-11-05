// Exact combinatorial invariants and certified, one-sided asphericity tests.
import {q,Z,ONE,rref,QQ} from './math.js';
const cross=(a,b)=>[a[1].mul(b[2]).sub(a[2].mul(b[1])),a[2].mul(b[0]).sub(a[0].mul(b[2])),a[0].mul(b[1]).sub(a[1].mul(b[0]))];
const dot=(a,b)=>a.reduce((s,x,i)=>s.add(x.mul(b[i])),Z);
const sign=x=>x.n<0n?-1:x.n>0n?1:0;
const bits=s=>s.reduce((v,x,i)=>v+(x>0?2**i:0),0);
const countBy=a=>{const r={};for(const x of a)r[x]=(r[x]||0)+1;return r;};
const samePoint=(a,b)=>a.every((x,i)=>x.eq(b[i]));
const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
function cleanPolygon(poly){let a=poly.filter((p,i)=>!i||!samePoint(p,poly[i-1]));if(a.length>1&&samePoint(a[0],a[a.length-1]))a.pop();let changed=true;while(changed&&a.length>3){changed=false;for(let i=0;i<a.length;i++){const p=a[(i+a.length-1)%a.length],v=a[i],w=a[(i+1)%a.length];const det=v[0].sub(p[0]).mul(w[1].sub(v[1])).sub(v[1].sub(p[1]).mul(w[0].sub(v[0])));if(!det.n){a.splice(i,1);changed=true;break;}}}return a;}

export function topeGraph(data){
  const n=data.n,raw=data.cells.map(c=>bits(c.signs)),index=new Map(raw.map((v,i)=>[v,i])),all=2**n-1;
  const neighbors=Array.from({length:raw.length},()=>[]),edges=[];
  raw.forEach((v,i)=>{for(let j=0;j<n;j++){const k=index.get(v^(2**j));if(k===undefined)continue;neighbors[i].push({to:k,line:j});if(i<k)edges.push({from:i,to:k,line:j});}});
  const opposite=raw.map(v=>index.get(v^all)??-1);
  const nodes=data.cells.map((c,i)=>({id:c.id,chamber:c.id,index:i,signs:c.signs,degree:c.degree,mask:raw[i]}));
  const coneNodes=nodes.map(c=>({...c,id:c.id+'+',sheet:1,signs:[...c.signs,1]})).concat(nodes.map(c=>({...c,id:c.id+'−',sheet:-1,signs:[...c.signs.map(x=>-x),-1]})));
  const r=nodes.length,coneEdges=edges.map(e=>({...e})).concat(edges.map(e=>({...e,from:e.from+r,to:e.to+r})));
  opposite.forEach((j,i)=>{if(j>=0)coneEdges.push({from:i,to:j+r,line:n});});
  return {nodes,edges,coneNodes,coneEdges,neighbors,opposite};
}

export function boundedComplex(data){
  const vertices=data.vertices.map((v,i)=>({...v,id:'v'+(i+1),index:i})),pointIndex=new Map(vertices.map((v,i)=>[v.p.join(','),i]));
  const edges=[],edgeMap=new Map();
  for(let j=0;j<data.n;j++){
    const l=data.lines[j],dir=[l[1],l[0].neg()],on=vertices.filter(v=>v.lines.includes(j));
    on.sort((v,w)=>dot(v.p,dir).cmp(dot(w.p,dir)));
    for(let k=1;k<on.length;k++){const e={id:'e'+(edges.length+1),from:on[k-1].index,to:on[k].index,line:j};edgeMap.set(edgeKey(e.from,e.to),edges.length);edges.push(e);}
  }
  const faces=data.cells.filter(c=>!c.unbounded).map(c=>{
    const poly=cleanPolygon(c.poly),vs=poly.map(p=>pointIndex.get(p.join(',')));
    if(vs.some(v=>v===undefined))throw Error('有界 chamber の頂点を検証できません');
    const es=vs.map((v,i)=>edgeMap.get(edgeKey(v,vs[(i+1)%vs.length])));
    if(es.some(e=>e===undefined))throw Error('有界 chamber の辺を検証できません');
    return {id:c.id,vertices:vs,edges:es};
  });
  const links=vertices.map(v=>({vertices:edges.map((e,i)=>e.from===v.index||e.to===v.index?i:-1).filter(i=>i>=0),edges:[]}));
  for(const f of faces)f.vertices.forEach((v,i)=>links[v].edges.push([f.edges[(i+f.edges.length-1)%f.edges.length],f.edges[i]]));
  return {vertices,edges,faces,links};
}

export function falkBalanced(data,complex=boundedComplex(data)){
  const weights=complex.vertices.map((v,i)=>{
    const link=complex.links[i],adj=new Map(link.vertices.map(e=>[e,[]]));
    link.edges.forEach(([a,b])=>{adj.get(a).push(b);adj.get(b).push(a);});
    const seen=new Set(),components=[];for(const u of link.vertices)if(!seen.has(u)){const stack=[u],part=[];seen.add(u);while(stack.length){const w=stack.pop();part.push(w);for(const z of adj.get(w))if(!seen.has(z)){seen.add(z);stack.push(z);}}components.push(part);}
    const m=v.lines.length,d=Math.max(0,...components.map(c=>c.length));
    const weight=d<m?Z:d===m&&m>=3?ONE.div(m+1):ONE.div(m);
    return {id:v.id,point:v.p.map(String),m,d,weight:weight.toString(),linkVertices:link.vertices.map(e=>complex.edges[e].id),linkEdges:link.edges.map(es=>es.map(e=>complex.edges[e].id)),components:components.map(c=>c.map(e=>complex.edges[e].id))};
  });
  const faces=complex.faces.map(f=>{const total=f.vertices.reduce((a,v)=>a.add(q(weights[v].weight)),Z),bound=q(f.vertices.length-2);return {id:f.id,vertices:f.vertices.map(v=>weights[v].id),sum:total.toString(),bound:bound.toString(),passed:total.cmp(bound)<=0};});
  return {passed:faces.every(f=>f.passed),weights,faces,edgeCount:complex.edges.length,source:'https://doi.org/10.1016/0040-9383(94)E0011-8',theorem:'Falk 1995, Corollary 3.10 (balanced weights)',scope:'十分条件。失敗は非 K(π,1) を意味しません。任意の角の重みを探索する一般版は未実装。'};
}

export function overview(data){
  const graph=topeGraph(data),N=data.n+1,normal=[...data.lines,[q(0),q(0),q(1)]],rank=rref(normal,QQ,3).rank;
  const groups=new Map();data.lines.forEach((l,i)=>{const k=l.slice(0,2).join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);});
  const finite=data.vertices.map((v,i)=>({id:'P'+(i+1),hom:[...v.p,ONE],lines:v.lines,infinity:false}));
  const infinity=[...groups.values()].map((g,i)=>({id:'P∞'+(i+1),hom:[data.lines[g[0]][1],data.lines[g[0]][0].neg(),Z],lines:[...g,data.n],infinity:true}));
  const points=[...finite,...infinity],projectiveCounts=countBy(points.map(p=>p.lines.length)),finiteCounts=countBy(finite.map(p=>p.lines.length)),infinityCounts=countBy(infinity.map(p=>p.lines.length));
  const projectiveEdges=points.reduce((s,p)=>s+p.lines.length,0),pairCount=points.reduce((s,p)=>s+p.lines.length*(p.lines.length-1)/2,0);
  if(pairCount!==N*(N-1)/2)throw Error('射影交点の組数の検算が一致しません');
  const walls=graph.nodes.map((c,i)=>({id:c.id,lines:[...graph.neighbors[i].map(e=>e.line),...(graph.opposite[i]>=0?[data.n]:[])]}));
  const simplicial=rank===3&&walls.every(c=>c.lines.length===3);
  if(rank===3&&walls.reduce((s,c)=>s+c.lines.length,0)!==2*projectiveEdges)throw Error('射影 chamber の辺数の検算が一致しません');
  const pairMap=new Map();for(const p of points)for(let a=0;a<p.lines.length;a++)for(let b=a+1;b<p.lines.length;b++)pairMap.set(edgeKey(p.lines[a],p.lines[b]),p);
  const boundedIds=new Set(data.cells.filter(c=>!c.unbounded).map(c=>c.id)),wallOrder=walls.slice().sort((a,b)=>Number(!boundedIds.has(a.id))-Number(!boundedIds.has(b.id)));
  let triangle=null;if(rank===3&&N>=4)for(const c of wallOrder){if(c.lines.length!==3)continue;const vertices=[];for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)vertices.push(pairMap.get(edgeKey(c.lines[i],c.lines[j])));if(vertices.every(p=>p&&p.lines.length===2)){triangle={chamber:c.id,walls:c.lines,vertices:vertices.map(p=>({id:p.id,point:p.hom.map(String),infinity:p.infinity}))};break;}}
  const modular=rank===3?points.find(p=>points.every(v=>p.lines.some(i=>v.lines.includes(i)))):null;
  const bounded=boundedComplex(data),falk=falkBalanced(data,bounded);
  return {n:data.n,N,rank,finiteCounts,infinityCounts,projectiveCounts,points:points.map(p=>({...p,hom:p.hom.map(String)})),projectiveEdges,pairCount,chambers:data.cells.length,bounded:bounded.faces.length,betti:[1,data.n,data.b2],euler:1-data.n+data.b2,characteristic:[1,-data.n,data.b2],coneCharacteristic:[1,-N,data.b2+data.n,-data.b2],graph,walls,faceDegrees:countBy(walls.map(c=>c.lines.length)),simplicial,triangle,modular:modular?{id:modular.id,hom:modular.hom.map(String),lines:modular.lines}:null,falk};
}

// In rank three, 2-consistency is equivalent to feasibility on every triple.
// Dependent triples of pairwise nonproportional normals give the only clauses.
export function yoshinagaConsistency(data){
  const normals=[...data.lines,[q(0),q(0),q(1)]],N=normals.length,n=data.n,clauses=[],dependencies=[];
  for(let i=0;i<N;i++)for(let j=i+1;j<N;j++)for(let k=j+1;k<N;k++){
    const a=normals[i],b=normals[j],c=normals[k];if(dot(cross(a,b),c).n!==0n)continue;
    let pair=null;for(const [u,v] of [[0,1],[0,2],[1,2]])if(a[u].mul(b[v]).sub(a[v].mul(b[u])).n!==0n){pair=[u,v];break;}
    if(!pair)throw Error('比例する法線が見つかりました');
    const [u,v]=pair,det=(x,y)=>x[u].mul(y[v]).sub(x[v].mul(y[u])),co=[det(b,c),det(c,a),det(a,b)],ids=[i,j,k];
    if(co.some(x=>!x.n)||[0,1,2].some(z=>co.reduce((s,x,t)=>s.add(x.mul(normals[ids[t]][z])),Z).n!==0n))throw Error('rank 2 triple の一次関係を検証できません');
    dependencies.push({lines:ids,coefficients:co.map(String)});
    for(const polarity of [-1,1]){const s=co.map(x=>polarity*sign(x));if(ids.includes(n)&&s[ids.indexOf(n)]!==1)continue;let mask=0,value=0;ids.forEach((j,t)=>{if(j===n)return;mask|=2**j;if(s[t]>0)value|=2**j;});clauses.push({mask,value});}
  }
  const actual=new Set(data.cells.map(c=>bits(c.signs))),frequencies=Array(n).fill(0);
  clauses.forEach(c=>{for(let i=0;i<n;i++)if(c.mask&2**i)frequencies[i]++;});
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>frequencies[b]-frequencies[a]||a-b),position=Array(n).fill(0);order.forEach((v,i)=>position[v]=i);
  const finish=Array.from({length:n},()=>[]);for(const c of clauses){let last=-1;for(let i=0;i<n;i++)if(c.mask&2**i)last=Math.max(last,position[i]);if(last>=0)finish[last].push(c);}
  let count=0,hits=0,witness=null;function search(depth,value){if(depth===n){count++;if(actual.has(value))hits++;else if(witness===null)witness=value;return;}const bit=2**order[depth];for(const b of [0,bit]){const next=value|b;if(finish[depth].some(c=>(next&c.mask)===c.value))continue;search(depth+1,next);}}
  search(0,0);if(hits!==actual.size)throw Error('consistency 条件が実在 chamber を除いています');
  return {passed:count===actual.size,localCount:count,globalCount:actual.size,sigma2:2*count,sigma3:2*actual.size,dependencyCount:dependencies.length,clauseCount:clauses.length,witness:witness===null?null:{signs:[...Array.from({length:n},(_,i)=>witness&2**i?1:-1),1],local:true,global:false},dependencies,source:'https://arxiv.org/abs/2405.20010',formulation:'https://arxiv.org/abs/2512.10077',scope:'必要条件。通過だけでは K(π,1) と断定しません。rank 3 で破れれば π₂ ≠ 0。'};
}

export function asphericity(data){const o=overview(data),consistency=yoshinagaConsistency(data);const yes=[];if(o.rank<=2)yes.push('rank ≤ 2');if(o.simplicial)yes.push('Deligne: simplicial');if(o.modular)yes.push('supersolvable: modular point');if(o.falk.passed)yes.push('Falk: balanced weights');const no=[];if(o.triangle)no.push('simple triangle');if(!consistency.passed)no.push('Yoshinaga consistency');if(yes.length&&no.length)throw Error('YES と NO の証拠が競合しました。判定を保留します。');return {verdict:no.length?'NO':yes.length?'YES':'UNKNOWN',yes,no,rank:o.rank,simplicial:o.simplicial,faceDegrees:o.faceDegrees,triangle:o.triangle,modular:o.modular,falk:o.falk,consistency,lines:data.lines.map(l=>l.map(String)),convention:'complexified affine complement; equivalent asphericity for cone including H∞'};}

export function polynomial(coeffs,variable='t'){const degree=coeffs.length-1,terms=[];coeffs.forEach((c,i)=>{if(!c)return;const p=degree-i,abs=Math.abs(c),factor=p===0?String(abs):(abs===1?'':String(abs)+' ')+variable+(p>1?'^'+p:'');terms.push((terms.length?(c<0?' − ':' + '):c<0?'−':'')+factor);});return terms.join('')||'0';}
