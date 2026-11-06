// Exact existence tests for multinets on a specified projective support.
// FY: Falk–Yuzvinsky, arXiv:math/0603166, Definition 2.1, Theorem 2.5,
//     Remark 2.6; TY: Torielli–Yoshinaga, J. Singularities 11 (2015),
//     Theorem 2.2 and Theorem 5.2.
// All nontrivial REAL multinets have k=3: a k=4 multinet is a 4-net,
// and real 4-nets do not exist. One-basepoint pencils are kept separate.
import {q,Z,ONE,QQ,nullspace} from './math.js';

const SOURCES={definition:'https://arxiv.org/abs/math/0603166',realRestriction:'https://www.journalofsing.org/volume11/torielli-yoshinaga.pdf'};
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r;}return a;};
const lcm=(a,b)=>a/gcd(a,b)*b;
class DSU{constructor(n){this.p=Array.from({length:n},(_,i)=>i);}find(a){while(a!==this.p[a]){this.p[a]=this.p[this.p[a]];a=this.p[a];}return a;}join(a,b){a=this.find(a);b=this.find(b);if(a===b)return false;this.p[b]=a;return true;}}

function supportData(data,options={}){
  const N=data.n+1,raw=options.support??Array.from({length:N},(_,i)=>i);
  if(!Array.isArray(raw))throw Error('support は直線番号の配列にしてください');
  if(raw.some(i=>!Number.isInteger(i)||i<0||i>=N))throw Error('support の直線番号が範囲外です');
  const supportedIndices=[...new Set(raw)].sort((a,b)=>a-b),chosen=new Set(supportedIndices);
  const finite=data.vertices.map((v,i)=>({id:'P'+(i+1),hom:[...v.p,ONE].map(String),lines:v.lines,infinity:false}));
  const groups=new Map();data.lines.forEach((l,i)=>{const key=l.slice(0,2).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
  const infinity=[...groups.values()].map((g,i)=>({id:'P∞'+(i+1),hom:[data.lines[g[0]][1],data.lines[g[0]][0].neg(),Z].map(String),lines:[...g,data.n],infinity:true}));
  const points=[...finite,...infinity].map(p=>({...p,lines:p.lines.filter(i=>chosen.has(i))})).filter(p=>p.lines.length>=2);
  const pairs=points.reduce((s,p)=>s+p.lines.length*(p.lines.length-1)/2,0);
  if(pairs!==supportedIndices.length*(supportedIndices.length-1)/2)throw Error('support の射影交点データの検算が一致しません');
  return {N,supportedIndices,fullSupport:supportedIndices.length===N,points};
}

function positivePrimitiveKernel(M){
  const ker=nullspace(M,QQ,M.length);
  // Connectivity makes Q an irreducible Z-matrix. If Q had a strictly
  // positive nullvector, Perron–Frobenius applied to cI−Q makes its nullity1.
  // Therefore rejecting nullity !=1 does NOT bound or truncate the weights.
  if(ker.length!==1)return null;
  let v=ker[0];if(v.every(x=>x.n<0n))v=v.map(x=>x.neg());
  if(v.some(x=>x.n<=0n))return null;
  const den=v.reduce((a,x)=>lcm(a,x.d),1n),ints=v.map(x=>x.n*(den/x.d)),g=ints.reduce(gcd);
  return ints.map(x=>x/g);
}

function analyzePartition(S,blocks){
  const lineBlock=new Map();for(let b=0;b<blocks.length;b++)for(const i of blocks[b]){if(lineBlock.has(i))return null;lineBlock.set(i,b);}
  if(lineBlock.size!==S.supportedIndices.length||S.supportedIndices.some(i=>!lineBlock.has(i))||blocks.length!==3||blocks.some(b=>!b.length))return null;
  const base=[],inside=[];
  for(const p of S.points){const colors=new Set(p.lines.map(i=>lineBlock.get(i)));if(colors.size===2)return null;if(colors.size===3)base.push(p);else inside.push(p);}
  // A true one-basepoint multinet is only the degree1 singleton pencil.
  // Nontrivial search is deliberately |X|>1, primitive degree>=2.
  if(base.length<=1)return null;
  for(const block of blocks){const pos=new Map(block.map((x,i)=>[x,i])),D=new DSU(block.length);for(const p of inside){const on=p.lines.filter(i=>pos.has(i));for(let j=1;j<on.length;j++)D.join(pos.get(on[0]),pos.get(on[j]));}if(block.some((_,i)=>D.find(i)!==D.find(0)))return null;}
  const kernels=[];
  for(const block of blocks){
    const M=block.map((i,a)=>block.map((j,b)=>q(a===b?base.filter(p=>p.lines.includes(i)).length-1:base.some(p=>p.lines.includes(i)&&p.lines.includes(j))?0:-1)));
    const v=positivePrimitiveKernel(M);if(!v)return null;kernels.push(v);
  }
  const sums=kernels.map(v=>v.reduce((s,x)=>s+x,0n)),common=sums.reduce(lcm,1n),weights=Array(S.N).fill(0n);
  blocks.forEach((block,b)=>block.forEach((i,j)=>weights[i]=kernels[b][j]*(common/sums[b])));
  const allGcd=S.supportedIndices.map(i=>weights[i]).reduce(gcd);for(const i of S.supportedIndices)weights[i]/=allGcd;
  const degree=common/allGcd;
  if(degree<2n)return null;
  const basepoints=[];
  for(const p of base){const totals=blocks.map(block=>p.lines.reduce((s,i)=>s+(block.includes(i)?weights[i]:0n),0n));if(totals[0]<=0n||totals.some(t=>t!==totals[0]))return null;basepoints.push({...p,weight:String(totals[0]),blockWeights:totals.map(String)});}
  // Independent double-counting check: every pair of lines from two blocks
  // intersects once in the projective plane, counting their positive weights.
  if(basepoints.reduce((s,p)=>s+BigInt(p.weight)**2n,0n)!==degree**2n)return null;
  const reduced=S.supportedIndices.every(i=>weights[i]===1n),isNet=reduced&&base.every(p=>blocks.every(b=>p.lines.filter(i=>b.includes(i)).length===1));
  return {fullSupport:S.fullSupport,supportedIndices:S.supportedIndices.slice(),k:3,degree:String(degree),weights:weights.map(String),blocks:blocks.map(b=>b.slice().sort((a,b)=>a-b)),basepoints,kind:isNet?'net':reduced?'reduced-multinet':'nonreduced-multinet',reduced,isNet,essential:true,connected:true,primitive:true,verified:true,source:SOURCES.definition,weightMethod:'Exact positive one-dimensional Cartan kernels; no multiplicity bound'};
}

export function verifyMultinetCertificate(data,certificate,options={}){
  try{
    const S=supportData(data,{support:options.support??certificate.supportedIndices}),candidate=analyzePartition(S,certificate.blocks);
    if(!candidate)return {valid:false,reason:'The partition does not satisfy all multinet axioms'};
    if(!Array.isArray(certificate.weights)||certificate.weights.length!==S.N)return {valid:false,reason:'Weight array must use original line indices including H∞'};
    const w=certificate.weights.map(x=>BigInt(x));if(S.supportedIndices.some(i=>w[i]<=0n)||w.some((x,i)=>!S.supportedIndices.includes(i)&&x!==0n))return {valid:false,reason:'Weights are not positive exactly on the declared support'};
    if(certificate.k!==undefined&&certificate.k!==3)return {valid:false,reason:'The certificate must declare3 classes'};
    const suppliedDegree=certificate.blocks[0].reduce((s,i)=>s+w[i],0n);
    if(certificate.degree!==undefined&&BigInt(certificate.degree)!==suppliedDegree)return {valid:false,reason:'Declared degree is not the sum of weights of a block'};
    // Arbitrary common scaling is allowed when verifying supplied weights.
    const first=S.supportedIndices[0],a=w[first],b=BigInt(candidate.weights[first]);
    if(S.supportedIndices.some(i=>w[i]*b!==BigInt(candidate.weights[i])*a))return {valid:false,reason:'Weights fail the unique positive kernel ratios'};
    return {valid:true,certificate:candidate};
  }catch(e){return {valid:false,reason:e.message};}
}

export function searchMultinets(data,options={}){
  const started=Date.now(),maxTimeMs=options.maxTimeMs===undefined?Infinity:Math.max(0,Number(options.maxTimeMs)||0);
  const S=supportData(data,options),n=S.supportedIndices.length,maxStates=Math.max(1,Math.min(10000000,Math.floor(options.maxStates??200000))),maxResults=Math.max(1,Math.min(1000,Math.floor(options.maxResults??25)));
  const linePos=new Map(S.supportedIndices.map((x,i)=>[x,i])),D=new DSU(n);
  // A point is either monochromatic or belongs to the base and meets ALL
  // three blocks. If its lines occupy at most2 currently forced atoms, those
  // atoms must coincide. Iterate this sound implication to closure.
  let merged=true;while(merged){merged=false;for(const p of S.points){const roots=[...new Set(p.lines.map(i=>D.find(linePos.get(i))))];if(roots.length===2)merged=D.join(roots[0],roots[1])||merged;}}
  const atomMap=new Map();S.supportedIndices.forEach((line,i)=>{const root=D.find(i);if(!atomMap.has(root))atomMap.set(root,[]);atomMap.get(root).push(line);});
  const atoms=[...atomMap.values()];
  const baseResult={fullSupport:S.fullSupport,supportedIndices:S.supportedIndices,scope:'Existence on exactly the declared projective support; proper subarrangements are not searched',nontrivial:true,k:3,excludedHigherK:{from:4,reason:'For |X|>1 complex multinets have k=3 or4; k=4 implies net, and real4-nets do not exist',source:SOURCES.realRestriction},atomicComponents:atoms,source:SOURCES,states:0,partitions:0,certificates:[],exhausted:true,limit:null};
  const trivialPoint=n>=3?S.points.find(p=>p.lines.length===n):null;
  if(trivialPoint)baseResult.trivialPencil={k:n,degree:'1',weights:Array.from({length:S.N},(_,i)=>S.supportedIndices.includes(i)?'1':'0'),blocks:S.supportedIndices.map(i=>[i]),basepoints:[trivialPoint],reason:'All supported lines are concurrent. The singleton (k,1)-net is trivial and is excluded from nontrivial results.'};
  function finish(reason){const nets=baseResult.certificates.filter(c=>c.isNet),multis=baseResult.certificates;
    const netCardinality=n%3!==0;
    baseResult.net={verdict:nets.length?'YES':netCardinality||baseResult.exhausted?'NO':'UNKNOWN',certificate:nets[0]??null,reason:nets.length?'Verified (3,d)-net certificate':netCardinality?'A nontrivial real net has k=3 and its support size must be divisible by3':baseResult.exhausted?reason??'All admissible partitions exhausted':'Partition search limit reached'};
    baseResult.multinet={verdict:multis.length?'YES':baseResult.exhausted?'NO':'UNKNOWN',certificate:multis[0]??null,reason:multis.length?'Verified positive integral multinet certificate; weights are unbounded':baseResult.exhausted?reason??'All admissible partitions exhausted with exact positive-kernel tests':'Partition search limit reached; no nonexistence claim'};
    baseResult.reducedMultinet={verdict:multis.some(c=>c.reduced)?'YES':netCardinality||baseResult.exhausted?'NO':'UNKNOWN',certificate:multis.find(c=>c.reduced)??null,reason:'Reduced means every line weight is1; a reduced multinet need not be a net'};
    return baseResult;
  }
  if(n<3)return finish('Fewer than3 supported lines cannot form3 nonempty classes');
  if(trivialPoint)return finish('Only the trivial singleton pencil can satisfy connectedness at a one-point base');
  if(atoms.length<3)return finish('Forced monochromatic closure has fewer than3 components');
  const freq=new Map(atoms.flat().map(i=>[i,0]));for(const p of S.points)for(const i of p.lines)freq.set(i,freq.get(i)+1);
  atoms.sort((a,b)=>b.reduce((s,i)=>s+freq.get(i),0)-a.reduce((s,i)=>s+freq.get(i),0)||a[0]-b[0]);
  const atomOf=new Map();atoms.forEach((atom,i)=>atom.forEach(line=>atomOf.set(line,i)));
  const pointAtoms=S.points.map(p=>[...new Set(p.lines.map(i=>atomOf.get(i)))]),byAtom=atoms.map(()=>[]);pointAtoms.forEach((a,p)=>a.forEach(i=>byAtom[i].push(p)));
  const color=Array(atoms.length).fill(-1);let aborted=null;
  function viable(pointIndex){const aa=pointAtoms[pointIndex],seen=new Set(),remaining=[];for(const i of aa)if(color[i]<0)remaining.push(i);else seen.add(color[i]);return seen.size!==2||remaining.length>0;}
  function visit(depth,maxColor){
    if(aborted)return;
    if(Date.now()-started>=maxTimeMs){aborted='time-limit';return;}
    if(baseResult.states>=maxStates){aborted='state-limit';return;}baseResult.states++;
    if(depth===atoms.length){if(maxColor!==2)return;baseResult.partitions++;const blocks=[[],[],[]];atoms.forEach((atom,i)=>blocks[color[i]].push(...atom));const cert=analyzePartition(S,blocks);if(cert){baseResult.certificates.push(cert);if(baseResult.certificates.length>=maxResults)aborted='result-limit';}return;}
    if(maxColor+(atoms.length-depth)<2)return;
    for(let c=0;c<=Math.min(2,maxColor+1);c++){color[depth]=c;if(byAtom[depth].every(viable))visit(depth+1,Math.max(maxColor,c));color[depth]=-1;if(aborted)return;}
  }
  visit(0,-1);baseResult.exhausted=!aborted;baseResult.limit=aborted;
  return finish();
}
