import assert from 'node:assert/strict';
import {q,QQ,primeField,cycloField,arrangement,defaultFlag,evaluate,milnor,PRESETS,verifyUniversal} from './docs/math.js';
for(const P of PRESETS){const d=arrangement(P.lines);assert.equal(d.verified,true,P.id);assert.equal(d.cells.length,1+d.n+d.b2,P.id);const trivial=evaluate(d,QQ,Array(d.n).fill(q(1)));assert.deepEqual(trivial.h,[1,d.n,d.b2]);const zero=evaluate(d,QQ,Array(d.n).fill(q(0)),'aomoto');assert.deepEqual(zero.h,[1,d.n,d.b2]);for(const order of [2,3,4,5,6]){const F=cycloField(order);const r=evaluate(d,F,Array.from({length:d.n},(_,i)=>F.root(i+1)));for(const row of r.d1){let s=F.zero;for(let i=0;i<d.n;i++)s=F.add(s,F.mul(row[i],r.d0[i][0]));assert(F.is0(s),P.id+' d²');}assert(r.h.every(h=>h>=0));}}
for(let n=1;n<=28;n++){const F=cycloField(n);assert(F.is0(F.sub(F.root(n),F.one)));if(n>1){const a=F.sub(F.root(1),F.one);assert(F.is0(F.sub(F.mul(a,F.inv(a)),F.one)));}}
const a3=arrangement(PRESETS[0].lines);assert.equal(a3.b2,6);assert.deepEqual(milnor(a3).betti,[1,7,18]);assert.deepEqual(milnor(a3).rows.map(r=>[r.d,r.h[1]]),[[1,5],[2,0],[3,1],[6,0]]);
assert.equal(evaluate(a3,primeField(3),Array(5).fill(1),'aomoto').h[1],1);assert.equal(evaluate(a3,QQ,Array(5).fill(q(1)),'aomoto').h[1],0);
assert.equal(evaluate(a3,QQ,[1,-1,-1,1,0].map(q),'aomoto').h[1],1);
assert.throws(()=>arrangement([[1,0,0],[2,0,0]]),/重複/);assert.throws(()=>arrangement([[1,0,0],[0,1,0]],[1,-1,0]),/交点/);
// Independently generated rational arrangements: exact Laurent identity, several flag directions.
for(let seed=1;seed<=14;seed++){const lines=Array.from({length:3+seed%5},(_,i)=>[1,i+1,(i*i+seed*i+seed)%13-6]);const d=arrangement(lines,defaultFlag(lines));assert(verifyUniversal(d));const F=primeField(7),r=evaluate(d,F,Array.from({length:d.n},(_,i)=>F.from(i+seed)),'aomoto');for(const row of r.d1){let sum=0;row.forEach((x,i)=>sum=F.add(sum,F.mul(x,r.d0[i][0])));assert.equal(sum,0);}}
console.log('Passed: chamber counts, exact universal d²=0, rational and finite-field Aomoto, cyclotomic arithmetic, A3 Milnor Betti numbers, degenerate-input rejection.');
