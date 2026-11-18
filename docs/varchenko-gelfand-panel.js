import {varchenkoGelfand} from './varchenko-gelfand.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const relationNames={idempotent:'二乗',empty:'空交差',circuit:'回路'};
const models=new WeakMap();

function modelFor(data,mode){
  if(!models.has(data))models.set(data,new Map());
  const byMode=models.get(data);
  if(!byMode.has(mode))byMode.set(mode,varchenkoGelfand(data,mode));
  return byMode.get(mode);
}

function variableHTML(label,symbol){
  return `${symbol}<sub>${esc(label.slice(1))}</sub>`;
}

function monomialHTML(labels,mask,symbol){
  return labels.filter((_,index)=>mask&2**index).map(label=>variableHTML(label,symbol)).join('')||'1';
}

function sumHTML(terms,monomial){
  if(!terms.length)return '0';
  return terms.map((term,index)=>{
    const negative=term.coefficient<0n, magnitude=negative?-term.coefficient:term.coefficient;
    const m=monomial(term);
    const prefix=negative?'−':index?'+':'';
    const factor=m==='1'?magnitude:magnitude===1n?'':`${magnitude}·`;
    return `<span class="vg-term">${prefix}${prefix&&index?' ':''}${factor}${m==='1'?'':m}</span>`;
  }).join(' ');
}

function polynomialHTML(labels,terms,symbol){
  return sumHTML(terms,({mask,square})=>square===undefined
    ? monomialHTML(labels,mask,symbol)
    : `${variableHTML(labels[square],symbol)}<sup>2</sup>`);
}

function pageControls(){
  return `<div class="vg-page-controls" hidden>
    <button type="button" class="quiet small" data-vg-previous>前へ</button>
    <span data-vg-range aria-live="polite"></span>
    <button type="button" class="quiet small" data-vg-next>次へ</button>
  </div>`;
}

function paginate(section,entries,size,render){
  const rows=section.querySelector('[data-vg-rows]'),controls=section.querySelector('.vg-page-controls');
  const previous=controls.querySelector('[data-vg-previous]'),next=controls.querySelector('[data-vg-next]');
  const range=controls.querySelector('[data-vg-range]');
  let start=0;
  function show(){
    const end=Math.min(start+size,entries.length);
    rows.innerHTML=render(entries.slice(start,end));
    range.textContent=`${start+1}–${end} / ${entries.length}`;
    previous.disabled=start===0;
    next.disabled=end===entries.length;
  }
  previous.onclick=()=>{start-=size;show();};
  next.onclick=()=>{start+=size;show();};
  controls.hidden=entries.length<=size;
  show();
}

function presentationHTML(title,labels,symbol,ideal,count,id){
  const variables=labels.map(h=>variableHTML(h,symbol)).join(', ');
  return `<section class="vg-card" id="${id}">
    <h3>${title}</h3>
    <p class="vg-expression">ℤ${variables?`[${variables}]`:''} / ${count?ideal:'(0)'}</p>
    <p class="note">${ideal} の生成元 ${count} 本</p>
    <ul class="vg-relations" data-vg-rows></ul>${pageControls()}
  </section>`;
}

function optionsHTML(values,format,defaultMask){
  return values.map(item=>`<option value="${item.mask}"${item.mask===defaultMask?' selected':''}>${esc(format(item))}</option>`).join('');
}

function plainMonomial(labels,{indices}){
  return indices.map(i=>'x'+labels[i].slice(1)).join(' · ')||'1';
}

function chamberLabel({id,signs}){
  return signs.length?`${id} · ${signs.map(sign=>sign>0?'+':'−').join('')}`:id;
}

function outputHTML(model){
  const {mode,labels,basis,hilbert,order,chambers,filteredRelations,gradedRelations}=model;
  const cone=mode==='cone';
  const productOptions=optionsHTML(basis,item=>plainMonomial(labels,item),basis[1]?.mask??basis[0].mask);
  const basisOptions=optionsHTML(basis,item=>plainMonomial(labels,item));
  const chamberOptions=optionsHTML(chambers,chamberLabel);
  const orderHTML=order.map(i=>variableHTML(labels[i],'H')).join(' &lt; ')||'∅';
  const signsHTML=labels.map(h=>variableHTML(h,'H')).join(', ')||'∅';
  const ranks=hilbert.map((rank,degree)=>`<span>次数 ${degree} <b>${rank}</b></span>`).join('');
  return `<p class="note">x<sub>i</sub>(C) は、chamber C が正規化方程式 a<sub>i</sub>x + b<sub>i</sub>y + c<sub>i</sub>${cone?'z':''} &gt; 0 の側にあるとき 1、反対側で 0。${cone?'x<sub>∞</sub> は z &gt; 0 の指示関数。':''} F<sub>d</sub> は x<sub>i</sub> の全次数 d 以下の多項式の像で、u<sub>i</sub> は x<sub>i</sub> の F<sub>1</sub>/F<sub>0</sub> における像です。</p>
    <div class="vg-grid">
      ${presentationHTML('Filtered 環',labels,'x','I',filteredRelations.length,'vg-filtered')}
      ${presentationHTML('Associated graded 環',labels,'u','J',gradedRelations.length,'vg-graded')}
    </div>
    <section class="vg-section" id="vg-basis">
      <h3>NBC 基底</h3>
      <p class="note">順序 ${orderHTML}。回路から最小元を除いた集合を含まない独立な台が NBC 基底を与えます。</p>
      <div class="vg-ranks" aria-label="次数別の NBC 基底数">${ranks}<span>合計 <b>${basis.length}</b></span></div>
      <div class="vg-table"><table class="table"><thead><tr><th scope="col">次数</th><th scope="col">台</th><th scope="col">Filtered</th><th scope="col">Graded</th></tr></thead><tbody data-vg-rows></tbody></table></div>
      ${pageControls()}
    </section>
    <section class="vg-section">
      <h3>NBC 基底元の積</h3>
      <div class="controls-row vg-controls">
        <label>左因子<select id="vg-product-left">${productOptions}</select></label>
        <label>右因子<select id="vg-product-right">${productOptions}</select></label>
      </div>
      <div id="vg-product" class="vg-grid" aria-live="polite"></div>
    </section>
    <section class="vg-section">
      <h3>Chamber 指示関数と NBC 基底の基底変換</h3>
      <p class="note">Filtered 環で δ<sub>C</sub> は chamber C で 1、他の chamber で 0。符号は ${signsHTML} の順です。${cone?' ⁺ と ⁻ は z の符号を表します。':''}</p>
      <div class="vg-grid">
        <div class="vg-card">
          <label>NBC → chamber 指示関数<select id="vg-forward">${basisOptions}</select></label>
          <div id="vg-forward-result" class="vg-expression" aria-live="polite"></div>
        </div>
        <div class="vg-card">
          <label>Chamber 指示関数 → NBC<select id="vg-backward">${chamberOptions}</select></label>
          <div id="vg-backward-result" class="vg-expression" aria-live="polite"></div>
        </div>
      </div>
    </section>`;
}

