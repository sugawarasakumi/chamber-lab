// One-variable Alexander order for the affine total-linking map.
// phi(mu_i)=1 for finite lines, phi(mu_infinity)=-n.
// Exact arithmetic over Q[t]; return the primitive integral representative.
import {Q,Z,ONE,QQ,cyclotomic,cycloField,primeField,rref,gcd,arrangement,autoFlag,q} from './math.js';

class CoefficientGrowth extends Error {}
const HEIGHT_LIMIT=1n<<512n;
function controlled(p){
  if(p.length>257||p.some(c=>c.n>HEIGHT_LIMIT||c.n< -HEIGHT_LIMIT||c.d>HEIGHT_LIMIT))throw new CoefficientGrowth('Intermediate coefficient growth');
  return p;
}

const ZERO=()=>[Z],UNIT=()=>[ONE];
const iszero=p=>p.length===1&&p[0].n===0n;
const trim=p=>{while(p.length>1&&p[p.length-1].n===0n)p.pop();return p.length?p:ZERO();};
const degree=p=>iszero(p)?-1:p.length-1;
const valuation=p=>{if(iszero(p))return Infinity;let i=0;while(!p[i].n)i++;return i;};
const width=p=>degree(p)-valuation(p);
const scalar=(p,c)=>controlled(trim(p.map(x=>x.mul(c))));
const subtract=(a,b)=>controlled(trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||Z).sub(b[i]||Z))));
const multiply=(a,b)=>{if(iszero(a)||iszero(b))return ZERO();if(a.length+b.length>258)throw new CoefficientGrowth('Intermediate polynomial degree growth');const p=Array(a.length+b.length-1).fill(Z);a.forEach((x,i)=>{if(x.n)b.forEach((y,j)=>{if(y.n)p[i+j]=p[i+j].add(x.mul(y));});});return controlled(trim(p));};
const division=(a,b)=>{
  if(iszero(b))throw Error('Polynomial division by zero');
  const r=a.slice(),out=Array(Math.max(1,a.length-b.length+1)).fill(Z);
  trim(r);
  while(degree(r)>=degree(b)&&!iszero(r)){
    const k=r.length-b.length,c=r[r.length-1].div(b[b.length-1]);out[k]=out[k].add(c);
    for(let j=0;j<b.length;j++)if(b[j].n)r[k+j]=r[k+j].sub(c.mul(b[j]));
    controlled(trim(r));
  }
  return [trim(out),trim(r)];
};
const countBits=x=>{let n=0;while(x){x&=x-1;n++;}return n;};
const lcm=(a,b)=>a/gcd(a,b)*b;

// Constant rescalings are units over Q[t]. Keep each affected row integral
// and primitive to avoid unnecessary rational coefficient swell.
function normalizeRow(a,i,start){
  let power=Infinity;for(let j=start;j<a[i].length;j++)power=Math.min(power,valuation(a[i][j]));
  if(power>0&&power!==Infinity)for(let j=start;j<a[i].length;j++)if(!iszero(a[i][j]))a[i][j]=a[i][j].slice(power);
  let den=1n;for(let j=start;j<a[i].length;j++)for(const c of a[i][j])if(c.n)den=lcm(den,c.d);
  let content=0n;for(let j=start;j<a[i].length;j++)for(const c of a[i][j])if(c.n)content=gcd(content,c.n*(den/c.d));
  if(!content)return;
  if(den===1n&&content===1n)return;
  const factor=new Q(den,content);for(let j=start;j<a[i].length;j++)a[i][j]=scalar(a[i][j],factor);
}

