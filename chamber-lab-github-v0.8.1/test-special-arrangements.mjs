import assert from 'node:assert/strict';
import fs from 'node:fs';
import {q,arrangement} from './docs/math.js';
import {overview} from './docs/overview.js';

const entries=JSON.parse(fs.readFileSync(new URL('./data/special-arrangements.json',import.meta.url),'utf8'));
const dot=(a,b)=>a.reduce((s,x,i)=>s.add(x.mul(b[i])),q(0));
const cross=(a,b)=>[a[1].mul(b[2]).sub(a[2].mul(b[1])),a[2].mul(b[0]).sub(a[0].mul(b[2])),a[0].mul(b[1]).sub(a[1].mul(b[0]))];
const normalise=v=>{const t=v.find(x=>!x.eq(0));assert(t,'Projective vector must be nonzero');return v.map(x=>x.div(t));};
const key=v=>normalise(v).join(',');
const cycle=v=>[v,[v[1],v[2],v[0]],[v[2],v[0],v[1]]];
const pairs=n=>Array.from({length:n},(_,i)=>Array.from({length:n-i-1},(_,j)=>[i,i+j+1])).flat();
const distance2=(a,b)=>a.reduce((s,x,i)=>s.add(x.sub(b[i]).mul(x.sub(b[i]))),q(0));

// Published polynomial for the icosidodecahedral decone, and independent
// incidence/chamber checks for both exact Q(sqrt(5)) realisations.
for(const entry of entries){
  const L=entry.projectiveNormals.map(v=>v.map(q));
  assert.deepEqual(L[entry.deconeIndex].map(String),['0','0','1']);
  assert.equal(new Set(L.map(key)).size,L.length);
  const data=arrangement(L.filter((_,i)=>i!==entry.deconeIndex)),o=overview(data),e=entry.expected;
  assert.deepEqual(o.projectiveCounts,e.t,entry.id);
  assert.deepEqual(o.finiteCounts,e.finiteCounts,entry.id);
  assert.deepEqual(o.infinityCounts,e.infinityCounts,entry.id);
  assert.deepEqual(o.characteristic,e.characteristic,entry.id);
  assert.deepEqual(o.coneCharacteristic,e.coneCharacteristic,entry.id);
  assert.equal(o.chambers,e.chambers,entry.id);
  assert.equal(2*o.chambers,e.regions,entry.id);
  assert.equal(data.cells.filter(c=>!c.unbounded).length,e.boundedChambers,entry.id);
  assert.equal(o.simplicial,e.simplicial,entry.id);
  assert(data.verified,entry.id+' universal chamber-complex relation');
  const P=new Map();
  for(const [i,j] of pairs(L.length)){
    const p=normalise(cross(L[i],L[j]));
    P.set(key(p),L.map((l,k)=>dot(l,p).eq(0)?k:-1).filter(k=>k>=0));
  }
  assert.equal(P.size,e.projectivePoints,entry.id);
  assert.equal([...P.values()].reduce((s,p)=>s+p.length*(p.length-1)/2,0),L.length*(L.length-1)/2);
}

const ID=entries.find(e=>e.id==='icosidodecahedral'),DS=entries.find(e=>e.id==='double-star');
const sourceNormals=ID.verification.symmetricProjectiveNormals.map(v=>v.map(q));
const targetNormals=ID.projectiveNormals.map(v=>v.map(q));
const M=ID.verification.normalTransformMatrix.map(v=>v.map(q));
assert(!dot(M[0],cross(M[1],M[2])).eq(0),'Exact coordinate transformation is nonsingular');
sourceNormals.forEach((v,i)=>assert.equal(key(M.map(row=>dot(row,v))),key(targetNormals[ID.verification.transformedNormalIndices[i]])));
DS.parentArrangement.projectiveIndices.forEach((j,i)=>assert.equal(key(DS.projectiveNormals[i].map(q)),key(targetNormals[j])));

// Verify Yoshinaga's primary geometric definition, not merely its t-vector.
// Start with the standard icosahedron; its edge midpoints form the
// icosidodecahedron. All distances and plane incidences remain exact.
const phi=q('(1+sqrt(5))/2'),ico=[];
for(const s of [-1,1])for(const t of [-1,1])ico.push(...cycle([q(0),q(s),phi.mul(t)]));
const icoEdges=pairs(ico.length).filter(([i,j])=>dot(ico[i],ico[j]).eq(phi));
assert.equal(ico.length,12);assert.equal(icoEdges.length,30);
const vertices=icoEdges.map(([i,j])=>ico[i].map((x,a)=>x.add(ico[j][a]).div(2)));
const edges=pairs(vertices.length).filter(([i,j])=>distance2(vertices[i],vertices[j]).eq(1));
assert.equal(vertices.length,30);assert.equal(edges.length,60);
const diagMap=new Map();
for(let v=0;v<ico.length;v++){
  const pentagon=icoEdges.map((e,i)=>e.includes(v)?i:-1).filter(i=>i>=0);
  assert.equal(pentagon.length,5);
  for(const [a,b] of pairs(pentagon.length)){
    const i=pentagon[a],j=pentagon[b];
    if(distance2(vertices[i],vertices[j]).eq(phi.add(1)))diagMap.set(i+','+j,[i,j]);
  }
}
const diagonals=[...diagMap.values()];assert.equal(diagonals.length,60);
function planeCycles(indices,graph,expected){
  for(const i of indices){
    const n=sourceNormals[i],on=vertices.map((v,j)=>dot(n,v).eq(0)?j:-1).filter(j=>j>=0),set=new Set(on);
    const es=graph.filter(([a,b])=>set.has(a)&&set.has(b));
    assert.equal(on.length,expected);assert.equal(es.length,expected);
    for(const v of on)assert.equal(es.filter(e=>e.includes(v)).length,2);
    const seen=new Set([on[0]]),queue=[on[0]];
    for(const v of queue)for(const [a,b] of es){const u=a===v?b:b===v?a:null;if(u!==null&&!seen.has(u)){seen.add(u);queue.push(u);}}
    assert.equal(seen.size,expected,'Plane section is one cycle');
  }
}
planeCycles(ID.verification.symmetricNormalClasses.edge,edges,10);
planeCycles(ID.verification.symmetricNormalClasses.diagonal,diagonals,6);
console.log('Passed: exact special-arrangement incidences, published polynomial, chamber counts, common decone/subarrangement, invertible Q(sqrt5) coordinate map, six edge cycles and ten diagonal cycles.');
