import assert from 'node:assert/strict';
import {Q,q,arrangement,PRESETS} from './docs/math.js';
import {overview} from './docs/overview.js';
import {Rational,quadraticExtension,fieldFromSpec,parseFieldExpression,polynomialRoots,rationalSqrt} from './docs/plinth-field.js';
import {projectiveArrangement,modelFromJSON,makePlinth,analyzePlinth,checkPolygon,serializeAnalysis,deconeProjective,matrixRank} from './docs/plinth-core.js';
import {PLINTH_PRESETS,plinthPreset} from './docs/plinth-presets.js';
import {transferModel,modelFromChamber,recognizedPlinthPreset} from './docs/plinth-ui.js';
import {sageExportPlinth,constructionStep,polygonSVG,plotBounds} from './docs/plinth-view.js';
const QF=Rational,key=(lines,F)=>lines.map(l=>l.map(F.str).join(';')).sort().join('|');
for(const d of [2,5,-1,-3]){
 const F=quadraticExtension(QF,Q.of(d),'a');
 for(const text of ['1/3+a/2','(2-a)/(a+3)','-a^2','0','-2/7']){const x=parseFieldExpression(text,F),round=parseFieldExpression(F.str(x),F);assert(F.eq(x,round));if(!F.is0(x))assert(F.eq(F.div(x,x),F.one));const squared=F.mul(x,x),root=F.sqrt(squared);assert(root&&F.eq(F.mul(root,root),squared));}
 assert.equal(F.sqrt(F.from(7)),null);
}
assert.equal(String(rationalSqrt(Q.of('4/9'))),'2/3');assert.equal(rationalSqrt(Q.of(2)),null);assert.equal(rationalSqrt(Q.of(-1)),null);
assert.equal(polynomialRoots([Q.of(0),Q.of(0),Q.of(0)],QF).kind,'identity');
assert.equal(polynomialRoots([Q.of(1),Q.of(0),Q.of(0)],QF).roots[0].label,'∞');
assert.equal(polynomialRoots([Q.of(1),Q.of(-2),Q.of(1)],QF).kind,'double');
assert.throws(()=>parseFieldExpression('alert(1)',QF));
assert.throws(()=>parseFieldExpression('sqrt(5)',quadraticExtension(QF,Q.of(-3),'a')));
const expectedCounts={rational13:{2:23,3:13,4:1,5:1},fs13:{2:24,3:14,4:2},ml11:{2:13,3:8,4:3},rybnikov:{2:33,3:15},maclane:{2:4,3:8},fs:{2:6,3:8,4:1},ny:{2:6,3:10},quadrilateral:{2:13,3:10,4:2}};
const results={};
for(const preset of PLINTH_PRESETS){
 const model=plinthPreset(preset.id),base=modelFromJSON(model),result=analyzePlinth(base,model.support,model.pivots),F=result.solutions.field;results[preset.id]=result;
 assert.equal(result.branches.length,2,preset.id);assert(result.sameLattice);assert(result.witness?.valid&&!result.witness.closed);
 assert.equal(result.rigidity.certified,preset.id!=='rybnikov');assert.equal(result.orderedSeparated,preset.id!=='rybnikov');
 for(const branch of result.branches){
  assert(branch.valid&&branch.closed,preset.id);assert.deepEqual(branch.counts,expectedCounts[preset.id]);
  const pairCount=branch.points.reduce((s,p)=>s+p.lines.length*(p.lines.length-1)/2,0);assert.equal(pairCount,branch.lines.length*(branch.lines.length-1)/2);
  for(const p of branch.corners)for(const x of p)assert(F.eq(x,parseFieldExpression(F.str(x),F)));
 }
 const serialized=serializeAnalysis(result);assert.doesNotThrow(()=>JSON.stringify(serialized));assert.doesNotThrow(()=>fieldFromSpec(serialized.resultField));
 assert(recognizedPlinthPreset(model));const edited=structuredClone(model);edited.support.reverse();assert.equal(recognizedPlinthPreset(edited),null,'published verdict requires exact preset fingerprint');
 if(base.field.degree===2){const conjugate=plinthPreset(preset.id,{conjugate:true}),b=modelFromJSON(conjugate),r=analyzePlinth(b,conjugate.support,conjugate.pivots);assert(r.sameLattice&&r.branches.every(x=>x.valid));assert.deepEqual(r.branches[0].counts,expectedCounts[preset.id]);assert(recognizedPlinthPreset(conjugate));}
 // The infinitesimal projective orbit independently annihilates the incidence
 // Jacobian. A projective frame makes its rank eight.
 if(result.rigidity.certified){
  const K=base.field,orbit=[];for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==2||b!==2){const vector=[];for(const l of base.lines){const lead=l.findIndex(x=>!K.is0(x));for(let c=0;c<3;c++)if(c!==lead){const raw=c===b?l[a]:K.zero,scale=lead===b?l[a]:K.zero;vector.push(K.sub(raw,K.mul(l[c],scale)));}}orbit.push(vector);}
  assert.equal(matrixRank(orbit,K,2*base.lines.length),8);
  for(const row of result.rigidity.matrix.map(row=>row.map(x=>parseFieldExpression(x,K))))for(const v of orbit)assert(K.is0(row.reduce((s,x,i)=>K.add(s,K.mul(x,v[i])),K.zero)));
 }
 assert(sageExportPlinth(result).includes('assert actual0 == expected0'));
}
// Explicit published equations, independent of the transport implementation.
const rationalExpected=[[[3,2,-3],[0,5,-3],[6,-2,-3]],[[1,-3,-1],[0,2,1],[4,6,-13]]];
assert.deepEqual(results.rational13.branches.map(b=>key(b.edges,QF)).sort(),rationalExpected.map(ls=>key(projectiveArrangement(ls,QF).lines,QF)).sort());
const fsExpected=[[['p+2','-p-1','p'],['p-1','-p','2*p-1'],['-2*p+1','-3*p+2','p-1']],[['p+2','-p-3','p+2'],['-p-1','p-2','1'],['-1','-p+2','-p-1']]],FS=results.fs13.solutions.field;
assert.deepEqual(results.fs13.branches.map(b=>key(b.edges,FS)).sort(),fsExpected.map(ls=>key(projectiveArrangement(ls,FS).lines,FS)).sort());
assert.equal(results.ml11.solutions.field.degree,4);
assert.deepEqual(results.maclane.plinth.coefficients.map(QF.str),['1','1','1']);assert.deepEqual(results.fs.plinth.coefficients.map(QF.str),['-1','1','1']);
// The construction display must reveal the right source/pivot/target, keep
// the two endpoint roles on exact closure, and never fill a nonclosed chain.
for(const preset of PLINTH_PRESETS){
 const model=plinthPreset(preset.id),r=results[preset.id],base=r.plinth.base,F=r.solutions.field;
 assert.equal(model.stage,0,'presets start at Q1');
 for(const polygon of r.branches)for(let stage=0;stage<=r.plinth.r;stage++){
  const m={...model,stage},t=constructionStep(r.plinth,polygon,m),svg=polygonSVG(base,r.plinth,polygon,F,m);
  assert.equal(t.i,Math.max(0,stage-1));assert.equal(t.closure,stage===r.plinth.r?'closed':'pending');
  assert.equal((svg.match(/class="pl-polygon-fill"/g)||[]).length,stage===r.plinth.r?1:0);
  assert(svg.includes(stage===r.plinth.r?'Q1 = R₁':'作図 '+stage+' / '+r.plinth.r));assert(!svg.includes('NaN'));
 }
 const witness=r.witness,G=base.field,m={...model,stage:r.plinth.r},svg=polygonSVG(base,r.plinth,witness,G,m);
 assert.equal(constructionStep(r.plinth,witness,m).closure,'open');assert(svg.includes('Q1 ≠ R₁'));assert(svg.includes('pl-closure-gap'));assert(!svg.includes('class="pl-polygon-fill"'));
 // Every possible affine chart, including one of the newly added edges.
 for(let chartLine=0;chartLine<r.branches[0].lines.length;chartLine++){
  const svg=polygonSVG(base,r.plinth,r.branches[0],F,{...m,chartLine});assert(!/NaN|undefined/.test(svg),preset.id+' chart '+chartLine);
 }
}
{
 const r=results.rational13,m=plinthPreset('rational13'),p=r.branches[0],F=r.solutions.field,svg=polygonSVG(r.plinth.base,r.plinth,p,F,{...m,stage:2});
 assert.equal((svg.match(/data-pl-pivot-infinity=/g)||[]).length,2,'infinite P2 is a direction, not a finite point');
 assert(!svg.includes('data-pl-pivot-marker="1"'));
 const focus=plotBounds(r.plinth.base,p,F,m.chartLine),allPivots=plotBounds(r.plinth.base,p,F,m.chartLine,false,true);
 assert(allPivots.maxY-allPivots.minY>10*(focus.maxY-focus.minY),'polygon fit keeps the small triangle readable');
 const partial=polygonSVG(r.plinth.base,r.plinth,p,F,{...m,stage:1});assert(!partial.includes('data-pl-drawn-line="E2"'));
}
// Reparametrize a rational example so a valid root is at infinity. Binary
// closure must preserve it rather than lose a solution in an affine chart.
{
 const p=results.rational13.plinth,r=Q.of('3/2'),transform=pair=>[pair[1],pair[0].map((x,i)=>x.add(pair[1][i].mul(r)))],changed={...p,basis:transform(p.basis),corners:p.corners.map(transform),edges:p.edges.map(transform),coefficients:[Q.of(1),Q.of('11/10'),Q.of(0)]},roots=polynomialRoots(changed.coefficients,QF);
 assert.equal(roots.roots.length,2);assert(roots.roots.some(x=>QF.is0(x.s)));for(const root of roots.roots)assert(checkPolygon(changed,root,QF).valid);
 const permuted=projectiveArrangement(p.base.lines.map(l=>[l[1],l[2],l[0]]),QF),again=analyzePlinth(permuted,p.support,p.pivots.map(x=>x.lines.slice(0,2)));assert(again.sameLattice);assert.equal(again.branches[0].signature,results.rational13.branches[0].signature);
}
const mac=results.maclane.plinth;assert(!checkPolygon(mac,{s:QF.one,t:QF.zero},QF).valid);assert(checkPolygon(mac,{s:QF.one,t:QF.one},QF).valid);
assert.throws(()=>makePlinth(mac.base,[0,0,1],[[2,3],[2,4],[1,4]]));assert.throws(()=>makePlinth(mac.base,[0,1,3],[[0,1],[2,4],[1,4]]));
// Deconing and real-field transfer are checked against the independent
// existing chamber engine, including d1*d0 and the projective t-vector.
for(const id of ['rational13','fs13','fs','quadrilateral']){
 const r=results[id],F=r.solutions.field,b=r.branches[0];for(const index of [0,b.lines.length-1]){
  const payload=transferModel(b,F,index,id),d=arrangement(payload.lines);assert(d.verified);assert.deepEqual(overview(d).projectiveCounts,b.counts);
  const restored=modelFromJSON(modelFromChamber(d));assert.equal(restored.lines.length,b.lines.length);
 }
}
assert.throws(()=>transferModel(results.maclane.branches[0],results.maclane.solutions.field,0,'complex'));
for(const id of ['a3','icosidodecahedral','cel-14-112-2']){
 const p=PRESETS.find(p=>p.id===id);if(!p)continue;const d=arrangement(p.lines);if(d.lines.flat().some(x=>x.field?.degree===3))assert.throws(()=>modelFromChamber(d));else{const m=modelFromChamber(d),b=modelFromJSON(m);assert.equal(b.lines.length,d.n+1);}
}
console.log('plinth: eight published constructions, explicit rational/FS equations, exact quadratic towers, rigidity Jacobians/orbits, genericity, projective/infinite roots, conjugate bases, safe published verdicts and chamber transfers passed');