function primitiveIntegral(p,stripT=true){
  p=trim(p.slice());if(iszero(p))return [0n];
  if(stripT)while(p.length>1&&p[0].n===0n)p.shift();
  let denominator=1n;for(const c of p)denominator=lcm(denominator,c.d);
  let a=p.map(c=>c.n*(denominator/c.d)),content=0n;for(const c of a)content=gcd(content,c);
  if(a[a.length-1]<0n)content=-content;
  return a.map(c=>c/content);
}
const ztrim=p=>{while(p.length>1&&p[p.length-1]===0n)p.pop();return p;};
const zmul=(a,b)=>{const out=Array(a.length+b.length-1).fill(0n);a.forEach((x,i)=>{if(x)b.forEach((y,j)=>{if(y)out[i+j]+=x*y;});});return ztrim(out);};
const zdivide=(a,b)=>{
  a=a.slice();const q=Array(Math.max(1,a.length-b.length+1)).fill(0n);
  if(b[b.length-1]!==1n)throw Error('Expected monic integral divisor');
  while(a.length>=b.length&&!(a.length===1&&a[0]===0n)){
    const k=a.length-b.length,c=a[a.length-1];q[k]+=c;for(let j=0;j<b.length;j++)a[k+j]-=c*b[j];ztrim(a);
  }
  return [ztrim(q),a];
};

// Euclidean diagonalization is enough: divisibility ordering of the diagonal
// entries is unnecessary for their product (the order/Fitting gcd).
function diagonalize(input){
  const a=input.map(row=>row.map(p=>p.slice())),rows=a.length,cols=a[0]?.length||0,pivots=[];
  let operations=0;
  for(let k=0;k<Math.min(rows,cols);k++){
    let choice=null;
    const rowCounts=Array(rows).fill(0),colCounts=Array(cols).fill(0);
    for(let i=k;i<rows;i++)for(let j=k;j<cols;j++)if(!iszero(a[i][j])){rowCounts[i]++;colCounts[j]++;}
    for(let i=k;i<rows;i++)for(let j=k;j<cols;j++)if(!iszero(a[i][j])){
      const w=width(a[i][j]),cost=(rowCounts[i]-1)*(colCounts[j]-1);
      if(!choice||w<choice.degree||w===choice.degree&&cost<choice.cost)choice={i,j,degree:w,cost};
    }
    if(!choice)break;
    [a[k],a[choice.i]]=[a[choice.i],a[k]];
    if(choice.j!==k)for(let i=0;i<rows;i++)[a[i][k],a[i][choice.j]]=[a[i][choice.j],a[i][k]];
    while(true){
      // t is a Laurent unit. Expose it before Euclidean elimination. Column
      // monomial shifts keep every matrix entry polynomial while allowing
      // division of the pivot row by the pivot's t-adic monomial factor.
      const power=valuation(a[k][k]);
      if(power>0){
        for(let j=k+1;j<cols;j++){const v=valuation(a[k][j]);if(v<power){const shift=Array(power-v).fill(Z);for(let i=k;i<rows;i++)if(!iszero(a[i][j]))a[i][j]=shift.concat(a[i][j]);}}
        for(let j=k;j<cols;j++)if(!iszero(a[k][j]))a[k][j]=a[k][j].slice(power);
      }
      const lead=a[k][k][a[k][k].length-1];
      if(!lead.eq(ONE)){const inverse=ONE.div(lead);for(let j=k;j<cols;j++)a[k][j]=scalar(a[k][j],inverse);}
      let restarted=false;
      for(let i=k+1;i<rows;i++){
        if(iszero(a[i][k]))continue;
        const [quotient,remainder]=division(a[i][k],a[k][k]);
        if(!iszero(quotient))for(let j=k;j<cols;j++)a[i][j]=subtract(a[i][j],multiply(quotient,a[k][j]));
        normalizeRow(a,i,k);
        if(++operations>20000)throw new CoefficientGrowth('Polynomial reduction budget');
        if(!iszero(remainder)){[a[i],a[k]]=[a[k],a[i]];restarted=true;break;}
      }
      if(restarted)continue;
      for(let j=k+1;j<cols;j++){
        if(iszero(a[k][j]))continue;
        const [quotient,remainder]=division(a[k][j],a[k][k]);
        if(!iszero(quotient))for(let i=k;i<rows;i++)a[i][j]=subtract(a[i][j],multiply(quotient,a[i][k]));
        if(++operations>20000)throw new CoefficientGrowth('Polynomial reduction budget');
        if(!iszero(remainder)){
          for(let i=0;i<rows;i++)[a[i][j],a[i][k]]=[a[i][k],a[i][j]];
          restarted=true;break;
        }
      }
      if(restarted)continue;
      break;
    }
    // Isolated pivot may contain t^a; t is a unit in Q[t,t^-1].
    pivots.push(primitiveIntegral(a[k][k]));
  }
  return {rank:pivots.length,pivots,operations};
}

