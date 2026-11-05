import assert from 'node:assert/strict';
import {EditHistory,deleteLineModel} from './docs/edit-history.js';
import {arrangement,PRESETS} from './docs/math.js';
const lines=PRESETS.find(p=>p.id==='a3').lines,d=arrangement(lines),model={lines:d.lines.map(l=>l.map(String)),flag:d.flag.map(String),w:['2','3','5','7','11'],a:['13','17','19','23','29'],complex:[[1,2],[3,4],[5,6],[7,8],[9,10]],netSupport:[0,1,2],name:'A3',preset:'a3'};
const before=JSON.stringify(model),deleted=deleteLineModel(model,2);
assert.equal(JSON.stringify(model),before);assert.deepEqual(deleted.w,['2','3','7','11']);assert.deepEqual(deleted.a,['13','17','23','29']);assert.deepEqual(deleted.complex,[[1,2],[3,4],[7,8],[9,10]]);assert.equal(deleted.lines.length,4);assert.equal(deleted.netSupport,null);assert(arrangement(deleted.lines,deleted.flag).verified);
const h=new EditHistory(3),after=JSON.stringify(deleted);h.record(before,after);assert(h.canUndo&&!h.canRedo);assert.equal(h.undo(after),before);assert(h.canRedo&&!h.canUndo);assert.equal(h.redo(before),after);
assert.equal(h.undo(after),before);assert.equal(h.record(before,before),false);assert(h.canRedo,'no-op must retain redo');h.record(before,'branch');assert(!h.canRedo);assert.equal(h.undo('branch'),before);
const bounded=new EditHistory(2);bounded.record('A','B');bounded.record('B','C');bounded.record('C','D');assert.equal(bounded.undo('D'),'C');assert.equal(bounded.undo('C'),'B');assert.equal(bounded.undo('B'),null);assert.equal(bounded.redo('B'),'C');assert.equal(bounded.redo('C'),'D');assert.equal(bounded.redo('D'),null);
for(let i=0;i<model.lines.length;i++){const sub=deleteLineModel(model,i);assert.equal(sub.w.length,sub.lines.length);assert.equal(sub.a.length,sub.lines.length);assert(arrangement(sub.lines,sub.flag).verified);}
let empty=model;while(empty.lines.length)empty=deleteLineModel(empty,0);assert.deepEqual(empty.w,[]);assert(arrangement(empty.lines,empty.flag).verified);assert.throws(()=>deleteLineModel(empty,0));
console.log('editing: exact deletion, aligned monodromy/Aomoto/complex parameters, empty arrangement, undo/redo branching, no-op retention and history limit passed');
