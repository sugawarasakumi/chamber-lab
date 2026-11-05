import {Rational,fieldFromSpec,parseFieldExpression} from './plinth-field.js';
import {projectiveArrangement,makePlinth,checkPolygon} from './plinth-core.js';
const I='https://arxiv.org/abs/2111.00399',II='https://arxiv.org/abs/2409.18022';
const base5=[[0,0,1],[1,0,0],[1,0,-1],[0,1,0],[0,1,-1]],base6=[...base5,[1,-1,0]];
const rational10=[[0,2,-1],[1,-1,0],[1,1,-1],[1,0,0],[2,-2,1],[1,0,-1],[2,6,-5],[0,1,0],[0,1,-1],[0,0,1]];
const macSupport=[0,1,3],macPivots=[[2,3],[2,4],[1,4]];
export const PLINTH_PRESETS=[
  {id:'rational13',name:'有理 pair · 13直線',tag:'Q · reducible Δ',source:II,section:'§3.3 / Theorem 3.5',description:'10本の有理配置に splitting triangle を加える。閉条件は Q 上で分解する。',topology:'unknown',classification:'文献の rational / nonarithmetic pair。位相的非同型性は同論文 §4.3 で未判定。'},
  {id:'fs13',name:'Falk–Sturmfels 拡張 · 13直線',tag:'Q(√5) · reducible Δ',source:II,section:'§3.2 / Theorem 3.3',description:'Falk–Sturmfels 配置に1本を加え、さらに二つの splitting triangle を比較する。',topology:'unknown',classification:'文献の実 nonarithmetic pair。位相的非同型性は同論文 §4.3 で未判定。'},
  {id:'ml11',name:'MacLane splitting · 11直線',tag:'次数4 · Zariski pair',source:I,section:'§4.2, Table 1 の k=1 / Theorem 4.1',description:'MacLane 配置上の二つ目の splitting triangle。固定した最初の分岐に対して、二つの解は補集合の基本群が非同型。',topology:'known',classification:'文献の Zariski pair（補集合の π₁ が非同型）。本画面では構成・組合せを検算し、群の非同型性は引用定理による。'},
  {id:'rybnikov',name:'Rybnikov · 二つ目の splitting',tag:'13直線 · Q(√−3)',source:I,section:'§4.1',description:'二つの MacLane 配置を3本の直線に沿って貼り合わせる構成。二つ目の分岐を比較する。',topology:'known',classification:'Rybnikov の既知の Zariski pair。位相の区別は文献の結果を表示し、本画面での群同型判定ではない。'},
  {id:'maclane',name:'MacLane · 最初の splitting',tag:'5 → 8 · Q(√−3)',source:I,section:'§3.1',description:'二つの3重点を持つ5本から複素 MacLane 配置を構成する。',topology:'conjugate',classification:'複素共役の arithmetic pair。複素共役による同相があり、通常の非標識 Zariski pair とは表示しない。'},
  {id:'fs',name:'Falk–Sturmfels · 最初の splitting',tag:'6 → 9 · Q(√5)',source:I,section:'§3.2.1',description:'4重点と3重点を持つ6本から、二つの実 splitting triangle を構成する。',topology:'unknown',classification:'標識付きモジュライの分離。ここでは位相的非同型とは判定しない。'},
  {id:'ny',name:'Nazir–Yoshinaga',tag:'6 → 9 · Q(i)',source:I,section:'§3.2.2',description:'同じ6本で pivot を変え、10個の3重点を持つ二つの複素配置を構成する。',topology:'conjugate',classification:'複素共役の arithmetic pair。通常の非標識 Zariski pair とは表示しない。'}
  ,{id:'quadrilateral',name:'Splitting quadrilateral',tag:'7 → 11 · Q(√2)',source:I,section:'§3.3',description:'4本の support と4個の pivot を選び、splitting 四角形を構成する。',topology:'unknown',classification:'文献のモジュライ分離の例。位相的非同型とは判定しない。'}
];
function maclaneBase(extra=[]){
  const F=fieldFromSpec({type:'sqrt',base:{type:'Q'},radicand:'-3',symbol:'a'}),base=projectiveArrangement([...base5,...extra],Rational),p=makePlinth(base,macSupport,macPivots),root={s:F.one,t:parseFieldExpression('(-1+a)/2',F)},result=checkPolygon(p,root,F);
  if(!result.valid)throw Error('MacLane 基礎配置の検算に失敗しました');return {field:F,lines:result.lines};
}
export function plinthPreset(id,{conjugate=false}={}){
  const preset=PLINTH_PRESETS.find(p=>p.id===id);if(!preset)throw Error('例が見つかりません');let F=Rational,lines,support,pivots;
  if(id==='rational13'){lines=rational10;support=[0,1,6];pivots=[[2,5],[0,7],[4,5]];}
  if(id==='fs13'){
    F=fieldFromSpec({type:'sqrt',base:{type:'Q'},radicand:'5',symbol:'a'});
    lines=[...base6,['1','p','-1'],['p','-p','1'],['-p','p-1','0'],['1','0','-p']];support=[0,1,4];pivots=[[4,6],[3,9],[3,7]];
  }
  if(id==='ml11'){const mac=maclaneBase();F=mac.field;lines=mac.lines;support=[0,1,3];pivots=[[2,3],[0,5],[1,4]];}
  if(id==='rybnikov'){const mac=maclaneBase([[1,1,-3],[1,1,-7]]);F=mac.field;lines=mac.lines;support=[0,1,5];pivots=[[2,5],[2,6],[1,6]];}
  if(id==='maclane'){lines=base5;support=macSupport;pivots=macPivots;}
  if(id==='fs'){lines=base6;support=[0,1,4];pivots=[[2,3],[0,5],[1,3]];}
  if(id==='ny'){lines=base6;support=[0,1,3];pivots=[[2,3],[0,5],[1,4]];}
  if(id==='quadrilateral'){lines=[...base6,[1,-1,1]];support=[1,3,2,4];pivots=[[2,6],[0,5],[1,3],[2,3]];}
  const base=projectiveArrangement(lines,F);
  if(conjugate&&F.degree===2)base.lines=base.lines.map(l=>l.map(x=>F.add(F.from(x.a),F.mul(F.from(F.base.neg(x.b)),F.generator))));
  const infinity=base.lines.findIndex(l=>F.is0(l[0])&&F.is0(l[1]));
  return {version:1,preset:id,conjugate,name:preset.name,field:F.spec,lines:base.lines.map(l=>l.map(F.str)),support:support.slice(),pivots:pivots.map(p=>p.slice()),branch:0,mode:'roots',lambda:'1',chartLine:Math.max(0,infinity),stage:0,guidedTrace:1};
}
