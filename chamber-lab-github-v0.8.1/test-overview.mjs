import assert from 'node:assert/strict';
import {q,arrangement,autoFlag,PRESETS} from './docs/math.js';
import {overview,asphericity,yoshinagaConsistency} from './docs/overview.js';
const preset=id=>arrangement(PRESETS.find(p=>p.id===id).lines);
const a3=overview(preset('a3'));
assert.deepEqual(a3.finiteCounts,{2:2,3:2});
assert.deepEqual(a3.infinityCounts,{2:1,3:2});
assert.deepEqual(a3.projectiveCounts,{2:3,3:4});
assert.deepEqual(a3.characteristic,[1,-5,6]);
assert.deepEqual(a3.coneCharacteristic,[1,-6,11,-6]);
assert.deepEqual([a3.points.length,a3.projectiveEdges,a3.chambers],[7,18,12]);
assert.deepEqual([a3.graph.nodes.length,a3.graph.edges.length,a3.graph.coneNodes.length,a3.graph.coneEdges.length],[12,15,24,36]);
// Independent graph verification: shortest paths agree with separation counts.
for(const mode of ['affine','cone']){const nodes=mode==='cone'?a3.graph.coneNodes:a3.graph.nodes,edges=mode==='cone'?a3.graph.coneEdges:a3.graph.edges,adj=nodes.map(()=>[]);for(const e of edges){adj[e.from].push(e.to);adj[e.to].push(e.from);assert.equal(nodes[e.from].signs.filter((v,i)=>v!==nodes[e.to].signs[i]).length,1);}for(let start=0;start<nodes.length;start++){const dist=nodes.map(()=>-1),queue=[start];dist[start]=0;for(const v of queue)for(const w of adj[v])if(dist[w]<0){dist[w]=dist[v]+1;queue.push(w);}nodes.forEach((v,i)=>assert.equal(dist[i],v.signs.filter((s,j)=>s!==nodes[start].signs[j]).length));}if(mode==='cone')assert(adj.every(a=>a.length===3));}
const yes=asphericity(preset('a3'));assert.equal(yes.verdict,'YES');assert(yes.simplicial&&yes.falk.passed&&yes.consistency.passed);
const no=asphericity(preset('triangle'));assert.equal(no.verdict,'NO');assert(no.triangle);assert.deepEqual([no.consistency.sigma2,no.consistency.sigma3],[16,14]);assert(no.consistency.witness);assert(!no.falk.passed);
const falk=asphericity(preset('falk11'));assert.equal(falk.verdict,'UNKNOWN');assert(!falk.falk.passed&&falk.consistency.passed&&!falk.triangle&&!falk.modular&&!falk.simplicial);
const grid=asphericity(preset('grid'));assert.equal(grid.verdict,'YES');assert(!grid.simplicial);assert(grid.falk.passed&&grid.modular);
const nonfano=asphericity(preset('nonfano'));assert.equal(nonfano.verdict,'YES');assert(nonfano.simplicial&&!nonfano.falk.passed);
assert.equal(asphericity(arrangement([[1,0,0],[1,0,-1],[1,0,-2]])).verdict,'YES');
assert.equal(asphericity(arrangement([])).verdict,'YES');
// Deligne and the necessary consistency condition must agree for every added catalogue entry.
let count=0;for(const p of PRESETS.filter(p=>p.expected)){const d=arrangement(p.lines),o=overview(d);assert.deepEqual(o.projectiveCounts,p.expected.t,p.name);assert.equal(2*o.chambers,p.expected.regions,p.name);assert.equal(o.simplicial,p.expected.simplicial??true,p.name);assert(!o.triangle,p.name);assert(yoshinagaConsistency(d).passed,p.name);count++;}
// Flags alter labels/bases; they must not alter these geometric invariants.
const original=preset('a3'),changed=arrangement(original.lines,autoFlag(original.lines,[q(1),q('3/7')]));
assert.deepEqual(overview(changed).projectiveCounts,a3.projectiveCounts);assert.equal(asphericity(changed).verdict,'YES');
// A tiny perturbation is detected exactly and may change incidences.
const lines=original.lines.map(l=>l.map(String));lines[4]=['1','-1','1/1000000000000'];
assert.notDeepEqual(overview(arrangement(lines)).projectiveCounts,a3.projectiveCounts);
console.log(`Passed: exact multiplicities/polynomials, tope shortest paths, four one-sided K(pi,1) tests, YES/NO/UNKNOWN, flag invariance, tiny perturbation, ${count} published catalogue checks.`);
