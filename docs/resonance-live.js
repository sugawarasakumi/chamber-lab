// Live R^1_1 over C for real line arrangements. Falk--Yuzvinsky identifies
// nonlocal components with connected multinets on projective subarrangements.
// A real multinet with more than one basepoint has exactly three classes.
// Local components (including parallel classes at infinity) are added directly.
import {q,QQ,Z,ONE,rref,nullspace} from './math.js';
import {searchMultinets} from './multinets.js';

export const LIVE_RESONANCE_SOURCES={
  multinet:'https://arxiv.org/abs/math/0603166',
  realRestriction:'https://www.journalofsing.org/volume11/torielli-yoshinaga.pdf'
};

const abs=x=>x<0n?-x:x;
const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a;};
const lcm=(a,b)=>a/gcd(a,b)*b;
const dot=(a,b)=>a.reduce((sum,x,i)=>sum.add(x.mul(b[i])),Z);
const sum=a=>a.reduce((s,x)=>s.add(x),Z);
const nonnegative=(value,fallback)=>value===undefined?fallback:Math.max(0,Number.isFinite(Number(value))?Number(value):fallback);

function projectiveFlats(data){
  const groups=new Map();
  data.lines.forEach((line,i)=>{
    const key=line.slice(0,2).join(',');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(i);
  });
  const flats=[...data.vertices.map(v=>v.lines.slice()),...[...groups.values()].map(g=>[...g,data.n])];
  const pairs=flats.reduce((n,flat)=>n+flat.length*(flat.length-1)/2,0);
  if(pairs!==data.n*(data.n+1)/2)throw Error('射影交点の全直線対の検算が一致しません');
  return flats;
}

function integerRow(row){
  const denominator=row.reduce((d,x)=>lcm(d,x.d),1n);
  const values=row.map(x=>x.n*(denominator/x.d)),content=values.reduce(gcd,0n);
  const sign=values.find(x=>x!==0n)<0n?-1n:1n;
  return values.map(x=>x/(content*sign));
}

function equation(row){
  const terms=[];
  integerRow(row).forEach((x,i)=>{
    if(!x)return;
    const monomial=(abs(x)===1n?'':String(abs(x))+'*')+'a'+(i+1);
    terms.push((terms.length?(x<0n?' - ':' + '):x<0n?'-':'')+monomial);
  });
  return terms.join('');
}

// This independently checks the degree-two Orlik--Solomon product. For every
// rank-two flat X, u wedge v vanishes iff u_i sum_X(v)-v_i sum_X(u)=0 for i in X.
function verifyIsotropy(basis,flats){
  const projective=basis.map(v=>[...v,sum(v).neg()]);
  for(let a=0;a<projective.length;a++)for(let b=0;b<a;b++){
    const u=projective[a],v=projective[b];
    for(const flat of flats){
      const su=sum(flat.map(i=>u[i])),sv=sum(flat.map(i=>v[i]));
      if(flat.some(i=>u[i].mul(sv).sub(v[i].mul(su)).n!==0n))return false;
    }
  }
  return true;
}

function linearSpace(equations,n,flats,evidence){
  const reduced=rref(equations,QQ,n),rows=reduced.a.slice(0,reduced.rank),basis=nullspace(rows,QQ,n);
  if(!verifyIsotropy(basis,flats))throw Error('resonance の Orlik–Solomon 積の検算が一致しません');
  return {
    key:JSON.stringify(rows.map(row=>row.map(String))),
    generators:rows.map(equation),linearEquations:rows.map(row=>row.map(String)),
    parameterBasis:basis.map(row=>row.map(String)),dimension:basis.length,
    absolutePrime:true,isotropyVerified:true,
    irreducibilityCertificate:'Independent homogeneous rational linear equations; their quotient is a polynomial ring over C.',
    evidence,_equations:rows,_basis:basis
  };
}

function contained(a,b){return b._equations.every(row=>a._basis.every(v=>dot(row,v).n===0n));}