const phiZ=d=>cyclotomic(d).map(c=>{if(c.d!==1n)throw Error('Nonintegral cyclotomic polynomial');return c.n;});
const phiCache=new Map();
function cachedPhi(d){if(!phiCache.has(d))phiCache.set(d,phiZ(d));return phiCache.get(d);}

function factorCyclotomic(p,initialBound){
  let remaining=p.slice();const factors=[];
  function attempt(d){const f=cachedPhi(d);if(f.length>remaining.length)return;let exponent=0;while(remaining.length>=f.length){const [quotient,remainder]=zdivide(remaining,f);if(remainder.some(x=>x!==0n))break;remaining=quotient;exponent++;}if(exponent)factors.push({order:d,exponent,coefficients:f});}
  for(let d=1;d<=initialBound&&remaining.length>1;d++)attempt(d);
  if(remaining.length>1){
    // For a root of unity of order d, phi(d)>=sqrt(d/2), so phi(d)<=D
    // implies d<=2D^2. This exhaustive fallback does not assume order<=n.
    const D=remaining.length-1,bound=Math.max(initialBound,2*D*D),totient=new Uint32Array(bound+1);
    for(let i=0;i<=bound;i++)totient[i]=i;
    for(let p=2;p<=bound;p++)if(totient[p]===p)for(let j=p;j<=bound;j+=p)totient[j]-=totient[j]/p;
    for(let d=initialBound+1;d<=bound&&remaining.length>1;d++)if(totient[d]<remaining.length)attempt(d);
  }
  return {factors,remaining};
}

export function integerPolynomialString(coefficients,variable='t'){
  const a=coefficients.map(BigInt),terms=[];
  for(let power=a.length-1;power>=0;power--){const c=a[power];if(!c)continue;const abs=c<0n?-c:c;let term=power===0?String(abs):(abs===1n?'':String(abs)+' ')+variable+(power>1?'^'+power:'');if(terms.length)term=(c<0n?' − ':' + ')+term;else if(c<0n)term='−'+term;terms.push(term);}
  return terms.join('')||'0';
}

function computeAlexander(data){
  if(!data.n)return {available:false,reason:'空配置には全メリディアンを 1 に送る Z への全射がありません。'};
  if(!data.verified)throw Error('Alexander 計算には計算可能な外側の flag が必要です');
  const n=data.n,m=n-1,columns=data.b2;
  // d0(t^-1)=(t^-1-1)(1,1+t^-1,...). Projection of its kernel
  // to the last n-1 coordinates is a Laurent-unimodular isomorphism.
  // Hence remove the first row of partial2=d1(t^-1)^T.
  const presentation=[];
  for(let j=1;j<n;j++){
    const entries=data.d1.map(row=>row[j]);
    const shift=Math.max(0,...entries.filter(e=>e.deg).map(e=>countBits(e.plus)));
    const row=entries.map(e=>{
      const length=countBits(e.sep);if(!e.deg||!length)return ZERO();
      const offset=shift-countBits(e.plus),p=Array(offset+length).fill(Z),coefficient=new Q(BigInt(-e.deg));
      for(let i=offset;i<offset+length;i++)p[i]=coefficient;
      return trim(p);
    });
    presentation.push(row);
  }
  const diagonal=diagonalize(presentation),freeRank=m-diagonal.rank;
  const accumulated=new Map();
  function addFactor(order,exponent){if(exponent)accumulated.set(order,(accumulated.get(order)||0)+exponent);}
  // Every original presentation entry contained t-1; multiplication of a
  // rank-r presentation matrix by t-1 adds one copy to each nonzero diagonal.
  addFactor(1,diagonal.rank);
  const residual=[];
  for(const pivot of diagonal.pivots){const r=factorCyclotomic(pivot,Math.max(2,n));for(const f of r.factors)addFactor(f.order,f.exponent);if(r.remaining.length>1)residual.push(r.remaining);}
  // For algebraic arrangement complements, isolated diagonal character roots
  // are roots of unity. Never label a residual factor irreducible by guess.
  return assemble(data,diagonal,accumulated,residual);
}

