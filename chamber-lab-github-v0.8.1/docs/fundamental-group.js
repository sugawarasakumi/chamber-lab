// Yoshinaga's chamber presentation, with an exact abelianized Fox certificate.
// Primary sources: math/0507311, Appendix 7, Theorem 7.0.1; and
// arXiv:1105.1857, Sections 3.3, 5.3, 6.2 (Theorems 5.3 and 6.5).
// Words use signed 1-based generator indices. Meridian indices always retain
// the original finite-line order; chamber indices follow the flag cuts.
const SOURCE='https://arxiv.org/abs/math/0507311';
const POSITIVE_SOURCE='https://arxiv.org/abs/1105.1857';
const PRODUCT_SOURCE='https://doi.org/10.2969/jmsj/03040599';

export const inverseWord=w=>w.slice().reverse().map(x=>-x);
export function reduceWord(word){
  const out=[];for(const letter of word){if(!Number.isInteger(letter)||!letter)throw Error('Invalid free-group letter');if(out[out.length-1]===-letter)out.pop();else out.push(letter);}return out;
}
export function groupWordString(word,prefix='g'){
  return word.length?word.map(x=>prefix+Math.abs(x)+(x<0?'^(-1)':'')).join(' '):'1';
}
function substitute(word,images){return reduceWord(word.flatMap(x=>x>0?images[x-1]:inverseWord(images[-x-1])));}
function cyclicallyReduce(word){let w=reduceWord(word),a=0,b=w.length;while(b-a>1&&w[a]===-w[b-1]){a++;b--;}return w.slice(a,b);}
function cyclicEquivalence(a,b){
  a=cyclicallyReduce(a);b=cyclicallyReduce(b);if(a.length!==b.length)return null;if(!a.length)return {inverse:false,rotation:0};
  for(const inverted of [false,true]){const w=inverted?inverseWord(b):b;for(let r=0;r<w.length;r++)if(a.every((x,i)=>x===w[(i+r)%w.length]))return {inverse:inverted,rotation:r};}return null;
}
const exponentSum=(word,n)=>{const e=Array(n).fill(0);for(const x of word){if(Math.abs(x)>n)throw Error('Free-group letter out of range');e[Math.abs(x)-1]+=Math.sign(x);}return e;};

