import assert from 'node:assert/strict';
import {arrangement,PRESETS,autoFlag,q} from './docs/math.js';
import {alexander} from './docs/alexander.js';
const get=id=>arrangement(PRESETS.find(p=>p.id===id).lines);
const exponents=r=>Object.fromEntries(r.factors.map(f=>[f.order,f.exponent]));
assert.equal(alexander(arrangement([])).available,false);
assert.deepEqual(alexander(arrangement([[1,0,0]])).coefficients,['1']);
const parallel=alexander(arrangement([[1,0,0],[1,0,-1],[1,0,-2]]));assert.equal(parallel.freeRank,2);assert.equal(parallel.factorized,'0');
assert.deepEqual(exponents(alexander(get('triangle'))),{1:2});
assert.deepEqual(exponents(alexander(get('generic'))),{1:3});
assert.deepEqual(exponents(alexander(get('grid'))),{1:5});
assert.deepEqual(exponents(alexander(get('pencil'))),{1:3,2:2,4:2});
assert.deepEqual(exponents(alexander(get('a3'))),{1:4,3:1});
for(const id of ['a3','pencil','generic','grid'])assert.deepEqual(alexander(get(id),{method:'certificate'}).coefficients,alexander(get(id)).coefficients,'local-order certificate: '+id);
// Synthetic polynomial presentation with a length-two (t+1)-primary block:
// B/(t-1) = diag([[t+1,1],[0,t+1]], [1]). Its nullity at -1 is only one,
// but its Alexander factor is (t+1)^2. This guards against root-rank sampling.
const entry=len=>({deg:len?-1:0,plus:0,minus:2**len-1,sep:2**len-1});
const toy={...get('generic'),b2:3,d1:[[entry(0),entry(2),entry(0),entry(0)],[entry(0),entry(1),entry(2),entry(0)],[entry(0),entry(0),entry(0),entry(1)]]};
assert.deepEqual(exponents(alexander(toy,{method:'certificate'})),{1:3,2:2});
const a3=get('a3'),flagged=arrangement(a3.lines,autoFlag(a3.lines,[q(1),q('3/7')]));assert.deepEqual(alexander(a3).coefficients,alexander(flagged).coefficients);
let count=0;for(const p of PRESETS){const r=alexander(arrangement(p.lines));if(!r.available)continue;assert(r.factorizationComplete,p.id);assert(!r.residualFactors.length,p.id);if(!r.zero)assert.equal(r.coefficients.at(-1),'1',p.id);count++;}
console.log(`Passed affine Alexander: missing map, trivial cover, free part, generic/grid/pencil/A3, flag invariance, complete integral cyclotomic factors for ${count} presets.`);