function assemble(data,diagonal,accumulated,residual=[]){
  const n=data.n,m=n-1,columns=data.b2,freeRank=m-diagonal.rank,complete=residual.length===0;
  let torsionOrder=[1n];const factors=[...accumulated.entries()].sort((a,b)=>a[0]-b[0]).map(([order,exponent])=>{
    const p=cachedPhi(order);for(let i=0;i<exponent;i++)torsionOrder=zmul(torsionOrder,p);
    return {order,exponent,coefficients:p.map(String),polynomial:integerPolynomialString(p)};
  });
  for(const p of residual)torsionOrder=zmul(torsionOrder,p);
  const factorized=factors.map(f=>(f.polynomial.includes(' ')?'('+f.polynomial+')':f.polynomial)+(f.exponent>1?'^'+f.exponent:'')).concat(residual.map(p=>'('+integerPolynomialString(p)+')')).join(' · ')||'1';
  return {available:true,exact:true,freeRank,torsion:freeRank===0,zero:freeRank>0,degree:freeRank?null:torsionOrder.length-1,coefficients:freeRank?['0']:torsionOrder.map(String),expanded:freeRank?'0':integerPolynomialString(torsionOrder),factorized:freeRank?'0':factorized,factors:freeRank?[]:factors,torsionFactors:factors,torsionOrder:torsionOrder.map(String),factorizationComplete:complete,residualFactors:residual.map(p=>p.map(String)),presentation:{rows:m,columns,rank:diagonal.rank,operations:diagonal.operations,diagonalAfterRemovingTMinusOne:diagonal.pivots.map(p=>p.map(String)),...(diagonal.certificate||{})},map:{finiteMeridians:1,infinityMeridian:-n},normalization:'Order over Q[t,t^-1], primitive integral representative with positive leading coefficient, modulo ±t^k. A positive Laurent-module rank gives Alexander polynomial 0.',convention:'Affine total-linking Alexander polynomial, distinct from the n+1-line Milnor-fiber monodromy polynomial.'};
}

function reducedPresentation(data){
  const result=[];for(let j=1;j<data.n;j++){
    const es=data.d1.map(row=>row[j]),shift=Math.max(0,...es.filter(e=>e.deg).map(e=>countBits(e.plus)));
    result.push(es.map(e=>{const length=countBits(e.sep);if(!e.deg||!length)return ZERO();const offset=shift-countBits(e.plus),p=Array(offset+length).fill(Z);for(let k=offset;k<offset+length;k++)p[k]=new Q(BigInt(-e.deg));return p;}));
  }return result;
}
const evaluatePolynomial=(p,F,z)=>{let v=F.zero;for(let i=p.length-1;i>=0;i--)v=F.add(F.mul(v,z),F.from(p[i]));return v;};
const evaluatedRank=(matrix,F,z)=>rref(matrix.map(row=>row.map(p=>evaluatePolynomial(p,F,z))),F,matrix[0]?.length||0).rank;
const prime=n=>{for(let p=2;p*p<=n;p++)if(n%p===0)return false;return n>=2;};
const powmod=(a,k,p)=>{let r=1;while(k){if(k&1)r=r*a%p;a=a*a%p;k=Math.floor(k/2);}return r;};
function rootModulo(d,p){const divisors=[];let n=d;for(let q=2;q*q<=n;q++)if(n%q===0){divisors.push(q);while(n%q===0)n/=q;}if(n>1)divisors.push(n);for(let a=2;a<p;a++){const z=powmod(a,(p-1)/d,p);if(divisors.every(q=>powmod(z,d/q,p)!==1))return z;}throw Error('No primitive modular root');}
function modularFields(d,n){const fields=[];for(let p=Math.max(31,n+1);p<=997&&fields.length<3;p++)if((p-1)%d===0&&prime(p))fields.push({F:primeField(p),p,z:rootModulo(d,p)});return fields;}

