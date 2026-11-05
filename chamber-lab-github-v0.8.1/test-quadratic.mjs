import assert from 'node:assert/strict';
import {Q,q,QQ,normalizeLine,arrangement,intersections} from './docs/math.js';
const r=q('sqrt(5)'),phi=q('(1+sqrt(5))/2');
assert(r.mul(r).eq(5));assert(phi.mul(phi).eq(phi.add(1)));
assert(q(2).cmp(r)<0);assert(q('9/4').cmp(r)>0);
assert(q('sqrt(5)-2').cmp(0)>0);assert(q('-sqrt(5)+2').cmp(0)<0);
assert(q('1/(sqrt(5)+2)').eq(q('sqrt(5)-2')));
assert(q('(-7/3+2/11*sqrt(5))/(3/7-5/13*sqrt(5))').mul(q('3/7-5/13*sqrt(5)')).eq(q('-7/3+2/11*sqrt(5)')));
for(const s of ['(1+sqrt(5))/2','-1/3-2/7*sqrt(5)','φ','√5','(sqrt(5)-2)/3']){const x=q(s);assert(q(String(x)).eq(x));assert(q(JSON.parse(JSON.stringify(x))).eq(x));}
// Large Pell approximants: the signs must not be inferred from valueOf().
let a=2n,b=1n;for(let i=0;i<25;i++){const x=q(String(a)).sub(r.mul(String(b)));assert.equal(x.cmp(0),i%2===0?-1:1);[a,b]=[2n*a+5n*b,a+2n*b];}
const lineA=normalizeLine(['sqrt(5)','1','-1']),lineB=normalizeLine(['5','sqrt(5)','-sqrt(5)']);assert.deepEqual(lineA.map(String),lineB.map(String));
const vertices=intersections([normalizeLine([1,0,'-sqrt(5)']),normalizeLine([0,1,0]),normalizeLine([1,1,'-sqrt(5)'])]);assert.equal(vertices.length,1);assert.deepEqual(vertices[0].lines,[0,1,2]);
assert.throws(()=>arrangement([lineA,lineB]),/重複/);assert(q('sqrt(2)').mul(q('sqrt(2)')).eq(2));assert.throws(()=>q('sqrt(5);alert(1)'));assert.throws(()=>q('sqrt(5)/0'));assert.throws(()=>QQ.from(r));assert.throws(()=>Q.of(r));
console.log('quadratic: exact arithmetic, order, cancellation, round trips, incidence, rational coefficient isolation passed');
