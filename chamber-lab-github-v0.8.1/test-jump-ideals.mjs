import assert from 'node:assert/strict';
import {arrangement,PRESETS,QQ,q,ONE,Z,evaluate,autoFlag} from './docs/math.js';
import {computeJumpIdeal,singularJumpScript} from './docs/jump-ideals.js';
import {JUMP_IDEAL_CACHE} from './docs/jump-cache.js';
const model=id=>arrangement(PRESETS.find(p=>p.id===id).lines);
function polynomialValue(text,values){
  const terms=text.replaceAll(' ','').replaceAll('-','+-').split('+').filter(Boolean);
  let sum=Z;
  for(let term of terms){let value=ONE;if(term[0]==='-'){value=q(-1);term=term.slice(1);}
    for(const factor of term.split('*')){const variable=factor.match(/^[at](\d+)(?:\^(\d+))?$/);if(variable){const i=Number(variable[1])-1,k=Number(variable[2]??1);for(let j=0;j<k;j++)value=value.mul(values[i]);}else value=value.mul(q(factor));}
    sum=sum.add(value);
  }
  return sum;
}
const vanishes=(generators,values)=>generators.every(p=>polynomialValue(p,values).n===0n);
function testPoint(data,kind,values,k,options){
  values=values.map(q);const ideal=computeJumpIdeal(data,kind,k,options),h=evaluate(data,QQ,values,kind).h[1];
  const factor=ideal.ideal.factorization,onScheme=factor?vanishes(factor.augmentationGenerators,values)||vanishes(factor.quotientGenerators,values):vanishes(ideal.ideal.generators,values);
  assert(ideal.ideal.complete);assert.equal(onScheme,h>=k,kind+' at '+values+' / k='+k);
  if(ideal.decomposition.complete){const onComponent=ideal.decomposition.components.some(c=>vanishes(c.generators,values));assert.equal(onComponent,h>=k);}
  return ideal;
}
const a3=model('a3');
for(const kind of ['local','aomoto'])for(let k=1;k<=a3.n+1;k++){
  const c=computeJumpIdeal(a3,kind,k);assert.equal(c.computation.cache,true);assert.equal(c.ideal.complete,true);assert.equal(c.decomposition.complete,true);assert.equal(c.decomposition.over,'C');
  assert(c.decomposition.radicalEqualityVerified);assert(c.decomposition.irredundancyVerified);assert(c.decomposition.radicalPowerCertificates.every(p=>p.verified));
  assert(c.decomposition.components.every(p=>p.absolutePrime));assert.equal(c.decomposition.components.length,k===1?5:k<=a3.n?1:0);
  assert.equal(c.definition.minorSize,a3.n-k+1);assert.equal(c.definition.blockColumns,a3.n+1);assert.match(c.definition.fitting,new RegExp('Fitt_'+k));
  const points=kind==='local'?[[1,1,1,1,1],[2,3,5,7,11],[2,3,3,2,'1/6'],[2,3,1,1,1]]:[[0,0,0,0,0],[1,2,3,4,5],[1,2,2,1,-3],[1,-1,0,0,0]];
  for(const p of points)testPoint(a3,kind,p,k);
}
const moved=arrangement(a3.lines,autoFlag(a3.lines,[ONE,q('3/7')]));
assert.deepEqual(computeJumpIdeal(moved,'local',1).ideal.generators,computeJumpIdeal(a3,'local',1).ideal.generators);
for(const [id,count]of [['b3',19],['deletedb3',12]]){
  const d=model(id),r=computeJumpIdeal(d,'aomoto',1);
  assert.equal(r.computation.cache,true);assert.equal(r.decomposition.complete,true);assert.equal(r.decomposition.components.length,count);assert(r.decomposition.components.every(c=>c.absolutePrime));
  testPoint(d,'aomoto',Array(d.n).fill(0),1);testPoint(d,'aomoto',Array(d.n).fill(1),1);
}
for(const id of ['generic','pencil','triangle','grid']){
  const d=model(id);
  for(const kind of ['local','aomoto'])for(let k=1;k<=d.n+1;k++){
    const result=computeJumpIdeal(d,kind,k);assert.equal(result.decomposition.complete,true);
    const ordinary=Array.from({length:d.n},(_,i)=>i+2),special=id==='pencil'?(kind==='local'?[2,3,5,'1/30']:[1,2,3,-6]):id==='grid'?(kind==='local'?[2,3,5,1,1,1]:[1,2,3,0,0,0]):ordinary;
    for(const values of [Array(d.n).fill(kind==='local'?1:0),special])testPoint(d,kind,values,k);
    if(kind==='local'&&k===1){const factor=result.ideal.factorization;assert(factor);assert.equal(result.ideal.generators.length,0);assert.equal(result.ideal.generatorCount,d.n*(d.n+1)/2*factor.quotientGenerators.length);assert(result.ideal.generatorCount>0);}
  }
}
// Live exact expansion is compared to independently evaluated chamber ranks.
for(const id of ['a3','triangle','generic','pencil']){
  const d=model(id);
  for(const kind of ['aomoto','local']){
    for(const values of [Array(d.n).fill(kind==='aomoto'?0:1),Array.from({length:d.n},(_,i)=>i+2)]){
      testPoint(d,kind,values,1,{ignoreCache:true,maxMinors:3000,maxOperations:4000000,maxTimeMs:10000});
    }
  }
}
const b3=model('b3'),bounded=computeJumpIdeal(b3,'local',1,{ignoreCache:true,maxMinors:1,maxMinorOrder:10,maxTimeMs:20,maxOperations:500});
assert.equal(bounded.ideal.complete,false);assert.equal(bounded.decomposition.complete,false);assert.match(bounded.decomposition.reason,/一部/);
const parallel=arrangement([[1,0,0],[1,0,1],[1,0,2]]),full=computeJumpIdeal(parallel,'local',1,{ignoreCache:true});
assert.equal(full.ideal.complete,true);assert.equal(full.ideal.generators.length,0);assert.equal(full.decomposition.complete,true);assert.equal(full.decomposition.components[0].dimension,3);
const empty=computeJumpIdeal(arrangement([]),'aomoto',1);assert.deepEqual(empty.ideal.generators,['1']);assert.equal(empty.decomposition.components.length,0);
const script=singularJumpScript(a3,'local',1);
assert.match(script,/sat\([JC]/);assert.match(script,/minAssGTZ/);assert.match(script,/Fitt_1/);assert.match(script,/Aug\^2\*C/);assert.match(script,/complex identity/);assert.match(script,/nonexact maximal-minor quotient/);
assert(JUMP_IDEAL_CACHE.every(c=>!c.decomposition.complete||c.decomposition.components.every(p=>p.absolutePrime)));
console.log('Passed jump ideals: A3/generic/pencil/triangle/grid all depths with scheme/radical/C-prime certificates; B3 19 and deletedB3 12 resonance components; exact compact products and cached/live equations agree with chamber ranks; nonreduced scheme retained; bounded fallback reports incomplete; Laurent saturation and precise Fitting index.');
