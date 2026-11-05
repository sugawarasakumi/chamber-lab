import assert from 'node:assert/strict';
import {arrangement,q,PRESETS} from './docs/math.js';
import {facePoset,faceInterval,covectorLeq,oppositeCovector,composeCovectors} from './docs/face-poset.js';

const fixtures = [
  {name:'empty',lines:[],affine:[0,0,1],cone:[0,0,1,2],rank:0,lineality:2},
  {name:'one line',lines:[[1,0,0]],affine:[0,1,2],cone:[0,1,4,4],rank:1,lineality:1},
  {name:'parallel lines',lines:[[1,0,0],[1,0,-1],[1,0,-2]],affine:[0,3,4],cone:[0,1,8,8],rank:1,lineality:1},
  {name:'four-line pencil',lines:[[1,0,0],[0,1,0],[1,1,0],[1,-1,0]],affine:[1,8,8],cone:[1,10,24,16],rank:2,lineality:0},
  {name:'generic triangle',lines:[[1,0,0],[0,1,0],[1,1,-1]],affine:[3,9,7],cone:[1,12,24,14],rank:2,lineality:0},
  {name:'A3 decone',lines:[[1,0,0],[1,0,-1],[0,1,0],[0,1,-1],[1,-1,0]],affine:[4,15,12],cone:[1,14,36,24],rank:2,lineality:0}
];
const vectorKey = v => v.join(',');

function validateFacePoset(data,poset) {
  const byId = new Map(poset.faces.map(f => [f.id,f]));
  const covectors = new Set(poset.covectors.map(vectorKey));
  assert.equal(byId.size,poset.faces.length,'face IDs are unique');
  assert.equal(covectors.size,poset.faces.length,'covectors uniquely identify faces');
  assert.equal(poset.faceCount,poset.fVector.reduce((a,b) => a+b,0));
  const expectedTopes = poset.mode==='affine' ? data.cells.length : 2*data.cells.length;
  assert.equal(poset.topeIds.length,expectedTopes,'chambers are exactly topes');
  const normals = poset.mode==='affine' ? data.lines : [...data.lines,[q(0),q(0),q(1)]];
  for (const face of poset.faces) {
    assert.equal(face.covector.length,poset.groundSetSize);
    assert(face.covector.every(s => [-1,0,1].includes(s)));
    assert.equal(face.normalRank+face.dimension,poset.ambientDimension);
    assert.equal(face.dimension-face.rank,poset.linealityDimension);
    assert.equal(face.zeroSet.length,face.zeroCount);
    assert(face.zeroCount>=face.normalRank);
    if (face.sample) {
      const point=face.sample.map(q);
      const sampled=normals.map(l => (poset.mode==='affine'
        ? l[0].mul(point[0]).add(l[1].mul(point[1])).add(l[2])
        : l.reduce((s,x,i) => s.add(x.mul(point[i])),q(0))).cmp(0));
      assert.deepEqual(sampled,face.covector,'every recorded exact sample realizes its covector');
    }
    if (face.kind==='chamber') assert(data.cells.some(c => c.id===face.chamberId));
  }
  for (const cover of poset.covers) {
    const lo=byId.get(cover.lower),hi=byId.get(cover.upper);
    assert.equal(hi.rank,lo.rank+1,'covers increase rank by one');
    assert(covectorLeq(lo,hi));
    assert(hi.lowerCovers.includes(lo.id));
    assert(lo.upperCovers.includes(hi.id));
  }
  for (const facet of poset.faces.filter(f => f.normalRank===1)) {
    assert.equal(facet.upperCovers.length,2,'a facet separates exactly two chambers');
  }
  // Reachability of the independently exposed cover graph is the sign order.
  for (const face of poset.faces) {
    const reached=new Set([face.id]),todo=[face.id];
    while(todo.length) for (const id of byId.get(todo.pop()).upperCovers) if (!reached.has(id)) {
      reached.add(id);todo.push(id);
    }
    for (const other of poset.faces) assert.equal(reached.has(other.id),covectorLeq(face,other));
    const interval=faceInterval(poset,face.id);
    assert.equal(interval.upper.length,reached.size);
    assert(interval.lower.some(f => f.id===face.id));
    assert(!interval.properLower.some(f => f.id===face.id));
  }
}

