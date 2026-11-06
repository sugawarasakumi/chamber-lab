// Display/export only. Equations come directly from certified prime generators;
// no components, constraints, or decompositions are inferred here.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monomial='(?:1|[at]\\d+(?:\\^\\d+)?(?:\\*[at]\\d+(?:\\^\\d+)?)*)';
const difference=new RegExp('^('+monomial+')-('+monomial+')$');
const plusOne=new RegExp('^('+monomial+')\\+1$');
export function explicitEquation(polynomial){
  const p=String(polynomial).replace(/\s+/g,''),pair=p.match(difference),negative=p.match(plusOne);
  if(pair)return pair[1]+' = '+pair[2];
  if(negative)return negative[1]+' = -1';
  return p+' = 0';
}
function mathHTML(s){return esc(s).replace(/\^\((-?\d+)\)|\^(-?\d+)/g,(_,a,b)=>'<sup>'+(a??b)+'</sup>').replace(/\b([at])(\d+)/g,'$1<sub>$2</sub>').replaceAll('*','·').replaceAll('-','−');}
function mathTeX(s){return s.replace(/\b([at])(\d+)/g,'$1_{$2}').replace(/\^\((-?\d+)\)|\^(-?\d+)/g,(_,a,b)=>'^{'+(a??b)+'}').replace(/(\d+)\/(\d+)/g,'\\frac{$1}{$2}').replaceAll('*','\\,');}
const ambientHTML=r=>r.kind==='local'?`(C*)<sup>${r.n}</sup>`:`C<sup>${r.n}</sup>`;
const ambientTeX=r=>r.kind==='local'?`(\\mathbb C^*)^{${r.n}}`:`\\mathbb C^{${r.n}}`;
export function explicitDecompositionHTML(r){
  const d=r.decomposition;
  const locus=(r.kind==='local'?'V':'R')+'¹<sub>'+r.k+'</sub>',coordinate=r.kind==='local'?'t':'a',space=ambientHTML(r),components=d.components;
  if(!components.length)return d.complete?`<div class="explicit-decomposition"><div class="explicit-union">${locus} = ∅</div><p class="note">この深さの jumping locus は空集合です。</p></div>`:'<p class="note">表示できる部分空間はまだありません。全成分の探索は未完了で、空集合とは判定していません。</p>';
  const names=components.length<=8?components.map((_,i)=>'X<sub>'+(i+1)+'</sub>').join(' ∪ '):'X<sub>1</sub> ∪ ⋯ ∪ X<sub>'+components.length+'</sub>';
  return `<section class="explicit-decomposition"><div class="explicit-union">${locus} ${d.complete?'=':'⊇'} ${names}</div><p class="note">${d.complete?'各 Xᵢ は既約成分です。':'確認できた部分空間を表示しています。全成分の列挙と各空間の最大性は未確定です。'}各 Xᵢ は、${coordinate} = (${coordinate}₁,…,${coordinate}<sub>${r.n}</sub>) ∈ ${space} が下の全ての方程式を満たす集合です。番号は入力した直線の順です。</p><div class="explicit-components" aria-label="${r.kind==='local'?'Characteristic':'Resonance'} locus の${d.complete?'具体的な既約成分':'確認できた部分空間'}">${components.map((c,i)=>`<section class="explicit-component"><div class="component-heading"><b>X<sub>${i+1}</sub></b><span>dim ${c.dimension}</span></div>${c.generators.length?`<div class="component-set"><span class="set-name">X<sub>${i+1}</sub> =</span><span class="set-brace">{</span><div class="component-conditions"><span class="component-ambient">${coordinate} ∈ ${space} ｜</span>${c.generators.map(g=>`<div class="component-equation">${mathHTML(explicitEquation(g))}</div>`).join('')}</div><span class="set-brace">}</span></div>`:`<div class="component-whole">X<sub>${i+1}</sub> = ${space}<small>方程式による制約なし</small></div>`}<details class="component-certificate"><summary>イデアル表示・既約性の検証</summary><div class="component-ideal">P<sub>${i+1}</sub> = ⟨${c.generators.length?c.generators.map(mathHTML).join(', '):'0'}⟩</div><p class="field-note">${esc(c.irreducibilityCertificate||'')}</p></details></section>`).join('')}</div><p class="field-note">${d.complete?`C 上の既約成分を集合として表示しています。対応する根基は √J¹<sub>${r.k}</sub> = ${components.map((_,i)=>'P<sub>'+(i+1)+'</sub>').join(' ∩ ')}。${r.ideal?.skipped?'jump ideal 自体の非被約構造は計算していません。':'jump ideal 自体の非被約構造は下で確認できます。'}`:'表示した各空間が jumping locus に含まれることを検証しました。全体の根基の分解は未確定です。'}</p></section>`;
}
export function decompositionText(r){
  const name=(r.kind==='local'?'V':'R')+'^1_'+r.k,ambient=r.kind==='local'?'(C*)^'+r.n:'C^'+r.n,coordinate=r.kind==='local'?'t':'a';
  const complete=r.decomposition.complete;
  if(!complete&&!r.decomposition.components.length)return name+': decomposition not completed; no subspaces listed. This does not assert an empty locus.\n';
  const sets=r.decomposition.components.map(c=>c.generators.length?'{ '+coordinate+' in '+ambient+' | '+c.generators.map(explicitEquation).join(', ')+' }':ambient);
  return (complete?'':'# Verified subspaces only; completeness and maximality are unconfirmed.\n')+name+(complete?' =\n':' contains\n')+(sets.length?sets.join('\n  union\n'):'empty set')+'\n';
}
export function decompositionTeX(r){
  const name=(r.kind==='local'?'\\mathcal V':'\\mathcal R')+'^1_{'+r.k+'}',coordinate=r.kind==='local'?'t':'a';
  const complete=r.decomposition.complete;
  if(!complete&&!r.decomposition.components.length)return '% Decomposition not completed; no subspaces listed. An empty locus is not asserted.\n';
  const components=r.decomposition.components,space=ambientTeX(r);
  if(!components.length)return '\\[\n'+name+'=\\varnothing.\n\\]\n';
  const sets=components.map(c=>c.generators.length?'\\left\\{'+coordinate+'\\in '+space+'\\;\\middle|\\;\\begin{gathered}'+c.generators.map(g=>mathTeX(explicitEquation(g))).join('\\\\\n')+'\\end{gathered}\\right\\}':space);
  return (complete?'% All components are certified over C.\n':'% Verified subspaces only; completeness and maximality are unconfirmed.\n')+'% Requires amsmath, amssymb.\n\\[\n\\begin{aligned}\n'+name+(complete?' &= ':' &\\supseteq ')+sets.join('\\\\\n&\\quad\\cup ')+'.\n\\end{aligned}\n\\]\n';
}