// Sparse Laurent polynomials over Z. No numerical polynomial arithmetic.
const zeroExp=n=>Array(n).fill(0);
function addTerm(poly,exponents,coefficient){if(!coefficient)return;const key=exponents.join(','),next=(poly.get(key)||0)+coefficient;if(next)poly.set(key,next);else poly.delete(key);}
function shifted(poly,exponents,coefficient=1){const out=new Map();for(const [key,c] of poly)addTerm(out,key.split(',').map((x,i)=>Number(x)+exponents[i]),coefficient*c);return out;}
const samePoly=(a,b)=>a.size===b.size&&[...a].every(([k,v])=>b.get(k)===v);
const terms=poly=>[...poly].map(([key,coefficient])=>({coefficient,exponents:key.split(',').filter(x=>x!=='').map(Number)})).sort((a,b)=>a.exponents.join(',').localeCompare(b.exponents.join(',')));
function foxMaps(word,images,n){
  const derivatives=images.map(()=>new Map()),prefix=zeroExp(n);
  for(const letter of word){const j=Math.abs(letter)-1,s=Math.sign(letter),image=images[j];if(s<0)image.forEach((x,i)=>prefix[i]-=x);addTerm(derivatives[j],prefix,s);if(s>0)image.forEach((x,i)=>prefix[i]+=x);}
  return {derivatives,end:prefix};
}
export function abelianizedFox(word,images){
  const n=images[0]?.length||0,result=foxMaps(word,images,n);return {row:result.derivatives.map(terms),exponents:result.end};
}
function chamberEntry(entry,n){
  const out=new Map();if(entry.deg){addTerm(out,Array.from({length:n},(_,i)=>entry.plus&2**i?1:0),entry.deg);addTerm(out,Array.from({length:n},(_,i)=>entry.minus&2**i?-1:0),-entry.deg);}return out;
}
function monomialUnit(actual,expected,n){
  if(!actual.size&&!expected.size)return {sign:1,exponents:zeroExp(n)};
  if(actual.size!==expected.size||!actual.size)return null;
  const [firstKey,firstCoefficient]=expected.entries().next().value,first=firstKey.split(',').map(Number);
  for(const sign of [1,-1])for(const [key,c] of actual){if(c!==sign*firstCoefficient)continue;const exponents=key.split(',').map((x,i)=>Number(x)-first[i]);if(samePoly(actual,shifted(expected,exponents,sign)))return {sign,exponents};}return null;
}
function foxCertificate(data,relators,images){
  const n=data.n,matrix=[],rowUnits=[];
  for(let r=0;r<relators.length;r++){
    const fox=foxMaps(relators[r].word,images,n);if(fox.end.some(x=>x))throw Error('Relator has nonzero abelianization');
    const boundary=new Map();fox.derivatives.forEach((p,j)=>{for(const [key,c] of shifted(p,images[j]))addTerm(boundary,key.split(',').map(Number),c);for(const [key,c] of p)addTerm(boundary,key.split(',').map(Number),-c);});
    if(boundary.size)throw Error('Fox fundamental identity failed');
    const expected=data.d1[r].map(e=>chamberEntry(e,n));let unit=null;
    for(let j=0;j<n;j++)if(expected[j].size||fox.derivatives[j].size){unit=monomialUnit(fox.derivatives[j],expected[j],n);if(!unit)throw Error('Fox/chamber coefficient mismatch');break;}
    unit=unit||{sign:1,exponents:zeroExp(n)};
    if(!fox.derivatives.every((p,j)=>samePoly(p,shifted(expected[j],unit.exponents,unit.sign))))throw Error('Fox/chamber row-unit mismatch');
    matrix.push(fox.derivatives.map(terms));rowUnits.push(unit);
  }
  return {variables:Array.from({length:n},(_,i)=>'t'+(i+1)),rows:relators.length,columns:n,matrix,rowUnits,verified:true,
    convention:'Rows are relators, columns are chamber generators. Abelianize g_j to the product of meridians at the first j flag cuts. FoxRow(C)=sign(C)*t^unit(C)*d1Row(C).',
    alexanderRelation:'The abelianized Fox matrix presents the universal abelian-cover boundary. Its one-variable total-linking specialization t_i=t agrees with the chamber Alexander calculation up to Laurent units; meridian at infinity has linking value -n.'};
}

