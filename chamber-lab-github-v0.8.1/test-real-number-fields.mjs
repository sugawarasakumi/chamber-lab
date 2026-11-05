import assert from 'node:assert/strict';
import {q,registerRealField,arrangement,QQ} from './docs/math.js';
registerRealField({id:'test_r7',symbol:'test_r7',polynomial:['-1','-2','1','1'],interval:['124/100','125/100']});
registerRealField({id:'test_s2',symbol:'test_s2',polynomial:['-2','0','1'],interval:['1','2']});
const a=q('test_r7'),s=q('test_s2');
assert(q('test_r7^3+test_r7^2-2*test_r7-1').eq(0));assert(q('test_s2^2').eq(2));
assert(q(1).div(a).mul(a).eq(1));assert(a.add(1).div(a.sub(1)).mul(a.sub(1)).eq(a.add(1)));
assert(a.cmp('5/4')<0&&a.cmp('31/25')>0);assert(Math.abs(Number(a)-1.246979603717467)<1e-14);
assert(q('-test_r7^2').eq(a.mul(a).neg()));assert(q('sqrt(2)').eq(s));
for(const x of [a,a.mul(17).sub('1/3'),q('1/(test_r7^2-2)'),q('(1+test_s2)/3')])assert(q(String(x)).eq(x));
// Exact cancellations and signs well below the numeric display resolution.
assert(a.sub(a).eq(0));assert(a.add(q('1/1000000000000000000000000000000000000000')).cmp(a)>0);
assert.throws(()=>a.add(s),/異なる/);assert.throws(()=>QQ.from(a));assert.throws(()=>registerRealField({id:'badinterval',polynomial:['-2','0','1'],interval:['0','1']}));
const d=arrangement([[1,0,a.neg()],[0,1,0],[1,1,a.neg()]]);assert.equal(d.vertices.length,1);assert.equal(d.vertices[0].lines.length,3);assert(d.verified);
console.log('real number fields: cubic/quadratic arithmetic, Sturm isolation, exact order, canonical parsing, incidence and field separation passed');