// Exact truncated local-series elimination. If complete=false, value is the
// lower bound sum_i min(a_i,L); if complete=true it is the exact local order.
function localOrder(matrix,F,z,L){
  const cache=new Map();let a=matrix.map(row=>row.map(p=>{
    const key=p.map(String).join(',');if(cache.has(key))return cache.get(key).slice();const series=Array(L).fill(F.zero);
    for(let i=p.length-1;i>=0;i--){for(let k=L-1;k>=0;k--)series[k]=F.add(F.mul(series[k],z),k?series[k-1]:F.zero);series[0]=F.add(series[0],F.from(p[i]));}
    cache.set(key,series);return series.slice();
  })),precision=L,value=0;
  const mul=(p,q)=>{const r=Array(precision).fill(F.zero);for(let i=0;i<precision;i++)if(!F.is0(p[i]))for(let j=0;j+i<precision;j++)if(!F.is0(q[j]))r[i+j]=F.add(r[i+j],F.mul(p[i],q[j]));return r;};
  const inv=p=>{const r=Array(precision).fill(F.zero);r[0]=F.inv(p[0]);for(let i=1;i<precision;i++){let s=F.zero;for(let j=1;j<=i;j++)s=F.add(s,F.mul(p[j],r[i-j]));r[i]=F.neg(F.mul(r[0],s));}return r;};
  while(a.length&&precision){
    const rows=a.length,cols=a[0].length;let k=0;
    while(k<rows&&k<cols){let pivot=null;for(let i=k;i<rows&&!pivot;i++)for(let j=k;j<cols;j++)if(!F.is0(a[i][j][0])){pivot=[i,j];break;}if(!pivot)break;
      [a[k],a[pivot[0]]]=[a[pivot[0]],a[k]];if(pivot[1]!==k)for(let i=0;i<rows;i++)[a[i][k],a[i][pivot[1]]]=[a[i][pivot[1]],a[i][k]];
      const unit=inv(a[k][k]);for(let j=k;j<cols;j++)a[k][j]=mul(a[k][j],unit);
      for(let i=k+1;i<rows;i++){const factor=a[i][k];if(factor.every(F.is0))continue;for(let j=k;j<cols;j++){const product=mul(factor,a[k][j]);a[i][j]=a[i][j].map((v,r)=>F.sub(v,product[r]));}}
      k++;
    }
    if(k===rows)return {complete:true,value};
    a=a.slice(k).map(row=>row.slice(k));value+=a.length;precision--;
    for(const row of a)for(let j=0;j<row.length;j++){if(!F.is0(row[j][0]))throw Error('Local elimination consistency error');row[j]=row[j].slice(1);}
  }
  return {complete:!a.length,value};
}

function certifiedCyclotomic(data){
  const n=data.n,m=n-1;if(!m)return null;
  const groups=new Map();for(const l of data.lines){const key=l.slice(0,2).join(',');groups.set(key,(groups.get(key)||0)+1);}
  if([...groups.values()].some(r=>r===n))return null; // parallel case is exact and trivial in the ordinary presentation
  const matrix=reducedPresentation(data),atOne=evaluatedRank(matrix,QQ,ONE);if(atOne!==m)return null;
  // CDO nonresonance along H_infinity: only t^n=1 or t^(n-r)=1,
  // for a parallel class of r>=2 lines, can support an Alexander root.
  const exponents=[n,...[...groups.values()].filter(r=>r>=2).map(r=>n-r)],orders=[];
  for(let d=2;d<=n;d++)if(exponents.some(e=>e%d===0))orders.push(d);
  const accumulated=new Map([[1,m]]),certificates=[];
  for(const d of orders){
    const fields=modularFields(d,n);let done=false;
    for(const f of fields){const rank=evaluatedRank(matrix,f.F,f.z);if(rank===m){certificates.push({order:d,exponent:0,prime:f.p,root:f.z,fullModularRank:rank});done=true;break;}}
    if(done)continue;
    const K=cycloField(d),z=K.root(1),h=m-evaluatedRank(matrix,K,z);
    if(!h){certificates.push({order:d,exponent:0,charZeroRank:m});continue;}
    for(const f of fields){
      for(const L of [2,4,8]){
        const upper=localOrder(matrix,f.F,f.z,L);if(!upper.complete)continue;
        if(upper.value===h){accumulated.set(d,h);certificates.push({order:d,exponent:h,prime:f.p,root:f.z,precision:L,charZeroNullity:h,modularUpper:upper.value});done=true;break;}
        for(const depth of [2,4,8]){const lower=localOrder(matrix,K,z,depth);if(lower.complete||lower.value===upper.value){accumulated.set(d,lower.value);certificates.push({order:d,exponent:lower.value,prime:f.p,root:f.z,precision:L,charZeroPrecision:depth,charZeroLower:lower.value,modularUpper:upper.value,charZeroComplete:lower.complete});done=true;break;}}
        if(done)break;
      }if(done)break;
    }
    if(!done)return null;
  }
  return assemble(data,{rank:m,pivots:[],operations:0,certificate:{method:'certified cyclotomic local orders',rootSupportExponents:exponents,rootSupportSource:'Yoshinaga arXiv:1002.2038, Theorem 1.5 (Cohen–Dimca–Orlik)',atOneReducedRank:atOne,localCertificates:certificates}},accumulated);
}

