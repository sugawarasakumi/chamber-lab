// Covectors of a realizable affine arrangement and its central cone.
// All incidence decisions use the exact ordered field supplied by math.js.
import {q} from './math.js';

const cache = new WeakMap();
const zero = () => q(0);
const sign = x => x.cmp(0);
const abs = x => x.cmp(0) < 0 ? x.neg() : x;
const keyOf = v => v.map(s => s < 0 ? '-' : s > 0 ? '+' : '0').join('');
const pointText = p => p.map(String);
const dot = (a,b) => a.reduce((s,x,i) => s.add(x.mul(b[i])),zero());
const affineValue = (line,p) => line[0].mul(p[0]).add(line[1].mul(p[1])).add(line[2]);
const affineSigns = (lines,p) => lines.map(l => sign(affineValue(l,p)));
const linearSigns = (lines,p) => lines.map(l => sign(l[0].mul(p[0]).add(l[1].mul(p[1]))));
const move = (p,v,t=q(1)) => p.map((x,i) => x.add(v[i].mul(t)));
const negate = v => v.map(x => x.neg());

/** Exact rank; works over Q and the ordered quadratic field used by the catalog. */
function matrixRank(rows) {
  if (!rows.length) return 0;
  const a = rows.map(row => row.slice());
  let r = 0;
  for (let col=0; col<a[0].length && r<a.length; col++) {
    const pivot = a.findIndex((row,i) => i>=r && !row[col].eq(0));
    if (pivot<0) continue;
    [a[r],a[pivot]] = [a[pivot],a[r]];
    for (let i=r+1; i<a.length; i++) {
      if (a[i][col].eq(0)) continue;
      const scale = a[i][col].div(a[r][col]);
      for (let j=col; j<a[i].length; j++) a[i][j] = a[i][j].sub(scale.mul(a[r][j]));
    }
    r++;
  }
  return r;
}

/** The covector/face order: X <= Y iff every nonzero sign of X agrees with Y. */
export function covectorLeq(x,y) {
  x = x.covector || x;
  y = y.covector || y;
  return x.length===y.length && x.every((s,i) => s===0 || s===y[i]);
}
export const faceOrder = covectorLeq;
export const oppositeCovector = v => (v.covector || v).map(s => s===0 ? 0 : -s);
export const composeCovectors = (x,y) => {
  x = x.covector || x;
  y = y.covector || y;
  if (x.length!==y.length) throw Error('Covectors have different ground sets.');
  return x.map((s,i) => s===0 ? y[i] : s);
};

function affineRecords(data) {
  const {lines,vertices,cells} = data;
  const records = new Map();
  const add = record => {
    record.covector ||= affineSigns(lines,record.sample);
    record.key = keyOf(record.covector);
    if (!records.has(record.key)) records.set(record.key,record);
  };
  vertices.forEach((v,vertexIndex) => add({
    kind:'vertex',sample:v.p,point:pointText(v.p),vertexIndex,unbounded:false
  }));
  lines.forEach((line,lineIndex) => {
    const tangent = [line[1],line[0].neg()];
    const incident = vertices.map((v,i) => ({...v,vertexIndex:i}))
      .filter(v => v.lines.includes(lineIndex))
      .sort((a,b) => dot(tangent,a.p).cmp(dot(tangent,b.p)));
    if (!incident.length) {
      const norm = line[0].mul(line[0]).add(line[1].mul(line[1]));
      const p = [line[0].mul(line[2]).neg().div(norm),line[1].mul(line[2]).neg().div(norm)];
      add({kind:'line',lineIndex,sample:p,point:pointText(p),direction:pointText(tangent),vertexIndices:[],unbounded:true});
      return;
    }
    const first = incident[0],last = incident.at(-1);
    const negativeTangent = negate(tangent);
    add({kind:'ray',lineIndex,sample:move(first.p,negativeTangent),point:pointText(first.p),direction:pointText(negativeTangent),vertexIndices:[first.vertexIndex],unbounded:true});
    for (let i=1; i<incident.length; i++) {
      const a = incident[i-1],b = incident[i];
      add({kind:'segment',lineIndex,sample:a.p.map((x,j) => x.add(b.p[j]).div(2)),endpoints:[pointText(a.p),pointText(b.p)],vertexIndices:[a.vertexIndex,b.vertexIndex],unbounded:false});
    }
    add({kind:'ray',lineIndex,sample:move(last.p,tangent),point:pointText(last.p),direction:pointText(tangent),vertexIndices:[last.vertexIndex],unbounded:true});
  });
  cells.forEach(c => {
    // A vertex average is strictly inside a full-dimensional convex chamber.
    const sample = c.poly?.length ? [0,1].map(i => c.poly.reduce((s,p) => s.add(p[i]),zero()).div(c.poly.length)) : undefined;
    add({kind:'chamber',covector:c.signs.slice(),sample,chamberId:c.id,unbounded:!!c.unbounded});
  });
  return [...records.values()];
}

