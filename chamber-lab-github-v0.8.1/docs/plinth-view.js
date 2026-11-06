import {deconeProjective} from './plinth-core.js';
import {clipLineToView,projectPoint} from './rotation.js';
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const lName=(i,n)=>i<n?'L'+(i+1):'E'+(i-n+1);
export function fieldDescription(F){return F.base?fieldDescription(F.base)+'; '+F.symbol+'² = '+F.base.str(F.radicand):'Q';}
export function polynomialText(coeffs,variable='λ'){
  const terms=coeffs.map((c,i)=>c==='0'?null:(i===0?c:(c==='1'?'':c==='-1'?'-':'('+c+')·')+variable+(i===2?'²':''))).filter(Boolean);return terms.reverse().join(' + ').replaceAll('+ -','− ')||'0';
}
export const equationText=(line,F)=>line.map((x,i)=>'('+F.str(x)+')'+['x','y','z'][i]).join(' + ')+' = 0';
export function isRealElement(x,F){if(!F.base)return true;if(F.base.degree===1&&F.radicand.n>0n)return true;if(F.base.is0(x.b))return isRealElement(x.a,F.base);return false;}
export const realArrangement=(lines,F)=>lines.every(l=>l.every(x=>isRealElement(x,F)));
function numericPoint(p,chart,F){if(!p)return null;const point=chart.point(p);return point?point.map(x=>F.num(x)[0]):null;}
export function constructionStep(plinth,polygon,model){
  const r=plinth?.r||model.support.length,stage=Math.max(0,Math.min(r,Math.trunc(Number(model.stage)||0))),i=Math.max(0,stage-1);
  return {r,stage,i,source:polygon?.corners?.[i],pivot:polygon?.pivots?.[i],target:stage?polygon?.corners?.[i+1]:null,start:polygon?.corners?.[0],returned:polygon?.corners?.[r],sourceName:'Q'+(i+1),pivotName:'P'+(i+1),targetName:i===r-1?'R₁':'Q'+(i+2),closure:stage<r?'pending':polygon?.corners?polygon.closed?'closed':'open':'unavailable'};
}
export function plotBounds(base,polygon,F,chartLine,fitAll=false,includePivots=false){
  const lines=polygon?.lines||base.lines.map(l=>l.map(x=>F.from(x))),chart=deconeProjective(lines,Math.min(chartLine,lines.length-1),F),focus=polygon?.corners&&!fitAll?[...polygon.corners,...(includePivots?polygon.pivots:[])]:(polygon?.points||base.points).map(p=>p.p.map(x=>F.from(x))),points=focus.map(p=>numericPoint(p,chart,F)).filter(p=>p&&p.every(Number.isFinite));
  if(points.length<2)points.push([-2,-2],[2,2]);const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return {minX,maxX,minY,maxY};
}
export function plotView(base,polygon,F,model,bounds=null){
  const lines=polygon?.lines||base.lines,index=Math.min(Number(model.chartLine)||0,lines.length-1),b=bounds||plotBounds(base,polygon,F,index,model.fitAll,model.fitPivots),width=900,height=460;
  let w=(b.maxX-b.minX||1)*1.8,h=(b.maxY-b.minY||.7)*1.8;if(w/h<width/height)w=h*width/height;else h=w*height/width;
  const zoom=Math.max(.25,Math.min(5,Number(model.plotZoom)||1)),pan=Array.isArray(model.plotPan)?model.plotPan:[0,0];
  return {cx:(b.maxX+b.minX)/2+(Number(pan[0])||0),cy:(b.maxY+b.minY)/2+(Number(pan[1])||0),w:w/zoom,h:h/zoom,angle:0};
}
export function polygonSVG(base,plinth,polygon,F,model,{bounds=null,small=false}={}){
  const n=base.lines.length,lines=polygon?.lines||base.lines.map(l=>l.map(x=>F.from(x))),real=realArrangement(lines,F);
  const staticSVG=svg=>small?svg.replace(/ data-pl-(?:base-line|point)="[^"]*"/g,'').replace(/ role="button" tabindex="0"/g,''):svg;
  if(!real)return staticSVG(polygon?.corners?`${polygonSchematic(plinth,polygon,model)}<details class="pl-incidence-details" ${model.incidenceOpen?'open':''}><summary>基礎配置を含む incidence graph を開く・図から選ぶ</summary>${incidenceSVG(base,plinth,polygon,F,model)}</details>`:incidenceSVG(base,plinth,polygon,F,model));
  const trace=constructionStep(plinth,polygon,model),width=900,height=460,index=Math.min(Number(model.chartLine)||0,lines.length-1),chart=deconeProjective(lines,index,F);
  const view=plotView(base,polygon,F,model,bounds),project=p=>projectPoint(p,view,width,height),colors=['#c39443','#a97a35','#d1aa62','#977534','#c0a573','#986e44','#b68d61','#8a683e'],sourceColor='#167f78',pivotColor='#b47c22',targetColor='#bd426e',at=p=>{const q=numericPoint(p,chart,F);return q?project(q):null;},inside=p=>p&&p[0]>=24&&p[0]<=width-24&&p[1]>=45&&p[1]<=height-28;let out='';
  const labels=[];
  function label(p,name,color){
    const tw=Math.min(290,name.length*8+12),th=21,candidates=[[13,-16],[13,28],[-tw-13,-16],[-tw-13,28],[13,-38],[-tw-13,-38]];
    const scored=candidates.map(([dx,dy])=>{const x=Math.max(8,Math.min(width-tw-8,p[0]+dx)),y=Math.max(54,Math.min(height-32,p[1]+dy)),rect=[x,y-th,tw,th],overlap=labels.reduce((s,[a,b,c,d])=>s+Math.max(0,Math.min(x+tw,a+c)-Math.max(x,a))*Math.max(0,Math.min(y,b+d)-Math.max(y-th,b)),0);return {x,y,rect,score:overlap+Math.abs(x-p[0]-dx)+Math.abs(y-p[1]-dy)};}).sort((a,b)=>a.score-b.score)[0];labels.push(scored.rect);
    return `<text x="${scored.x}" y="${scored.y}" class="pl-trace-label" fill="${color}" pointer-events="none">${esc(name)}</text>`;
  }
  function arrow(a,b,color,thick=2,dashed=false){
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)return '';const ux=dx/len,uy=dy/len,tip=[b[0]-ux*11,b[1]-uy*11],size=Math.min(10,len/5),base=[tip[0]-ux*size,tip[1]-uy*size];
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${thick}" ${dashed?'stroke-dasharray="7 6"':''}/><path d="M${tip[0]},${tip[1]} L${base[0]-uy*size*.5},${base[1]+ux*size*.5} L${base[0]+uy*size*.5},${base[1]-ux*size*.5} Z" fill="${color}"/>`;
  }
  function borderPoint(anchor,direction){
    const a=inside(anchor)?anchor:[width/2,height/2],dx=direction[0],dy=direction[1],ts=[dx>0?(width-32-a[0])/dx:dx<0?(32-a[0])/dx:Infinity,dy>0?(height-38-a[1])/dy:dy<0?(58-a[1])/dy:Infinity],t=Math.min(...ts.filter(v=>v>=0));return Number.isFinite(t)?[a[0]+dx*t,a[1]+dy*t]:null;
  }
  const cornerPixels=polygon?.corners?.map(at)||[];
  const step=10**Math.floor(Math.log10(view.w/10));for(let x=Math.ceil((view.cx-view.w/2)/step)*step;x<view.cx+view.w/2;x+=step){const p=project([x,0]);out+=`<line x1="${p[0]}" x2="${p[0]}" y1="0" y2="${height}" stroke="#e6ece2" stroke-width="1"/>`;}
  for(let y=Math.ceil((view.cy-view.h/2)/step)*step;y<view.cy+view.h/2;y+=step){const p=project([0,y]);out+=`<line x1="0" x2="${width}" y1="${p[1]}" y2="${p[1]}" stroke="#e6ece2" stroke-width="1"/>`;}
  if(trace.closure==='closed'&&polygon.valid&&cornerPixels.every(Boolean))out+=`<polygon class="pl-polygon-fill" points="${cornerPixels.slice(0,-1).map(p=>p.join(',')).join(' ')}" fill="#bd426e" fill-opacity=".12" fill-rule="evenodd" pointer-events="none"/>`;
  chart.lines.forEach((line,j)=>{
    const i=chart.indices[j];if(i>=n&&i-n>=trace.stage)return;const ends=clipLineToView(line.map(x=>F.num(x)[0]),view,width,height);if(!ends)return;const support=plinth?.support.indexOf(i)??model.support.indexOf(i),added=i>=n,active=added&&i-n===trace.i,color=added?targetColor:support>=0?colors[support]:'#6c8179',thick=active?2.5:added?1.6:support>=0?1.8:1;
    out+=`<line data-pl-drawn-line="${lName(i,n)}" x1="${ends[0][0]}" y1="${ends[0][1]}" x2="${ends[1][0]}" y2="${ends[1][1]}" stroke="${color}" stroke-width="${thick}" opacity="${active? .75:added? .45:support>=0? .65:.24}" pointer-events="none"/>`;
    if(i<n)out+=`<line class="pl-base-line" data-pl-base-line="${i}" x1="${ends[0][0]}" y1="${ends[0][1]}" x2="${ends[1][0]}" y2="${ends[1][1]}" stroke="transparent" stroke-width="16"><title>${lName(i,n)} を support に選ぶ</title></line>`;
    const p=ends[0].map((v,k)=>v*.88+ends[1][k]*.12);out+=`<text x="${p[0]+5}" y="${p[1]-6}" class="pl-line-label" fill="${color}" pointer-events="none">${lName(i,n)}${support>=0?' / S'+(support+1):''}</text>`;
  });
  for(const [i,point] of base.points.entries()){
    const p=numericPoint(point.p.map(x=>F.from(x)),chart,F);if(!p)continue;const [x,y]=project(p);if(x<0||x>width||y<0||y>height)continue;out+=`<circle data-pl-point="${i}" class="pl-base-point" cx="${x}" cy="${y}" r="${point.lines.length>=3?4:2.5}"><title>${esc(point.id)} = {${point.lines.map(i=>lName(i,n)).join(', ')}} · pivot に選ぶ</title></circle>`;
  }
  if(plinth){
    const source=at(trace.source),pivot=at(trace.pivot||plinth.pivots[trace.i].p.map(x=>F.from(x)));
    if(source&&pivot){const end=inside(pivot)?pivot:borderPoint(source,[pivot[0]-source[0],pivot[1]-source[1]]);if(end)out+=`<g class="pl-pivot-guide" pointer-events="none">${arrow(source,end,pivotColor,1.8,true)}</g>`;}
    for(let i=0;i<trace.stage;i++){const a=cornerPixels[i],b=cornerPixels[i+1];if(a&&b)out+=`<g data-pl-edge-segment="${i}" pointer-events="none">${arrow(a,b,i===trace.i?targetColor:'#bd7089',i===trace.i?5:3.4)}</g>`;}
    if(trace.closure==='open'&&cornerPixels[0]&&cornerPixels.at(-1))out+=`<line class="pl-closure-gap" x1="${cornerPixels[0][0]}" y1="${cornerPixels[0][1]}" x2="${cornerPixels.at(-1)[0]}" y2="${cornerPixels.at(-1)[1]}" stroke="#8e63a8" stroke-width="3" stroke-dasharray="5 5" pointer-events="none"><title>出発点 Q1 と戻り点 R₁ のずれ（追加の辺ではありません）</title></line>`;
    // Draw the active pivot even when its affine position is outside the
    // polygon's view. Infinity gets direction markers, never a finite dot.
    plinth.pivots.forEach((v,i)=>{
      const p=at(v.p.map(x=>F.from(x))),active=i===trace.i;
      if(p&&inside(p)){const [x,y]=p;out+=`<g class="pl-pivot-marker" data-pl-pivot-marker="${i}" pointer-events="none"><path d="M${x},${y-8} L${x+8},${y} L${x},${y+8} L${x-8},${y} Z" fill="${active?'#f7d38a':'#f8e6bd'}" stroke="${pivotColor}" stroke-width="${active?2.8:1.4}"/>${label(p,'P'+(i+1)+(active?' 通る点':''),pivotColor)}</g>`;}
      else if(active&&p&&source){const q=borderPoint(source,[p[0]-source[0],p[1]-source[1]]);if(q)out+=`<g data-pl-pivot-offscreen="${i}" pointer-events="none">${label(q,'P'+(i+1)+' はこの先',pivotColor)}</g>`;}
      else if(active&&!p){
        const j=chart.indices.indexOf(n+i),line=j>=0?chart.lines[j]:null,ends=line?clipLineToView(line.map(x=>F.num(x)[0]),view,width,height):null;
        if(ends){const a=source||[(ends[0][0]+ends[1][0])/2,(ends[0][1]+ends[1][1])/2];ends.forEach((end,k)=>{const q=borderPoint(a,[end[0]-a[0],end[1]-a[1]]);if(q){const near=[q[0]*.83+a[0]*.17,q[1]*.83+a[1]*.17];out+=`<g data-pl-pivot-infinity="${i}" pointer-events="none">${arrow(near,q,pivotColor,2.2,true)}${k?label(q,'P'+(i+1)+' ∞ · この方向',pivotColor):''}</g>`;}});}
      }
    });
    // Q1 remains visible throughout. On closure the two roles share one
    // position, shown by a circle and diamond rather than hiding R1.
    const ordered=[...Array(Math.min(trace.stage+1,cornerPixels.length)).keys()].sort((a,b)=>Number(b===0||b===trace.i||b===trace.stage)-Number(a===0||a===trace.i||a===trace.stage));
    for(const i of ordered){const p=cornerPixels[i];if(!p||!inside(p)||i===trace.r&&polygon.closed)continue;const [x,y]=p,sourcePoint=i===trace.i,start=i===0,target=trace.stage>0&&i===trace.stage,closedStart=start&&trace.closure==='closed',color=target?targetColor:sourceColor,name=closedStart?'Q1 = R₁ · 一致':start?(sourcePoint?'Q1 出発点':'Q1 最初の点'):target?(i===trace.r?'R₁ 戻り点':'Q'+(i+1)+' 到着点'):'Q'+(i+1)+(sourcePoint?' 始める点':'');
      out+=`<g data-pl-corner-marker="${i}" pointer-events="none">${start?`<circle cx="${x}" cy="${y}" r="13" fill="#f1fbf6" stroke="${sourceColor}" stroke-width="2"/>`:''}${target||closedStart?`<path d="M${x},${y-8} L${x+8},${y} L${x},${y+8} L${x-8},${y} Z" fill="#ffe9f0" stroke="${targetColor}" stroke-width="2.5"/>`:`<circle cx="${x}" cy="${y}" r="${sourcePoint?7:5}" fill="#f1fbf6" stroke="${color}" stroke-width="${sourcePoint?3:2}"/>`}${closedStart?`<circle cx="${x}" cy="${y}" r="3" fill="${sourceColor}"/>`:''}${label(p,name,closedStart?sourceColor:color)}</g>`;
    }
  }
  const headline=trace.stage===0?'出発点 Q1 · 「次へ」で E1 を引く':trace.closure==='closed'?polygon.valid?'✓ splitting polygon · Q1 = R₁':'Q1 = R₁ · 退化条件を確認':trace.closure==='open'?'Q1 ≠ R₁ · 閉じていません':`E${trace.stage} · ${trace.sourceName} → ${trace.pivotName} → ${trace.targetName}`;
  out+=`<rect x="12" y="10" width="${Math.min(600,headline.length*11+24)}" height="31" rx="5" fill="#f9fcf7" fill-opacity=".95"/><text x="24" y="31" class="pl-trace-label" fill="${trace.closure==='open'?'#805493':sourceColor}" pointer-events="none">${esc(headline)}</text>`;
  out+=`<text x="15" y="${height-15}" class="pl-plot-caption">${lName(index,n)} を無限遠にする実 affine chart · 作図のみ数値近似</text>`;
  const infiniteCorners=polygon?.corners?.some(p=>!numericPoint(p,chart,F));
  return staticSVG(`<svg data-pl-plot="real" viewBox="0 0 ${width} ${height}" role="img" aria-label="Splitting polygon の実直線図・作図 ${trace.stage} / ${trace.r}">${out}</svg>${infiniteCorners&&!small?`<p class="pl-chart-note">この chart では無限遠の corner があるため、下の模式図でも接続を示します。</p>${polygonSchematic(plinth,polygon,model)}`:''}`);
}
function polygonSchematic(plinth,polygon,model){
  const trace=constructionStep(plinth,polygon,model),{r,stage}=trace,width=900,height=360,closed=polygon.closed,span=closed?2*Math.PI:2*Math.PI-.7,positions=Array.from({length:r+1},(_,i)=>{const a=-Math.PI/2+i*span/r;return [420+210*Math.cos(a),173+105*Math.sin(a)];});if(closed)positions[r]=positions[0];
  let out='';
  if(trace.closure==='closed'&&polygon.valid)out+=`<polygon class="pl-polygon-fill" points="${positions.slice(0,-1).map(p=>p.join(',')).join(' ')}" fill="#bd426e" fill-opacity=".1"/>`;
  for(let i=0;i<stage;i++){
    const a=positions[i],b=positions[i+1],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],dx=mid[0]-420,dy=mid[1]-173,len=Math.hypot(dx,dy)||1,pivot=[mid[0]+dx/len*70,mid[1]+dy/len*55],active=i===trace.i,color=active?'#bd426e':'#bd7089';
    out+=`<g data-pl-edge-segment="${i}"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${active?5:3}"/><text x="${mid[0]+8}" y="${mid[1]-8}" class="pl-trace-label" fill="${color}">E${i+1}</text><line x1="${mid[0]}" y1="${mid[1]}" x2="${pivot[0]}" y2="${pivot[1]}" stroke="#b47c22" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M${pivot[0]},${pivot[1]-6} l6,6 l-6,6 l-6,-6 Z" fill="#f7d38a" stroke="#b47c22"/><text x="${pivot[0]+10}" y="${pivot[1]+4}" class="pl-trace-label" fill="#a57720">P${i+1}${active?' 通る点':''}</text></g>`;
  }
  if(trace.closure==='open')out+=`<line class="pl-closure-gap" x1="${positions[0][0]}" y1="${positions[0][1]}" x2="${positions[r][0]}" y2="${positions[r][1]}" stroke="#8e63a8" stroke-width="2" stroke-dasharray="5 5"/>`;
  positions.slice(0,stage+1).forEach((p,i)=>{
    if(i===r&&closed)return;const target=i===stage&&stage>0,combined=i===0&&trace.closure==='closed',source=i===trace.i,name=combined?'Q1 = R₁ · 一致':i===r?'R₁ 戻り点':'Q'+(i+1)+(i===0?' 出発点':source?' 始める点':target?' 到着点':''),color=target?'#bd426e':'#167f78',below=p[1]>173;
    out+=`<g data-pl-corner-marker="${i}">${i===0?`<circle cx="${p[0]}" cy="${p[1]}" r="12" fill="#f1fbf6" stroke="#167f78" stroke-width="2"/>`:''}${target||combined?`<path d="M${p[0]},${p[1]-7} l7,7 l-7,7 l-7,-7 Z" fill="#ffe9f0" stroke="#bd426e" stroke-width="2"/>`:`<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#f1fbf6" stroke="${color}" stroke-width="2"/>`}<text x="${p[0]+15}" y="${p[1]+(below?24:-14)}" class="pl-trace-label" fill="${color}">${esc(name)}</text><text x="${p[0]+15}" y="${p[1]+(below?40:-30)}" class="pl-line-label" fill="#a38749">∈ S${i===r?1:i+1}</text></g>`;
  });
  out+=`<text x="18" y="27" class="pl-trace-label" fill="#537e70">${trace.closure==='closed'&&polygon.valid?'✓ splitting polygon':trace.closure==='open'?'Q1 ≠ R₁ · 閉じていません':'corner・追加直線・pivot の接続をたどる'}</text><text x="18" y="${height-15}" class="pl-plot-caption">接続の模式図 · Pᵢ は Eᵢ 上の pivot · 実平面の座標・距離を表す図ではありません</text>`;
  return `<svg data-pl-plot="schematic" class="pl-polygon-schematic" viewBox="0 0 ${width} ${height}" role="img" aria-label="Splitting polygon の接続の模式図・作図 ${stage} / ${r}">${out}</svg>`;
}
function incidenceSVG(base,plinth,polygon,F,model){
  const n=base.lines.length,lines=polygon?.lines||base.lines,stage=model.stage??plinth?.r??0,points=(polygon?.points||base.points).filter(p=>model.allPoints||p.lines.length>=3),count=Math.max(lines.length,points.length),height=Math.max(420,70+count*23),width=900,lpos=lines.map((_,i)=>[180,35+(i+.5)/lines.length*(height-70)]),ppos=points.map((_,i)=>[650,35+(i+.5)/Math.max(1,points.length)*(height-70)]);let out='';
  points.forEach((p,j)=>p.lines.forEach(i=>{if(i>=n&&i-n>=stage)return;const a=lpos[i],b=ppos[j];out+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${i>=n?'#bd5574':'#bdcbbb'}" stroke-opacity="${i>=n?.8:.35}" stroke-width="${i>=n?1.8:1}"/>`;}));
  lines.forEach((_,i)=>{if(i>=n&&i-n>=stage)return;const [x,y]=lpos[i],support=plinth?.support.indexOf(i)??model.support.indexOf(i);out+=`<g ${i<n?`data-pl-base-line="${i}" role="button" tabindex="0"`:''} class="pl-inc-node"><circle cx="${x}" cy="${y}" r="6" fill="${i>=n?'#bd5574':support>=0?'#bd9140':'#6e9688'}"/><text x="${x-15}" y="${y+4}" text-anchor="end">${lName(i,n)}${support>=0?' / S'+(support+1):''}</text></g>`;});
  points.forEach((p,j)=>{const [x,y]=ppos[j],baseIndex=base.points.findIndex(v=>v.lines.every(i=>p.lines.includes(i))),pivot=plinth?.pivots.findIndex(v=>v.lines.every(i=>p.lines.includes(i)))??-1;out+=`<g class="pl-inc-node" ${baseIndex>=0?`data-pl-point="${baseIndex}" role="button" tabindex="0"`:''}><title>{${p.lines.map(i=>lName(i,n)).join(', ')}}</title><circle cx="${x}" cy="${y}" r="${pivot>=0?7:5}" fill="${pivot>=0?'#c39b4c':'#d5d7c2'}"/><text x="${x+13}" y="${y+4}">${pivot>=0?'P'+(pivot+1)+' · ':''}{${p.lines.map(i=>lName(i,n)).join(', ')}}</text></g>`;});
  out+=`<text x="25" y="${height-12}" class="pl-plot-caption">複素配置の incidence graph · ${model.allPoints?'全交点':'重複度3以上'}と全直線 · 実平面の直線図ではありません</text>`;
  return `<svg data-pl-plot="incidence" viewBox="0 0 ${width} ${height}" role="img" aria-label="複素配置の incidence graph">${out}</svg>`;
}

export function sageExportPlinth(result){
  const F=result.solutions.field,base=result.plinth.base,n=base.lines.length;let code='# Plinth Lab: exact projective coordinates and independent incidence verification\nK0 = QQ\n',levels=[];for(let f=F;f.base;f=f.base)levels.unshift(f);
  levels.forEach((f,i)=>{code+=`R${i}.<T${i}> = PolynomialRing(K${i})\nK${i+1}.<${f.symbol}> = K${i}.extension(T${i}^2 - K${i}(${f.base.str(f.radicand)}))\n`;});
  code+=`K = K${levels.length}\n`;
  result.branches.forEach((b,i)=>{if(!b.lines)return;code+=`\n# Branch ${i+1}: ${b.status}\nA${i} = [vector(K,v) for v in [\n${b.lines.map(l=>'    ['+l.map(F.str).join(', ')+']').join(',\n')}\n]]\n`;
    if(b.valid)code+=`expected${i} = {${b.points.map(p=>'('+p.lines.join(', ')+(p.lines.length===1?',':'')+')').join(', ')}}\nactual${i} = set()\nfor j in range(len(A${i})):\n    for k in range(j+1,len(A${i})):\n        p = A${i}[j].cross_product(A${i}[k])\n        assert p != vector(K,[0,0,0])\n        actual${i}.add(tuple(t for t,L in enumerate(A${i}) if L.dot_product(p)==0))\nassert actual${i} == expected${i}\nassert matrix(K,[A${i}[${result.plinth.support[0]}],A${i}[${n}],A${i}[-1]]).det() == 0\n`;
  });
  return code+'\n# Indexing in this script is zero-based. No general topology-isomorphism claim is made.\n';
}