function validateCovectorAxioms(poset) {
  const vectors=poset.covectors,keys=new Set(vectors.map(vectorKey));
  assert(keys.has(vectorKey(Array(poset.groundSetSize).fill(0))),'zero covector');
  for (const x of vectors) assert(keys.has(vectorKey(oppositeCovector(x))),'antipodal closure');
  for (const x of vectors) for (const y of vectors) {
    const composition=composeCovectors(x,y);
    assert(keys.has(vectorKey(composition)),'composition closure');
    const separation=x.flatMap((s,i) => s!==0 && s===-y[i] ? [i] : []);
    const outside=x.map((_,i) => i).filter(i => !separation.includes(i));
    for (const e of separation) {
      assert(vectors.some(z => z[e]===0 && outside.every(i => z[i]===composition[i])),
        `strong elimination for coordinate ${e}`);
    }
  }
}

for (const fixture of fixtures) {
  const data=arrangement(fixture.lines),affine=facePoset(data),cone=facePoset(data,{mode:'cone'});
  assert.deepEqual(affine.fVector,fixture.affine,fixture.name+' affine face counts');
  assert.deepEqual(cone.fVector,fixture.cone,fixture.name+' cone face counts');
  assert.equal(affine.rank,fixture.rank);
  assert.equal(cone.rank,fixture.rank+1);
  assert.equal(affine.linealityDimension,fixture.lineality);
  assert.equal(cone.linealityDimension,fixture.lineality);
  assert.equal(affine.fVector.reduce((s,n,d) => s+(-1)**d*n,0),1,'affine Euler relation');
  assert.equal(cone.rankCounts.slice(1).reduce((s,n,i) => s+(-1)**i*n,0),1+(-1)**(cone.rank-1),'sphere Euler relation');
  const kernel=cone.faces.find(f => f.id===cone.zeroFaceId);
  assert.equal(kernel.dimension,fixture.lineality,'zero covector is the whole common kernel');
  assert.equal(kernel.rank,0);
  assert.equal(faceInterval(cone,kernel).upper.length,cone.faceCount);
  validateFacePoset(data,affine);
  validateFacePoset(data,cone);
  validateCovectorAxioms(cone);
}

// Close and very large rational intersections must not collapse into one face.
const close=arrangement([[1,0,0],[1,0,'-1/100000000000000000000'],[0,1,0],[1,1,-1]]);
assert.equal(facePoset(close).fVector[0],close.vertices.length);
validateFacePoset(close,facePoset(close));
validateCovectorAxioms(facePoset(close,'cone'));

// Regression over every available catalog entry, including Q(sqrt(5)) entries
// once registered by the main catalog update.
let catalogCount=0;
for (const preset of PRESETS) {
  if (!preset.lines) continue;
  const data=arrangement(preset.lines),affine=facePoset(data),cone=facePoset(data,'cone');
  assert.equal(affine.faces.filter(f => f.kind==='vertex').length,data.vertices.length);
  assert.equal(affine.topeIds.length,data.cells.length);
  assert.equal(cone.topeIds.length,2*data.cells.length);
  assert.equal(cone.rankCounts.slice(1).reduce((s,n,i) => s+(-1)**i*n,0),1+(-1)**(cone.rank-1));
  catalogCount++;
}
assert.throws(() => faceInterval(facePoset(arrangement([])),'unknown'),/Unknown face/);
assert.throws(() => facePoset(arrangement([]),'invalid'),/mode/);
console.log(`face-poset: ${fixtures.length} exact fixtures, covector axioms, and ${catalogCount} catalog arrangements passed`);