function makePoset(records,normals,ambientDimension,mode,metadata={}) {
  const rank = matrixRank(normals),linealityDimension = ambientDimension-rank;
  const faces = records.map(record => {
    const {sample,...rest} = record;
    const zeroSet = record.covector.flatMap((s,i) => s===0 ? [i] : []);
    const normalRank = matrixRank(zeroSet.map(i => normals[i]));
    const dimension = ambientDimension-normalRank;
    return {
      ...rest,covector:record.covector.slice(),key:keyOf(record.covector),
      sample:sample ? pointText(sample) : undefined,
      dimension,rank:dimension-linealityDimension,normalRank,codimension:normalRank,
      zeroSet,zeroCount:zeroSet.length,support:record.covector.flatMap((s,i) => s!==0 ? [i] : []),
      lowerCovers:[],upperCovers:[]
    };
  }).sort((a,b) => a.rank-b.rank || a.key.localeCompare(b.key));
  const indices = {};
  for (const face of faces) {
    indices[face.dimension] = (indices[face.dimension] || 0)+1;
    face.id = (mode==='affine' ? 'A' : 'K')+face.dimension+'_'+indices[face.dimension];
  }
  const covers = [];
  const byRank = Array.from({length:rank+1},() => []);
  for (const face of faces) byRank[face.rank].push(face);
  for (let r=0; r<rank; r++) for (const lower of byRank[r]) for (const upper of byRank[r+1]) {
    if (!covectorLeq(lower,upper)) continue;
    covers.push({lower:lower.id,upper:upper.id});
    lower.upperCovers.push(upper.id);
    upper.lowerCovers.push(lower.id);
  }
  const fVector = Array.from({length:ambientDimension+1},(_,dim) => faces.filter(f => f.dimension===dim).length);
  const rankCounts = byRank.map(fs => fs.length);
  const zeroFace = faces.find(f => f.zeroCount===normals.length);
  return {
    mode,ambientDimension,rank,linealityDimension,groundSetSize:normals.length,
    labels:normals.map((_,i) => mode==='cone' && i===normals.length-1 ? 'H∞' : 'H'+(i+1)),
    faces,covers,covectors:faces.map(f => f.covector),counts:{...fVector},fVector,rankCounts,
    faceCount:faces.length,coverCount:covers.length,zeroFaceId:zeroFace?.id,
    topeIds:faces.filter(f => f.zeroCount===0).map(f => f.id),...metadata
  };
}