const abs=x=>x<0n?-x:x;
const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a;};
// Exact unimodular row/column isolation. Sorting the diagonal via gcd/lcm
// then gives invariant factors; a divisibility condition is not assumed.
function integerDiagonal(input,columns){
  const a=input.map(row=>row.map(BigInt)),rows=a.length,diagonal=[];let operations=0;
  for(let k=0;k<Math.min(rows,columns);k++){
    let choice=null;for(let i=k;i<rows;i++)for(let j=k;j<columns;j++)if(a[i][j]&&(!choice||abs(a[i][j])<choice.value))choice={i,j,value:abs(a[i][j])};
    if(!choice)break;[a[k],a[choice.i]]=[a[choice.i],a[k]];if(choice.j!==k)for(let i=0;i<rows;i++)[a[i][k],a[i][choice.j]]=[a[i][choice.j],a[i][k]];
    while(true){
      let restart=false;
      for(let i=k+1;i<rows;i++)if(a[i][k]){
        const quotient=a[i][k]/a[k][k];if(quotient)for(let j=k;j<columns;j++)a[i][j]-=quotient*a[k][j];
        if(++operations>100000)throw Error('Integer reduction budget exceeded');
        if(a[i][k]){[a[i],a[k]]=[a[k],a[i]];restart=true;break;}
      }
      if(restart)continue;
      for(let j=k+1;j<columns;j++)if(a[k][j]){
        const quotient=a[k][j]/a[k][k];if(quotient)for(let i=k;i<rows;i++)a[i][j]-=quotient*a[i][k];
        if(++operations>100000)throw Error('Integer reduction budget exceeded');
        if(a[k][j]){for(let i=0;i<rows;i++)[a[i][j],a[i][k]]=[a[i][k],a[i][j]];restart=true;break;}
      }
      if(!restart)break;
    }
    diagonal.push(abs(a[k][k]));
  }
  for(let i=0;i<diagonal.length;i++)for(let j=i+1;j<diagonal.length;j++)if(diagonal[j]%diagonal[i]){const g=gcd(diagonal[i],diagonal[j]),l=diagonal[i]/g*diagonal[j];diagonal[i]=g;diagonal[j]=l;}
  return {rank:diagonal.length,diagonal:diagonal.map(String),torsion:diagonal.filter(x=>x>1n).map(String),operations};
}
export function classTwoQuotient(words,n){
  const pairs=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)pairs.push([i,j]);
  const relationMatrix=words.map(word=>{
    const prefix=Array(n).fill(0n),row=Array(pairs.length).fill(0n);
    for(const letter of word){const j=Math.abs(letter)-1,s=BigInt(Math.sign(letter));if(j<0||j>=n)throw Error('Free-group letter out of range');pairs.forEach(([a,b],i)=>{if(b===j)row[i]+=s*prefix[a];});prefix[j]+=s;}
    if(prefix.some(x=>x))throw Error('Class-two helper requires commutator relators');return row;
  });
  const smith=integerDiagonal(relationMatrix,pairs.length);
  return {rank:pairs.length-smith.rank,torsion:smith.torsion,relationRank:smith.rank,smithDiagonal:smith.diagonal,commutatorGeneratorCount:pairs.length,operations:smith.operations,
    method:'Integral degree-two Magnus coefficients and exact unimodular integer reduction of the relators in gamma2(F)/gamma3(F).'};
}

function certifiedStructure(data){
  const n=data.n,classes=new Map();data.lines.forEach((l,i)=>{const key=l.slice(0,2).join(',');if(!classes.has(key))classes.set(key,[]);classes.get(key).push(i);});
  if(data.vertices.every(v=>v.lines.length===2)){
    const parallelClasses=[...classes.values()],freeRanks=parallelClasses.map(c=>c.length),centerRank=freeRanks.filter(r=>r===1).length;
    return {available:true,kind:'product-of-free-groups',freeRanks,parallelClasses,label:freeRanks.length?freeRanks.map(r=>r===1?'Z':'F_'+r).join(' × '):'1',centerRank,abelian:freeRanks.every(r=>r<=1),source:PRODUCT_SOURCE,
      proof:'Each parallel block of p lines meets the remaining q lines in exactly p*q distinct finite ordinary points. Repeated Oka–Sakamoto product theorem splits the group into the free groups of the parallel blocks. A single parallel block has complement (C minus p points) times C.'};
  }
  const pencil=data.vertices.find(v=>v.lines.length===n);
  if(pencil)return {available:true,kind:'finite-pencil',freeRanks:[1,n-1],label:'Z × F_'+(n-1),centerRank:n===2?2:1,abelian:n<=2,point:pencil.p.map(String),lines:pencil.lines,
    proof:'Translation makes the arrangement central in C². Projection to P¹ minus n directions has fiber C*, and its line bundle is trivial over this punctured sphere. Thus the complement is a product up to homotopy.'};
  return {available:false,kind:'unclassified',label:null,centerRank:null,abelian:null,proof:'No general group-isomorphism or center decision is claimed.'};
}

