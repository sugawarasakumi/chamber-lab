// Exact magnitude and integral magnitude homology of real arrangement tope graphs.
// Koizumi, arXiv:2607.11863v1, Theorem 6.4, Corollary 6.6 and Proposition 6.9.
// A weak flag of proper faces contributes one Z-generator in bidegree
// (sum rank(A_F), sum |A_F|). In particular, all these groups are torsion-free.
import {facePoset} from './face-poset.js';

export const MAGNITUDE_SOURCE={
  author:'Junnosuke Koizumi',title:'Magnitude homology of tope graphs',
  url:'https://arxiv.org/abs/2607.11863',version:'v1 (2026-07-13)',
  theorem:'Theorem 6.4; Corollaries 6.5–6.6; Proposition 6.9',
  scope:'Finite real affine hyperplane arrangements, including central arrangements and arrangements with lineality.'
};
export const MAGNITUDE_LIMITS={maxK:64,maxL:128,maxFaces:5000,maxRank:3};
const dataCache=new WeakMap(),posetCache=new WeakMap();
const abs=x=>x<0n?-x:x;
const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b)[a,b]=[b,a%b];return a;};
const trim=p=>{while(p.length>1&&p[p.length-1]===0n)p.pop();return p;};
const isZero=p=>p.length===1&&p[0]===0n;
const pAdd=(a,b)=>trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||0n)+(b[i]||0n)));
const pScale=(p,c)=>trim(p.map(x=>x*c));
const pMul=(a,b)=>{const p=Array(a.length+b.length-1).fill(0n);a.forEach((x,i)=>b.forEach((y,j)=>{p[i+j]+=x*y;}));return trim(p);};
function primitive(p){p=trim(p.slice());if(isZero(p))return p;let c=0n;for(const x of p)c=gcd(c,x);if(p[p.length-1]<0n)c=-c;return p.map(x=>x/c);}
// Primitive pseudo-remainders compute gcd in Q[q] without floating point.
function pRemainder(a,b){let r=a.slice();while(!isZero(r)&&r.length>=b.length){const shift=r.length-b.length,lc=r[r.length-1],d=b[b.length-1];r=r.map(x=>x*d);for(let j=0;j<b.length;j++)r[j+shift]-=lc*b[j];r=primitive(r);}return r;}
function pGcd(a,b){a=primitive(a);b=primitive(b);while(!isZero(b))[a,b]=[b,pRemainder(a,b)];return primitive(a);}
function pDivide(a,b){let r=trim(a.slice());const out=Array(Math.max(1,a.length-b.length+1)).fill(0n);if(isZero(b))throw Error('Zero polynomial divisor');while(!isZero(r)&&r.length>=b.length){const d=r.length-b.length;if(r[r.length-1]%b[b.length-1])throw Error('Nonintegral exact polynomial division');const c=r[r.length-1]/b[b.length-1];out[d]+=c;for(let j=0;j<b.length;j++)r[d+j]-=c*b[j];trim(r);}if(!isZero(r))throw Error('Inexact polynomial division');return trim(out);}
function polyText(p,variable='q'){
  const terms=[];p.forEach((c,i)=>{if(!c)return;const power=i===0?'':i===1?variable:variable+'^'+i,coefficient=abs(c);let body=power?(coefficient===1n?'':coefficient.toString()+'·')+power:coefficient.toString();if(!terms.length)body=(c<0n?'-':'')+body;else body=(c<0n?' - ':' + ')+body;terms.push(body);});return terms.join('')||'0';
}
const monomial=(r,m)=>`${r===1?'u':'u^'+r}·${m===1?'q':'q^'+m}`;
const signatureKey=d=>d.map(([r,m])=>r+':'+m).join('|');
const readSignature=key=>key?key.split('|').map(x=>x.split(':').map(Number)):[];
const addCount=(map,key,n)=>map.set(key,(map.get(key)||0n)+n);
function bitSigns(covector){let positive=0n,negative=0n;covector.forEach((x,i)=>{const b=1n<<BigInt(i);if(x>0)positive|=b;else if(x<0)negative|=b;});return {positive,negative};}
const below=(a,b)=>(a.positive&b.positive)===a.positive&&(a.negative&b.negative)===a.negative;