function coneRecords(data,affine,affinePoset) {
  const records = new Map(),affineByKey = new Map(affinePoset.faces.map(f => [f.key,f]));
  const add = record => {
    record.key = keyOf(record.covector);
    if (!records.has(record.key)) records.set(record.key,record);
  };
  for (const face of affine) {
    const source = affineByKey.get(face.key);
    const positive = [...face.covector,1],negative = oppositeCovector(positive);
    const sample = face.sample ? [...face.sample,q(1)] : undefined;
    const common = {affineFaceId:source.id,sourceKind:face.kind,chamberId:face.chamberId};
    add({...common,kind:'positive-lift',covector:positive,sample,chart:1});
    add({...common,kind:'negative-lift',covector:negative,sample:sample ? negate(sample) : undefined,chart:-1});
  }
  // At infinity this is the central fan of the linear parts (a_i,b_i).
  // A small exact transverse perturbation enumerates both adjacent sectors;
  // the bound keeps every nonzero sign at the chosen ray unchanged.
  const linearRank = matrixRank(data.lines.map(l => l.slice(0,2)));
  for (const line of data.lines) for (const raySign of [-1,1]) {
    const v = [line[1].mul(raySign),line[0].mul(-raySign)],w = line.slice(0,2);
    const raySigns = linearSigns(data.lines,v);
    if (raySigns.some(Boolean)) add({kind:'infinity-ray',covector:[...raySigns,0],sample:[...v,q(0)],chart:0});
    let epsilon = q(1);
    for (const other of data.lines) {
      const value = other[0].mul(v[0]).add(other[1].mul(v[1]));
      const change = other[0].mul(w[0]).add(other[1].mul(w[1]));
      if (value.eq(0) || change.eq(0)) continue;
      const bound = abs(value).div(abs(change).mul(2));
      if (bound.cmp(epsilon)<0) epsilon=bound;
    }
    for (const direction of [-1,1]) {
      const p = move(v,w,epsilon.mul(direction));
      const signs = linearSigns(data.lines,p);
      add({kind:'infinity-sector',covector:[...signs,0],sample:[...p,q(0)],chart:0});
    }
  }
  // The zero covector is the common kernel. It is one face, even when the
  // kernel has positive dimension (parallel and empty affine arrangements).
  add({kind:linearRank===2 ? 'origin' : 'lineality',covector:Array(data.lines.length+1).fill(0),sample:[q(0),q(0),q(0)],chart:0});
  return [...records.values()];
}

/**
 * Enumerate the actual affine face poset or the complete coned OM covectors.
 * `dimension` is the ambient face dimension; `rank` is dimension after
 * quotienting common lineality; `normalRank` is the rank of the zero-set.
 * For a nonessential cone, the zero covector represents the entire kernel.
 */
export function facePoset(data,options={}) {
  const mode = typeof options==='string' ? options : options.mode || 'affine';
  if (mode!=='affine' && mode!=='cone') throw Error('face-poset mode must be affine or cone.');
  let entry = cache.get(data);
  if (!entry) {
    const records = affineRecords(data);
    const affine = makePoset(records,data.lines.map(l => l.slice(0,2)),2,'affine');
    entry = {records,affine};
    cache.set(data,entry);
  }
  if (mode==='affine') return entry.affine;
  if (!entry.cone) {
    const normals = [...data.lines,[q(0),q(0),q(1)]];
    entry.cone = makePoset(coneRecords(data,entry.records,entry.affine),normals,3,'cone',{
      infinityIndex:data.lines.length,affineFaceCount:entry.affine.faceCount
    });
  }
  return entry.cone;
}

export const affineFacePoset = data => facePoset(data,{mode:'affine'});
export const coneFacePoset = data => facePoset(data,{mode:'cone'});

/** Principal intervals include the selected face; proper intervals omit it. */
export function faceInterval(poset,id) {
  const face = typeof id==='string' ? poset.faces.find(f => f.id===id) : id;
  if (!face || !poset.faces.some(f => f.id===face.id)) throw Error('Unknown face.');
  const lower = poset.faces.filter(f => covectorLeq(f,face));
  const upper = poset.faces.filter(f => covectorLeq(face,f));
  const byId = new Map(poset.faces.map(f => [f.id,f]));
  return {
    face,lower,upper,properLower:lower.filter(f => f.id!==face.id),properUpper:upper.filter(f => f.id!==face.id),
    lowerCovers:face.lowerCovers.map(id => byId.get(id)),upperCovers:face.upperCovers.map(id => byId.get(id))
  };
}