export function fundamentalGroup(data){
  if(!data.verified||!data.adapted)throw Error('基本群の計算には全交点を片側に置く外側の flag が必要です');
  const n=data.n,cutLines=data.cuts.map(c=>c.i),images=data.c1.map(c=>Array.from({length:n},(_,i)=>c.mask&2**i?1:0));
  const chamberImages=cutLines.map((_,j)=>cutLines.slice(0,j+1).reverse().map(i=>i+1));
  const chamber=chamberImages.map((wordInMeridians,j)=>({index:j,name:'g'+(j+1),chamber:data.c1[j].id,wordInMeridians,abelianImage:images[j]}));
  const meridian=Array.from({length:n},(_,i)=>{const j=cutLines.indexOf(i);return {index:i,name:'m'+(i+1),line:i,flagPosition:j+1,wordInChambers:j?[j+1,-j]:[1]};});
  const left=cutLines.slice().reverse().map(i=>i+1);
  const relators=data.c2.map((cell,r)=>{
    const degrees=data.d1[r].map(e=>e.deg),first=degrees.map((e,j)=>e*(j+1)).filter(Boolean),word=reduceWord(first.concat(first.map(x=>-x)));
    const meridianWord=substitute(word,chamberImages),right=left.filter(i=>!(cell.mask&2**(i-1))).concat(left.filter(i=>cell.mask&2**(i-1))),positiveWord=reduceWord(left.concat(inverseWord(right)));
    const equivalence=cyclicEquivalence(meridianWord,positiveWord);if(!equivalence)throw Error('Positive meridian/chamber presentation mismatch');
    if(exponentSum(word,n).some(x=>x)||exponentSum(positiveWord,n).some(x=>x))throw Error('Nonminimal abelian relation');
    return {chamber:cell.id,index:r,degrees,word,meridianWord,positive:{left:left.slice(),right,word:positiveWord},cyclicEquivalence:equivalence};
  });
  const fox=foxCertificate(data,relators,images),second=classTwoQuotient(relators.map(r=>r.word),n),phi2=n*(n-1)/2-data.b2;
  if(second.rank!==phi2)throw Error('Class-two rank and arrangement Betti number disagree');
  const structure=certifiedStructure(data),abelian=structure.available?structure.abelian:second.rank||second.torsion.length?false:null;
  const invariants={generatorCount:n,relationCount:relators.length,presentationDeficiency:n-relators.length,
    abelianization:{rank:n,torsion:[],basis:'Original finite-line meridians',verified:true},
    lowerCentral:{phi1:n,phi2,secondQuotient:second,convention:'gamma1(G)=G; gamma_(k+1)=[gamma_k,G]; phi_k=rank(gamma_k/gamma_(k+1)).',crossCheck:'phi2=binomial(n,2)-b2; computed independently from the presentation over Z.'},
    finite:{value:n===0,order:n===0?'1':'infinite',reason:n?'The abelianization surjects onto Z.':'The empty complement is C².'},
    abelian:{value:abelian,reason:structure.available?structure.proof:abelian===false?'The nonzero second lower-central quotient certifies a nonabelian group.':'No general abelianness decision is claimed from this quotient alone.'},
    groupHomology:{h1Rank:n,h2Rank:data.b2,source:POSITIVE_SOURCE,note:'For arrangement complements H_i(M;Z)=H_i(pi1(M);Z) for i<=2; this does not require K(pi,1).'},
    certifiedStructure:structure,center:structure.available?{status:'KNOWN',rank:structure.centerRank,torsion:[],reason:structure.proof}:{status:'UNKNOWN',rank:null,reason:'Center computation is only certified for the displayed special classes.'}};
  return {available:true,verified:true,source:{url:SOURCE,publishedUrl:'https://www.jstage.jst.go.jp/article/kodaimath/30/2/30_2_157/_pdf',location:'Appendix7, Theorem7.0.1; Kodai Math. J.30 (2007), p192',positiveUrl:POSITIVE_SOURCE,positiveLocation:'Section6.2, Theorem6.5'},
    scope:'The complement of the affine complexified arrangement; equivalently the projective completion including H∞. The cone group has one additional direct Z factor.',
    formula:'R_C=g_1^e_1 ... g_n^e_n g_1^(-e_1) ... g_n^(-e_n), e_j=deg(C,C_j). Both halves use increasing chamber order.',
    convention:'m_cut(j)=g_j*g_(j-1)^(-1), g_0=1; hence g_j=m_cut(j)...m_cut(1). Positive relations use decreasing flag-cut order, placing unseparated lines before separated lines on the right.',
    generators:{chamber,meridian},infinityMeridian:{wordInChambers:n?[-n]:[],wordInMeridians:inverseWord(left),abelianImage:Array(n).fill(-1),note:'A based meridian of H∞ is the inverse of the large flag loop g_n, up to the displayed choice of paths.'},relators,fox,invariants};
}

