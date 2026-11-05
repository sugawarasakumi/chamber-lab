import assert from 'node:assert/strict';
import {arrangement,autoFlag,q,PRESETS,evaluate,primeField} from './docs/math.js';
import {fundamentalGroup,groupExport,reduceWord,inverseWord,classTwoQuotient} from './docs/fundamental-group.js';

const preset=id=>arrangement(PRESETS.find(p=>p.id===id).lines);
const comm=(a,b)=>[a,b,-a,-b];
const power=(word,n)=>Array.from({length:n},()=>word).flat();
const substitute=(word,images)=>reduceWord(word.flatMap(x=>x>0?images[x-1]:inverseWord(images[-x-1])));
const exponentSum=(word,n)=>{const v=Array(n).fill(0);for(const x of word)v[Math.abs(x)-1]+=Math.sign(x);return v;};

// These non-arrangement examples exercise integer torsion, rather than
// checking only the unit pivots normally encountered for arrangements.
assert.deepEqual(classTwoQuotient([power(comm(1,2),2)],2).torsion,['2']);
const cyclic6=classTwoQuotient([power(comm(1,2),2),power(comm(1,3),3)],3);
assert.equal(cyclic6.rank,1);assert.deepEqual(cyclic6.torsion,['6']);
const smith=classTwoQuotient([
  power(comm(1,2),2).concat(power(comm(1,3),4)),
  power(comm(1,2),6).concat(power(comm(1,3),8))
],3);
assert.equal(smith.rank,1);assert.deepEqual(smith.torsion,['2','4']);
assert.throws(()=>classTwoQuotient([[1]],2),/commutator relators/);

const empty=fundamentalGroup(preset('empty'));
assert.equal(empty.invariants.finite.value,true);assert.equal(empty.invariants.center.rank,0);
const parallel=fundamentalGroup(arrangement([[1,0,0],[1,0,1],[1,0,2]]));
assert.equal(parallel.relators.length,0);assert.equal(parallel.invariants.certifiedStructure.label,'F_3');
assert.equal(parallel.invariants.center.rank,0);assert.equal(parallel.invariants.lowerCentral.phi2,3);
const pencil=fundamentalGroup(preset('pencil'));
assert.equal(pencil.invariants.certifiedStructure.label,'Z × F_3');assert.equal(pencil.invariants.center.rank,1);
const generic=fundamentalGroup(preset('generic'));
assert.equal(generic.invariants.abelian.value,true);assert.equal(generic.invariants.center.rank,4);
assert.equal(generic.invariants.lowerCentral.phi2,0);
const grid=fundamentalGroup(preset('grid'));
assert.deepEqual(grid.invariants.certifiedStructure.freeRanks,[3,3]);assert.equal(grid.invariants.center.rank,0);
assert.equal(grid.invariants.lowerCentral.phi2,6);
const nodal=fundamentalGroup(arrangement([[1,0,-1],[1,0,1],[0,1,-1],[0,1,2],[1,1,-7]]));
assert.deepEqual(nodal.invariants.certifiedStructure.freeRanks,[2,2,1]);assert.equal(nodal.invariants.center.rank,1);