function strictFlagTerms(poset){
  if(!poset||!Array.isArray(poset.faces)||!poset.faces.length)throw Error('Magnitude requires a nonempty arrangement face poset');
  if(poset.faces.length>MAGNITUDE_LIMITS.maxFaces)throw Error('Magnitude: face-poset resource limit exceeded');
  const length=poset.faces[0].covector.length,seen=new Set();
  const faces=poset.faces.map(face=>{
    const s=face.covector;if(!Array.isArray(s)||s.length!==length||s.some(x=>![-1,0,1].includes(x)))throw Error('Invalid face covector');
    const key=s.join(',');if(seen.has(key))throw Error('Repeated face covector');seen.add(key);
    const zeroCount=s.filter(x=>x===0).length,normalRank=face.normalRank??face.codimension;
    if(!Number.isInteger(normalRank)||normalRank<0||normalRank>zeroCount||(!zeroCount&&normalRank))throw Error('Faces must record the rank of their zero-set normals');
    if(zeroCount&&normalRank===0)throw Error('A proper arrangement face must have positive normal rank');
    return {...bitSigns(s),normalRank,zeroCount};
  });
  const rank=Math.max(...faces.map(f=>f.normalRank));if(rank>MAGNITUDE_LIMITS.maxRank)throw Error('Magnitude: supported arrangement rank is at most 3');
  const chambers=faces.filter(f=>!f.zeroCount),proper=faces.filter(f=>f.zeroCount).sort((a,b)=>a.normalRank-b.normalRank);
  if(!chambers.length)throw Error('Face poset contains no chambers');
  // Enumerate STRICT supports of face flags, not arbitrarily long weak flags.
  // Repetitions are summed by the factor x_F/(1-x_F), so this is all-degree exact.
  const totals=new Map([['',BigInt(chambers.length)]]);
  for(const chamber of chambers){
    const local=proper.filter(f=>below(f,chamber)),chains=[];
    local.forEach((face,i)=>{
      const suffix=face.normalRank+':'+face.zeroCount,current=new Map([[suffix,1n]]);
      for(let j=0;j<i;j++)if(local[j].normalRank<face.normalRank&&below(face,local[j])){
        for(const [key,count]of chains[j])addCount(current,key+'|'+suffix,count);
      }
      chains.push(current);for(const [key,count]of current)addCount(totals,key,count);
    });
  }
  const terms=[...totals].map(([key,count])=>({degrees:readSignature(key),count}));
  terms.sort((a,b)=>a.degrees.length-b.degrees.length||signatureKey(a.degrees).localeCompare(signatureKey(b.degrees)));
  return {terms,rank,vertexCount:chambers.length,edgeCount:faces.filter(f=>f.normalRank===1).length,faceCount:faces.length};
}

function rationalMagnitude(terms){
  const degrees=new Map();for(const term of terms)for(const d of term.degrees)degrees.set(d.join(':'),d);
  const factors=[...degrees].map(([key,[r,m]])=>{const p=Array(m+1).fill(0n);p[0]=1n;p[m]=r%2?1n:-1n;return {key,r,m,p};});
  let denominator=[1n];for(const {p}of factors)denominator=pMul(denominator,p);
  let numerator=[0n];
  for(const term of terms){
    let quotient=denominator.slice(),shift=0,coefficient=term.count;
    for(const [r,m]of term.degrees){const factor=factors.find(f=>f.key===r+':'+m);quotient=pDivide(quotient,factor.p);shift+=m;if(r%2)coefficient=-coefficient;}
    numerator=pAdd(numerator,[...Array(shift).fill(0n),...pScale(quotient,coefficient)]);
  }
  const divisor=pGcd(numerator,denominator);numerator=pDivide(numerator,divisor);denominator=pDivide(denominator,divisor);
  if(denominator[0]<0n){numerator=pScale(numerator,-1n);denominator=pScale(denominator,-1n);}
  if(denominator[0]!==1n)throw Error('Magnitude denominator normalization failed');
  return {numerator,denominator};
}
function rationalSeries(numerator,denominator,maxL){const out=Array(maxL+1).fill(0n);for(let l=0;l<=maxL;l++){let c=numerator[l]||0n;for(let j=1;j<denominator.length&&j<=l;j++)c-=denominator[j]*out[l-j];out[l]=c;}return out;}
function expansion(terms,maxK,maxL){
  const width=maxL+1,size=(maxK+1)*width,total=Array(size).fill(0n);
  for(const {degrees,count}of terms){
    let current=Array(size).fill(0n);current[0]=count;
    for(const [r,m]of degrees){
      const next=Array(size).fill(0n);
      for(let k=r;k<=maxK;k++)for(let l=m;l<=maxL;l++)next[k*width+l]=current[(k-r)*width+l-m]+next[(k-r)*width+l-m];
      current=next;
    }
    for(let i=0;i<size;i++)total[i]+=current[i];
  }
  return Array.from({length:maxK+1},(_,k)=>total.slice(k*width,(k+1)*width));
}
function boundedInteger(value,fallback,max,label){const n=value??fallback;if(!Number.isInteger(n)||n<0||n>max)throw Error(`${label} must be an integer from 0 through ${max}`);return n;}
function prepare(poset){if(posetCache.has(poset))return posetCache.get(poset);const base=strictFlagTerms(poset);base.rational=rationalMagnitude(base.terms);posetCache.set(poset,base);return base;}

