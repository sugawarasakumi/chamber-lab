import assert from 'node:assert/strict';
import {arrangement,PRESETS,q,QQ,Z,ONE,evaluate,autoFlag} from './docs/math.js';
import {computeLiveResonance} from './docs/resonance-live.js';
import {computeJumpIdeal} from './docs/jump-ideals.js';
import {JUMP_IDEAL_CACHE} from './docs/jump-cache.js';
import {overview} from './docs/overview.js';
import {idealResultHTML} from './docs/research-panel.js';
import {explicitDecompositionHTML,decompositionText,decompositionTeX} from './docs/jump-formulas.js';

const model=id=>arrangement(PRESETS.find(p=>p.id===id).lines);
// Parse the actual displayed polynomial equations, independently of the live
// engine's parameter and equation matrices.
function linearRow(polynomial,n){
  const row=Array.from({length:n},()=>Z);
  for(const term of polynomial.replaceAll(' ','').replaceAll('-','+-').split('+').filter(Boolean)){
    if(term==='0')continue;
    const match=term.match(/^([+-]?(?:\d+(?:\/\d+)?)?)\*?a(\d+)$/);
    assert(match,'Expected a homogeneous rational linear equation: '+polynomial);
    const index=Number(match[2])-1;
    assert(index>=0&&index<n,'Equation variable outside the affine coordinate range');
    const coefficient=match[1]===''||match[1]==='+'?ONE:match[1]==='-'?q(-1):q(match[1]);
    row[index]=row[index].add(coefficient);
  }
  return row;
}
function reducedRows(matrix,n){
  const rows=matrix.map(row=>row.map(q));let rank=0;
  for(let column=0;column<n;column++){
    const pivot=rows.findIndex((row,index)=>index>=rank&&row[column].n!==0n);
    if(pivot<0)continue;
    [rows[rank],rows[pivot]]=[rows[pivot],rows[rank]];
    const divisor=rows[rank][column];rows[rank]=rows[rank].map(x=>x.div(divisor));
    for(let i=0;i<rows.length;i++)if(i!==rank){const factor=rows[i][column];rows[i]=rows[i].map((x,j)=>x.sub(factor.mul(rows[rank][j])));}
    rank++;
  }
  return rows.slice(0,rank);
}
const componentRows=(component,n)=>reducedRows(component.generators.map(g=>linearRow(g,n)),n);
const rowKey=rows=>JSON.stringify(rows.map(row=>row.map(String)));
const componentKeys=(components,n)=>components.map(c=>rowKey(componentRows(c,n))).sort();
const dot=(a,b)=>a.reduce((sum,x,i)=>sum.add(x.mul(b[i])),Z);
function kernel(rows,n){
  const reduced=reducedRows(rows,n),pivots=reduced.map(row=>row.findIndex(x=>x.n!==0n));
  return Array.from({length:n},(_,i)=>i).filter(i=>!pivots.includes(i)).map(column=>{
    const v=Array.from({length:n},()=>Z);v[column]=ONE;
    reduced.forEach((row,i)=>v[pivots[i]]=row[column].neg());return v;
  });
}
function verifyComponent(data,component){
  assert.equal(component.absolutePrime,true);
  const rows=componentRows(component,data.n),basis=kernel(rows,data.n);
  assert.equal(component.dimension,basis.length,'Declared dimension must equal the displayed equation codimension');
  assert.equal(component.isotropyVerified,true);
  // Projectivize a∞=-Σa_i and test Orlik–Solomon wedge relations on every
  // pair of basis vectors. This checks the entire space, not just samples.
  const projective=basis.map(v=>[...v,v.reduce((sum,x)=>sum.add(x),Z).neg()]);
  for(const X of overview(data).points)for(let i=0;i<projective.length;i++)for(let j=i+1;j<projective.length;j++){
    const a=projective[i],b=projective[j],A=X.lines.reduce((sum,k)=>sum.add(a[k]),Z),B=X.lines.reduce((sum,k)=>sum.add(b[k]),Z);
    for(const k of X.lines)assert(a[k].mul(B).sub(b[k].mul(A)).n===0n,'The displayed space must be isotropic in the independent OS model');
  }
  for(const weights of [basis.map((_,i)=>q(i+1)),basis.map((_,i)=>q((i%2?-1:1)*(i+2)))]){
    const point=Array.from({length:data.n},(_,i)=>basis.reduce((sum,v,j)=>sum.add(v[i].mul(weights[j])),Z));
    assert(rows.every(row=>dot(row,point).n===0n));
    assert(evaluate(data,QQ,point,'aomoto').h[1]>=1,'Displayed space must lie in resonance for the chamber complex');
  }
  return rows;
}
function verifyResult(data,result){
  assert.equal(typeof result.complete,'boolean');
  assert.equal(typeof result.statistics,'object');
  result.components.forEach(c=>verifyComponent(data,c));
  const keys=componentKeys(result.components,data.n);
  assert.equal(new Set(keys).size,keys.length,'Duplicate spaces must be removed');
  return keys;
}

const cachedIDs=['a3','b3','deletedb3','generic','pencil','triangle','grid'];
for(const id of cachedIDs){
  const data=model(id),expected=JUMP_IDEAL_CACHE.find(c=>c.sourceId===id&&c.kind==='aomoto'&&c.k===1),result=computeLiveResonance(data);
  assert(expected,'Independent Singular reference for '+id);
  assert.equal(result.complete,true,id+' support search must finish');
  assert.deepEqual(verifyResult(data,result),componentKeys(expected.decomposition.components,data.n),id+' must match the full Singular decomposition');
}
assert.equal(computeLiveResonance(model('a3')).components.length,5);
assert.equal(computeLiveResonance(model('b3')).components.length,19);
assert.equal(computeLiveResonance(model('deletedb3')).components.length,12);

