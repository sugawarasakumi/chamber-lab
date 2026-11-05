import assert from 'node:assert/strict';
import {arrangement,PRESETS} from './docs/math.js';
import {topeGraph} from './docs/overview.js';
import {facePoset} from './docs/face-poset.js';
import {topeMagnitude,magnitudeFromFacePoset,graphMagnitudeSeries,MAGNITUDE_SOURCE} from './docs/magnitude.js';

const coefficient=(result,k,l)=>BigInt(result.homology.coefficients[k][l]);
function verifyDefinition(data,mode,maxL=12){
  const graph=topeGraph(data),selected=mode==='cone'?{nodes:graph.coneNodes,edges:graph.coneEdges}:graph;
  const result=topeMagnitude(data,{mode,maxK:maxL,maxL});
  assert.equal(result.graph.vertexCount,selected.nodes.length);
  assert.equal(result.graph.edgeCount,selected.edges.length);
  assert.deepEqual(result.magnitude.series,graphMagnitudeSeries(selected,maxL).series,'face flags agree with the defining distance-matrix inverse');
  for(let l=0;l<=maxL;l++){
    let euler=0n;for(let k=0;k<=maxL;k++)euler+=(k%2?-1n:1n)*coefficient(result,k,l);
    assert.equal(euler,BigInt(result.magnitude.series[l]),'integral Betti numbers categorify magnitude');
  }
  assert(result.homology.torsionFree);
  assert(result.homology.groups.every(g=>Array.isArray(g.torsion)&&!g.torsion.length));
  return result;
}

// Rank-zero and rank-one affine examples also test nonessential arrangements.
let data=arrangement([]),result=verifyDefinition(data,'affine');
assert.deepEqual(result.magnitude.numerator,['1']);
assert.deepEqual(result.magnitude.denominator,['1']);
assert.equal(result.homology.groups.length,1);
result=verifyDefinition(data,'cone');
assert.deepEqual(result.magnitude.numerator,['2']);
assert.deepEqual(result.magnitude.denominator,['1','1']);

data=arrangement([[1,0,0],[1,0,-1],[1,0,-2]]);
result=verifyDefinition(data,'affine');
for(let k=0;k<=12;k++)for(let l=0;l<=12;l++)assert.equal(coefficient(result,k,l),k===l?(k===0?4n:6n):0n);
assert.deepEqual(result.magnitude.numerator,['4','-2']);
assert.deepEqual(result.magnitude.denominator,['1','1']);
result=verifyDefinition(data,'cone');
// This cone is essential rank 2, although represented in R^3: its graph is C8.
assert.equal(result.arrangementRank,2);
for(let k=0;k<=12;k++)for(let l=0;l<=12;l++){
  let expected=0n;for(let b=0;2*b<=k;b++){const a=k-2*b;if(a+4*b===l)expected+=a?16n:8n;}
  assert.equal(coefficient(result,k,l),expected);
}

// Boolean arrangements / hypercubes: MH_{k,k}(Q_r) = Z^{2^r C(k+r-1,r-1)}.
for(let r=1;r<=3;r++){
  const faces=[];
  function enumerate(v=[]){if(v.length===r){faces.push({covector:v,normalRank:v.filter(x=>!x).length});return;}for(const s of [-1,0,1])enumerate([...v,s]);}
  enumerate();const poset={mode:'cone',faces};result=magnitudeFromFacePoset(poset,{maxK:10,maxL:12});
  const choose=(n,k)=>{let x=1n;for(let i=1;i<=k;i++)x=x*BigInt(n-i+1)/BigInt(i);return x;};
  for(let k=0;k<=10;k++)for(let l=0;l<=12;l++)assert.equal(coefficient(result,k,l),k===l?(2n**BigInt(r))*choose(k+r-1,r-1):0n);
}

// Even cycles recover Koizumi Section 7.2 / Gu's integral computation.
data=arrangement([[1,0,0],[0,1,0],[1,1,0]]);
result=verifyDefinition(data,'affine');
assert.deepEqual(result.magnitude.numerator,['6']);
assert.deepEqual(result.magnitude.denominator,['1','2','2','1']);
assert.equal(coefficient(result,2,3),6n);
assert.equal(coefficient(result,3,4),12n);
assert.equal(coefficient(result,4,6),6n);

// The full A3 cone is Cay(S4,adj). Match the published Table 1, including
// off-diagonal groups in lengths 3 and 6 (so a diagonal-only heuristic fails).
data=arrangement(PRESETS.find(p=>p.id==='a3').lines);
verifyDefinition(data,'affine');result=verifyDefinition(data,'cone');
const published=[
  [24],[0,72],[0,0,96,48],[0,0,0,120,96,0,24],
  [0,0,0,0,144,96,48,72],[0,0,0,0,0,168,96,96,96,48],
  [0,0,0,0,0,0,192,96,96,168,96]
];
published.forEach((row,k)=>row.forEach((n,l)=>assert.equal(coefficient(result,k,l),BigInt(n))));
assert.deepEqual(result.magnitude.numerator,['24']);
assert.deepEqual(result.magnitude.denominator,['1','3','5','6','5','3','1']);
assert.equal(result.hilbert.allDegrees,true);
assert.equal(result.source.url,MAGNITUDE_SOURCE.url);

// Several distinct lattice types and both graph conventions, beyond examples.
for(const id of ['b3','nonfano','pencil','grid','triangle']){
  const preset=PRESETS.find(p=>p.id===id);assert(preset,id);const d=arrangement(preset.lines);
  verifyDefinition(d,'affine',9);verifyDefinition(d,'cone',9);
}

// The full series is independent of the display box. Coefficients beyond the
// displayed box are not marked zero; only the exact rational Hilbert formula
// makes an all-degree claim. Limits are explicit and fail loudly.
const small=topeMagnitude(data,{mode:'cone',maxK:1,maxL:12});
assert.deepEqual(small.magnitude.series,result.magnitude.series);
assert.equal(small.homology.range.maxK,1);
assert.equal(small.homology.coefficients.length,2);
assert.match(small.homology.outsideRange,/No group outside/);
assert.throws(()=>topeMagnitude(data,{maxK:65}),/maxK/);
assert.throws(()=>topeMagnitude(data,{maxL:129}),/maxL/);
assert.throws(()=>topeMagnitude(data,{mode:'projective'}),/mode/);
assert.throws(()=>magnitudeFromFacePoset({faces:[{covector:[0],rank:0}]}),/rank/);
assert.throws(()=>graphMagnitudeSeries({nodes:[{},{}],edges:[]}),/connected/);
assert.throws(()=>graphMagnitudeSeries({nodes:[],edges:[]}),/vertex/);

// The implementation does not depend on geometric samples or on cover IDs:
// its required theorem data are the full covector order and normal ranks.
const fp=facePoset(data,{mode:'cone'}),minimal={mode:'cone',faces:fp.faces.map(f=>({covector:f.covector,normalRank:f.normalRank}))};
assert.deepEqual(magnitudeFromFacePoset(minimal,{maxK:12,maxL:12}).magnitude,result.magnitude);
console.log('Magnitude: exact distance-matrix series, all-degree face flags, integral MH, C6/C8 and published A3 table verified.');