export function alexander(data,options={}){
  if(!data.n)return computeAlexander(data);
  if(!data.verified)throw Error('Alexander 計算には計算可能な外側の flag が必要です');
  if(options.method==='certificate'){
    const result=certifiedCyclotomic(data);
    if(result)return result;
    throw Error('The local-order certificate did not finish');
  }
  if(data.n>=10){const result=certifiedCyclotomic(data);if(result){result.presentation.attempts=1;result.presentation.usedFlag=data.flag.map(String);return result;}}
  let attempts=0;
  const attempt=model=>{attempts++;const result=computeAlexander(model);if(result.presentation){result.presentation.attempts=attempts;result.presentation.usedFlag=model.flag.map(String);}return result;};
  try{return attempt(data);}catch(e){if(!(e instanceof CoefficientGrowth))throw e;}
  const certificate=certifiedCyclotomic(data);if(certificate){certificate.presentation.attempts=attempts;certificate.presentation.usedFlag=data.flag.map(String);return certificate;}
  // The order is independent of the adapted flag. If a presentation causes
  // coefficient swell, choose another exact chamber presentation rather than
  // reducing precision or silently replacing the invariant by sampled ranks.
  for(const slope of ['3/7','5/11','7/13','11/17','-2/5','-3/7','13/19','17/23','19/29']){
    try{const flag=autoFlag(data.lines,[ONE,q(slope)]);if(flag.every((x,i)=>x.eq(data.flag[i])))continue;return attempt(arrangement(data.lines,flag));}
    catch(e){if(e instanceof CoefficientGrowth)continue;if(/平行/.test(e.message))continue;throw e;}
  }
  throw Error('正確な多項式消去で係数が増大しました。別の flag を選んで再計算するか、SageMath に書き出してください。');
}

export function alexanderSage(data){
  if(!data.n)throw Error('まず直線を加えてください');
  const term=e=>{if(!e.deg)return '0';return e.deg+'*(t^('+(-countBits(e.plus))+')-t^('+countBits(e.minus)+'))';};
  const rows=Array.from({length:data.n-1},(_,j)=>data.d1.map(row=>term(row[j+1])));
  return `# Affine Alexander module: phi(mu_i)=1, phi(mu_infinity)=-${data.n}\n# Lines: ${JSON.stringify(data.lines)}\nR.<t> = LaurentPolynomialRing(QQ)\nB = matrix(R, ${data.n-1}, ${data.b2}, [${rows.flat().join(', ')}])\n# Delete first row of partial2=d1(t^-1)^T to identify ker(partial1).\nS = B.smith_form(transformation=False)\nr = B.rank()\nprint('free Laurent rank =', ${data.n-1}-r)\nif r < ${data.n-1}:\n    print('Alexander polynomial = 0')\nelse:\n    delta = prod(S[i,i] for i in range(r))\n    print('Order up to a Laurent unit =', delta)\n    print('Factorization =', factor(delta))\n`;
}
