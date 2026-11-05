// Exact families in degree-one cohomology jump loci arising from a verified
// 3-multinet on a declared projective subarrangement.
// Falk–Yuzvinsky, arXiv:math/0603166, Theorems 2.4 and 3.11;
// Denham–Suciu, arXiv:1209.3414, Sections 5.4–5.5, Proposition 5.6.
// A family supplied here is not an enumeration of the full jumping variety.
import {q,Z,ONE,QQ,cycloField,evaluate,arrangement} from './math.js';
import {verifyMultinetCertificate} from './multinets.js';

export const NET_JUMPING_SOURCES={
  resonance:'https://arxiv.org/abs/math/0603166',
  pencil:'https://arxiv.org/abs/1209.3414',
  pointed:'https://arxiv.org/abs/1209.3414',
  pointedNotExhaustive:'https://arxiv.org/abs/2409.04032'
};
const abs=x=>x<0n?-x:x;
const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a;};
const lcm=(a,b)=>!a||!b?0n:a/gcd(a,b)*b;
const mod=(a,b)=>((a%b)+b)%b;
const integers=a=>a.map(row=>row.map(x=>{const s=String(x);if(!/^[+-]?\d+$/.test(s))throw Error('パラメータ行列は整数係数にしてください');return BigInt(s);}));
const strings=a=>a.map(row=>row.map(String));
const geometryKey=data=>JSON.stringify(data.lines.map(l=>l.map(String)));
const lineName=(i,n)=>i===n?'H∞':'H'+(i+1);
const intArg=(x,label)=>{if(!/^[+-]?\d+$/.test(String(x)))throw Error(label+' は整数にしてください');return BigInt(x);};

// Unimodular column operations on P^T diagonalize its at most two rows.
// The zero columns of the transformed matrix give a Z-basis of ker_Z(P^T).
// Thus these equations are saturated; clearing denominators in a rational
// nullspace separately would not, in general, give the full relation lattice.
export function torusImageLattice(parameterMatrix){
  if(!Array.isArray(parameterMatrix)||!parameterMatrix.length)throw Error('パラメータ行列に座標が必要です');
  const P=integers(parameterMatrix),m=P.length,k=P[0].length;
  if(k<1||k>2||P.some(row=>row.length!==k))throw Error('パラメータは 1 または 2 個に対応しています');
  const a=Array.from({length:k},(_,i)=>P.map(row=>row[i]));
  const V=Array.from({length:m},(_,i)=>Array.from({length:m},(_,j)=>i===j?1n:0n));
  const swapCols=(i,j)=>{for(const row of a)[row[i],row[j]]=[row[j],row[i]];for(const row of V)[row[i],row[j]]=[row[j],row[i]];};
  const addCol=(target,source,c)=>{for(const row of a)row[target]+=c*row[source];for(const row of V)row[target]+=c*row[source];};
  let rank=0;
  for(let r=0;r<Math.min(k,m);r++){
    let p=null;for(let i=r;i<k;i++)for(let j=r;j<m;j++)if(a[i][j]!==0n&&(!p||abs(a[i][j])<abs(a[p[0]][p[1]])))p=[i,j];
    if(!p)break;
    [a[r],a[p[0]]]=[a[p[0]],a[r]];swapCols(r,p[1]);
    for(;;){
      let changed=false;
      for(let i=r+1;i<k;i++)if(a[i][r]!==0n){const c=a[i][r]/a[r][r];for(let j=0;j<m;j++)a[i][j]-=c*a[r][j];if(a[i][r]!==0n)[a[r],a[i]]=[a[i],a[r]];changed=true;break;}
      if(changed)continue;
      for(let j=r+1;j<m;j++)if(a[r][j]!==0n){const c=a[r][j]/a[r][r];addCol(j,r,-c);if(a[r][j]!==0n)swapCols(j,r);changed=true;break;}
      if(!changed)break;
    }
    if(a[r][r]<0n)a[r]=a[r].map(x=>-x);
    rank++;
  }
  const relations=Array.from({length:m-rank},(_,j)=>V.map(row=>row[rank+j]));
  for(const row of relations)for(let j=0;j<k;j++)if(row.reduce((s,x,i)=>s+x*P[i][j],0n)!==0n)throw Error('整数 character 格子の検算が一致しません');
  let divisor1=0n;for(const row of P)for(const x of row)divisor1=gcd(divisor1,x);
  let divisor2=0n;if(k===2)for(let i=0;i<m;i++)for(let j=0;j<i;j++)divisor2=gcd(divisor2,P[i][0]*P[j][1]-P[i][1]*P[j][0]);
  const invariantFactors=rank===2?[divisor1,divisor2/divisor1]:rank===1?[divisor1]:[];
  const finite=rank===k,order=finite?invariantFactors.reduce((s,x)=>s*x,1n):null;
  return {parameterDimension:k,dimension:rank,coordinateCount:m,relations:strings(relations),saturated:true,
    parameterKernel:{finite,dimension:k-rank,order:order===null?null:String(order),invariantFactors:invariantFactors.map(String)},
    verification:'Integral kernel basis obtained by unimodular column operations; every relation annihilates the parameter matrix.'};
}

