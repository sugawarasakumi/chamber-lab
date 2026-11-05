import {netJumpingHTML,jumpingScopeHTML,doubleStarJumpingHTML} from './jumping-panel.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const BLOCK_COLORS=['#bd5277','#2e83b4','#399974'];
export const lineName=(i,n)=>i===n?'H∞':'H'+(i+1);
const power=s=>esc(s).replace(/\^(\d+)/g,'<sup>$1</sup>');
const verdict=v=>v==='UNKNOWN'?'未判定':v;
const kind=c=>c.isNet?'net':c.reduced?'reduced multinet（net ではない）':'nonreduced multinet';

export function alexanderSummaryHTML(data){return `<section class="alexander-summary"><div class="matrix-title"><h3>Alexander 多項式 · Z[t] での因数分解</h3><button data-overview="alexander" class="quiet small">写像・因子を詳しく →</button></div><div id="alexander-summary-result" class="calculation-placeholder">全メリディアンを 1 に送る写像について正確に計算しています…</div></section>`;}

export function alexanderPanelHTML(data){return `<div class="panel-header"><div><h3 style="font-size:13px;font-weight:550;margin:0">Alexander 多項式</h3><p>無限遠直線の扱いが異なる 2 つの写像を区別します。</p></div><span class="tag">EXACT · Z[t] FACTORS</span></div><p class="poly-note">Δ は第一 Alexander 加群 H₁(無限巡回被覆; Q) の Q[t,t⁻¹] 上の order を、原始整数多項式に正規化したものです。±tᵃ の不定性を除き、整数係数で因数表示します。</p><div id="alexander-result" class="calculation-placeholder">多項式行列の order を正確に計算しています…</div><div class="button-row"><button id="export-alexander" class="secondary small" disabled>計算結果 JSON ↓</button><button id="export-alexander-sage" class="quiet small">Affine 計算を SageMath へ ↓</button><button id="recompute-alexander" class="quiet small">再計算</button></div><details class="algorithm-details"><summary>計算対象と方法</summary><p>Affine は μ₁,…,μₙ ↦ 1、射影閉包の μ∞ ↦ −n です。cone は H∞ を含めた n+1 個すべてのメリディアンを 1 に送り、Milnor fiber の H₁ 上のモノドロミー多項式と一致します。</p><p>Affine は普遍 chamber 境界行列に tᵢ=t を代入し、Q[t,t⁻¹] 上の多項式行列を正確に簡約して order を求めます。根における rank だけで多重度を推定する計算ではありません。Λ-free rank が正なら Δ=0 とします。整数ホモロジーの torsion の計算とは異なります。</p></details>`;}

export function alexanderResultHTML(result,data,compact=false){
  const one=(r,cone)=>{
    const heading=cone?`Cone · ${data.n+1} hyperplanes`:`Affine · ${data.n} lines`;
    const map=cone?'μ₁, …, μₙ, μ∞ ↦ 1':`μ₁, …, μₙ ↦ 1　/　μ∞ ↦ −${data.n}`;
    if(!r.available)return `<section class="poly-card"><div class="poly-card-header"><h3>${heading}</h3></div><p class="poly-note">${esc(r.reason)}</p></section>`;
    const poly=r.zero?'0':r.factorized;
    let text=`<section class="poly-card"><div class="poly-card-header"><h3>${heading}</h3>${compact?'':`<span class="count">${r.zero?'Λ-rank '+r.freeRank:'degree '+r.degree}</span>`}</div><div class="math-polynomial">Δ(t) = ${power(poly)}</div><div class="poly-scope">${map}</div>`;
    if(r.zero)text+=`<p class="poly-note">Alexander 加群に rank ${r.freeRank} の free part があるため、order の規約で Δ=0 です。</p>`;
    if(!r.factorizationComplete)text+='<p class="warning">残りの因子の既約性は未確認です。表示を完全な既約因数分解とは扱いません。</p>';
    if(!compact&&!r.zero){text+=`<details class="factor-detail"><summary>展開形と各整数因子</summary><div class="math-line">${power(r.expanded)}</div><table class="table factor-table"><thead><tr><th>因子</th><th>Z[t] での表示</th><th>指数</th></tr></thead><tbody>${r.factors.map(f=>`<tr><td>Φ<sub>${f.order}</sub>(t)</td><td>${power(f.polynomial)}</td><td>${f.exponent}</td></tr>`).join('')}</tbody></table></details>`;}
    return text+'</section>';
  };
  return `<div class="poly-grid">${one(result.affine,false)}${one(result.cone,true)}</div>${compact?'<p class="poly-note">Affine の「全て」は入力した直線を指します。cone の「全て」には H∞ も含まれます。</p>':'<p class="alexander-normalization">正規化：Q[t,t⁻¹] 上の order の原始整数代表、最高次係数は正、t の単項式因子を除去。Δ=1 は Alexander 加群の有理 torsion 部分が自明である場合を含みます。</p>'}`;
}