// Every catalogue entry has a theorem-backed chamber presentation, exactly
// one relator per ch2 chamber, and independent Fox/chamber Laurent agreement.
let arrangements=0,relations=0;
for(const p of PRESETS){
  const data=arrangement(p.lines),group=fundamentalGroup(data),n=data.n;
  assert.equal(group.relators.length,data.b2,p.id);assert(group.fox.verified,p.id);
  assert.equal(group.invariants.abelianization.rank,n,p.id);
  assert.deepEqual(group.invariants.abelianization.torsion,[],p.id);
  assert.deepEqual(group.invariants.lowerCentral.secondQuotient.torsion,[],p.id);
  assert.equal(group.invariants.lowerCentral.secondQuotient.relationRank,data.b2,p.id);
  const meridianToChamber=group.generators.meridian.map(g=>g.wordInChambers);
  const chamberToMeridian=group.generators.chamber.map(g=>g.wordInMeridians);
  group.generators.chamber.forEach((g,i)=>assert.deepEqual(substitute(g.wordInMeridians,meridianToChamber),[i+1]));
  group.generators.meridian.forEach((m,i)=>assert.deepEqual(substitute(m.wordInChambers,chamberToMeridian),[i+1]));
  for(const rel of group.relators){
    assert.deepEqual(exponentSum(rel.word,n),Array(n).fill(0));
    assert.deepEqual(exponentSum(rel.positive.word,n),Array(n).fill(0));
    assert.deepEqual(rel.positive.left.slice().sort((a,b)=>a-b),Array.from({length:n},(_,i)=>i+1));
    assert.deepEqual(rel.positive.right.slice().sort((a,b)=>a-b),Array.from({length:n},(_,i)=>i+1));
    assert.deepEqual(substitute(rel.word,chamberToMeridian),rel.meridianWord);
  }
  assert.deepEqual(substitute(group.infinityMeridian.wordInChambers,chamberToMeridian),group.infinityMeridian.wordInMeridians);
  arrangements++;relations+=group.relators.length;
}

// Independently evaluate Fox derivatives directly from word prefixes,
// without using the serialized sparse derivative implementation.
for(const id of ['a3','b3','icosidodecahedral','double-star']){
  const data=preset(id),group=fundamentalGroup(data),F=primeField(101),t=Array.from({length:data.n},(_,i)=>i+2);
  const boundary=evaluate(data,F,t).d1;
  const values=group.generators.chamber.map(g=>g.abelianImage.reduce((s,e,i)=>e?F.mul(s,t[i]):s,F.one));
  group.relators.forEach((rel,r)=>{
    const row=Array(data.n).fill(F.zero);let prefix=F.one;
    for(const letter of rel.word){const j=Math.abs(letter)-1;if(letter<0)prefix=F.mul(prefix,F.inv(values[j]));row[j]=F.add(row[j],letter>0?prefix:F.neg(prefix));if(letter>0)prefix=F.mul(prefix,values[j]);}
    assert.equal(prefix,F.one);
    const unit=group.fox.rowUnits[r];let scale=F.from(unit.sign);
    unit.exponents.forEach((e,i)=>{for(let k=0;k<Math.abs(e);k++)scale=F.mul(scale,e>0?t[i]:F.inv(t[i]));});
    row.forEach((x,j)=>assert.equal(x,F.mul(scale,boundary[r][j]),id+' row '+r+' column '+j));
  });
}

const original=preset('a3'),changed=arrangement(original.lines,autoFlag(original.lines,[q(1),q('3/7')]));
const a=fundamentalGroup(original),b=fundamentalGroup(changed);
assert.equal(a.invariants.lowerCentral.phi2,4);assert.equal(a.invariants.lowerCentral.phi2,b.invariants.lowerCentral.phi2);
assert.equal(a.invariants.center.status,'UNKNOWN');assert.equal(a.invariants.abelian.value,false);
assert.equal(a.invariants.lowerCentral.secondQuotient.rank,4);
const crossingFlag=arrangement([[1,0,0],[0,1,0],[1,1,-1]],[1,2,'-1/2']);
assert(!crossingFlag.adapted);assert.throws(()=>fundamentalGroup(crossingFlag),/flag/);
for(const format of ['gap','sage'])for(const basis of ['chamber','meridian']){
  const exported=groupExport(a,{format,basis});assert(exported.includes('FreeGroup'));assert(exported.includes('D1'));assert(exported.includes('abelian_invariants')||exported.includes('AbelianInvariants'));
}
assert(groupExport(a,{format:'sage'}).includes('assert A*image_g'));
assert(groupExport(empty,{format:'gap'}).includes('FreeGroup(0)'));
console.log(`Passed: ${arrangements} exact chamber presentations / ${relations} ch2 relators, Nielsen/positive-word certificates, universal Fox agreement, independent finite-field Fox evaluation, integral class-two torsion, geometric product/center certificates, flag invariance, GAP/Sage exports.`);
