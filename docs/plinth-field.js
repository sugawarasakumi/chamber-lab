import {Q} from './math.js';
const complexAdd=(a,b)=>[a[0]+b[0],a[1]+b[1]],complexMul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const complexSqrt=z=>{const r=Math.hypot(...z),a=Math.sqrt(Math.max(0,(r+z[0])/2)),b=Math.sqrt(Math.max(0,(r-z[0])/2));return [a,z[1]<0?-b:b];};
function integerSqrt(n){if(n<0n)return null;if(n<2n)return n;let a=1n<<BigInt(Math.ceil(n.toString(2).length/2));for(;;){const b=(a+n/a)/2n;if(b>=a)return a;a=b;}}
export function rationalSqrt(x){x=Q.of(x);if(x.n<0n)return null;const a=integerSqrt(x.n),b=integerSqrt(x.d);return a*a===x.n&&b*b===x.d?new Q(a,b):null;}
export const Rational={degree:1,symbol:null,base:null,spec:{type:'Q'},label:'Q',zero:Q.of(0),one:Q.of(1),from:x=>Q.of(x),add:(a,b)=>a.add(b),sub:(a,b)=>a.sub(b),mul:(a,b)=>a.mul(b),div:(a,b)=>a.div(b),neg:a=>a.neg(),is0:a=>!a.n,eq:(a,b)=>a.eq(b),str:String,num:a=>[Number(a),0]};
Rational.sqrt=rationalSqrt;

export function quadraticExtension(base,radicand,symbol=base.degree===1?'a':'b'){
  if(base.degree>2)throw Error('この実験画面の数体は次数4までです');
  if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(symbol))throw Error('生成元名を確認してください');
  radicand=base.from(radicand);if(base.is0(radicand)||base.sqrt?.(radicand)!==null&&base.sqrt?.(radicand)!==undefined)throw Error('平方根を既に含む体への拡大は不要です');
  const F={base,radicand,symbol,degree:base.degree*2,spec:{type:'sqrt',base:base.spec,radicand:base.str(radicand),symbol},label:base.label+'('+symbol+')'};
  const make=(a,b)=>({field:F,a,b});
  F.from=x=>x?.field===F?x:make(base.from(x),base.zero);
  F.zero=make(base.zero,base.zero);F.one=make(base.one,base.zero);F.generator=make(base.zero,base.one);
  F.add=(a,b)=>{a=F.from(a);b=F.from(b);return make(base.add(a.a,b.a),base.add(a.b,b.b));};
  F.neg=a=>make(base.neg(a.a),base.neg(a.b));F.sub=(a,b)=>F.add(a,F.neg(F.from(b)));
  F.mul=(a,b)=>{a=F.from(a);b=F.from(b);return make(base.add(base.mul(a.a,b.a),base.mul(radicand,base.mul(a.b,b.b))),base.add(base.mul(a.a,b.b),base.mul(a.b,b.a)));};
  F.div=(a,b)=>{a=F.from(a);b=F.from(b);const norm=base.sub(base.mul(b.a,b.a),base.mul(radicand,base.mul(b.b,b.b)));if(base.is0(norm))throw Error('数体での0除算');return make(base.div(base.sub(base.mul(a.a,b.a),base.mul(radicand,base.mul(a.b,b.b))),norm),base.div(base.sub(base.mul(a.b,b.a),base.mul(a.a,b.b)),norm));};
  F.is0=a=>base.is0(a.a)&&base.is0(a.b);F.eq=(a,b)=>F.is0(F.sub(a,b));
  F.str=a=>{a=F.from(a);if(base.is0(a.b))return base.str(a.a);const b=base.str(a.b),term=base.eq(a.b,base.one)?symbol:base.eq(a.b,base.neg(base.one))?'-'+symbol:'('+b+')*'+symbol;return base.is0(a.a)?term:'('+base.str(a.a)+')+('+term+')';};
  F.num=a=>{a=F.from(a);return complexAdd(base.num(a.a),complexMul(base.num(a.b),complexSqrt(base.num(radicand))));};
  F.sqrt=x=>{
    x=F.from(x);if(F.is0(x))return F.zero;if(base.degree!==1)return undefined;
    const a=x.a,b=x.b,d=radicand;
    if(!b.n){let r=rationalSqrt(a);if(r)return F.from(r);r=rationalSqrt(a.div(d));return r?make(base.zero,r):null;}
    const norm=a.mul(a).sub(d.mul(b.mul(b))),n=rationalSqrt(norm);if(!n)return null;
    for(const sign of [n,n.neg()]){const u=rationalSqrt(a.add(sign).div(2));if(u?.n){const root=make(u,b.div(u.mul(2)));if(F.eq(F.mul(root,root),x))return root;}}
    return null;
  };
  return F;
}

