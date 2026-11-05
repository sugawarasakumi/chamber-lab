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
  const d=r.decomposition;if(!d.complete)return '';
  const locus=(r.kind==='local'?'V':'R')+'¹<sub>'+r.k+'</sub>',coordinate=r.kind==='local'?'t':'a',space=ambientHTML(r),components=d.components;
  if(!components.length)return `<div class="explicit-decomposition"><div class="explicit-union">${locus} = ∅</div><p class="note">この深さの jumping locus は空集合です。</p></div>`;
  const names=components.length<=8?components.map((_,i)=>'X<sub>'+(i+1)+'</sub>').join(' ∪ '):'X<sub>1</sub> ∪ ⋯ ∪ X<sub>'+components.length+'</sub>';
  return `<section class="explicit-decomposition"><div class="explicit-union">${locus} = ${names}</div><p class="note">各 Xᵢ は、${coordinate} = (${coordinate}₁,…,${coordinate}<sub>${r.n}</sub>) ∈ ${space} が下の全ての方程式を満たす集合です。番号は入力した直線の順です。</p><div class="explicit-components" aria-label="${r.kind==='local'?'Characteristic':'Resonance'} locus の具体的な既約成分">${components.map((c,i)=>`<section class="explicit-component"><div class="component-heading"><b>X<sub>${i+1}</sub></b><span>dim ${c.dimension}</span></div>${c.generators.length?`<div class="component-set"><span class="set-name">X<sub>${i+1}</sub> =</span><span class="set-brace">{</span><div class="component-conditions"><span class="component-ambient">${coordinate} ∈ ${space} ｜</span>${c.generators.map(g=>`<div class="component-equation">${mathHTML(explicitEquation(g))}</div>`).join('')}</div><span class="set-brace">}</span></div>`:`<div class="component-whole">X<sub>${i+1}</sub> = ${space}<small>方程式による制約なし</small></div>`}<details class="component-certificate"><summary>イデアル表示・既約性の検証</summary><div class="component-ideal">P<sub>${i+1}</sub> = ⟨${c.generators.length?c.generators.map(mathHTML).join(', '):'0'}⟩</div><p class="field-note">${esc(c.irreducibilityCertificate||'')}</p></details></section>`).join('')}</div><p class="field-note">C 上の既約成分を集合として表示しています。対応する根基は √J¹<sub>${r.k}</sub> = ${components.map((_,i)=>'P<sub>'+(i+1)+'</sub>').join(' ∩ ')}。jump ideal 自体の非被約構造は下で確認できます。</p></section>`;
}
export function decompositionText(r){
  const name=(r.kind==='local'?'V':'R')+'^1_'+r.k,ambient=r.kind==='local'?'(C*)^'+r.n:'C^'+r.n,coordinate=r.kind==='local'?'t':'a';
  if(!r.decomposition.complete)return name+': decomposition not completed.\n';
  const sets=r.decomposition.components.map(c=>c.generators.length?'{ '+coordinate+' in '+ambient+' | '+c.generators.map(explicitEquation).join(', ')+' }':ambient);
  return name+' =\n'+(sets.length?sets.join('\n  union\n'):'empty set')+'\n';
}
export function decompositionTeX(r){
  const name=(r.kind==='local'?'\\mathcal V':'\\mathcal R')+'^1_{'+r.k+'}',coordinate=r.kind==='local'?'t':'a';
  if(!r.decomposition.complete)return '% '+(r.kind==='local'?'Characteristic':'Resonance')+' decomposition at depth '+r.k+' is not completed.\n';
  const components=r.decomposition.components,space=ambientTeX(r);
  if(!components.length)return '\\[\n'+name+'=\\varnothing.\n\\]\n';
  const sets=components.map(c=>c.generators.length?'\\left\\{'+coordinate+'\\in '+space+'\\;\\middle|\\;\\begin{gathered}'+c.generators.map(g=>mathTeX(explicitEquation(g))).join('\\\\\n')+'\\end{gathered}\\right\\}':space);
  return '% Requires amsmath, amssymb. All components are certified over C.\n\\[\n\\begin{aligned}\n'+name+' &= '+sets.join('\\\\\n&\\quad\\cup ')+'.\n\\end{aligned}\n\\]\n';
}