const linearExpression=(row,names)=>{
  const terms=[];row.forEach((raw,i)=>{const x=BigInt(raw);if(!x)return;const term=(abs(x)===1n?'':String(abs(x))+' ')+names[i];terms.push((terms.length?(x<0n?' − ':' + '):x<0n?'−':'')+term);});return terms.join('')||'0';
};
const monomial=(row,names)=>row.flatMap((raw,i)=>{const x=BigInt(raw);return x===0n?[]:[names[i]+(x===1n?'':'^('+x+')')];}).join(' · ')||'1';
const relationEquations=(relations,names,kind,rhs)=>relations.map((coefficients,i)=>({coefficients:coefficients.slice(),rhs:rhs?.[i]??(kind==='linear'?'0':'1'),
  expression:(kind==='linear'?linearExpression(coefficients,names):monomial(coefficients,names))+' = '+(rhs?.[i]??(kind==='linear'?'0':'1'))}));

function checkedCertificate(data,certificate){
  const verified=verifyMultinetCertificate(data,certificate);
  if(!verified.valid)throw Error('検証済みの multinet が必要です: '+verified.reason);
  const canonical=verified.certificate,weights=certificate.weights.map(x=>BigInt(x)),blocks=certificate.blocks.map(b=>b.slice()),support=canonical.supportedIndices.slice();
  const degree=blocks[0].reduce((s,i)=>s+weights[i],0n),scale=support.map(i=>weights[i]).reduce(gcd,0n);
  return {canonical,weights,blocks,support,degree,scale};
}
function checkFamilyData(data,family,kind='multinet-jumping'){
  if(family?.kind!==kind||family.geometryKey!==geometryKey(data))throw Error('この family は現在の配置に対応していません。構造を再計算してください');
}
const summary=r=>({h:r.h.slice(),r0:r.r0,r1:r.r1,field:r.F.name,exact:true});
const pow=(F,x,k)=>{k=BigInt(k);if(k<0n){x=F.inv(x);k=-k;}let y=F.one;while(k){if(k&1n)y=F.mul(y,x);x=F.mul(x,x);k>>=1n;}return y;};
const dotInteger=(a,b)=>a.reduce((s,x,i)=>s+BigInt(x)*BigInt(b[i]),0n);