export function parseFieldExpression(text,F){
  text=String(text).replaceAll('−','-');const squareRoots=new Map();
  for(const [literal,value,name] of [['sqrt(5)',5,'sqrtFive'],['sqrt(-3)',-3,'sqrtMinusThree']])if(text.includes(literal)){
    const root=F.sqrt?.(F.from(value));if(root===null||root===undefined)throw Error('この係数体に '+literal+' の平方根は見つかりません');squareRoots.set(name,root);text=text.replaceAll(literal,name);
  }
  if(text.length>2500)throw Error('係数の式が長すぎます');
  const tokens=text.match(/\d+(?:\.\d*)?|\.\d+|[A-Za-z][A-Za-z0-9_]*|[()+*/^\-]/g)||[];
  if(tokens.join('')!==text.replace(/\s/g,''))throw Error('係数には四則演算と数体の生成元を使ってください');let at=0;
  const embed=x=>F.from(x);
  const symbols=new Map(squareRoots);for(let current=F;current.base;current=current.base)symbols.set(current.symbol,embed(current.generator));
  if(F.degree===2&&F.base.eq(F.radicand,Q.of(5)))symbols.set('p',F.div(F.sub(F.generator,F.one),F.from(2)));
  const atom=()=>{const t=tokens[at++];let out;if(t==='-')return F.neg(atom());if(t==='+')return atom();if(t==='('){out=sum();if(tokens[at++]!==')')throw Error('係数の括弧が対応していません');}else if(symbols.has(t))out=symbols.get(t);else if(/^\d|^\./.test(t||''))out=F.from(Q.of(t));else throw Error('未定義の係数: '+t);
    if(tokens[at]==='^'){at++;const k=Number(tokens[at++]);if(!Number.isInteger(k)||k<0||k>8)throw Error('係数の冪は0–8です');let v=F.one;for(let i=0;i<k;i++)v=F.mul(v,out);out=v;}return out;};
  const product=()=>{let x=atom();while(['*','/'].includes(tokens[at])){const op=tokens[at++],y=atom();x=op==='*'?F.mul(x,y):F.div(x,y);}return x;};
  const sum=()=>{let x=product();while(['+','-'].includes(tokens[at])){const op=tokens[at++],y=product();x=op==='+'?F.add(x,y):F.sub(x,y);}return x;};
  if(!tokens.length)throw Error('空の係数があります');const out=sum();if(at!==tokens.length)throw Error('係数の式を確認してください');return out;
}

export function fieldFromSpec(spec){if(!spec||spec.type==='Q')return Rational;if(spec.type!=='sqrt')throw Error('数体の定義を確認してください');const base=fieldFromSpec(spec.base);return quadraticExtension(base,parseFieldExpression(spec.radicand,base),spec.symbol);}
export function polynomialRoots(coefficients,F){
  const [c,b,a]=coefficients;if(coefficients.every(F.is0))return {kind:'identity',field:F,roots:[],discriminant:null,factorization:'全ての [s:t] で閉じる'};
  if(F.is0(a)){
    if(F.is0(b))return {kind:'double',field:F,roots:[{s:F.zero,t:F.one,label:'∞',multiplicity:2}],discriminant:F.zero};
    return {kind:'split',field:F,roots:[{s:F.one,t:F.div(F.neg(c),b),multiplicity:1},{s:F.zero,t:F.one,label:'∞',multiplicity:1}],discriminant:F.mul(b,b)};
  }
  const discriminant=F.sub(F.mul(b,b),F.mul(F.from(4),F.mul(a,c)));let root=F.sqrt(discriminant),field=F,kind='split';
  if(root===undefined)return {kind:'unresolved',field:F,roots:[],discriminant};
  if(root===null){field=quadraticExtension(F,discriminant);root=field.generator;kind='irreducible';}else if(F.is0(root))kind='double';
  const center=field.neg(field.from(b)),den=field.mul(field.from(2),field.from(a));
  const roots=[{s:field.one,t:field.div(field.add(center,root),den),multiplicity:kind==='double'?2:1}];
  if(kind!=='double')roots.push({s:field.one,t:field.div(field.sub(center,root),den),multiplicity:1});
  return {kind,field,roots,discriminant};
}