export function netsPanelHTML(data,state){
  const N=data.n+1,support=state.netSupport??Array.from({length:N},(_,i)=>i),chosen=new Set(support);
  return `<div class="panel-header"><div><h3 style="font-size:13px;font-weight:550;margin:0">net / multinet の存在性</h3><p>直線の分割・正の整数重み・基点での釣り合い・連結性を検査します。</p></div><span class="tag">EXACT · CERTIFICATE</span></div><p class="poly-note">判定対象はチェックした射影直線の集合です。初期状態は入力した ${data.n} 本と H∞。部分配置を調べる場合は、その直線だけを選んでください。非自明な構造（d≥2、基点が 2 点以上）を対象とし、全ての部分配置の自動列挙はしません。</p><div class="support-controls"><button id="net-support-all" class="secondary small">全直線を選ぶ</button><button id="net-support-finite" class="quiet small">H∞ を除く</button><span id="net-support-count" class="support-label">${support.length} / ${N} 本を選択</span></div><div class="support-list">${Array.from({length:N},(_,i)=>`<label class="support-check"><input type="checkbox" class="net-support-checkbox" value="${i}" ${chosen.has(i)?'checked':''}>${lineName(i,data.n)}</label>`).join('')}</div><div class="net-scope"><div class="button-row" style="margin:0"><button id="run-net-search" class="primary">この集合で判定する</button><button id="clear-net-coloring" class="quiet small" disabled>図の分割色を切り替える</button></div><label>探索上限（状態数）<input id="net-budget" type="number" min="1" max="10000000" value="${Number(state.netBudget)||200000}"></label></div>${jumpingScopeHTML()}${doubleStarJumpingHTML(data.preset)}<div id="net-result" class="calculation-placeholder">許容分割と正の重みを正確に調べています…</div><details class="algorithm-details"><summary>判定の範囲・非存在の根拠</summary><p>実直線配置の非自明 multinet は 3 クラスのみを調べれば十分です。4 クラスの multinet は 4-net になり、実 4-net は存在しません。<a href="https://www.journalofsing.org/volume11/torielli-yoshinaga.pdf" target="_blank" rel="noopener">Torielli–Yoshinaga, Theorems 2.2, 5.2 ↗</a></p><p>各分割について Cartan 行列の正の核から重みを決定し、<a href="https://arxiv.org/abs/math/0603166" target="_blank" rel="noopener">Falk–Yuzvinsky の multinet の全条件 ↗</a>を再検証します。重みを一定値以下に制限する探索ではありません。NO は選んだ集合の許容分割を尽くした場合など、非存在を証明できた場合だけ表示します。上限到達は未判定です。</p></details>`;
}

export function netsResultHTML(result,data,state){
  const status=[['net',result.net],['reduced multinet',result.reducedMultinet],['multinet',result.multinet]];
  const cards=`<div class="net-verdicts">${status.map(([name,r])=>`<div class="net-verdict ${r.verdict.toLowerCase()}"><span>${name}</span><strong>${verdict(r.verdict)}</strong></div>`).join('')}</div>`;
  const exhaustive=result.exhausted?'指定した集合の許容分割を全て検査しました。':'探索上限に到達しました。NO と表示していない項目の非存在は証明していません。';
  const intro=result.trivialPencil?'<div class="info-box">選んだ直線は全て共点です。自明な (k,1)-net はありますが、ここでは非自明な net / multinet と区別しています。</div>':'';
  let html=intro+cards+`<div class="net-search-status">${result.fullSupport?'全配置（H∞ 含む）':'選択した部分配置'} · ${result.supportedIndices.length} 本 / ${result.states} 探索状態 / ${result.partitions} 分割<br>${exhaustive}<br>reduced は「全ての直線重みが 1」の意味で、net を含みます。</div>`;
  if(result.certificates.length){const selected=Math.max(0,Math.min(result.certificates.length-1,Number(state.netResultIndex)||0)),c=result.certificates[selected];html+=`<section class="net-certificate"><div class="net-certificate-header"><h3>検証済みの構造</h3><select id="net-certificate-choice" aria-label="net multinet の構造を選ぶ">${result.certificates.map((v,i)=>`<option value="${i}" ${i===selected?'selected':''}>#${i+1} · (3,${v.degree}) ${kind(v)}</option>`).join('')}</select></div><div class="net-blocks">${c.blocks.map((block,b)=>`<div class="net-block" style="--block-color:${BLOCK_COLORS[b]}"><h4>Class ${b+1}</h4><div class="formula">${block.map(i=>lineName(i,data.n)+(c.weights[i]==='1'?'':' × '+esc(c.weights[i]))).join(', ')}</div><div class="degree">重みの和 d = ${esc(c.degree)}</div></div>`).join('')}</div><p class="net-color-key">上の図では直線を 3 色に分け、重みが 2 以上の直線に重みを併記します。${c.supportedIndices.includes(data.n)?'H∞ のクラスと重みは表に表示します。':''}</p><details><summary>基点と各クラスの重みの和（${c.basepoints.length} 点）</summary><div class="certificate-table"><table class="table"><thead><tr><th>基点</th><th>射影座標</th><th>Class 1 / 2 / 3</th></tr></thead><tbody>${c.basepoints.map(p=>`<tr><td>${esc(p.id)}</td><td>[${p.hom.map(esc).join(':')}]</td><td>${p.blockWeights.map(esc).join(' / ')}</td></tr>`).join('')}</tbody></table></div></details><p class="verification">✓ クラス次数・全クラス間交点・各基点の釣り合い・クラス内連結性を確認</p>${netJumpingHTML(result.jumping?.[selected])}</section>`;}
  else if(result.exhausted)html+='<p class="poly-note">選んだ集合全体を台とする非自明 multinet はありません。これは別の部分配置の非存在まで主張する結果ではありません。</p>';
  html+='<div class="button-row"><button id="export-net-result" class="secondary small">判定と構造 JSON ↓</button></div>';
  return html;
}
