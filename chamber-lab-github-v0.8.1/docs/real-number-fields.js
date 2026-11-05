// Exact real algebraic geometry fields. Coefficients are injected rational numbers.
// A field is Q[a]/(minimalPolynomial), with ONE real root selected by a rational
// isolating interval. All order decisions use rational interval arithmetic.
export function realNumberFields(R){
  const fields=new Map();let externalParse=x=>R.of(x),embedding=()=>null;
  const z=()=>R.of(0),one=()=>R.of(1),trim=p=>{while(p.length>1&&p.at(-1).eq(0))p.pop();return p;};
  const add=(a,b)=>trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||z()).add(b[i]||z())));
  const neg=a=>a.map(x=>x.neg()),sub=(a,b)=>add(a,neg(b));
  const mul=(a,b)=>{const p=Array.from({length:a.length+b.length-1},z);a.forEach((x,i)=>b.forEach((y,j)=>p[i+j]=p[i+j].add(x.mul(y))));return trim(p);};
  const zero=p=>p.length===1&&p[0].eq(0);
  function divmod(a,b){a=trim(a.slice());b=trim(b.slice());if(zero(b))throw Error('数体で 0 除算');const out=Array.from({length:Math.max(1,a.length-b.length+1)},z);while(!zero(a)&&a.length>=b.length){const k=a.length-b.length,c=a.at(-1).div(b.at(-1));out[k]=out[k].add(c);for(let j=0;j<b.length;j++)a[k+j]=a[k+j].sub(c.mul(b[j]));trim(a);}return [trim(out),a];}
  const at=(p,x)=>p.reduceRight((s,c)=>s.mul(x).add(c),z());
  const sgn=x=>x.cmp(0);
  function variations(chain,x){let prev=0,total=0;for(const p of chain){const sign=sgn(at(p,x));if(sign){if(prev&&prev!==sign)total++;prev=sign;}}return total;}
  const intervalMul=(a,b)=>{const v=[a[0].mul(b[0]),a[0].mul(b[1]),a[1].mul(b[0]),a[1].mul(b[1])].sort((x,y)=>x.cmp(y));return [v[0],v[3]];};
  function intervalEval(p,interval){let out=[z(),z()];for(let i=p.length-1;i>=0;i--){out=intervalMul(out,interval);out=[out[0].add(p[i]),out[1].add(p[i])];}return out;}
  class RealField {
    constructor(def){
      this.symbol=def.symbol||def.id;if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(this.symbol)||['sqrt','phi','S'].includes(this.symbol))throw Error('不正な数体の生成元名');
      this.id=def.id||this.symbol;this.polynomial=trim(def.polynomial.map(R.of));this.degree=this.polynomial.length-1;
      if(this.degree<2||this.degree>12)throw Error('実数体の次数は 2–12 にしてください');const lc=this.polynomial.at(-1);this.polynomial=this.polynomial.map(x=>x.div(lc));
      this.interval=def.interval.map(R.of);if(this.interval.length!==2||this.interval[0].cmp(this.interval[1])>=0)throw Error('不正な根の分離区間');
      const derivative=this.polynomial.slice(1).map((c,i)=>c.mul(i+1)),chain=[this.polynomial,derivative];while(!zero(chain.at(-1))){const next=neg(divmod(chain.at(-2),chain.at(-1))[1]);if(zero(next))break;chain.push(next);}
      if(chain.at(-1).length!==1||at(this.polynomial,this.interval[0]).eq(0)||at(this.polynomial,this.interval[1]).eq(0)||variations(chain,this.interval[0])-variations(chain,this.interval[1])!==1)throw Error('指定区間が単純な実根を一つだけ含むことを確認できません');
      this.sturm=chain;this.leftSign=sgn(at(this.polynomial,this.interval[0]));this.definition={...def,id:this.id,symbol:this.symbol,degree:this.degree,polynomial:this.polynomial.map(String),interval:def.interval.map(String)};
    }
    element(coefficients){const p=divmod(trim(coefficients.map(R.of)),this.polynomial)[1];return p.length===1?p[0]:new Element(this,p);}
    coerce(x){if(x instanceof Element){if(x.field!==this)throw Error('異なる実数体の座標は一つの配置内で混ぜられません');return x.coefficients;}if(x instanceof R||typeof x==='number'||typeof x==='bigint')return [R.of(x)];if(typeof x==='string')return this.coerce(externalParse(x));const embedded=embedding(this,x);if(embedded)return embedded;throw Error('この実数体へ埋め込めない係数です');}
    refine(){const mid=this.interval[0].add(this.interval[1]).div(2),sign=sgn(at(this.polynomial,mid));if(!sign)throw Error('指定多項式が最小多項式ではありません');if(sign===this.leftSign)this.interval[0]=mid;else this.interval[1]=mid;}
    numericRoot(){if(this._numericRoot!==undefined)return this._numericRoot;const width=new R(1n,2n**52n);while(this.interval[1].sub(this.interval[0]).cmp(width)>0)this.refine();return this._numericRoot=Number(this.interval[0].add(this.interval[1]).div(2));}
    sign(p){for(let i=0;i<512;i++){const [a,b]=intervalEval(p,this.interval);if(a.cmp(0)>0)return 1;if(b.cmp(0)<0)return -1;this.refine();}throw Error('実代数的数の符号計算が資源上限に達しました');}
    sameRoot(other){if(this.polynomial.map(String).join(',')!==other.polynomial.map(String).join(','))return false;const lo=this.interval[0].cmp(other.interval[0])>0?this.interval[0]:other.interval[0],hi=this.interval[1].cmp(other.interval[1])<0?this.interval[1]:other.interval[1];return lo.cmp(hi)<0&&variations(this.sturm,lo)-variations(this.sturm,hi)===1;}
  }
  class Element {
    constructor(field,coefficients){this.field=field;this.coefficients=coefficients;this._sign=null;}
    get n(){return this._sign??(this._sign=BigInt(this.field.sign(this.coefficients)));}
    add(x){return this.field.element(add(this.coefficients,this.field.coerce(x)));}
    sub(x){return this.field.element(sub(this.coefficients,this.field.coerce(x)));}
    mul(x){return this.field.element(mul(this.coefficients,this.field.coerce(x)));}
    div(x){return this.mul(new Element(this.field,this.field.coerce(x)).inv());}
    inv(){const b=this.coefficients;if(zero(b))throw Error('0 で割れません');let r0=this.field.polynomial,r1=b,s0=[z()],s1=[one()];while(!zero(r1)){const [d,r]=divmod(r0,r1);[r0,r1]=[r1,r];[s0,s1]=[s1,sub(s0,mul(d,s1))];}if(r0.length!==1)throw Error('数体の逆元を計算できません（最小多項式を確認してください）');return this.field.element(s0.map(c=>c.div(r0[0])));}
    neg(){return this.field.element(neg(this.coefficients));}
    abs(){return this.n<0n?this.neg():this;}
    cmp(x){const d=this.sub(x);return d.n<0n?-1:d.n>0n?1:0;}
    eq(x){return this.cmp(x)===0;}
    valueOf(){const a=this.field.numericRoot();return this.coefficients.reduceRight((s,c)=>s*a+Number(c),0);}
    toString(){let out='';this.coefficients.forEach((c,i)=>{if(c.eq(0))return;const negative=c.n<0n,abs=c.abs(),power=i?this.field.symbol+(i>1?'^'+i:''):'',term=power?(abs.eq(1)?'':String(abs)+'*')+power:String(abs);out+=(out?(negative?'-':'+'):(negative?'-':''))+term;});return out||'0';}
    toJSON(){return this.toString();}
  }
  return {Element,fields,setParser:fn=>externalParse=fn,setEmbedding:fn=>embedding=fn,register(def){const f=new RealField(def),old=fields.get(f.symbol);if(old){if(!old.sameRoot(f))throw Error('同じ生成元名の異なる数体・実根があります');return old;}const equivalent=[...fields.values()].find(g=>g.sameRoot(f));fields.set(f.symbol,equivalent||f);return equivalent||f;},generator(symbol){const f=fields.get(symbol);if(!f)throw Error('未登録の実数体の生成元: '+symbol);return f.element([z(),one()]);},definitions:()=>[...new Set(fields.values())].map(f=>f.definition)};
}