function bindOutput(container,model){
  const {labels,basis,chambers,filteredRelations,gradedRelations}=model;
  const find=selector=>container.querySelector(selector);
  const supportHTML=indices=>indices.map(i=>variableHTML(labels[i],'H')).join(', ');
  const showRelations=(section,relations,symbol)=>paginate(find(section),relations,12,rows=>rows.length
    ? rows.map(({kind,support,terms})=>`<li><div class="vg-expression">${polynomialHTML(labels,terms,symbol)}</div><small>${relationNames[kind]} · ${supportHTML(support)}</small></li>`).join('')
    : '<li>生成元なし</li>');
  showRelations('#vg-filtered',filteredRelations,'x');
  showRelations('#vg-graded',gradedRelations,'u');
  paginate(find('#vg-basis'),basis,16,rows=>rows.map(({degree,indices,mask})=>`<tr><td>${degree}</td><td>${supportHTML(indices)||'∅'}</td><td>${monomialHTML(labels,mask,'x')}</td><td>${monomialHTML(labels,mask,'u')}</td></tr>`).join(''));

  const left=find('#vg-product-left'),right=find('#vg-product-right'),product=find('#vg-product');
  function showProduct(){
    const a=Number(left.value),b=Number(right.value);
    product.innerHTML=[['filtered','x','Filtered'],['graded','u','Graded']].map(([ring,symbol,title])=>
      `<div class="vg-card"><p class="note">${title}</p><div class="vg-expression">${monomialHTML(labels,a,symbol)} · ${monomialHTML(labels,b,symbol)} = ${polynomialHTML(labels,model.product(a,b,ring),symbol)}</div></div>`).join('');
  }
  left.onchange=right.onchange=showProduct;
  showProduct();

  const chamberByMask=new Map(chambers.map(chamber=>[chamber.mask,chamber]));
  const indicator=mask=>`δ<sub>${esc(chamberByMask.get(mask).id)}</sub>`;
  const forward=find('#vg-forward'),backward=find('#vg-backward');
  const forwardResult=find('#vg-forward-result'),backwardResult=find('#vg-backward-result');
  function showForward(){
    const mask=Number(forward.value);
    forwardResult.innerHTML=`${monomialHTML(labels,mask,'x')} = ${sumHTML(model.toChambers(mask),term=>indicator(term.mask))}`;
  }
  function showBackward(){
    const mask=Number(backward.value);
    backwardResult.innerHTML=`${indicator(mask)} = ${polynomialHTML(labels,model.toNBC(mask),'x')}`;
  }
  forward.onchange=showForward;
  backward.onchange=showBackward;
  showForward();showBackward();
}

export function mountVarchenkoGelfandPanel(el,data,initialMode,onModeChange){
  el.innerHTML=`<section class="vg-panel" aria-labelledby="vg-title">
    <div class="panel-header">
      <div><h2 id="vg-title">Varchenko–Gelfand 環</h2><p>Chamber 上の整数値関数を、正の半空間の指示関数で生成します。</p></div>
    </div>
    <div class="controls-row"><label>配置<select id="vg-mode"><option value="affine">Affine 配置</option><option value="cone">Cone（H∞ を含む）</option></select></label></div>
    <div id="vg-output"></div>
  </section>`;
  const select=el.querySelector('#vg-mode'),output=el.querySelector('#vg-output');
  select.value=initialMode==='cone'?'cone':'affine';
  function show(){
    try{
      const model=modelFor(data,select.value);
      output.innerHTML=outputHTML(model);
      bindOutput(output,model);
    }catch(error){
      output.innerHTML=`<div class="panel-error">${esc(error.message)}</div>`;
    }
  }
  select.onchange=()=>{onModeChange(select.value);show();};
  show();
}
