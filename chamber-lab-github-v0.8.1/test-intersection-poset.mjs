import assert from 'node:assert/strict';
import {arrangement,PRESETS,q,QQ,rref} from './docs/math.js';
import {overview} from './docs/overview.js';
import {intersectionPoset,intersectionPosets} from './docs/intersection-poset.js';
const subset=(a,b)=>(a&b)===a;
const fixture=id=>arrangement(PRESETS.find(p=>p.id===id).lines);
const a3=intersectionPosets(fixture('a3'));
assert.deepEqual(a3.affine.whitneySecond,[1,5,4]);assert.deepEqual(a3.affine.whitneyFirst,[1,-5,6]);assert(!a3.affine.properties.lattice);assert.equal(a3.affine.properties.supersolvable,null);
assert.deepEqual(a3.cone.whitneySecond,[1,6,7,1]);assert.deepEqual(a3.cone.whitneyFirst,[1,-6,11,-6]);assert.equal(a3.cone.maximalChainCount,18);assert(a3.cone.properties.supersolvable&&!a3.cone.properties.modular);
assert(!intersectionPoset(fixture('triangle'),'cone').properties.supersolvable);
for(const [lines,affineRank,coneRank] of [[[],0,1],[[[1,0,0]],1,2],[[[1,0,0],[1,0,-1],[1,0,-2]],1,2],[[[1,0,0],[0,1,0]],2,3]]){
 const d=arrangement(lines),p=intersectionPosets(d);assert.equal(p.affine.rank,affineRank);assert.equal(p.cone.rank,coneRank);assert.equal(p.cone.nodes.some(x=>x.id==='T'),coneRank===3);
 if(lines.length===2)assert(p.affine.properties.boolean&&p.cone.properties.boolean);
}
// Independent closure enumeration: every subset of the defining equations,
// ranks/consistency by exact row reduction, and closure by adjoining each row.
for(const d of [arrangement([]),arrangement([[1,0,0],[1,0,-1]]),arrangement([[1,0,0],[0,1,0]]),fixture('a3'),fixture('triangle'),fixture('pencil')])for(const mode of ['affine','cone']){
 const cone=mode==='cone',rows=cone?[...d.lines,[q(0),q(0),q(1)]]:d.lines,rank=rs=>rref(rs,QQ,3).rank,found=new Map();
 for(let set=0;set<2**rows.length;set++){
  const selected=rows.filter((_,i)=>set&2**i),r=cone?rank(selected):rref(selected.map(l=>l.slice(0,2)),QQ,2).rank;
  if(!cone&&rank(selected)>r)continue;
  let closure=0;for(let i=0;i<rows.length;i++)if(rank([...selected,rows[i]])===rank(selected))closure+=2**i;
  found.set(closure,r);
 }
 const p=intersectionPoset(d,mode);assert.deepEqual(new Map(p.nodes.map(x=>[x.mask,x.rank])),found);
}
let count=0;
for(const preset of PRESETS){
 const d=arrangement(preset.lines),o=overview(d),all=intersectionPosets(d);
 assert.deepEqual(all.affine.characteristic,o.characteristic.map(x=>x||0),preset.id);assert.deepEqual(all.cone.characteristic,o.coneCharacteristic.map(x=>x||0),preset.id);
 assert.equal(all.cone.properties.supersolvable,o.rank<=2||!!o.modular,preset.id);
 const decone=all.cone.nodes.filter(x=>!(x.mask&2**d.n)).map(x=>[x.mask,x.rank]);assert.deepEqual(decone,all.affine.nodes.map(x=>[x.mask,x.rank]));
 for(const p of Object.values(all)){
  assert.equal(new Set(p.nodes.map(x=>x.mask)).size,p.nodes.length);assert(p.properties.ranked&&p.properties.pure);
  for(const x of p.nodes){assert.equal(x.dimension,p.ambientDimension-x.rank);const sum=p.nodes.filter(y=>subset(y.mask,x.mask)).reduce((s,y)=>s+y.mu,0);assert.equal(sum,x.rank?0:1);assert.equal(x.upperCovers.length,p.covers.filter(e=>e.from===x.id).length);}
  for(const e of p.covers){const x=p.nodes.find(x=>x.id===e.from),y=p.nodes.find(x=>x.id===e.to);assert.equal(y.rank,x.rank+1);assert(subset(x.mask,y.mask));}
  for(const witness of Object.values(p.modularWitnesses))assert.notEqual(witness.ranks[0]+witness.ranks[1],witness.ranks[2]+witness.ranks[3]);
  if(p.modularChain){assert.equal(p.modularChain.length,p.rank+1);p.modularChain.forEach((id,r)=>{const x=p.nodes.find(x=>x.id===id);assert.equal(x.rank,r);assert(x.modular);});}
 }
 if(o.rank===3)assert.equal(all.cone.maximalChainCount,o.projectiveEdges);
 count++;
}
console.log(`intersection posets: independent exhaustive equation-closure fixtures, ${count} exact presets, affine/cone inclusion, Möbius characteristic polynomials, covers, rank degeneracies, modular witnesses and chains passed`);