export function computeLiveResonance(data,options={}){
  if(!data.verified)throw Error('普遍複体の検証を通過する flag を使ってください');
  const start=Date.now(),n=data.n,N=n+1,flats=projectiveFlats(data),found=new Map();
  const limits={
    maxTimeMs:nonnegative(options.maxTimeMs,2000),
    maxStates:Math.floor(nonnegative(options.maxStates,100000)),
    maxSupports:Math.floor(nonnegative(options.maxSupports,8192)),
    maxLines:Math.floor(nonnegative(options.maxLines,12))
  };
  const statistics={supportsExamined:0,totalSupports:2**N-1-N-N*(N-1)/2,states:0,partitions:0,multinets:0,localFlats:0,milliseconds:0,limits};
  let complete=true,reason=null;
  const add=component=>{if(!found.has(component.key))found.set(component.key,component);};
  const identity=()=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?ONE:Z));

  // a_infinity=-sum(a_i). If X contains infinity its zero-sum condition follows
  // from the equations off X; otherwise add sum_{i in X} a_i=0 explicitly.
  for(const flat of flats){
    if(flat.length<3)continue;
    const equations=identity().filter((_,i)=>!flat.includes(i));
    if(!flat.includes(n))equations.push(Array.from({length:n},(_,i)=>flat.includes(i)?ONE:Z));
    add(linearSpace(equations,n,flats,{kind:'local-flat',flat:flat.slice(),multiplicity:flat.length}));
    statistics.localFlats++;
  }

  const stop=message=>{complete=false;reason=message;};
  if(n>limits.maxLines)stop('ライブ計算の直線数上限に達しました。局所成分だけを検証しました。');
  for(let mask=0;complete&&mask<2**N;mask++){
    const support=Array.from({length:N},(_,i)=>i).filter(i=>mask&2**i);
    if(support.length<3)continue;
    if(statistics.supportsExamined>=limits.maxSupports){stop('射影部分配置の個数上限に達しました。全 support は調べていません。');break;}
    if(statistics.states>=limits.maxStates){stop('multinet 探索の状態数上限に達しました。全 support は調べていません。');break;}
    const remainingTime=limits.maxTimeMs-(Date.now()-start);
    if(remainingTime<=0){stop('時間上限に達しました。全 support の探索は未完了です。');break;}
    const result=searchMultinets(data,{support,maxStates:limits.maxStates-statistics.states,maxTimeMs:remainingTime,maxResults:1000});
    statistics.supportsExamined++;statistics.states+=result.states;statistics.partitions+=result.partitions;
    for(const certificate of result.certificates){
      statistics.multinets++;
      const parameters=Array.from({length:n},()=>[Z,Z]);
      certificate.blocks.forEach((block,b)=>block.forEach(i=>{
        if(i<n){const w=q(certificate.weights[i]);parameters[i]=b===0?[w,Z]:b===1?[Z,w]:[w.neg(),w.neg()];}
      }));
      const transpose=[parameters.map(row=>row[0]),parameters.map(row=>row[1])],equations=nullspace(transpose,QQ,n);
      add(linearSpace(equations,n,flats,{kind:'multinet',certificate}));
    }
    if(!result.exhausted)stop(result.limit==='time-limit'?'時間上限に達しました。ある support の multinet 探索が未完了です。':'ある support の multinet 探索が処理上限に達しました。全分解は未確定です。');
    else if(Date.now()-start>limits.maxTimeMs)stop('時間上限に達しました。全 support の探索は未完了です。');
  }

  // Every nonzero point of a component of dimension >=2 is resonant. With no
  // positive-dimensional component, 0 remains resonant exactly when n>=1.
  if(!found.size&&n>0)add(linearSpace(identity(),n,flats,{kind:'origin'}));
  const candidates=[...found.values()],maximal=candidates.filter((a,i)=>!candidates.some((b,j)=>i!==j&&contained(a,b)));
  const components=maximal.map(({key,_equations,_basis,...component})=>({...component,maximalityClaimed:complete}));
  statistics.milliseconds=Date.now()-start;
  return {components,complete,reason,statistics,sources:LIVE_RESONANCE_SOURCES,
    verification:complete?
      'Exhausted every projective support, with exact connected positive multinet tests; real multinets have three classes. Added every projective multiple-point component, checked all component basis products in the Orlik–Solomon algebra, and removed duplicate/contained linear spaces. Completeness uses the Falk–Yuzvinsky correspondence over C.':
      'Displayed linear spaces pass exact Orlik–Solomon isotropy checks. Search limits prevent a claim that all components have been found.'};
}
