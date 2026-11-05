import assert from 'node:assert/strict';
import {arrangement,PRESETS,q,Z,ONE,autoFlag} from './docs/math.js';
import {overview} from './docs/overview.js';
import {searchMultinets} from './docs/multinets.js';
import {multinetJumping,torusImageLattice,specializeResonance,specializeCharacterRational,specializeCharacterCyclotomic,
  sampleMultinetJumping,pointedDeletionFamily,specializePointedDeletionCyclotomic} from './docs/net-jumping.js';

const model=id=>arrangement(PRESETS.find(p=>p.id===id).lines);
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const c=a%b;a=b;b=c;}return a;};
const dot=(a,b)=>a.reduce((s,x,i)=>s+BigInt(x)*BigInt(b[i]),0n);
function determinant(M){
  if(!M.length)return 1n;
  const a=M.map(row=>row.map(BigInt));let sign=1n,den=1n;
  for(let k=0;k<a.length-1;k++){
    let p=k;while(p<a.length&&!a[p][k])p++;if(p===a.length)return 0n;
    if(p!==k){[a[p],a[k]]=[a[k],a[p]];sign=-sign;}
    const pivot=a[k][k];for(let i=k+1;i<a.length;i++)for(let j=k+1;j<a.length;j++)a[i][j]=(a[i][j]*pivot-a[i][k]*a[k][j])/den;
    for(let i=k+1;i<a.length;i++)a[i][k]=0n;den=pivot;
  }
  return sign*a[a.length-1][a.length-1];
}
function subsets(n,k){const out=[];function visit(v,start){if(v.length===k){out.push(v);return;}for(let i=start;i<=n-(k-v.length);i++)visit([...v,i],i+1);}visit([],0);return out;}
function verifySaturation(P,L){
  const k=P[0].length,m=P.length;
  assert.equal(L.relations.length,m-L.dimension);assert.equal(L.saturated,true);
  for(const c of L.relations)for(let j=0;j<k;j++)assert.equal(dot(c,P.map(row=>row[j])),0n);
  // The gcd of all full-rank minors of a lattice basis is its saturation index.
  // This is independent of the unimodular algorithm used by the module.
  const d=L.relations.length,divisor=subsets(m,d).map(cols=>determinant(L.relations.map(row=>cols.map(i=>row[i])))).reduce(gcd,0n);
  assert.equal(divisor,1n,'the returned integral relation lattice must be saturated');
}
function checkIsotropicByOS(data,family){
  // Independent Orlik–Solomon test: a∧b=0 iff a_i Σ_X b_j−b_i Σ_X a_j=0
  // for every rank-two flat X and i∈X. This does not use chamber matrices.
  const P=family.resonance.projectiveMatrix.map(row=>row.map(BigInt));
  for(const X of overview(data).points){
    const A=X.lines.reduce((s,i)=>s+P[i][0],0n),B=X.lines.reduce((s,i)=>s+P[i][1],0n);
    for(const i of X.lines)assert.equal(P[i][0]*B-P[i][1]*A,0n);
  }
}
function checkFamily(data,certificate){
  const f=multinetJumping(data,certificate);
  assert.equal(f.dimension,2);assert.equal(f.guaranteedDepth,1);assert.equal(f.completeDecomposition,false);assert.equal(f.maximalityClaimed,false);
  verifySaturation(f.characteristic.affineMatrix,{relations:f.characteristic.relations,dimension:2,saturated:f.characteristic.latticeSaturated});
  verifySaturation(f.characteristic.projectiveMatrix,{relations:f.characteristic.projectiveRelations,dimension:2,saturated:f.characteristic.latticeSaturated});
  for(let j=0;j<2;j++)assert.equal(f.resonance.projectiveMatrix.reduce((s,row)=>s+BigInt(row[j]),0n),0n);
  checkIsotropicByOS(data,f);
  const samples=sampleMultinetJumping(data,f);
  for(const p of [...samples.resonance,...samples.character]){assert.equal(p.membershipConfirmed,true);assert(p.depth>=1);assert.equal(p.cohomology.exact,true);}
  assert.equal(samples.resonance[0].depth,1);assert.equal(samples.character[0].depth,1);
  assert.equal(samples.resonance[1].depth,data.n);assert.equal(samples.character[2].depth,data.n);
  assert.equal(samples.resonance[0].load.field,'q');assert.equal(samples.character[1].load.homology,false);
  return f;
}