export function multinetJumping(data,certificate){
  const {canonical,weights,blocks,support,degree,scale}=checkedCertificate(data,certificate),N=data.n+1;
  const rowBlocks=Array(N).fill(-1);blocks.forEach((block,b)=>block.forEach(i=>rowBlocks[i]=b));
  const projectiveMatrix=weights.map((w,i)=>rowBlocks[i]===0?[w,0n]:rowBlocks[i]===1?[0n,w]:rowBlocks[i]===2?[-w,-w]:[0n,0n]);
  for(let j=0;j<2;j++)if(projectiveMatrix.reduce((s,row)=>s+row[j],0n)!==0n)throw Error('射影重みの和の検算が一致しません');
  const affineMatrix=strings(projectiveMatrix.slice(0,data.n)),projective=strings(projectiveMatrix);
  const affineLattice=torusImageLattice(affineMatrix),projectiveLattice=torusImageLattice(projective);
  if(affineLattice.dimension!==2||projectiveLattice.dimension!==2||affineLattice.parameterKernel.order!==projectiveLattice.parameterKernel.order)throw Error('projective / affine パラメータの検算が一致しません');
  const finiteA=Array.from({length:data.n},(_,i)=>'a'+(i+1)),finiteT=Array.from({length:data.n},(_,i)=>'t'+(i+1));
  const projectiveA=[...finiteA,'a∞'],projectiveT=[...finiteT,'t∞'];
  const coordinateRows=projective.map((coefficients,i)=>({index:i,line:lineName(i,data.n),block:rowBlocks[i],weight:String(weights[i]),coefficients,
    additive:linearExpression(coefficients,['u','v']),multiplicative:monomial(coefficients,['z1','z2'])}));
  const canonicalWeights=canonical.weights.map(BigInt);
  const pointedLines=canonical.supportedIndices.filter(i=>canonicalWeights[i]>1n&&canonical.basepoints.filter(p=>p.lines.includes(i)).every(p=>BigInt(p.weight)%canonicalWeights[i]===0n)).map(i=>({
    index:i,line:lineName(i,data.n),multiplicity:canonical.weights[i],basepointIds:canonical.basepoints.filter(p=>p.lines.includes(i)).map(p=>p.id),
    deletionHasTranslatedFamily:true,sameAffineChart:i!==data.n,source:NET_JUMPING_SOURCES.pointed}));
  return {kind:'multinet-jumping',verified:true,geometryKey:geometryKey(data),n:data.n,N,k:3,dimension:2,degree:String(degree),weights:weights.map(String),blocks,
    supportedIndices:support,fullSupport:support.length===N,rowBlocks,coordinateRows,primitive:scale===1n,commonWeightScale:String(scale),
    guaranteedDepth:1,genericDepthLowerBound:1,completeDecomposition:false,maximalityClaimed:false,
    scope:'These are certified families in R¹₁ and V¹₁ over C, pulled back from the declared support. They are not the full jumping varieties or an exhaustive list of components or depths.',
    resonance:{dimension:2,parameters:['u','v'],classParameters:['u','v','-u-v'],projectiveMatrix:projective,affineMatrix,
      affineEquations:relationEquations(affineLattice.relations,finiteA,'linear'),projectiveEquations:relationEquations(projectiveLattice.relations,projectiveA,'linear'),
      formula:'a_i=m_i u_b for i in block b; u_1+u_2+u_3=0; a_i=0 off support',infinity:'a∞ = −Σ a_i',source:NET_JUMPING_SOURCES.resonance},
    characteristic:{dimension:2,parameters:['z1','z2'],classParameters:['z1','z2','(z1*z2)^(-1)'],projectiveMatrix:projective,affineMatrix,
      relations:affineLattice.relations,projectiveRelations:projectiveLattice.relations,latticeSaturated:true,
      affineEquations:relationEquations(affineLattice.relations,finiteT,'multiplicative'),projectiveEquations:relationEquations(projectiveLattice.relations,projectiveT,'multiplicative'),
      parameterKernel:affineLattice.parameterKernel,blockWeightGcds:blocks.map(block=>String(block.map(i=>weights[i]).reduce(gcd,0n))),
      formula:'t_i=z_b^(m_i) for i in block b; z_1 z_2 z_3=1; t_i=1 off support',infinity:'t∞ = (∏ t_i)^(-1)',
      tangentCorrespondence:'The exponential map sends the displayed resonance space onto this connected character subtorus; its tangent space at 1 is the resonance space.',source:NET_JUMPING_SOURCES.pencil},
    pointedLines,
    limitations:[
      'The depth bound is at least k−2=1, not a claim of exact depth at every point. Special points can have larger H¹.',
      'Selected-support pullback sets additive coordinates to 0 and multiplicative coordinates to 1 outside that support.',
      'A finite kernel of the monomial parameterization is retained explicitly. The saturated relation lattice defines its connected image without extra components.',
      'Multinet nonexistence on this support does not exclude local components, other supports, isolated torsion points, or translated components.',
      'Pointed multinets give one source of translated components after deletion. Liu–Xie’s double-star example shows that this source is not exhaustive.'
    ],sources:NET_JUMPING_SOURCES};
}

export function specializeResonance(data,family,u=1,v=2){
  checkFamilyData(data,family);u=QQ.from(u);v=QQ.from(v);const classParameters=[u,v,u.add(v).neg()];
  const projectiveValues=family.resonance.projectiveMatrix.map(row=>q(row[0]).mul(u).add(q(row[1]).mul(v)));
  if(projectiveValues.reduce((s,x)=>s.add(x),Z).n!==0n)throw Error('射影 Aomoto 重みの和が 0 ではありません');
  const values=projectiveValues.slice(0,data.n),r=evaluate(data,QQ,values,'aomoto'),cohomology=summary(r),affineWeights=values.map(String);
  return {kind:'resonance-specialization',exact:true,classParameters:classParameters.map(String),projectiveWeights:projectiveValues.map(String),affineWeights,infinity:String(projectiveValues[data.n]),cohomology,
    depth:cohomology.h[1],membershipConfirmed:cohomology.h[1]>=family.guaranteedDepth,
    load:{tab:'aomoto',field:'q',a:affineWeights}};
}