// Affine coordinate changes, arbitrary line rescalings, and relabelings must
// not rely on the exact coordinate strings used as precomputed cache keys.
for(const id of ['a3','b3']){
  const data=model(id),old=computeLiveResonance(data),order=Array.from({length:data.n},(_,i)=>data.n-1-i);
  const lines=order.map((index,i)=>{
    const [a,b,c]=data.lines[index];
    return [a.mul(2).add(b),a.mul(3).add(b.mul(2)),a.sub(b.mul(4)).add(c)].map(x=>String(x.mul(i+2)));
  });
  const changed=arrangement(lines),result=computeLiveResonance(changed);
  assert.equal(result.complete,true);
  const expected=old.components.map(c=>rowKey(reducedRows(componentRows(c,data.n).map(row=>order.map(i=>row[i])),data.n))).sort();
  assert.deepEqual(verifyResult(changed,result),expected,id+' coordinate and label invariance');
  const otherFlag=arrangement(changed.lines,autoFlag(changed.lines,[ONE,q('3/7')]));
  assert.deepEqual(componentKeys(computeLiveResonance(otherFlag).components,data.n),expected,'The decomposition must be independent of the chamber flag');
}

// Noncached elementary inputs have directly known decompositions.
const parallel=arrangement([[1,0,0],[1,0,-2],[1,0,-5],[1,0,-9]]);
let result=computeLiveResonance(parallel);assert.equal(result.complete,true);
assert.equal(result.components.length,1);assert.equal(result.components[0].dimension,4);assert.deepEqual(result.components[0].generators,[]);verifyResult(parallel,result);
const pencil=arrangement([[1,0,0],[0,1,0],[1,2,0],[1,-3,0],[2,5,0]]);
result=computeLiveResonance(pencil);assert.equal(result.complete,true);assert.equal(result.components.length,1);
assert.deepEqual(componentKeys(result.components,pencil.n),[rowKey([Array.from({length:5},()=>ONE)])]);verifyResult(pencil,result);
const generic=arrangement([[1,0,0],[0,1,0],[1,1,-1]]);
result=computeLiveResonance(generic);assert.equal(result.complete,true);assert.equal(result.components.length,1);assert.equal(result.components[0].dimension,0);verifyResult(generic,result);
const empty=arrangement([]);
result=computeLiveResonance(empty);assert.equal(result.complete,true);assert.deepEqual(result.components,[]);
const single=arrangement([[1,0,-2]]);
result=computeLiveResonance(single);assert.equal(result.complete,true);assert.equal(result.components.length,1);assert.equal(result.components[0].dimension,0);verifyResult(single,result);

// This six-line net is finite in the chosen chart. H∞ lies outside its support,
// so the essential plane must satisfy Σa_i=0 after deconing.
const finiteNet=arrangement([[1,0,0],[0,1,0],[1,-1,0],[0,1,-1],[1,0,-1],[1,1,-1]]);
result=computeLiveResonance(finiteNet);assert.equal(result.complete,true);verifyResult(finiteNet,result);
const essential=result.components.find(c=>c.evidence?.kind==='multinet'&&!c.evidence.certificate.supportedIndices.includes(finiteNet.n));
assert(essential,'Search must include net supports omitting the chosen infinity line');
assert(kernel(componentRows(essential,finiteNet.n),finiteNet.n).every(v=>v.reduce((sum,x)=>sum.add(x),Z).n===0n));

// Resource exhaustion must preserve the distinction between known spaces and
// a proved exhaustive decomposition, while keeping those spaces valid.
for(const limits of [{maxTimeMs:0},{maxSupports:1},{maxStates:1},{maxLines:4}]){
  const data=model('a3'),limited=computeLiveResonance(data,limits);
  assert.equal(limited.complete,false,'A forced resource limit cannot certify completeness: '+JSON.stringify(limits));
  assert(limited.reason,'An incomplete search must explain the remaining limit');verifyResult(data,limited);
}

const integration=computeJumpIdeal(model('a3'),'aomoto',1,{liveResonance:true});
assert.equal(integration.computation.cache,false,'The live action must bypass precomputed Singular results');
assert.equal(integration.decomposition.complete,true);
assert.deepEqual(componentKeys(integration.decomposition.components,5),componentKeys(computeLiveResonance(model('a3')).components,5));

// The set decomposition and the nonreduced jump ideal are different outputs.
const html=idealResultHTML(integration);
assert.match(html,/このブラウザで計算/);assert.match(html,/全成分を確認/);
assert.match(html,/スキーム生成元は未計算/);assert(!html.includes('生成元なし：零イデアル'));
const partial=computeJumpIdeal(model('a3'),'aomoto',1,{liveResonance:true,maxSupports:0});
assert.equal(partial.decomposition.complete,false);
assert.match(explicitDecompositionHTML(partial),/⊇/);
assert.match(decompositionText(partial),/contains/);
assert.match(decompositionTeX(partial),/supseteq/);
assert(!explicitDecompositionHTML(partial).includes('√J'));
const unknown={...partial,decomposition:{...partial.decomposition,components:[]}};
assert(!explicitDecompositionHTML(unknown).includes('= ∅'));
assert(!decompositionTeX(unknown).includes('varnothing'));
assert.match(decompositionText(unknown),/does not assert an empty locus/);

console.log('live resonance: full Singular comparisons for seven arrangements, transformed/relabelled inputs, all-space/pencil/origin cases, finite net support, exact OS isotropy and chamber membership, resource limits, and live-cache bypass passed');