const a3=model('a3'),a3Certificate=searchMultinets(a3).net.certificate,a3Family=checkFamily(a3,a3Certificate);
assert.deepEqual(a3Family.blocks,[[0,3],[1,2],[4,5]]);
assert.deepEqual(a3Family.resonance.affineMatrix,[['1','0'],['0','1'],['0','1'],['1','0'],['-1','-1']]);
assert.deepEqual(a3Family.characteristic.parameterKernel.invariantFactors,['1','1']);
assert.equal(a3Family.pointedLines.length,0);
assert.equal(specializeResonance(a3,a3Family,1,2).infinity,'-3');
assert.equal(specializeCharacterRational(a3,a3Family,2,3).infinity,'1/6');
// exp(2πi a_i) agrees with the character parameterization at a rational point.
const third=specializeResonance(a3,a3Family,'1/3','1/3'),root=specializeCharacterCyclotomic(a3,a3Family,3,1,1);
third.projectiveWeights.forEach((x,i)=>{const w=q(x).mul(3);assert.equal(w.d,1n);assert.equal(String((w.n%3n+3n)%3n),root.projectiveExponents[i]);});
const moved=arrangement(a3.lines,autoFlag(a3.lines,[ONE,q('3/7')]));
assert.deepEqual(specializeCharacterCyclotomic(moved,a3Family,3,1,1).cohomology.h,root.cohomology.h);
assert.deepEqual(specializeResonance(moved,a3Family,1,2).cohomology.h,specializeResonance(a3,a3Family,1,2).cohomology.h);

const b3=model('b3'),b3Certificate=searchMultinets(b3).multinet.certificate,b3Family=checkFamily(b3,b3Certificate);
assert.equal(b3Family.weights.filter(w=>w==='2').length,3);
assert.deepEqual(b3Family.pointedLines.map(p=>p.index),[0,1,8]);
const subCertificate=searchMultinets(b3,{support:[0,1,2,4,6,8]}).net.certificate,subFamily=checkFamily(b3,subCertificate);
assert.equal(subFamily.fullSupport,false);
for(const i of [3,5,7]){
  assert.deepEqual(subFamily.resonance.projectiveMatrix[i],['0','0']);
  assert.equal(specializeResonance(b3,subFamily,1,2).projectiveWeights[i],'0');
  assert.equal(specializeCharacterRational(b3,subFamily,2,3).projectiveValues[i],'1');
  assert.equal(specializeCharacterCyclotomic(b3,subFamily,5,1,2).projectiveExponents[i],'0');
}
// Also test selected support not containing the chosen infinity line. The new
// generic line is outside the net and must receive a∞=0, t∞=1.
const finiteNet=arrangement([[1,0,0],[0,1,0],[1,-1,0],[0,1,-1],[1,0,-1],[1,1,-1]]);
const finiteCertificate=searchMultinets(finiteNet,{support:[0,1,2,3,4,5]}).net.certificate;
assert(finiteCertificate);
const finiteFamily=multinetJumping(finiteNet,finiteCertificate);
assert.equal(specializeResonance(finiteNet,finiteFamily,1,2).infinity,'0');
assert.equal(specializeCharacterRational(finiteNet,finiteFamily,2,3).infinity,'1');
assert(specializeCharacterCyclotomic(finiteNet,finiteFamily,3,1,1).depth>=1);
checkIsotropicByOS(finiteNet,finiteFamily);