export function specializeCharacterRational(data,family,z1=2,z2=3){
  checkFamilyData(data,family);z1=QQ.from(z1);z2=QQ.from(z2);if(!z1.n||!z2.n)throw Error('z1 と z2 は 0 にできません');
  const classParameters=[z1,z2,ONE.div(z1.mul(z2))],projectiveValues=family.characteristic.projectiveMatrix.map(row=>pow(QQ,z1,row[0]).mul(pow(QQ,z2,row[1])));
  if(!projectiveValues.reduce((s,x)=>s.mul(x),ONE).eq(1))throw Error('射影モノドロミーの積が 1 ではありません');
  const r=evaluate(data,QQ,projectiveValues.slice(0,data.n),'local'),cohomology=summary(r);
  return {kind:'rational-character-specialization',exact:true,classParameters:classParameters.map(String),projectiveValues:projectiveValues.map(String),affineValues:projectiveValues.slice(0,data.n).map(String),infinity:String(projectiveValues[data.n]),cohomology,
    depth:cohomology.h[1],membershipConfirmed:cohomology.h[1]>=family.guaranteedDepth};
}

export function specializeCharacterCyclotomic(data,family,order=3,r=1,s=1){
  checkFamilyData(data,family);const F=cycloField(order),N=BigInt(F.n);r=intArg(r,'r');s=intArg(s,'s');
  const projectiveExponents=family.characteristic.projectiveMatrix.map(row=>String(mod(BigInt(row[0])*r+BigInt(row[1])*s,N)));
  if(mod(projectiveExponents.reduce((a,x)=>a+BigInt(x),0n),N)!==0n)throw Error('射影モノドロミーの積の検算が一致しません');
  const values=projectiveExponents.slice(0,data.n).map(x=>F.root(Number(x))),cohomology=summary(evaluate(data,F,values,'local')),affineExponents=projectiveExponents.slice(0,data.n);
  return {kind:'cyclotomic-character-specialization',exact:true,order:F.n,classExponents:[r,s,-r-s].map(x=>String(mod(x,N))),projectiveExponents,affineExponents,
    infinity:'ζ_'+F.n+'^'+projectiveExponents[data.n],cohomology,depth:cohomology.h[1],membershipConfirmed:cohomology.h[1]>=family.guaranteedDepth,
    load:{tab:'local',localMode:'cyclic',order:F.n,w:affineExponents,homology:false}};
}

// Explicit pointed-deletion family: if H belongs to block b and m=m_H,
// choose the other blocks p,q and set z_b=η, z_p=s, z_q=(ηs)^(-1),
// where η is a nontrivial m-th root. Since t_H=η^m=1, omit that coordinate.
// Primitive certificate weights are used: artificial common rescaling must
// not create extra pointed deletions or spurious translation orders.
export function pointedDeletionFamily(data,certificate,distinguishedIndex,torsionPower=1){
  const {canonical}=checkedCertificate(data,certificate),base=multinetJumping(data,canonical),point=base.pointedLines.find(p=>p.index===distinguishedIndex);
  if(!point)throw Error('この直線は検証済み multinet の pointed 条件を満たしません');
  const m=BigInt(point.multiplicity),power=mod(intArg(torsionPower,'torsionPower'),m);
  if(!power)throw Error('translated family には非自明な根 η を選んでください');
  const block=base.rowBlocks[distinguishedIndex],other=[0,1,2].filter(b=>b!==block),p=other[0],qblock=other[1];
  const originalIndices=Array.from({length:data.n+1},(_,i)=>i).filter(i=>i!==distinguishedIndex),w=canonical.weights.map(BigInt);
  const direction=originalIndices.map(i=>base.rowBlocks[i]===p?w[i]:base.rowBlocks[i]===qblock?-w[i]:0n);
  const offset=originalIndices.map(i=>base.rowBlocks[i]===block?w[i]:base.rowBlocks[i]===qblock?-w[i]:0n);
  const projectiveLattice=torusImageLattice(direction.map(x=>[String(x)])),rhs=projectiveLattice.relations.map(row=>String(mod(dotInteger(row,offset)*power,m)));
  const cosetOrder=rhs.map(x=>m/gcd(m,BigInt(x))).reduce(lcm,1n),translationOrder=offset.map(x=>m/gcd(m,x*power)).reduce(lcm,1n);
  const sameAffineChart=distinguishedIndex!==data.n,finiteOriginalIndices=sameAffineChart?originalIndices.filter(i=>i!==data.n):null;
  const finitePositions=sameAffineChart?finiteOriginalIndices.map(i=>originalIndices.indexOf(i)):null;
  const affineDirection=sameAffineChart?finitePositions.map(i=>[String(direction[i])]):null;
  const affineLattice=sameAffineChart?torusImageLattice(affineDirection):null;
  const affineRhs=sameAffineChart?affineLattice.relations.map(row=>String(mod(dotInteger(row,finitePositions.map(i=>offset[i]))*power,m))):null;
  const etaPower=x=>BigInt(x)===0n?'1':'η^'+x;
  return {kind:'pointed-deletion-jumping',verified:true,geometryKey:geometryKey(data),n:data.n,distinguishedIndex,line:point.line,multiplicity:String(m),torsionPower:String(power),
    canonicalWeights:canonical.weights.slice(),dimension:1,guaranteedDepth:1,completeDecomposition:false,maximalityClaimed:false,sameAffineChart,
    originalIndices,finiteOriginalIndices,supportedIndices:canonical.supportedIndices.filter(i=>i!==distinguishedIndex),
    directionExponents:direction.map(String),translationExponents:offset.map(x=>String(mod(x*power,m))),
    translationCharacterOrder:String(translationOrder),translationCosetOrder:String(cosetOrder),translated:cosetOrder>1n,
    parameterKernel:projectiveLattice.parameterKernel,projectiveRelations:projectiveLattice.relations,affineRelations:affineLattice?.relations??null,
    projectiveEquations:relationEquations(projectiveLattice.relations,originalIndices.map(i=>'t['+lineName(i,data.n)+']'),'multiplicative',rhs.map(etaPower)),
    affineEquations:sameAffineChart?relationEquations(affineLattice.relations,finiteOriginalIndices.map((_,j)=>'t'+(j+1)),'multiplicative',affineRhs.map(etaPower)):null,
    formula:'t_i = η^(translationExponents_i) s^(directionExponents_i), with η=exp(2πi/m_H); omit H and keep t_i=1 off support',
    scope:'A certified one-dimensional family in V¹₁ of the deletion (and its selected-support pullback); not a full decomposition. Deleting H∞ needs a new affine chart.',source:NET_JUMPING_SOURCES.pointed};
}

