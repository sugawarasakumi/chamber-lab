import assert from 'node:assert/strict';
import {arrangement,PRESETS} from './docs/math.js';
import {searchMultinets,verifyMultinetCertificate} from './docs/multinets.js';
const model=id=>arrangement(PRESETS.find(p=>p.id===id).lines);
const a3=model('a3'),a=searchMultinets(a3);
assert.equal(a.net.verdict,'YES');assert.equal(a.multinet.verdict,'YES');assert.equal(a.net.certificate.degree,'2');assert.equal(a.net.certificate.k,3);assert.equal(a.net.certificate.basepoints.length,4);assert(a.net.certificate.weights.every(w=>w==='1'));assert(verifyMultinetCertificate(a3,a.net.certificate).valid);
const b3=model('b3'),b=searchMultinets(b3);
assert.equal(b.net.verdict,'NO');assert.equal(b.multinet.verdict,'YES');assert.equal(b.multinet.certificate.degree,'4');assert.equal(b.multinet.certificate.kind,'nonreduced-multinet');assert.equal(b.multinet.certificate.weights.filter(w=>w==='2').length,3);assert(verifyMultinetCertificate(b3,b.multinet.certificate).valid);
const sub=searchMultinets(b3,{support:[0,1,2,4,6,8]});assert.equal(sub.fullSupport,false);assert.equal(sub.net.verdict,'YES');assert.equal(sub.net.certificate.degree,'2');assert.equal(sub.net.certificate.weights.filter(w=>w==='0').length,3);assert(verifyMultinetCertificate(b3,sub.net.certificate).valid);
const generic=searchMultinets(model('generic'));assert.equal(generic.net.verdict,'NO');assert.equal(generic.multinet.verdict,'NO');assert(generic.exhausted);
const reducedData=model('cel-12-84-3'),reduced=searchMultinets(reducedData);assert.equal(reduced.multinet.verdict,'YES');assert.equal(reduced.reducedMultinet.verdict,'YES');assert.equal(reduced.net.verdict,'NO');assert.equal(reduced.multinet.certificate.degree,'4');assert.equal(reduced.multinet.certificate.kind,'reduced-multinet');assert.equal(reduced.multinet.certificate.isNet,false);assert(reduced.multinet.certificate.basepoints.some(p=>p.weight!=='1'));assert(verifyMultinetCertificate(reducedData,reduced.multinet.certificate).valid);
const pencilData=model('pencil'),pencil=searchMultinets(pencilData,{support:[0,1,2,3]});assert(pencil.trivialPencil);assert.equal(pencil.trivialPencil.degree,'1');assert.equal(pencil.net.verdict,'NO');assert.equal(pencil.multinet.verdict,'NO');
const withoutInfinity=searchMultinets(a3,{support:[0,1,2,3,4]});assert.equal(withoutInfinity.net.verdict,'NO');assert.equal(withoutInfinity.multinet.verdict,'NO');
const wrong=structuredClone(a.net.certificate);wrong.weights[0]='2';assert.equal(verifyMultinetCertificate(a3,wrong).valid,false);
const scaled=structuredClone(a.net.certificate);scaled.weights=scaled.weights.map(w=>String(BigInt(w)*7n));scaled.degree='14';assert(verifyMultinetCertificate(a3,scaled).valid);
// Search caps must never turn a missing certificate into a nonexistence proof.
const capped=searchMultinets(a3,{maxStates:1});assert.equal(capped.exhausted,false);assert.equal(capped.net.verdict,'UNKNOWN');assert.equal(capped.multinet.verdict,'UNKNOWN');
assert.throws(()=>searchMultinets(a3,{support:[-1,0,1]}),/範囲外/);
console.log('Passed: A3(3,2)-net; B3 nonreduced(3,4)-multinet; selected support; genuine full-support nonexistence; trivial pencils separated; exact certificate validation; capped search returns UNKNOWN.');