// Common scaling retains the same connected image, with a finite kernel of
// order 7². The unscaled pointed data must not gain artificial pointed lines.
const scaled=structuredClone(b3Certificate);scaled.weights=scaled.weights.map(w=>String(BigInt(w)*7n));scaled.degree=String(BigInt(scaled.degree)*7n);
const scaledFamily=multinetJumping(b3,scaled);
assert.equal(scaledFamily.commonWeightScale,'7');assert.equal(scaledFamily.characteristic.parameterKernel.order,'49');
assert.deepEqual(scaledFamily.characteristic.parameterKernel.invariantFactors,['7','7']);
assert.deepEqual(scaledFamily.pointedLines,b3Family.pointedLines);
verifySaturation(scaledFamily.characteristic.affineMatrix,{relations:scaledFamily.characteristic.relations,dimension:2,saturated:true});
assert(specializeCharacterRational(b3,scaledFamily,2,3).depth>=1);

// Two explicit integer lattices distinguish a saturated relation from a set
// of power equations which might introduce extra finite components.
const coprime=[[2,0],[0,3],[-5,-5]],finiteKernel=[[2,0],[0,2],[-1,-1]];
for(const P of [coprime,finiteKernel])verifySaturation(P,torusImageLattice(P));
assert.deepEqual(torusImageLattice(coprime).relations,[['15','10','6']]);
assert.equal(torusImageLattice(coprime).parameterKernel.order,'1');
assert.deepEqual(torusImageLattice(finiteKernel).relations,[['1','1','2']]);
assert.deepEqual(torusImageLattice(finiteKernel).parameterKernel.invariantFactors,['1','2']);
assert.equal(torusImageLattice(finiteKernel).parameterKernel.order,'2');
for(let seed=1;seed<=20;seed++){
  const P=Array.from({length:5},(_,i)=>[((seed*(i+2)*7)%11)-5,((seed*(i+1)*3+5)%13)-6]);
  verifySaturation(P,torusImageLattice(P));
}

// The deleted B3 character family comes from a pointed multinet on B3, even
// though the deletion itself has no full-support nontrivial multinet.
for(const H of [0,1]){
  const d=pointedDeletionFamily(b3,b3Certificate,H);
  assert.equal(d.translated,true);assert.equal(d.translationCharacterOrder,'2');assert.equal(d.translationCosetOrder,'2');
  assert.equal(d.dimension,1);assert.equal(d.completeDecomposition,false);assert(!d.originalIndices.includes(H));
  for(const c of d.projectiveRelations)assert.equal(dot(c,d.directionExponents),0n);
  for(const [N,r] of [[2,0],[4,1],[6,1]]){
    const sample=specializePointedDeletionCyclotomic(b3,d,N,r);
    assert.equal(sample.membershipConfirmed,true);assert(sample.depth>=1);assert.equal(sample.affineExponents.length,b3.n-1);
    assert.equal(sample.load.lines.length,b3.n-1);
  }
}
assert.equal(searchMultinets(model('deletedb3')).multinet.verdict,'NO');
const deletedInfinity=pointedDeletionFamily(b3,b3Certificate,b3.n);
assert.equal(deletedInfinity.sameAffineChart,false);assert.equal(deletedInfinity.affineEquations,null);
assert.throws(()=>specializePointedDeletionCyclotomic(b3,deletedInfinity,6,1),/座標変換/);
assert.throws(()=>pointedDeletionFamily(a3,a3Certificate,0),/pointed 条件/);
assert.throws(()=>pointedDeletionFamily(b3,b3Certificate,0,0),/非自明/);
assert.throws(()=>specializePointedDeletionCyclotomic(b3,pointedDeletionFamily(b3,b3Certificate,0),3,1),/倍数/);
const wrong=structuredClone(a3Certificate);wrong.weights[0]='2';assert.throws(()=>multinetJumping(a3,wrong),/検証済み/);
assert.throws(()=>specializeCharacterRational(a3,a3Family,0,2),/0 にできません/);
assert.throws(()=>specializeCharacterCyclotomic(a3,a3Family,3,'1/2',1),/整数/);
assert.throws(()=>specializeResonance(arrangement(a3.lines.map((l,i)=>i===0?[1,0,2]:l)),a3Family,1,2),/現在の配置/);
console.log('Passed net jumping: A3/B3 and selected supports; independent OS isotropy; saturated integer character equations and finite kernels; exact Q/cyclotomic H¹ tests; exponential and flag compatibility; B3 pointed deletions and translated cosets; scope guards.');