/**
 * All-degree rational Hilbert series and exact integral groups in a finite display box.
 * Input must be the FULL face poset of a finite real arrangement (not an arbitrary
 * graph or an arbitrary poset). normalRank is codimension, not face dimension.
 * No chain truncation or rational-coefficient substitute is used for the Z-groups.
 */
export function magnitudeFromFacePoset(poset,options={}){
  const maxK=boundedInteger(options.maxK,10,MAGNITUDE_LIMITS.maxK,'maxK'),maxL=boundedInteger(options.maxL,20,MAGNITUDE_LIMITS.maxL,'maxL');
  const {terms,rank,vertexCount,edgeCount,faceCount,rational}=prepare(poset),betti=expansion(terms,maxK,maxL),groups=[];
  betti.forEach((row,k)=>row.forEach((n,l)=>{if(n)groups.push({k,l,rank:n.toString(),torsion:[]});}));
  const formula=terms.map(({degrees,count})=>{
    if(!degrees.length)return count.toString();
    return (count===1n?'':count.toString()+'·')+degrees.map(([r,m])=>{const x=monomial(r,m);return '('+x+')/(1 - '+x+')';}).join('·');
  }).join(' + ');
  const nt=polyText(rational.numerator),dt=polyText(rational.denominator);
  return {
    mode:options.mode??poset.mode??'affine',graph:{vertexCount,edgeCount},arrangementRank:rank,faceCount,
    source:MAGNITUDE_SOURCE,
    hilbert:{variables:['u','q'],uDegree:'homological degree k',qDegree:'length l',allDegrees:true,formula,terms:terms.map(t=>({count:t.count.toString(),degrees:t.degrees}))},
    homology:{coefficientRing:'Z',torsionFree:true,allDegrees:true,
      theoremAssumption:'Full face poset of a finite real affine hyperplane arrangement',
      range:{minK:0,maxK,minL:0,maxL},coefficients:betti.map(row=>row.map(n=>n.toString())),groups,
      outsideRange:'The table is restricted to the stated box; the exact Hilbert formula determines every bidegree. No group outside the box is asserted to vanish.'},
    magnitude:{variable:'q',exact:true,numerator:rational.numerator.map(String),denominator:rational.denominator.map(String),
      formula:rational.denominator.length===1?nt:'('+nt+') / ('+dt+')',
      series:rationalSeries(rational.numerator,rational.denominator,maxL).map(String),seriesThrough:maxL,
      convention:'Z(q)_{xy}=q^{d(x,y)}; Mag(G)=sum_{x,y} Z(q)^{-1}_{xy}; H(u,q)|_{u=-1}.'}
  };
}

/** Affine tope graph, or the central rank-at-most-3 cone with H_infinity. */
export function topeMagnitude(data,options={}){
  const mode=options.mode??'affine';if(!['affine','cone'].includes(mode))throw Error('mode must be affine or cone');
  let cached=dataCache.get(data);if(!cached){cached=new Map();dataCache.set(data,cached);}if(!cached.has(mode))cached.set(mode,facePoset(data,{mode}));
  return magnitudeFromFacePoset(cached.get(mode),{...options,mode});
}

/**
 * Independent generic graph computation, for verification / small custom graphs.
 * Uses the defining distance matrix and exact BigInt formal-series inversion.
 * This function does not claim any integral homology result for a generic graph.
 */
export function graphMagnitudeSeries(graph,maxL=20){
  maxL=boundedInteger(maxL,20,MAGNITUDE_LIMITS.maxL,'maxL');const n=graph.nodes.length;
  if(n>1024)throw Error('Distance-matrix verification is limited to 1024 vertices');if(!n)throw Error('The graph must have a vertex');
  const neighbors=Array.from({length:n},()=>[]);for(const e of graph.edges){const a=e.from,b=e.to;if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=n||b>=n||a===b)throw Error('Invalid graph edge');neighbors[a].push(b);neighbors[b].push(a);}
  const distances=Array.from({length:n},(_,start)=>{const d=Array(n).fill(-1),queue=[start];d[start]=0;for(let head=0;head<queue.length;head++){const a=queue[head];for(const b of neighbors[a])if(d[b]===-1){d[b]=d[a]+1;queue.push(b);}}if(d.some(x=>x<0))throw Error('The graph must be connected');return d;});
  const weights=[Array(n).fill(1n)],series=[BigInt(n)];
  for(let l=1;l<=maxL;l++){
    const w=Array(n).fill(0n);for(let a=0;a<n;a++)for(let b=0;b<n;b++){const d=distances[a][b];if(d>0&&d<=l)w[a]-=weights[l-d][b];}weights.push(w);series.push(w.reduce((s,x)=>s+x,0n));
  }
  return {series:series.map(String),through:maxL,vertexCount:n,diameter:Math.max(...distances.map(d=>Math.max(...d))),exact:true,method:'Exact formal inverse of Z(q)_{xy}=q^{d(x,y)}'};
}