export function groupExport(result,{format='gap',basis='chamber',includeAlexander=true}={}){
  if(!result?.verified)throw Error('Verified group presentation required');if(!['gap','sage'].includes(format)||!['chamber','meridian'].includes(basis))throw Error('Unsupported export convention');
  const n=result.generators.chamber.length,prefix=basis==='chamber'?'g':'m',words=result.relators.map(r=>basis==='chamber'?r.word:r.positive.word),names=Array.from({length:n},(_,i)=>prefix+(i+1));
  const header='# Chamber Lab: Yoshinaga chamber-indexed presentation\n# '+SOURCE+' (Theorem7.0.1); '+POSITIVE_SOURCE+' (Theorem6.5)\n# Relator rows: '+result.relators.map(r=>r.chamber).join(', ')+'\n';
  if(format==='gap'){
    const word=w=>w.length?w.map(x=>'x['+Math.abs(x)+']'+(x<0?'^-1':'')).join('*'):'One(F)';
    return header+'F := FreeGroup('+n+');;\nx := GeneratorsOfGroup(F);;\nrels := [\n'+words.map(w=>'  '+word(w)).join(',\n')+'\n];;\nG := F/rels;;\nAbelianInvariants(G);\n# The presentation is explicit; no general isomorphism or center algorithm is claimed.\n';
  }
  const word=w=>w.length?w.map(x=>'x['+(Math.abs(x)-1)+']'+(x<0?'^(-1)':'')).join('*'):'F.one()';
  let out=header+'F = FreeGroup('+n+', names='+JSON.stringify(names)+')\nx = F.gens()\nrels = [\n'+words.map(w=>'    '+word(w)).join(',\n')+'\n]\nG = F / rels\nprint(G.abelian_invariants())\n';
  if(includeAlexander&&basis==='chamber'&&n){
    const entry=ts=>ts.length?ts.map(({coefficient,exponents})=>{const factors=exponents.map((e,i)=>e?'t['+i+']^('+e+')':null).filter(Boolean);return '('+coefficient+(factors.length?'*'+factors.join('*'):'')+')';}).join('+'):'0';
    out+='\n# Abelianized Fox derivatives; variables follow original finite-line order.\nR = LaurentPolynomialRing(QQ, names='+JSON.stringify(result.fox.variables)+')\nt = R.gens()\nA = matrix(R, '+result.fox.rows+', '+n+', [\n'+result.fox.matrix.flat().map(ts=>'    '+entry(ts)).join(',\n')+'\n])\nimage_g = vector(R, [\n'+result.generators.chamber.map(g=>'    '+(g.abelianImage.map((e,i)=>e?'t['+i+']':null).filter(Boolean).join('*')||'1')+'-1').join(',\n')+'\n])\nassert A*image_g == vector(R, [0]*A.nrows())\n# This Fox matrix is related rowwise to the chamber d1 by Laurent units.\n';
  }
  return out;
}