export function specializePointedDeletionCyclotomic(data,family,order=6,r=1){
  checkFamilyData(data,family,'pointed-deletion-jumping');
  if(!family.sameAffineChart)throw Error('H∞ の deletion には別の直線を無限遠に取る座標変換が必要です');
  const F=cycloField(order),N=BigInt(F.n),m=BigInt(family.multiplicity);r=intArg(r,'r');
  if(N%m!==0n)throw Error('巡回位数は pointed 重み m_H の倍数にしてください');
  const projectiveExponents=family.directionExponents.map((a,i)=>String(mod(BigInt(a)*r+BigInt(family.translationExponents[i])*(N/m),N)));
  const target=arrangement(data.lines.filter((_,i)=>i!==family.distinguishedIndex)),finitePositions=family.finiteOriginalIndices.map(i=>family.originalIndices.indexOf(i));
  const affineExponents=finitePositions.map(i=>projectiveExponents[i]),values=affineExponents.map(x=>F.root(Number(x))),cohomology=summary(evaluate(target,F,values,'local'));
  const infinityPosition=family.originalIndices.indexOf(data.n);
  if(mod(projectiveExponents.reduce((s,x)=>s+BigInt(x),0n),N)!==0n)throw Error('deletion の射影モノドロミーの積の検算が一致しません');
  return {kind:'pointed-deletion-specialization',exact:true,order:F.n,originalIndices:family.originalIndices.slice(),finiteOriginalIndices:family.finiteOriginalIndices.slice(),projectiveExponents,affineExponents,
    infinity:'ζ_'+F.n+'^'+projectiveExponents[infinityPosition],cohomology,depth:cohomology.h[1],membershipConfirmed:cohomology.h[1]>=family.guaranteedDepth,
    load:{tab:'local',localMode:'cyclic',order:F.n,w:affineExponents,homology:false,lines:target.lines.map(l=>l.map(String)),flag:target.flag.map(String),preset:'custom',name:'Pointed multinet deletion '+family.line}};
}

export function sampleMultinetJumping(data,family){
  return {scope:'Exact tests at selected points; these samples do not determine the generic depth or the complete jumping variety.',
    resonance:[{label:'u=1, v=2',...specializeResonance(data,family,1,2)},{label:'原点',...specializeResonance(data,family,0,0)}],
    character:[{label:'z1=2, z2=3',...specializeCharacterRational(data,family,2,3)},{label:'ζ3, ζ3',...specializeCharacterCyclotomic(data,family,3,1,1)},{label:'単位元',...specializeCharacterCyclotomic(data,family,1,0,0)}]};
}
