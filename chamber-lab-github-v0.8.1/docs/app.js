import {q,Q,registerRealField,arrangement,normalizeLine,defaultFlag,autoFlag,lineThrough,maskIndices,symbolicEntry,sageExport,PRESETS} from './math.js';
import {overview} from './overview.js';
import {initPlinthLab} from './plinth-ui.js';
import {EditHistory,deleteLineModel} from './edit-history.js';
import {intersectionPosets} from './intersection-poset.js';
import {intersectionRowsHTML,intersectionInspectorHTML} from './intersection-panel.js';
import {overviewHTML,graphSVG,kpiHTML} from './overview-panel.js';
import {alexanderResultHTML,netsResultHTML,BLOCK_COLORS} from './structures-panel.js';
import {facesResultHTML,faceHasseSVG,magnitudeResultHTML,magnitudeValue} from './combinatorics-panel.js';
import {doubleStarJumpingHTML} from './jumping-panel.js';
import {fieldMetadata,fieldDetailsHTML,groupPanelHTML,groupResultHTML,idealsPanelHTML,idealResultHTML} from './research-panel.js';
import {groupExport} from './fundamental-group.js';
import {singularJumpScript,jumpGeometryKey} from './jump-ideals.js';
import {JUMP_IDEAL_CACHE} from './jump-cache.js';
import {decompositionText,decompositionTeX} from './jump-formulas.js';
import {wrapAngle,toView,fromView,projectPoint,unprojectPoint,viewportCorners,clipLineToView,fitRotatedPoints,flagBottomView,projectToExactLine,pivotForLine,rotatedLine,tangentAngle,flagAfterLineEdit} from './rotation.js';
import {alexanderSage} from './alexander.js';
import {attachPinchZoom} from './pinch-zoom.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT={version:1,viewAngle:0,flagBottom:false,uiRelease:'0.5',netSupport:null,netBudget:200000,netResultIndex:0,overviewPane:'invariants',graphMode:'affine',graphZoom:1,name:PRESETS[0].name,preset:'a3',lines:PRESETS[0].lines,flag:null,tab:'overview',mode:'select',order:3,w:['1','1','1','1','1'],localMode:'cyclic',complex:Array(5).fill([1,0]),homology:false,a:Array(5).fill('1'),field:'fp',p:3,k:1,matrixKind:'local',matrixDisplay:'symbolic'};
let state=structuredClone(DEFAULT);try{const s=JSON.parse(localStorage.getItem('chamber-lab-v1'));if(s?.version===1&&Array.isArray(s.lines)&&s.lines.length<=20)state={...state,...s};if(s?.uiRelease!=='0.5'){state.tab='overview';state.uiRelease='0.5';state.overviewPane='invariants';}}catch{}
const edits=new EditHistory(50);
let angleBefore=null;
let data,selected=null,entrySelected=null,drawStart=null,pointer=null,view,toastTimer,jobNo=0,panelGeneration=0;
let W=920,H=470,panStart=null,skipClick=false,highlightMask=0,netColoring=null,geometryKey=null,faceHighlight=null,faceResult=null,rotationTarget=null,lineGesture=null;
function syncPlotSize(){const r=$('#stage').getBoundingClientRect();if(!r.width||!r.height)return;H=W*r.height/r.width;$('#stage').setAttribute('viewBox',`0 0 ${W} ${H}`);if(view)view.h=view.w*H/W;}
const resultCache=new Map(),worker=new Worker('./worker.js',{type:'module'}),polynomialWorker=new Worker('./worker.js',{type:'module'}),pending=new Map(),structureRequests=new Map();
for(const activeWorker of [worker,polynomialWorker]){activeWorker.onmessage=({data:msg})=>{const p=pending.get(msg.id);if(!p)return;pending.delete(msg.id);msg.error?p.reject(Error(msg.error)):p.resolve(msg.result);};activeWorker.onerror=()=>{for(const [id,p] of pending)if(p.worker===activeWorker){p.reject(Error('計算ワーカーを開始できませんでした。ページを再読み込みしてください。'));pending.delete(id);}};}
function request(type,params){return new Promise((resolve,reject)=>{const id=++jobNo,activeWorker=['alexander','jump-ideal'].includes(type)?polynomialWorker:worker;pending.set(id,{resolve,reject,worker:activeWorker});activeWorker.postMessage({id,type,model:{lines:state.lines,flag:state.flag},params});});}
function persist(){try{localStorage.setItem('chamber-lab-v1',JSON.stringify(state));}catch{}}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4300);}
function snapshot(){return JSON.stringify({model:state,view,line:rotationTarget?{index:rotationTarget.index,pivot:rotationTarget.pivot.map(String)}:null});}
function updateEditControls(){
  for(const id of ['undo','undo-side'])$('#'+id).disabled=!edits.canUndo;
  for(const id of ['redo','redo-side'])$('#'+id).disabled=!edits.canRedo;
  const lineSelected=['line-select','rotate-line'].includes(state.mode)&&rotationTarget;
  $('#delete-line').disabled=!lineSelected;$('#selected-line-status').textContent=lineSelected?'H'+(rotationTarget.index+1)+' を選択中':'「線を選択」で直線を選ぶ';
  $('#history-status').textContent='戻す '+edits.past.length+' / やり直す '+edits.future.length;
}
function restoreSnapshot(saved){
  const old=JSON.parse(saved);state=old.model;view=old.view;geometryKey=null;rebuild(false);
  if(old.line&&old.line.index<data.n)rotationTarget={index:old.line.index,pivot:old.line.pivot.map(q)};
  renderSidebar();renderCanvas();persist();
}
function recordEdit(before){edits.record(before,snapshot());updateEditControls();}
function travelHistory(direction){cancelGesture();drawStart=null;pointer=null;angleBefore=null;const next=edits[direction](snapshot());if(next!==null)restoreSnapshot(next);updateEditControls();}
function changeView(fn){if(lineGesture)return;const before=snapshot();fn();recordEdit(before);persist();}
function change(fn,fit=true){const before=snapshot();try{cancelGesture();fn();rebuild(fit);recordEdit(before);persist();return true;}catch(e){restoreSnapshot(before);toast(e.message);return false;}}
function ensureParams(){if(Array.isArray(state.extraRealFields)){if(state.extraRealFields.length>4)throw Error('追加の実数体定義は4個までです');for(const definition of state.extraRealFields)registerRealField(definition);}state.viewAngle=wrapAngle(state.viewAngle);if(!['select','draw','flag','rotate-line','line-select'].includes(state.mode))state.mode='select';const n=state.lines.length;state.k=Math.max(1,Math.min(n+1,Math.floor(Number(state.k)||1)));for(const key of ['w','a'])state[key]=Array.from({length:n},(_,i)=>state[key]?.[i]??'1');state.complex=Array.from({length:n},(_,i)=>state.complex?.[i]??[1,0]);}
function rebuild(fit=true){ensureParams();data=arrangement(state.lines,state.flag);const nextGeometry=JSON.stringify(data.lines.map(l=>l.map(String)));if(geometryKey!==null&&geometryKey!==nextGeometry){state.netSupport=null;state.netResultIndex=0;}geometryKey=nextGeometry;rotationTarget=null;lineGesture=null;netColoring=null;faceHighlight=null;state.faceSelected=null;state.facePage=0;data.preset=PRESETS.find(p=>p.id===state.preset);data.geometryField=fieldMetadata(data);data.overview=overview(data);data.intersections=intersectionPosets(data);state.intersectionSelected=null;highlightMask=0;state.lines=data.lines.map(l=>l.map(String));state.flag=data.flag.map(String);selected=null;entrySelected=null;drawStart=null;pointer=null;syncPlotSize();if(fit||!view)fitView();renderSidebar();renderCanvas();renderAnalysis();persist();}
function fitView(){
  const angle=wrapAngle(state.viewAngle),points=[...data.vertices.map(v=>v.p),...data.cuts.map(c=>data.point(c.t)),data.f0];
  if(!data.vertices.length)for(const l of data.lines){const [a,b,c]=l.map(Number),norm=a*a+b*b;points.push([-a*c/norm,-b*c/norm]);}
  if(state.flagBottom&&data.adapted){view=flagBottomView(data,W/H);state.viewAngle=view.angle;}else view=fitRotatedPoints(points,W/H,angle);
}
function updateRotationControls(){
  const degrees=wrapAngle(state.viewAngle)*180/Math.PI;
  $('#view-rotation').value=degrees.toFixed(1);$('#view-angle-output').textContent=degrees.toFixed(1)+'°';
  $('#flag-bottom').classList.toggle('active',!!state.flagBottom);$('#flag-bottom').setAttribute('aria-pressed',String(!!state.flagBottom));
}
function setViewAngle(angle){if(lineGesture)return;state.viewAngle=wrapAngle(angle);state.flagBottom=false;view.angle=state.viewAngle;renderCanvas();persist();}
function alignFlagBottom(){
  if(lineGesture)return;
  if(!data.adapted){change(()=>{state.flag=flagAfterLineEdit(state.lines,data.u).map(String);state.flagBottom=true;});return;}
  changeView(()=>{state.flagBottom=true;fitView();renderCanvas();});
}
function rotationOverlaySVG(){
  if(state.mode!=='rotate-line'||!rotationTarget)return '';
  const {index,pivot}=rotationTarget,line=lineGesture?.preview||data.lines[index],ends=svgLine(line),p=project(pivot);let s='';
  if(lineGesture?.moved&&lineGesture.type==='line'&&ends)s+=`<line class="rotation-preview" x1="${ends[0][0]}" y1="${ends[0][1]}" x2="${ends[1][0]}" y2="${ends[1][1]}" stroke="#087e9a" stroke-width="3" stroke-dasharray="9 4" pointer-events="none"/>`;
  if(ends)for(const [i,t] of [.2,.8].entries()){
    const h=ends[0].map((v,j)=>v*(1-t)+ends[1][j]*t);if(Math.hypot(h[0]-p[0],h[1]-p[1])<28)continue;
    s+=`<circle class="rotation-handle" data-rotation-handle="${i}" data-line-index="${index}" cx="${h[0]}" cy="${h[1]}" r="9" role="button" tabindex="0" aria-label="H${index+1} の回転ハンドル ${i+1}。矢印キーで1度回転"><title>ドラッグして回転 · 矢印キーで1°、Shiftで15°</title></circle><circle cx="${h[0]}" cy="${h[1]}" r="2.5" fill="#087e9a" pointer-events="none"/>`;
  }
  s+=`<circle class="rotation-pivot" data-rotation-pivot="true" cx="${p[0]}" cy="${p[1]}" r="8" role="button" tabindex="0" aria-label="H${index+1} の回転の支点。ドラッグで直線上を移動"><title>支点 · 直線上をドラッグして移動</title></circle><path d="M${p[0]-4},${p[1]}h8 M${p[0]},${p[1]-4}v8" stroke="#a76722" stroke-width="1.5" pointer-events="none"/><text x="${p[0]+12}" y="${p[1]-12}" class="pivot-label" pointer-events="none">支点</text>`;
  return s;
}
function deleteSelectedLine(){
  if(!rotationTarget||lineGesture)return;const index=rotationTarget.index;
  if(change(()=>{state=deleteLineModel(state,index);state.mode='line-select';},false))toast('H'+(index+1)+' を削除しました。「戻す」で復元できます。');
}
function renderRotationInspector(el){
  const {index,pivot}=rotationTarget;
  if(state.mode==='line-select'){
    el.innerHTML=`<p class="inspector-title">H${index+1} <span class="chip">選択した直線</span></p><div class="rotation-equation">(${data.lines[index].map(v=>esc(String(v))).join(', ')})</div><p class="note">図の上の「選択した直線を削除」、または Delete キーで直線全体を削除します。編集履歴から復元できます。</p><button id="rotate-selected-line" class="secondary full">この直線を回す</button><button id="inspector-delete-line" class="danger-line full">H${index+1} を削除</button>`;
    $('#rotate-selected-line').onclick=()=>$('#mode-rotate-line').click();$('#inspector-delete-line').onclick=deleteSelectedLine;return;
  }
  el.innerHTML=`<p class="inspector-title">H${index+1} <span class="chip">直線を回す</span></p><div class="rotation-equation">(${data.lines[index].map(v=>esc(String(v))).join(', ')})</div><p class="note">支点 (${pivot.map(v=>esc(String(v))).join(', ')})</p><div class="rotation-nudge"><button id="line-rotate-left" class="secondary small" aria-label="直線を反時計回りに5度">↶ 5°</button><button id="line-rotate-right" class="secondary small" aria-label="直線を時計回りに5度">↷ 5°</button></div><p class="note">線や丸いハンドルをつまんで回転。交点を押すと支点を変更できます。オレンジの支点は直線上を移動できます。</p><button id="pivot-near-vertex" class="quiet small full">近い交点を支点に</button><button id="pivot-screen-center" class="quiet small full">画面中央に近い点を支点に</button><p class="tiny">直線を変えると交点・chamber・計算結果も更新し、flag は外側に取り直します。回転方向は有理数で近似し、支点は正確に保持します。「戻す」で復元できます。</p>`;
  $('#line-rotate-left').onclick=()=>nudgeLine(5);$('#line-rotate-right').onclick=()=>nudgeLine(-5);
  for(const [id,preferVertex] of [['pivot-near-vertex',true],['pivot-screen-center',false]])$('#'+id).onclick=()=>{rotationTarget.pivot=pivotForLine(data,index,view,preferVertex);renderCanvas();renderInspector();};
}
function selectRotationLine(index){
  state.intersectionSelected=null;
  if(!rotationTarget||rotationTarget.index!==index)rotationTarget={index,pivot:pivotForLine(data,index,view)};
  selected=null;entrySelected=null;highlightMask=0;renderCanvas();renderInspector();
}
function commitRotatedLine(line,index,pivot){
  const raw=data.lines.map(l=>l.map(String));raw[index]=line.map(String);
  if(raw[index].join(',')===state.lines[index].join(',')){renderCanvas();return;}
  const direction=data.u;
  if(change(()=>{state.lines=raw;state.flag=flagAfterLineEdit(raw,direction).map(String);state.preset='custom';state.name='オリジナル配置';},false)){
    rotationTarget={index,pivot};if(state.flagBottom)fitView();renderCanvas();renderInspector();
  }else{renderCanvas();renderInspector();}
}
function nudgeLine(degrees){if(!rotationTarget||lineGesture)return;const {index,pivot}=rotationTarget;commitRotatedLine(rotatedLine(data.lines[index],pivot,degrees*Math.PI/180),index,pivot);}
function renderSidebar(){renderCatalogue();const P=PRESETS.find(p=>p.id===state.preset);$('#preset').value=P?state.preset:'custom';$('#preset-description').textContent=P?(P.description+(P.coefficientField?' '+P.coefficientField+' の正確な実現座標です。':'')):'自分で編集した正確な座標の配置。JSON に保存して続きを再開できます。';$('#preset-source').style.display=P?.source?'inline':'none';if(P?.source)$('#preset-source').href=P.source;$('#equations').value=state.lines.map(l=>l.join(', ')).join('\n');$('#coordinate-field').innerHTML=fieldDetailsHTML(data.geometryField);$('.plot-label span').textContent='exact '+data.geometryField.name+' geometry';$('#line-count').textContent=data.n+' 本';$('#flag-equation').value=state.flag.join(', ');$('#flag-status').textContent=data.verified?'✓ 計算可能な flag · F⁰ は自動設定':'図の分類のみ：全交点を同じ側に置いてください';$('#flag-status').classList.toggle('invalid',!data.verified);$('#arrangement-name').textContent=state.name;$('#geometry-status').textContent=data.n+' LINES · '+data.vertices.length+' VERTICES';$('#complex-counts').textContent=`1 → ${data.n} → ${data.b2}`;$('#chamber-counts').innerHTML=`<span>ch⁰ <b>1</b></span><span>ch¹ <b>${data.n}</b></span><span>ch² <b>${data.b2}</b></span><span>全 chamber <b>${data.cells.length}</b></span>`;$('#identity-check').textContent=data.verified?'✓ d¹d⁰ = 0 · 正確に検算済み':'flag の調整が必要';updateEditControls();$$('.analysis-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));for(const mode of ['select','draw','flag','rotate-line','line-select'])$('#mode-'+mode).classList.toggle('active',state.mode===mode);renderInspector();}
function visiblePoly(signs){let p=viewportCorners(view,W,H);data.lines.forEach((l,j)=>{if(!p.length)return;const [a,b,c]=l.map(Number),s=signs[j],out=[];p.forEach((v,i)=>{const w=p[(i+1)%p.length],u=s*(a*v[0]+b*v[1]+c),t=s*(a*w[0]+b*w[1]+c),inside=u>=-1e-10,next=t>=-1e-10;if(inside)out.push(v);if(inside!==next){const r=u/(u-t);out.push([v[0]+r*(w[0]-v[0]),v[1]+r*(w[1]-v[1])]);}});p=out;});return p;}
const project=p=>projectPoint(p,view,W,H);
const svgLine=l=>clipLineToView(l,view,W,H);
function renderCanvas(){const svg=$('#stage');view.angle=wrapAngle(state.viewAngle);updateRotationControls();let s='';const colors=['#79cbd4','#aecfba','#ccc5df'];const selectedE=entrySelected?data[entrySelected.matrix][entrySelected.row][entrySelected.col]:null;const ix=currentIntersection(),intersectionMask=ix?ix.node.atoms.filter(i=>i<data.n).reduce((m,i)=>m+2**i,0):0;const sep=selectedE?.sep||highlightMask||intersectionMask||0,net=state.tab==='overview'&&state.overviewPane==='nets'?netColoring:null;for(const c of data.cells){const p=visiblePoly(c.signs);if(p.length<3)continue;const px=p.map(project),sel=c.id===selected||selectedE&&(selectedE.from===c.id||selectedE.to===c.id);s+=`<polygon class="chamber-cell" data-chamber="${c.id}" points="${px.map(v=>v.join(',')).join(' ')}" fill="${colors[c.degree]}" fill-opacity="${sel?'.78':c.degree===0?'.38':c.degree===1?'.30':'.23'}" stroke="${sel?'#0f7889':'none'}" stroke-width="${sel?2:0}"><title>${c.id} · ch${c.degree} · ${c.key}</title></polygon>`;let area=0,cx=0,cy=0;for(let i=0;i<px.length;i++){const a=px[i],b=px[(i+1)%px.length],v=a[0]*b[1]-b[0]*a[1];area+=v;cx+=(a[0]+b[0])*v;cy+=(a[1]+b[1])*v;}if(Math.abs(area)>500){cx/=3*area;cy/=3*area;if(cx>25&&cx<W-25&&cy>35&&cy<H-45)s+=`<text class="chamber-label" x="${cx}" y="${cy}" text-anchor="middle">${c.id}</text>`;}}
 let grid=Math.pow(10,Math.floor(Math.log10(view.w/12)));if(view.w/grid>35)grid*=5;else if(view.w/grid>18)grid*=2;
 const corners=viewportCorners(view,W,H),minX=Math.min(...corners.map(p=>p[0])),maxX=Math.max(...corners.map(p=>p[0])),minY=Math.min(...corners.map(p=>p[1])),maxY=Math.max(...corners.map(p=>p[1]));
 for(let x=Math.ceil(minX/grid)*grid;x<maxX;x+=grid){const v=svgLine([1,0,-x]);if(v)s+=`<line x1="${v[0][0]}" y1="${v[0][1]}" x2="${v[1][0]}" y2="${v[1][1]}" stroke="#76927e" stroke-opacity=".11" stroke-width=".7" pointer-events="none"/>`;}
 for(let y=Math.ceil(minY/grid)*grid;y<maxY;y+=grid){const v=svgLine([0,1,-y]);if(v)s+=`<line x1="${v[0][0]}" y1="${v[0][1]}" x2="${v[1][0]}" y2="${v[1][1]}" stroke="#76927e" stroke-opacity=".11" stroke-width=".7" pointer-events="none"/>`;}
 for(let i=0;i<data.lines.length;i++){const v=svgLine(data.lines[i]);if(!v)continue;const on=!!(sep&2**i),block=net?net.blocks.findIndex(b=>b.includes(i)):-1,stroke=['rotate-line','line-select'].includes(state.mode)&&rotationTarget?.index===i?'#087e9a':net?(block<0?'#aab6ac':BLOCK_COLORS[block]):on?'#d26f35':'#435d59',lineWidth=['rotate-line','line-select'].includes(state.mode)&&rotationTarget?.index===i?3:net&&block>=0?1.65+.6*Math.log2(1+Math.min(16,Number(net.weights[i]))):on?3:1.35;s+=`<line x1="${v[0][0]}" y1="${v[0][1]}" x2="${v[1][0]}" y2="${v[1][1]}" stroke="${stroke}" stroke-opacity="${net?(block<0?.22:.96):on?1:.8}" stroke-width="${lineWidth}" pointer-events="none"/>`;if(['rotate-line','line-select'].includes(state.mode))s+=`<line class="rotation-line-hit" data-line-index="${i}" role="button" tabindex="0" aria-label="H${i+1} を選択する" x1="${v[0][0]}" y1="${v[0][1]}" x2="${v[1][0]}" y2="${v[1][1]}" stroke="transparent" stroke-width="18" pointer-events="stroke"><title>H${i+1} · クリックで選択${state.mode==='rotate-line'?' / ドラッグで回転':''}</title></line>`;const t=.12,p=[v[0][0]*(1-t)+v[1][0]*t,v[0][1]*(1-t)+v[1][1]*t];s+=`<text class="line-label" x="${p[0]+5}" y="${p[1]-6}" ${net&&block>=0?`style="fill:${BLOCK_COLORS[block]}"`:""}>H${i+1}${net&&block>=0&&net.weights[i]!=="1"?" × "+esc(net.weights[i]):""}</text>`;}
 const f=svgLine(data.flag);if(f)s+=`<line x1="${f[0][0]}" y1="${f[0][1]}" x2="${f[1][0]}" y2="${f[1][1]}" stroke="#be852c" stroke-width="1.7" stroke-dasharray="7 5" pointer-events="none"/><text x="${f[1][0]*.95+f[0][0]*.05+4}" y="${f[1][1]*.95+f[0][1]*.05-8}" font-family="serif" font-style="italic" font-size="15" fill="#ae7c27" pointer-events="none">F¹</text>`;
 for(const c of data.cuts){const [x,y]=project(data.point(c.t).map(Number));if(x<0||x>W||y<0||y>H)continue;s+=`<circle cx="${x}" cy="${y}" r="2.8" fill="#ba862a" stroke="#fff" stroke-width="1" pointer-events="none"/>`;}
 for(const [vi,v] of data.vertices.entries()){const [x,y]=project(v.p.map(Number));if(x<0||x>W||y<0||y>H)continue;const m=v.lines.length,pivotCandidate=state.mode==='rotate-line'&&rotationTarget&&v.lines.includes(rotationTarget.index);s+=`<circle cx="${x}" cy="${y}" r="${pivotCandidate?5:m>2?4.5:2.3}" fill="${m>2?'#f8faf6':'#597469'}" stroke="#476b61" stroke-width="${m>2?1.5:0}" ${pivotCandidate?`class="pivot-candidate" data-pivot-vertex="${vi}" role="button" tabindex="0" aria-label="交点 P${vi+1} を回転の支点にする" pointer-events="all"`:'pointer-events="none"'} />`;if(m>2)s+=`<text x="${x+7}" y="${y-7}" fill="#3b6558" font-size="10" font-family="monospace" pointer-events="none">${m}</text>`;}
 s+=faceOverlaySVG();s+=intersectionOverlaySVG();
 const [fx,fy]=project(data.f0.map(Number));s+=`<circle cx="${fx}" cy="${fy}" r="5" fill="#c5913c" stroke="white" stroke-width="2" pointer-events="none"/><text x="${fx+9}" y="${fy+5}" font-size="12" fill="#a57929" font-family="serif" pointer-events="none">F⁰</text>`;
 s+=rotationOverlaySVG();
 if(drawStart){const a=project(drawStart.map(Number));s+=`<circle cx="${a[0]}" cy="${a[1]}" r="5" fill="#0c8ea4" stroke="white" stroke-width="2" pointer-events="none"/>`;if(pointer&&String(pointer)!==String(drawStart)){try{const ghost=svgLine(lineThrough(drawStart,pointer));if(ghost)s+=`<line x1="${ghost[0][0]}" y1="${ghost[0][1]}" x2="${ghost[1][0]}" y2="${ghost[1][1]}" stroke="#128aa3" stroke-width="2" stroke-dasharray="4 5" pointer-events="none"/>`;}catch{}}}
 if(['draw','flag'].includes(state.mode)&&pointer){const p=project(pointer.map(Number));s+=`<circle cx="${p[0]}" cy="${p[1]}" r="3.8" fill="#087b9b" fill-opacity=".5" pointer-events="none"/><text x="${p[0]+9}" y="${p[1]-9}" font-family="monospace" font-size="10" fill="#087b9b" pointer-events="none">(${pointer.map(String).join(', ')})</text>`;}const guide=$('#drawing-guide');guide.hidden=state.mode==='select';guide.innerHTML=state.mode==='line-select'?(rotationTarget?'<b>H'+(rotationTarget.index+1)+' を選択中</b><span>上の削除ボタン / Delete キーで直線を削除</span>':'<b>直線をクリックして選択</b><span>直線全体の削除、回転へ</span>'):state.mode==='rotate-line'?(lineGesture?.type==='line'?'<b>直線の回転をプレビュー</b><span>放すと交点・chamber を再計算 · Esc で取消</span>':rotationTarget?'<b>H'+(rotationTarget.index+1)+' を回す</b><span>線・丸いハンドルをドラッグ · オレンジの支点も移動可</span>':'<b>直線をつまんで回転</b><span>線をドラッグ · 支点は近い交点から選択</span>'):state.mode==='flag'?'<b>Flag を選ぶ</b><span>交点の外側で 2 点を選択</span>':drawStart?'<b>② もう 1 点を選ぶ</b><span>直線が完成 · Esc でキャンセル</span>':'<b>① 図の上で最初の点を選ぶ</b><span>次に別の点を選ぶと 1 本完成</span>';const key=$('#net-plot-key');key.hidden=!net;if(net){const infinityClass=net.blocks.findIndex(b=>b.includes(data.n));key.innerHTML=`<span>(3,${esc(net.degree)})</span> `+net.blocks.map((_,b)=>`<b style="color:${BLOCK_COLORS[b]}">class ${b+1}</b>`).join(' ')+(infinityClass>=0?`<small>H∞: class ${infinityClass+1}, m=${esc(net.weights[data.n])}</small>`:'');}svg.innerHTML=s;svg.classList.toggle('is-rotating',!!lineGesture?.moved);updateEditControls();svg.style.cursor=['select','line-select'].includes(state.mode)?'default':state.mode==='rotate-line'?'grab':'crosshair';$('#canvas-hint').textContent=state.mode==='line-select'?'直線をクリックして選択 · Delete で削除':state.mode==='rotate-line'?'線をドラッグして回転 · Shift で15°刻み · Esc で取消':state.mode==='select'?'選択・ドラッグで移動 · 2本指で拡大・縮小':drawStart?'もう 1 点を選択 · Esc でキャンセル':state.mode==='flag'?'2 点で F¹ を指定 · 交点の外側に選んでください':'2 点で直線を描く · ¼ 方眼・交点にスナップ';}
function renderInspector(){if(state.tab==='overview'&&state.overviewPane==='tope')renderGraph();const el=$('#inspector');if(['rotate-line','line-select'].includes(state.mode)&&rotationTarget){renderRotationInspector(el);return;}const ix=currentIntersection();if(ix){el.innerHTML=intersectionInspectorHTML(ix.poset,ix.node);return;}if(faceHighlight&&state.tab==='overview'&&state.overviewPane==='faces'){const f=faceHighlight.face;el.innerHTML=`<p class="inspector-title">${f.id} · face</p><div class="sign-vector">${f.covector.map(x=>x<0?'−':x>0?'+':'0').join(' ')}</div><p class="note">実次元 ${f.dimension} / rank ${f.rank}<br>零成分 ${f.zeroCount} · 直下 ${f.lowerCovers.length} / 直上 ${f.upperCovers.length}</p>`;return;}if(entrySelected){const e=data[entrySelected.matrix][entrySelected.row][entrySelected.col],ids=maskIndices(e.sep,data.n).map(i=>'H'+(i+1));el.innerHTML=`<p class="inspector-title">${e.from} → ${e.to}</p><div class="data-list"><span>degree</span><span>${e.deg}</span><span>分離する直線</span><span>${ids.length}</span></div><div class="sign-vector" style="font-size:11px;letter-spacing:1px">${ids.join(', ')||'∅'}</div><p class="note">オレンジ色が Sep(${e.from}, ${e.to})。輪郭のある 2 領域が行列成分の始点と終点です。</p><div class="formula">${esc(symbolicEntry(e,data.n,state.matrixKind))}</div>`;return;}if(netColoring&&!selected&&state.tab==='overview'&&state.overviewPane==='nets'){el.innerHTML=`<p class="inspector-title">(3,${esc(netColoring.degree)}) ${netColoring.isNet?'net':'multinet'}</p><div class="data-list"><span>選択した直線</span><span>${netColoring.supportedIndices.length}</span><span>基点</span><span>${netColoring.basepoints.length}</span><span>reduced</span><span>${netColoring.reduced?'YES':'NO'}</span></div><p class="note">図の 3 色は直線のクラスです。重みと基点での釣り合いを下の表で確認できます。</p>`;return;}const c=data.cells.find(c=>c.id===selected);if(!c){el.innerHTML='<p class="note">chamber や行列の成分を選ぶと、対応する幾何データを表示します。</p>';return;}el.innerHTML=`<p class="inspector-title">${c.id} <span class="chip">ch${c.degree}</span></p><div class="data-list"><span>基底の次数</span><span>${c.degree}</span><span>領域</span><span>${c.unbounded?'非有界':'有界'}</span><span>F¹ との交わり</span><span>${c.degree<2?'あり':'なし'}</span></div><div class="sign-vector">${c.signs.map(x=>x>0?'+':'−').join('')}</div><p class="note">符号は左の方程式の H1, …, H${data.n} の順。C0 が F⁰ を含み、C1, … は flag に沿う順です。</p>`;}
function tableMatrix(M,rows,cols,matrix,clickable=true){if(!rows.length||!cols.length)return '<p class="note">この次数の行列は空です。</p>';return `<div class="matrix-wrap"><table class="matrix-table"><thead><tr><th></th>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${M.map((r,i)=>`<tr><th>${esc(rows[i])}</th>${r.map((v,j)=>`<td class="${v==='0'?'zero':'nonzero'} ${clickable?'entry':''}" ${clickable?`data-entry="${matrix},${i},${j}" tabindex="0" role="button" aria-label="${esc(rows[i])}, ${esc(cols[j])}: ${esc(v)}"`:''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function exactTag(exact=true){return `<span class="tag ${exact?'':'numeric'}">${exact?'EXACT · 正確計算':'NUMERIC · 近似計算'}</span>`;}
function blocked(){return !data.verified?'<div class="panel-error">この flag では計算を止めています。「外側へ配置」で全ての有限交点を同じ側に置いてください。</div>':'';}
function resultCards(h,label='H'){return `<div class="result-row">${h.map((v,i)=>`<div class="result-card ${i===1?'emphasis':''}"><span class="k">${label}${i} <small>dim</small></span><strong>${v}</strong></div>`).join('')}</div>`;}
function basisHTML(r){if(!r.basis)return '';if(!r.basis.length)return '<p class="note">このパラメータでの H¹ / H₁ は 0。表示する代表元はありません。</p>';return `<p class="note">C1, …, C${data.n} を座標とする kernel / image の代表元（${r.field} 上）。</p><div class="basis-list">${r.basis.map((v,i)=>`<p>v${i+1} = (${v.map(esc).join(', ')})</p>`).join('')}</div>`;}
function readParams(type,basis=false){return type==='aomoto'?{field:state.field,p:state.p,a:state.a,basis}:{mode:state.localMode,order:state.order,w:state.w,complex:state.complex,homology:state.homology,basis};}
const calcKey=(type,params)=>JSON.stringify([state.lines,state.flag,type,params]);
async function calc(type,basis=false){const p=readParams(type,basis),key=calcKey(type,p);if(resultCache.has(key))return resultCache.get(key);const result=await request(type,p);resultCache.set(key,result);return result;}
async function calculatePanel(type,basis=false){const el=$('#result'),gen=panelGeneration;if(!el)return;el.innerHTML='<div class="busy">正確な行列の rank を計算しています…</div>';try{const r=await calc(type,basis);if(gen!==panelGeneration)return;el.innerHTML=resultCards(r.h,r.homology?'H_':'H^')+`<p class="field-note">${esc(r.field)} · rank ${r.homology?'∂₁':'d⁰'} = ${r.r0}, rank ${r.homology?'∂₂':'d¹'} = ${r.r1}${type==='local'?' · t∞ = '+esc(r.infinity):''}</p>`+(r.exact?'':`<p class="warning">複素数の数値計算です。pivot のしきい値は 10⁻⁸。境界近くの rank は円分体で再確認してください。</p>`)+`<div class="button-row"><button id="show-basis" class="secondary small">${r.homology?'H₁':'H¹'} の代表元を表示</button><button id="show-current-matrices" class="quiet small">この行列を見る →</button></div>`+basisHTML(r);$('#show-basis').onclick=()=>calculatePanel(type,true);$('#show-current-matrices').onclick=()=>{state.matrixKind=type==='aomoto'?'aomoto':'local';state.matrixDisplay='evaluated';switchTab('matrices');};}catch(e){if(gen===panelGeneration)el.innerHTML=`<div class="panel-error">${esc(e.message)}</div>`;}}
function renderLocal(){const cyclic=state.localMode==='cyclic';return `<div class="panel-header"><div><h2>局所系係数の (co)homology</h2><p>tᵢ を各直線の正の meridian のモノドロミーに指定します。</p></div>${exactTag(cyclic)}</div><div class="controls-row"><label>モノドロミーの指定<select id="local-mode"><option value="cyclic" ${cyclic?'selected':''}>1 の冪根（円分体で正確）</option><option value="complex" ${!cyclic?'selected':''}>複素数を直接指定（数値）</option></select></label><label>計算する群<select id="homology"><option value="cohomology" ${!state.homology?'selected':''}>コホモロジー Hᵏ(M; L)</option><option value="homology" ${state.homology?'selected':''}>ホモロジー Hₖ(M; L)</option></select></label>${cyclic?`<label>位数 N<input id="local-order" type="number" min="1" max="60" value="${esc(state.order)}"></label>`:''}</div>${cyclic?`<div class="controls-row"><label class="wide">指数 (w₁, …, wₙ)<input id="local-weights" class="number-input" value="${esc(state.w.join(', '))}" placeholder="1, 1, …"></label><button id="local-compute" class="primary">計算する</button><button id="all-one" class="secondary small">全て 1</button></div><p class="field-note">tᵢ = ζ<sub>N</sub><sup>wᵢ</sup>、ζ<sub>N</sub> = exp(2πi/N)。N=1 は自明局所系。N≤60、φ(N)≤24。</p>`:`<div class="param-scroller"><table class="param-table"><thead><tr><th>直線</th><th>Re tᵢ</th><th>Im tᵢ</th></tr></thead><tbody>${state.complex.map((v,i)=>`<tr><td class="line-name">H${i+1}</td><td><input class="complex-re" data-index="${i}" aria-label="H${i+1} の実部" value="${esc(v[0])}"></td><td><input class="complex-im" data-index="${i}" aria-label="H${i+1} の虚部" value="${esc(v[1])}"></td></tr>`).join('')}</tbody></table></div><button id="local-compute" class="primary">計算する</button>`}<div id="result"></div><p class="note">ホモロジーは双対局所系の cochain 行列から ∂₁=d⁰(t⁻¹)ᵀ、∂₂=d¹(t⁻¹)ᵀ を作ります。表示する代表元は chamber セルに対応する座標ベクトルです。</p>`;}
function renderAomoto(){return `<div class="panel-header"><div><h2>Aomoto 複体のコホモロジー</h2><p>(A•, ω∧)、ω = Σ aᵢeᵢ を chamber basis で計算します。</p></div>${exactTag()}</div><div class="controls-row"><label>係数体<select id="aomoto-field"><option value="fp" ${state.field==='fp'?'selected':''}>有限体 Fₚ</option><option value="q" ${state.field==='q'?'selected':''}>有理数体 Q</option></select></label>${state.field==='fp'?`<label>標数 p<input id="aomoto-p" type="number" min="2" max="997" value="${esc(state.p)}"></label>`:''}<label class="wide">重み (a₁, …, aₙ)<input id="aomoto-weights" class="number-input" value="${esc(state.a.join(', '))}"></label><button id="aomoto-compute" class="primary">計算する</button></div><div class="button-row"><button id="aomoto-diagonal" class="secondary small">全て 1</button><button id="aomoto-zero" class="quiet small">全て 0</button>${state.preset==='a3'?'<button id="aomoto-net" class="quiet small">A₃ の net 重み</button>':''}</div><div id="result"></div><p class="note">Aomoto の重み aᵢ と局所系の tᵢ は別のパラメータです。Aomoto は普遍行列の tᵢ=exp(saᵢ) における一次項であり、特殊化した局所系の代わりになるのは追加条件がある場合です。</p>`;}
function renderMilnor(){return `<div class="panel-header"><div><h2>Milnor fiber とモノドロミー</h2><p>射影化・無限遠直線を含めて ${data.n+1} 本の配置を考えます。</p></div>${exactTag()}</div><div class="math-line">Q(x,y,z) = z ∏ᵢ(aᵢx + bᵢy + cᵢz),　F = {Q = 1},　N = ${data.n+1}</div><p class="note">各 d | N の primitive 固有値について円分体 Q(ζ<sub>d</sub>) 上で計算。幾何モノドロミー h* の λ 固有空間には tᵢ=λ⁻¹ を使います。</p><button id="milnor-compute" class="primary">全ての固有空間を計算</button><div id="milnor-result"></div><p class="warning">ここで求めるのは複素係数の homology / cohomology の次元とモノドロミー多項式です。整数係数の torsion と、その幾何的なサイクルは未実装です。</p>`;}
async function calculateMilnor(){const gen=panelGeneration,el=$('#milnor-result');el.innerHTML='<div class="busy">d | N ごとに円分体で rank を計算しています…</div>';try{const key=calcKey('milnor',{});let r=resultCache.get(key);if(!r){r=await request('milnor',{});resultCache.set(key,r);}if(gen!==panelGeneration)return;const factors=r.rows.filter(x=>x.h[1]).map(x=>(x.d===1?'(t − 1)':`Φ${x.d}(t)`)+(x.h[1]>1?`^${x.h[1]}`:''));el.innerHTML=resultCards(r.betti,'b')+`<table class="table"><thead><tr><th>固有値の位数 d</th><th>φ(d)</th><th>dim H⁰(F)<sub>λ</sub></th><th>dim H¹(F)<sub>λ</sub></th><th>dim H²(F)<sub>λ</sub></th></tr></thead><tbody>${r.rows.map(x=>`<tr class="${x.d>1&&x.h[1]?'highlight':''}"><td>${x.d}</td><td>${x.phi}</td>${x.h.map(h=>`<td>${h}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="field-note">各列の次元は primitive 固有値 1 個あたりの値。Betti 数は φ(d) を掛けて合計。</p><div class="math-line">det(tI − h* | H¹(F; C)) = ${esc(factors.join(' · ')||'1')}</div><p class="field-note">χ(F) = N χ(M) = ${r.N} × ${1-data.n+data.b2} = ${r.euler}<br>b₀ − b₁ + b₂ = ${r.betti[0]} − ${r.betti[1]} + ${r.betti[2]} = ${r.betti[0]-r.betti[1]+r.betti[2]} ${r.euler===r.betti[0]-r.betti[1]+r.betti[2]?"✓ 一致":"— 検算不一致"}</p>`;}catch(e){if(gen===panelGeneration)el.innerHTML=`<div class="panel-error">${esc(e.message)}</div>`;}}
function renderVariety(){const k=state.k,n=data.n;const finite=data.vertices.filter(v=>v.lines.length>=3).map(v=>({ids:v.lines,infty:false,m:v.lines.length}));const groups=new Map();data.lines.forEach((l,i)=>{const key=l.slice(0,2).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});const atInfinity=[...groups.values()].filter(g=>g.length>=2).map(g=>({ids:g,infty:true,m:g.length+1}));const comps=[...finite,...atInfinity];return `<div class="panel-header"><div><h2>Characteristic / resonance varieties</h2><p>共通する rank 条件から、jump loci の定義行列を得ます。</p></div><span class="tag">DETERMINANTAL DESCRIPTION</span></div><div class="controls-row"><label>深さ k（dim H¹ ≥ k）<input id="jump-k" type="number" min="1" max="${Math.max(1,n+1)}" value="${k}"></label><span class="field-note">B = d⁰ ⊕ d¹,　rank B = rank d⁰ + rank d¹</span></div><div class="jump-grid"><section class="jump-card"><h3>V¹<sub>${k}</sub> ⊂ (C*)${n}</h3><div class="math-line">I<sub>${n-k+1}</sub>(d⁰(t) ⊕ d¹(t)) = 0</div><p>tᵢ は各直線の monodromy。Laurent 多項式の小行列式で記述します。</p><button id="test-character" class="secondary small">現在の局所系で判定</button><div id="character-membership" class="note"></div><button id="export-character" class="text-link quiet small">SageMath の定義式 ↓</button></section><section class="jump-card"><h3>R¹<sub>${k}</sub> ⊂ C${n}</h3><div class="math-line">I<sub>${n-k+1}</sub>(δ⁰(a) ⊕ δ¹(a)) = 0</div><p>aᵢ は Aomoto の重み。δ の成分は aᵢ の一次式です。有限体上にも特殊化できます。</p><button id="test-resonance" class="secondary small">現在の重みで判定</button><div id="resonance-membership" class="note"></div><button id="export-resonance" class="text-link quiet small">SageMath の定義式 ↓</button></section></div><div class="info-box">Iᵣ は r 次小行列式のイデアル。単位元・原点の特別な rank もこの block 行列で含めます。</div>${idealsPanelHTML()}<div class="jumping-scope"><h3>net / multinet と非局所的な jumping loci</h3><p class="note">重み付き pencil が与える R¹₁ の線形空間と V¹₁ の subtorus を、具体的なパラメータ写像・定義式で確認できます。</p><button id="variety-nets" class="secondary small">net / multinet の対応を調べる →</button></div>${doubleStarJumpingHTML(data.preset)}<h3 style="font-size:12px;margin-top:21px">多重点由来の局所部分空間</h3><p class="note">以下は C 上の R¹₁ に含まれる既知の局所成分。essential 成分や translated 成分の一覧ではありません。</p><div class="component-list">${comps.length?comps.map(c=>`<div>${c.infty?'∞':'有限交点'} · {${c.ids.map(i=>'H'+(i+1)).join(', ')}${c.infty?', H∞':''}} · 次元 ${c.m-1}<br>　${c.infty?'':`Σ(${c.ids.map(i=>'a'+(i+1)).join(', ')}) = 0, `}aⱼ = 0 (j ∉ {${c.ids.map(i=>i+1).join(', ')}})</div>`).join('<br>'):'3 重以上の射影交点はありません。'}</div><p class="note">特性多様体の全体像の探索には、局所系タブでパラメータを変え、行列の rank と代表元を確認できます。描画で多重点を壊すと配置の組合せ型も変わります。</p>`;}
async function membership(type,target){const el=$(target),gen=panelGeneration;el.textContent='判定しています…';try{const params=readParams(type);params.homology=false;const key=calcKey(type,params);let r=resultCache.get(key);if(!r){r=await request(type,params);resultCache.set(key,r);}if(gen!==panelGeneration)return;const finite=type==='aomoto'&&state.field==='fp';el.textContent=`dim H¹ = ${r.h[1]} ${r.h[1]>=state.k?'≥':'<'} ${state.k} → ${r.h[1]>=state.k?'属します':'属しません'}（${r.field} 上）${finite?'。これは有限体上での判定で、C 上での所属は別です。':''}`;}catch(e){if(gen===panelGeneration)el.textContent=e.message;}}
function renderMatrices(){const aomoto=state.matrixKind==='aomoto';return `<div class="panel-header"><div><h2>Chamber basis の行列</h2><p>列が始点、行が終点。成分を選ぶと chamber と Sep(C,D) を図で確認できます。</p></div><span class="tag">d¹ d⁰ = 0</span></div><div class="controls-row"><label>複体<select id="matrix-kind"><option value="local" ${!aomoto?'selected':''}>局所系 d(t)</option><option value="aomoto" ${aomoto?'selected':''}>Aomoto δ(a)</option></select></label><label>表示<select id="matrix-display"><option value="symbolic" ${state.matrixDisplay==='symbolic'?'selected':''}>普遍・記号行列</option><option value="evaluated" ${state.matrixDisplay==='evaluated'?'selected':''}>現在のパラメータで特殊化</option></select></label><button id="export-matrix" class="secondary small">SageMath ↓</button></div><div id="matrix-content"></div>${!aomoto?'<p class="note">半冪を消した Laurent 行列です。X=Sep(C0,C), Y=Sep(C0,D) とすると、成分は deg(C,D) [∏<sub>Y∖X</sub>tᵢ − ∏<sub>X∖Y</sub>tᵢ⁻¹]。基底のスケールの違いにより、半冪を使う論文の表示とは見た目が異なります。</p>':'<p class="note">成分は deg(C,D) Σ<sub>Sep(C,D)</sub> aᵢ。局所系行列を tᵢ=exp(saᵢ) で微分して得られます。</p>'}`;}
async function fillMatrices(){const el=$('#matrix-content'),gen=panelGeneration,kind=state.matrixKind;let M0,M1,rows0,cols0,rows1,cols1,clickable=true,hom=false;if(state.matrixDisplay==='symbolic'){M0=data.d0.map(r=>r.map(e=>symbolicEntry(e,data.n,kind)));M1=data.d1.map(r=>r.map(e=>symbolicEntry(e,data.n,kind)));rows0=data.c1.map(c=>c.id);cols0=['C0'];rows1=data.c2.map(c=>c.id);cols1=data.c1.map(c=>c.id);}else{el.innerHTML='<div class="busy">現在のパラメータで特殊化しています…</div>';try{const r=await calc(kind==='aomoto'?'aomoto':'local');if(gen!==panelGeneration)return;({d0:M0,d1:M1,rows0,cols0,rows1,cols1}=r);hom=r.homology;clickable=!hom;}catch(e){if(gen===panelGeneration)el.innerHTML=`<div class="panel-error">${esc(e.message)}</div>`;return;}}el.innerHTML=`${hom?'<p class="note">局所系タブの設定により、双対局所系から得た境界行列 ∂ を表示中。</p>':''}<div class="matrix-title"><h3>${hom?'∂₁':kind==='aomoto'?'δ⁰':'d⁰'} : ${hom?data.n+' → 1':'1 → '+data.n}</h3><span>${rows0.length} × ${cols0.length}</span></div>${tableMatrix(M0,rows0,cols0,'d0',clickable)}<div class="matrix-title"><h3>${hom?'∂₂':kind==='aomoto'?'δ¹':'d¹'} : ${hom?data.b2+' → '+data.n:data.n+' → '+data.b2}</h3><span>${rows1.length} × ${cols1.length}</span></div>${tableMatrix(M1,rows1,cols1,'d1',clickable)}`;bindMatrixEntries();}
function parseVector(v,n){const list=v.trim()?(v.includes(',')?v.trim().split(',').map(x=>x.trim()):v.trim().split(/\s+/)):[];if(list.length!==n)throw Error(`${n} 個の値を入力してください`);return list;}
function readLocalForm(){state.localMode=$('#local-mode').value;state.homology=$('#homology').value==='homology';if(state.localMode==='cyclic'){state.order=Number($('#local-order').value);state.w=parseVector($('#local-weights').value,data.n);}else state.complex=Array.from({length:data.n},(_,i)=>[Number($(`.complex-re[data-index="${i}"]`).value),Number($(`.complex-im[data-index="${i}"]`).value)]);persist();}
function readAomotoForm(){state.field=$('#aomoto-field').value;if($('#aomoto-p'))state.p=Number($('#aomoto-p').value);state.a=parseVector($('#aomoto-weights').value,data.n);persist();}
function renderAnalysis(){panelGeneration++;const el=$('#analysis');$$('.analysis-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));if(state.tab==='overview'){el.innerHTML=overviewHTML(data,state);bindOverview();return;}if(blocked()){el.innerHTML=blocked();return;}el.innerHTML=state.tab==='local'?renderLocal():state.tab==='aomoto'?renderAomoto():state.tab==='milnor'?renderMilnor():state.tab==='variety'?renderVariety():state.tab==='group'?groupPanelHTML():renderMatrices();if(state.tab==='local'){$('#local-mode').onchange=()=>{state.localMode=$('#local-mode').value;persist();renderAnalysis();};$('#homology').onchange=()=>{state.homology=$('#homology').value==='homology';persist();calculatePanel('local');};$('#local-compute').onclick=()=>{try{readLocalForm();calculatePanel('local');}catch(e){toast(e.message);}};if($('#all-one'))$('#all-one').onclick=()=>{state.w=Array(data.n).fill('1');renderAnalysis();};calculatePanel('local');}else if(state.tab==='aomoto'){$('#aomoto-field').onchange=()=>{try{state.a=parseVector($('#aomoto-weights').value,data.n);}catch{}state.field=$('#aomoto-field').value;persist();renderAnalysis();};$('#aomoto-compute').onclick=()=>{try{readAomotoForm();calculatePanel('aomoto');}catch(e){toast(e.message);}};$('#aomoto-diagonal').onclick=()=>{state.a=Array(data.n).fill('1');persist();renderAnalysis();};$('#aomoto-zero').onclick=()=>{state.a=Array(data.n).fill('0');persist();renderAnalysis();};if($('#aomoto-net'))$('#aomoto-net').onclick=()=>{state.a=['1','-1','-1','1','0'];state.field='q';persist();renderAnalysis();};calculatePanel('aomoto');}else if(state.tab==='milnor'){$('#milnor-compute').onclick=calculateMilnor;if(resultCache.has(calcKey('milnor',{})))calculateMilnor();}else if(state.tab==='group'){calculateGroup();}else if(state.tab==='variety'){bindJumpIdeals();bindDoubleStar();$('#variety-nets').onclick=()=>{state.overviewPane='nets';switchTab('overview');};$('#jump-k').onchange=()=>{state.k=Math.max(1,Math.min(data.n+1,Number($('#jump-k').value)||1));persist();renderAnalysis();};$('#test-character').onclick=()=>membership('local','#character-membership');$('#test-resonance').onclick=()=>membership('aomoto','#resonance-membership');$('#export-character').onclick=()=>exportSage('local');$('#export-resonance').onclick=()=>exportSage('aomoto');}else{$('#matrix-kind').onchange=()=>{state.matrixKind=$('#matrix-kind').value;persist();renderAnalysis();};$('#matrix-display').onchange=()=>{state.matrixDisplay=$('#matrix-display').value;persist();fillMatrices();};$('#export-matrix').onclick=()=>exportSage(state.matrixKind);fillMatrices();}}
function bindMatrixEntries(){$$('[data-entry]').forEach(td=>{const choose=()=>{const [matrix,row,col]=td.dataset.entry.split(',');entrySelected={matrix,row:+row,col:+col};selected=null;$$('[data-entry]').forEach(x=>x.classList.toggle('selected',x===td));renderCanvas();renderInspector();};td.onclick=choose;td.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};});}
function switchTab(tab){state.tab=tab;persist();renderAnalysis();renderCanvas();renderInspector();}
function download(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportSage(kind){try{download('chamber-'+(kind==='local'?'characteristic':'resonance')+'.sage',sageExport(data,kind,state.k));toast('定義行列と小行列式イデアルの SageMath コードを書き出しました');}catch(e){toast(e.message);}}
renderCatalogue();
$('#preset').onchange=()=>{if($('#preset').value==='empty'){startNew();return;}const P=PRESETS.find(p=>p.id===$('#preset').value);if(!P)return;change(()=>{state.lines=P.lines;state.flag=null;state.name=P.name;state.preset=P.id;state.mode=P.id==='empty'?'draw':'select';state.tab='overview';state.w=[];state.a=[];state.complex=[];});};
$('#reset-example').onclick=()=>{const P=PRESETS.find(p=>p.id===state.preset)||PRESETS[0];change(()=>{state.lines=P.lines;state.flag=null;state.name=P.name;state.preset=P.id;state.w=[];state.a=[];state.complex=[];});};
$('#apply-equations').onclick=()=>{const text=$('#equations').value;change(()=>{state.lines=text.split('\n').map(v=>v.trim()).filter(v=>v&&!v.startsWith('#')).map(v=>(v.includes(',')?v.split(','):v.split(/\s+/)).map(x=>x.trim()));state.flag=null;state.preset='custom';state.name='オリジナル配置';});};
$('#auto-flag').onclick=()=>change(()=>{state.flag=autoFlag(state.lines,[$('#flag-dx').value,$('#flag-dy').value]).map(String);});
$('#apply-flag').onclick=()=>change(()=>{state.flag=parseVector($('#flag-equation').value,3);if(state.flag.length!==3)throw Error('a, b, c の 3 値を入力してください');});
$('#clear').onclick=startNew;$('#new-project').onclick=startNew;$('#catalog-search').oninput=renderCatalogue;$('#equation-example').onclick=()=>change(()=>{state.lines=[[1,0,0],[0,1,0],[1,1,-1]];state.flag=null;state.preset='triangle';state.name='一般位置の 3 直線';state.tab='overview';state.mode='select';state.w=[];state.a=[];state.complex=[];});
for(const id of ['undo','undo-side'])$('#'+id).onclick=()=>travelHistory('undo');
for(const id of ['redo','redo-side'])$('#'+id).onclick=()=>travelHistory('redo');
$('#delete-line').onclick=deleteSelectedLine;
for(const mode of ['select','draw','flag','rotate-line','line-select'])$('#mode-'+mode).onclick=()=>{cancelGesture();state.mode=mode;if(!['rotate-line','line-select'].includes(mode))rotationTarget=null;drawStart=null;pointer=null;renderSidebar();renderCanvas();persist();};
$('#fit').onclick=()=>changeView(()=>{fitView();renderCanvas();});$('#zoom-in').onclick=()=>changeView(()=>{view.w*=.76;view.h*=.76;renderCanvas();});$('#zoom-out').onclick=()=>changeView(()=>{view.w/= .76;view.h/= .76;renderCanvas();});
$('#view-rotation').onpointerdown=()=>{angleBefore=snapshot();};
$('#view-rotation').oninput=e=>{if(angleBefore===null)angleBefore=snapshot();setViewAngle(Number(e.target.value)*Math.PI/180);};
const finishAngleEdit=()=>{if(angleBefore!==null)recordEdit(angleBefore);angleBefore=null;};
$('#view-rotation').onchange=finishAngleEdit;$('#view-rotation').onpointerup=finishAngleEdit;$('#view-rotation').onpointercancel=finishAngleEdit;$('#view-rotation').onblur=finishAngleEdit;
$('#view-rotate-left').onclick=()=>changeView(()=>setViewAngle(state.viewAngle+Math.PI/12));$('#view-rotate-right').onclick=()=>changeView(()=>setViewAngle(state.viewAngle-Math.PI/12));$('#view-reset').onclick=()=>changeView(()=>setViewAngle(0));$('#flag-bottom').onclick=alignFlagBottom;
function eventCoordinates(e){const svg=$('#stage'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const matrix=svg.getScreenCTM(),pos=pt.matrixTransform(matrix.inverse());return {pixel:[pos.x,pos.y],world:unprojectPoint([pos.x,pos.y],view,W,H),matrix};}
function pointFromEvent(e,incidentLine=null){
  const {pixel:[px,py],world:[x,y],matrix}=eventCoordinates(e);let nearest=null,best=13;
  for(const v of data.vertices){if(incidentLine!==null&&!v.lines.includes(incidentLine))continue;const a=project(v.p),dist=Math.hypot((a[0]-px)*matrix.a,(a[1]-py)*matrix.d);if(dist<best){best=dist;nearest=v.p;}}
  return nearest||[q(String(Math.round(x*4)/4)),q(String(Math.round(y*4)/4))];
}
function capturePointer(e){$('#stage').setPointerCapture(e.pointerId);$('#stage').focus({preventScroll:true});}
function releasePointer(id){if(id!==undefined&&$('#stage').hasPointerCapture(id))$('#stage').releasePointerCapture(id);}
function cancelGesture(){
  if(lineGesture){const old=lineGesture;lineGesture=null;if(old.type==='pivot'&&rotationTarget)rotationTarget.pivot=old.pivot;releasePointer(old.pointerId);}
  if(panStart){releasePointer(panStart.pointerId);panStart=null;}
}
let pinchBefore=null;
const stagePinch=attachPinchZoom($('#stage'),{
  onStart(){
    const before=panStart?.before;
    cancelGesture();
    pinchBefore=before||snapshot();
    pointer=null;skipClick=true;
    renderCanvas();renderInspector();
  },
  onMove({scale,from,to}){
    const anchor=eventCoordinates(from).world;
    const width=Math.max(1e-4,Math.min(1e6,view.w/scale)),ratio=width/view.w;
    view.w=width;view.h*=ratio;
    const next=eventCoordinates(to).world;
    view.cx+=anchor[0]-next[0];view.cy+=anchor[1]-next[1];
    renderCanvas();
  },
  onEnd(){
    if(pinchBefore!==null){recordEdit(pinchBefore);pinchBefore=null;}
    skipClick=false;persist();
  }
});
$('#stage').addEventListener('pointerdown',e=>{
  if(e.button!==0)return;skipClick=false;
  if(state.mode==='select'){panStart={before:snapshot(),x:e.clientX,y:e.clientY,cx:view.cx,cy:view.cy,moved:false,pointerId:e.pointerId};$('#stage').focus({preventScroll:true});return;}
  if(state.mode==='line-select'){const hit=e.target.closest('[data-line-index]');if(hit)selectRotationLine(Number(hit.dataset.lineIndex));else{rotationTarget=null;renderCanvas();renderInspector();}$('#stage').focus({preventScroll:true});e.preventDefault();return;}
  if(state.mode!=='rotate-line')return;
  const vertex=e.target.closest('[data-pivot-vertex]');
  if(vertex&&rotationTarget){rotationTarget.pivot=data.vertices[Number(vertex.dataset.pivotVertex)].p.slice();renderCanvas();renderInspector();skipClick=true;return;}
  const pin=e.target.closest('[data-rotation-pivot]'),hit=e.target.closest('[data-line-index]');if(!pin&&!hit)return;
  const index=pin?rotationTarget.index:Number(hit.dataset.lineIndex);if(!pin)selectRotationLine(index);
  const pivot=rotationTarget.pivot.slice(),{world,pixel}=eventCoordinates(e),line=data.lines[index];
  const nearPivot=Math.hypot(...project(pivot).map((v,i)=>v-pixel[i]))<12;
  lineGesture={type:pin?'pivot':'line',index,pivot,line,grabAngle:nearPivot?tangentAngle(line):Math.atan2(world[1]-Number(pivot[1]),world[0]-Number(pivot[0])),x:e.clientX,y:e.clientY,moved:false,pointerId:e.pointerId};
  capturePointer(e);e.preventDefault();
});
$('#stage').addEventListener('pointermove',e=>{
  if(lineGesture){
    const g=lineGesture;if(e.pointerId!==g.pointerId)return;
    if(Math.hypot(e.clientX-g.x,e.clientY-g.y)<3&&!g.moved)return;g.moved=true;
    if(g.type==='pivot'){rotationTarget.pivot=projectToExactLine(pointFromEvent(e,g.index),g.line);}
    else{
      const w=eventCoordinates(e).world;if(Math.hypot(w[0]-Number(g.pivot[0]),w[1]-Number(g.pivot[1]))<view.w*1e-6)return;
      let delta=wrapAngle(Math.atan2(w[1]-Number(g.pivot[1]),w[0]-Number(g.pivot[0]))-g.grabAngle);
      if(e.shiftKey){const base=tangentAngle(g.line),step=Math.PI/12;delta=Math.round((base+delta+view.angle)/step)*step-base-view.angle;}
      g.preview=rotatedLine(g.line,g.pivot,delta);
    }
    renderCanvas();return;
  }
  if(panStart&&state.mode==='select'){
    const r=$('#stage').getBoundingClientRect(),dx=e.clientX-panStart.x,dy=e.clientY-panStart.y;
    if(Math.hypot(dx,dy)>4||panStart.moved){if(!panStart.moved)capturePointer(e);panStart.moved=true;const d=fromView([dx/r.width*view.w,-dy/r.height*view.h],view.angle);view.cx=panStart.cx-d[0];view.cy=panStart.cy-d[1];renderCanvas();}
  }else if(['draw','flag'].includes(state.mode)){const next=pointFromEvent(e);if(!pointer||String(pointer)!==String(next)){pointer=next;renderCanvas();}}
});
window.addEventListener('pointerup',e=>{
  if(lineGesture&&lineGesture.pointerId===e.pointerId){const g=lineGesture;lineGesture=null;releasePointer(g.pointerId);skipClick=true;if(g.type==='line'&&g.moved&&g.preview)commitRotatedLine(g.preview,g.index,g.pivot);else{renderCanvas();renderInspector();}}
  if(panStart&&panStart.pointerId===e.pointerId){skipClick=panStart.moved;if(panStart.moved)recordEdit(panStart.before);releasePointer(panStart.pointerId);panStart=null;}
});
$('#stage').addEventListener('pointercancel',()=>{cancelGesture();skipClick=true;renderCanvas();renderInspector();});
$('#stage').addEventListener('click',e=>{
  if(skipClick){skipClick=false;return;}
  if(state.mode==='select'){const c=e.target.closest('[data-chamber]');if(c){selected=c.dataset.chamber;state.intersectionSelected=null;entrySelected=null;highlightMask=0;renderCanvas();renderInspector();}return;}
  if(!['draw','flag'].includes(state.mode))return;
  const p=pointFromEvent(e);if(!drawStart){drawStart=p;pointer=p;renderCanvas();return;}
  if(String(drawStart)===String(p)){toast('異なる 2 点を選んでください');return;}
  try{const l=lineThrough(drawStart,p);if(state.mode==='flag')change(()=>state.flag=l.map(String));else change(()=>{state.lines=[...state.lines,l.map(String)];state.flag=null;state.preset='custom';state.name='オリジナル配置';},false);drawStart=null;renderCanvas();}catch(e){toast(e.message);}
});
$('#stage').addEventListener('wheel',e=>{e.preventDefault();if(lineGesture||stagePinch.active)return;const r=e.deltaY>0?1.15:1/1.15;view.w*=r;view.h*=r;renderCanvas();},{passive:false});
$('#stage').addEventListener('keydown',e=>{
  if(!['rotate-line','line-select'].includes(state.mode))return;
  const hit=e.target.closest('[data-line-index]'),vertex=e.target.closest('[data-pivot-vertex]');
  if(['Enter',' '].includes(e.key)&&(hit||vertex)){e.preventDefault();if(vertex&&rotationTarget){rotationTarget.pivot=data.vertices[Number(vertex.dataset.pivotVertex)].p.slice();renderCanvas();renderInspector();}else selectRotationLine(Number(hit.dataset.lineIndex));$('#stage').focus({preventScroll:true});}
  if(state.mode==='rotate-line'&&rotationTarget&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();nudgeLine((['ArrowLeft','ArrowUp'].includes(e.key)?1:-1)*(e.shiftKey?15:1));$('#stage').focus({preventScroll:true});}
});
document.addEventListener('keydown',e=>{
  if(document.body.dataset.lab==='plinth')return;
  const typing=e.target.closest('input,textarea,select,[contenteditable="true"]');
  if(!typing&&!$('#help').open&&(e.ctrlKey||e.metaKey)&&!e.altKey){const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();travelHistory(key==='y'||e.shiftKey?'redo':'undo');return;}}
  if(!typing&&e.target.closest('#stage')&&['Delete','Backspace'].includes(e.key)&&rotationTarget){e.preventDefault();deleteSelectedLine();return;}
  if(e.key==='Escape'){stagePinch.cancel();cancelGesture();drawStart=null;pointer=null;skipClick=true;renderCanvas();renderInspector();}
});
$$('.analysis-tabs button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('#save-project').onclick=()=>download('chamber-lab-arrangement.json',JSON.stringify({...state,geometryField:data.geometryField,source:'Chamber Lab v0.8',convention:'n affine lines plus line at infinity for Milnor fiber'},null,2),'application/json');
$('#import-open').onclick=()=>$('#import-file').click();$('#import-file').onchange=async()=>{const file=$('#import-file').files[0];if(!file)return;try{if(file.size>150000)throw Error('JSON は 150 KB 以下にしてください');const s=JSON.parse(await file.text());if(!Array.isArray(s.lines))throw Error('lines 配列を持つ JSON が必要です');change(()=>{const tab=state.tab;state={...structuredClone(DEFAULT),...s,version:1,tab,name:typeof s.name==='string'?s.name:'読み込んだ配置',preset:'custom',mode:'select'};if(!['overview','local','aomoto','milnor','variety','matrices','group'].includes(state.tab))state.tab='overview';});toast('配置を読み込みました');}catch(e){toast(e.message);}$('#import-file').value='';};
for(const id of ['help-open','limits-open'])$('#'+id).onclick=()=>$('#help').showModal();$('#help-close').onclick=()=>$('#help').close();$('#help').onclick=e=>{if(e.target===$('#help')){const r=$('#help').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#help').close();}};
try{rebuild();}catch(e){state=structuredClone(DEFAULT);rebuild();toast('保存済みデータを読み込めず、A₃ の例を開きました');}

new ResizeObserver(()=>{syncPlotSize();if(data)renderCanvas();}).observe($('.stage-wrap'));

function renderCatalogue(){
  const el=$('#preset');if(!el)return;
  const norm=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const search=norm($('#catalog-search')?.value||''),items=PRESETS.filter(p=>p.id!=='empty'),filtered=items.filter(p=>norm(p.name+' '+p.id+' '+(p.tag||'')+' '+(p.lines.length+1)).includes(search));
  const grun=p=>p.category==='grunbaum'||['a3','b3','nonfano'].includes(p.id);
  const option=p=>`<option value="${p.id}">${esc(p.name)}${grun(p)?' · '+esc(p.field?.label||'Q'):' · affine '+p.lines.length+' 本'}</option>`;
  let html='<optgroup label="自分で作る"><option value="empty">＋ 白紙から作図（新規）</option>'+(state.preset==='custom'?'<option value="custom" disabled>編集中のオリジナル配置</option>':'')+'</optgroup>';
  const current=items.find(p=>p.id===state.preset);if(current&&!filtered.includes(current))html+='<optgroup label="現在の配置">'+option(current)+'</optgroup>';
  const a=filtered.filter(grun).sort((p,q)=>p.lines.length-q.lines.length||p.name.localeCompare(q.name,'en',{numeric:true})),b=filtered.filter(p=>!grun(p)&&p.category!=='special'),c=filtered.filter(p=>p.category==='special');if(a.length)html+='<optgroup label="Grünbaum / CEL · 射影配置の名前">'+a.map(option).join('')+'</optgroup>';if(c.length)html+='<optgroup label="吉永の配置・特別な例">'+c.map(option).join('')+'</optgroup>';if(b.length)html+='<optgroup label="基本例と判定の例">'+b.map(option).join('')+'</optgroup>';
  el.innerHTML=html;el.value=state.preset;$('#catalog-count').textContent=search?`${filtered.length} / ${items.length} 例`:`${items.length} 例 · Grünbaum ${items.filter(grun).length}`;
}

function startNew(){change(()=>{state.lines=[];state.flag=null;state.preset='empty';state.name='新しいオリジナル配置';state.mode='draw';state.tab='overview';state.overviewPane='invariants';state.w=[];state.a=[];state.complex=[];});$('#stage').scrollIntoView({behavior:'smooth',block:'center'});$('#stage').focus({preventScroll:true});toast('図で 2 点を選ぶと 1 本完成します。続けて何本でも描けます。');}

function showChamber(id,mask=0){selected=id;entrySelected=null;highlightMask=mask;renderCanvas();renderInspector();}

function currentIntersection(){
  if(state.tab!=='overview'||state.overviewPane!=='intersection'||!state.intersectionSelected)return null;
  const poset=data.intersections[state.intersectionMode==='cone'?'cone':'affine'],node=poset.nodes.find(x=>x.id===state.intersectionSelected);return node?{poset,node}:null;
}
function bindIntersection(){
  const scope=()=>data.intersections[state.intersectionMode==='cone'?'cone':'affine'];
  $('#intersection-mode').onchange=()=>{state.intersectionMode=$('#intersection-mode').value;state.intersectionSelected=null;state.intersectionRank='all';persist();renderAnalysis();renderCanvas();renderInspector();};
  $('#intersection-neighborhood').onchange=()=>{state.intersectionNeighborhood=$('#intersection-neighborhood').checked;persist();renderAnalysis();};
  $('#intersection-clear').onclick=()=>{state.intersectionSelected=null;persist();renderAnalysis();renderCanvas();renderInspector();};
  const filter=()=>{state.intersectionSearch=$('#intersection-search').value;state.intersectionRank=$('#intersection-rank').value;$('#intersection-rows').innerHTML=intersectionRowsHTML(scope(),state);persist();};
  $('#intersection-search').oninput=filter;$('#intersection-rank').onchange=filter;
  const choose=e=>{const b=e.target.closest('[data-poset-id]');if(!b)return;if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;if(e.type==='keydown')e.preventDefault();state.intersectionSelected=b.dataset.posetId;rotationTarget=null;selected=null;entrySelected=null;faceHighlight=null;highlightMask=0;persist();renderAnalysis();renderCanvas();renderInspector();};
  $('#intersection-panel').onclick=choose;$('#intersection-panel').onkeydown=choose;
  $('#export-intersection').onclick=()=>download('chamber-intersection-poset.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,...scope()},null,2),'application/json');
}
function intersectionOverlaySVG(){
  const ix=currentIntersection();if(!ix)return '';const x=ix.node;
  if(x.rank!==2||x.geometry.infinity||!x.geometry.point)return '';
  const [px,py]=project(x.geometry.point.map(v=>Number(q(v))));
  return `<circle class="intersection-point-highlight" cx="${px}" cy="${py}" r="10" fill="#bc7c36" fill-opacity=".18" stroke="#b67b2e" stroke-width="2.5" pointer-events="none"/><text x="${px+14}" y="${py-12}" class="pivot-label" pointer-events="none">${esc(x.label)}</text>`;
}

function bindOverview(){
  $$('[data-overview]').forEach(b=>b.onclick=()=>{state.overviewPane=b.dataset.overview;persist();renderAnalysis();renderCanvas();renderInspector();});
  if($('#export-invariants'))$('#export-invariants').onclick=()=>download('chamber-invariants.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,convention:'affine lines plus H∞ for projective invariants',intersectionPosets:data.intersections,...data.overview},null,2),'application/json');
  if(state.overviewPane==='tope'){
    $('#graph-mode').onchange=()=>{state.graphMode=$('#graph-mode').value;state.graphZoom=1;persist();renderAnalysis();};
    $('#graph-zoom-in').onclick=()=>{state.graphZoom=Math.min(3,(state.graphZoom||1)*1.25);persist();renderGraph();};
    $('#graph-zoom-out').onclick=()=>{state.graphZoom=Math.max(.5,(state.graphZoom||1)/1.25);persist();renderGraph();};
    $('#graph-fit').onclick=()=>{state.graphZoom=1;persist();renderGraph();};
    $('#export-graph').onclick=()=>{const g=data.overview.graph,cone=state.graphMode==='cone';download('chamber-tope-graph.json',JSON.stringify({source:'Chamber Lab v0.8',type:cone?'central cone including H∞':'affine',lines:state.lines,nodes:cone?g.coneNodes:g.nodes,edges:cone?g.coneEdges:g.edges,lineLabels:[...state.lines.map((_,i)=>'H'+(i+1)),'H∞']},null,2),'application/json');};renderGraph();calculateMagnitude();
  }else if(state.overviewPane==='intersection')bindIntersection();else if(state.overviewPane==='faces')bindFaces();else if(state.overviewPane==='kpi')calculateKpi();else if(state.overviewPane==='nets'){bindNets();bindDoubleStar();}else if(state.overviewPane==='alexander')bindAlexander();else calculateAlexander(true);
}

function renderGraph(){
  const el=$('#tope-plot');if(!el||!data?.overview)return;state.graphZoom=Math.max(.5,Math.min(3,Number(state.graphZoom)||1));el.innerHTML=graphSVG(data.overview,state,selected);
  const g=data.overview.graph,cone=state.graphMode==='cone',nodes=cone?g.coneNodes:g.nodes,edges=cone?g.coneEdges:g.edges;
  $$('[data-graph-node]').forEach(b=>{const choose=()=>{const v=nodes[Number(b.dataset.graphNode)];showChamber(v.chamber);$('#graph-selection').textContent=`${v.id} · 符号: ${v.signs.map(x=>x>0?'+':'−').join(' ')}${cone?'（末尾は H∞）':''}`;};b.onclick=choose;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};});
  $$('[data-graph-edge]').forEach(b=>b.onclick=()=>{const e=edges[Number(b.dataset.graphEdge)],inf=e.line===data.n;showChamber(nodes[e.from].chamber,inf?0:2**e.line);$('#graph-selection').textContent=`${nodes[e.from].id} ↔ ${nodes[e.to].id} · ${inf?'H∞ を横切る辺（affine の画面外での隣接）':'H'+(e.line+1)+' を横切る辺'}`;});
}

async function calculateKpi(){
  const el=$('#kpi-result'),gen=panelGeneration;if(!el)return;el.innerHTML='<div class="busy">有限の符号探索と有理重みを検証しています…</div>';
  try{const key=calcKey('kpi',{});let r=resultCache.get(key);if(!r){r=await request('kpi',{});resultCache.set(key,r);}if(gen!==panelGeneration)return;
    el.className='';el.innerHTML=kpiHTML(r,PRESETS.find(p=>p.id===state.preset),data.n);
    if($('#show-triangle'))$('#show-triangle').onclick=()=>{const mask=r.triangle.walls.filter(i=>i<data.n).reduce((s,i)=>s+2**i,0);showChamber(r.triangle.chamber,mask);toast(r.triangle.chamber+' と有限の壁を上の配置で強調しました');};
    $$('[data-proof-face]').forEach(b=>b.onclick=()=>showChamber(b.dataset.proofFace));
    $('#export-kpi').onclick=()=>download('chamber-kpi-certificate.json',JSON.stringify({source:'Chamber Lab v0.8',flag:state.flag,...r},null,2),'application/json');
    $('#recompute-kpi').onclick=()=>{resultCache.delete(key);calculateKpi();};
  }catch(e){if(gen===panelGeneration)el.innerHTML=`<div class="panel-error">判定を完了できませんでした：${esc(e.message)}</div>`;}
}

function cachedStructure(type,params={}){
  const key=calcKey(type,params);if(resultCache.has(key))return Promise.resolve(resultCache.get(key));
  if(structureRequests.has(key))return structureRequests.get(key);
  const promise=request(type,params).then(r=>{resultCache.set(key,r);return r;}).finally(()=>structureRequests.delete(key));structureRequests.set(key,promise);return promise;
}

function bindAlexander(){
  $('#export-alexander-sage').disabled=!data.n;$('#export-alexander-sage').onclick=()=>{try{const model=data.verified?data:arrangement(state.lines);download('chamber-affine-alexander.sage',alexanderSage(model));}catch(e){toast(e.message);}};
  $('#recompute-alexander').onclick=()=>{resultCache.delete(calcKey('alexander',{}));calculateAlexander(false);};
  calculateAlexander(false);
}

async function calculateAlexander(compact=false){
  const el=$(compact?'#alexander-summary-result':'#alexander-result'),gen=panelGeneration;if(!el)return;
  try{const r=await cachedStructure('alexander');if(gen!==panelGeneration)return;el.innerHTML=alexanderResultHTML(r,data,compact);
    if(r.cone.milnor)resultCache.set(calcKey('milnor',{}),r.cone.milnor);
    if(!compact){$('#export-alexander').disabled=false;$('#export-alexander').onclick=()=>download('chamber-alexander.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,...r},null,2),'application/json');}
  }catch(e){if(gen===panelGeneration)el.innerHTML=`<div class="structure-error">計算を完了できませんでした：${esc(e.message)}</div>`;}
}

let netRequestSerial=0,currentNetResult=null;
function netSupportFromForm(){return $$('.net-support-checkbox:checked').map(e=>Number(e.value));}
function bindNets(){
  $$('.net-support-checkbox').forEach(box=>box.onchange=()=>{state.netSupport=netSupportFromForm();state.netResultIndex=0;netRequestSerial++;netColoring=null;$('#clear-net-coloring').disabled=true;persist();$('#net-support-count').textContent=`${state.netSupport.length} / ${data.n+1} 本を選択`;$('#net-result').innerHTML='<p class="poly-note">対象を変更しました。「この集合で判定する」で確認してください。</p>';renderCanvas();renderInspector();});
  $('#net-support-all').onclick=()=>{state.netSupport=null;state.netResultIndex=0;persist();renderAnalysis();};
  $('#net-support-finite').onclick=()=>{state.netSupport=Array.from({length:data.n},(_,i)=>i);state.netResultIndex=0;persist();renderAnalysis();};
  $('#run-net-search').onclick=()=>{state.netSupport=netSupportFromForm();state.netBudget=Math.max(1,Math.min(10000000,Math.floor(Number($('#net-budget').value)||200000)));persist();calculateNets();};
  $('#clear-net-coloring').onclick=()=>{const r=currentNetResult;netColoring=netColoring?null:r?.certificates[Math.max(0,Math.min(r.certificates.length-1,Number(state.netResultIndex)||0))]||null;renderCanvas();renderInspector();};
  calculateNets();
}

function paintNetResult(result){
  currentNetResult=result;$('#clear-net-coloring').disabled=!result.certificates.length;$('#net-result').innerHTML=netsResultHTML(result,data,state);
  const paint=()=>{const i=Math.max(0,Math.min(result.certificates.length-1,Number(state.netResultIndex)||0));netColoring=result.certificates[i]||null;entrySelected=null;highlightMask=0;selected=null;renderCanvas();renderInspector();};
  if($('#net-certificate-choice'))$('#net-certificate-choice').onchange=()=>{state.netResultIndex=Number($('#net-certificate-choice').value);persist();paintNetResult(result);};
  $('#export-net-result').onclick=()=>download('chamber-net-multinet.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,...result},null,2),'application/json');paint();bindNetJumping(result);
}

async function calculateNets(){
  const el=$('#net-result'),gen=panelGeneration,serial=++netRequestSerial;if(!el)return;
  const support=state.netSupport??Array.from({length:data.n+1},(_,i)=>i),params={support,maxStates:state.netBudget||200000,maxResults:25};
  el.innerHTML='<div class="calculation-placeholder">指定した集合の分割と正の整数重みを検証しています…</div>';
  try{const r=await cachedStructure('nets',params);if(gen!==panelGeneration||serial!==netRequestSerial)return;paintNetResult(r);}
  catch(e){if(gen===panelGeneration&&serial===netRequestSerial)el.innerHTML=`<div class="structure-error">探索を完了できませんでした：${esc(e.message)}</div>`;}
}

async function calculateMagnitude(){
  const el=$('#magnitude-result'),gen=panelGeneration;if(!el)return;
  const params={mode:state.graphMode==='cone'?'cone':'affine',maxK:state.magnitudeK??8,maxL:state.magnitudeL??12};
  try{const r=await cachedStructure('magnitude',params);if(gen!==panelGeneration)return;
    el.className='';el.innerHTML=magnitudeResultHTML(r,state);
    const numeric=()=>{try{state.magnitudeQ=Number($('#magnitude-q').value);$('#magnitude-value').textContent='Mag ≈ '+magnitudeValue(r,state.magnitudeQ).toPrecision(10);persist();}catch(e){$('#magnitude-value').textContent=e.message;}};numeric();$('#magnitude-q').oninput=numeric;
    $('#magnitude-compute').onclick=()=>{const k=Number($('#magnitude-k').value),l=Number($('#magnitude-l').value);if(!Number.isInteger(k)||k<0||k>64||!Number.isInteger(l)||l<0||l>128){toast('0 ≤ k ≤ 64, 0 ≤ ℓ ≤ 128 の整数を指定してください');return;}state.magnitudeK=k;state.magnitudeL=l;persist();el.innerHTML='<div class="busy">表示範囲の群を計算しています…</div>';calculateMagnitude();};
    $$('[data-mh]').forEach(b=>b.onclick=()=>{const [k,l]=b.dataset.mh.split(',').map(Number),rank=r.homology.coefficients[k][l];$('#mh-selection').textContent=`MH_${k},${l}(G; Z) ≅ ${rank==='0'?'0':rank==='1'?'Z':'Z^'+rank} · torsion なし`});
    $('#export-magnitude').onclick=()=>download('chamber-tope-magnitude.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,...r},null,2),'application/json');
  }catch(e){if(gen===panelGeneration)el.innerHTML=`<div class="structure-error">計算を完了できませんでした：${esc(e.message)}</div>`;}
}

function bindFaces(){
  $('#face-mode').onchange=()=>{state.faceMode=$('#face-mode').value;state.faceSelected=null;state.facePage=0;faceHighlight=null;selected=null;persist();renderAnalysis();renderCanvas();renderInspector();};calculateFaces();
}
async function calculateFaces(){
  const el=$('#faces-result'),gen=panelGeneration;try{const r=await cachedStructure('faces',{mode:state.faceMode==='affine'?'affine':'cone'});if(gen!==panelGeneration)return;faceResult=r;paintFaces();}
  catch(e){if(gen===panelGeneration)el.innerHTML=`<div class="structure-error">face の列挙を完了できませんでした：${esc(e.message)}</div>`;}
}
function paintFaces(){
  const el=$('#faces-result'),p=faceResult;if(!el||!p)return;el.className='';el.innerHTML=facesResultHTML(p,state);$('#face-hasse').innerHTML=faceHasseSVG(p,state.faceSelected);
  const choose=id=>{const face=p.faces.find(f=>f.id===id);if(!face)return;state.faceSelected=id;const geometry=p.mode==='affine'?face:p.affineFaces.find(f=>f.id===face.affineFaceId);faceHighlight={face,geometry};selected=face.chamberId||null;entrySelected=null;highlightMask=0;persist();paintFaces();renderCanvas();renderInspector();};
  $$('[data-face]').forEach(b=>{b.onclick=()=>choose(b.dataset.face);b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(b.dataset.face);}};});
  $('#face-dimension').onchange=()=>{state.faceDimension=$('#face-dimension').value;state.facePage=0;persist();paintFaces();};$('#face-query').onchange=()=>{state.faceQuery=$('#face-query').value;state.facePage=0;persist();paintFaces();};
  $('#face-clear').onclick=()=>{state.faceSelected=null;selected=null;faceHighlight=null;persist();paintFaces();renderCanvas();renderInspector();};
  $('#face-prev').onclick=()=>{state.facePage=Math.max(0,(Number(state.facePage)||0)-1);persist();paintFaces();};$('#face-next').onclick=()=>{state.facePage=(Number(state.facePage)||0)+1;persist();paintFaces();};
  $('#export-faces').onclick=()=>download('chamber-face-poset.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,...p},null,2),'application/json');
}
function faceOverlaySVG(){
  if(state.tab!=='overview'||state.overviewPane!=='faces'||!faceHighlight?.geometry)return '';
  const f=faceHighlight.geometry,point=p=>project(p.map(x=>Number(q(x)))),stroke='#bd5277';
  if(f.kind==='vertex'){const p=point(f.point);return `<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="${stroke}" fill-opacity=".25" stroke="${stroke}" stroke-width="2.5" pointer-events="none"/>`;}
  let a,b;if(f.kind==='segment'){a=point(f.endpoints[0]);b=point(f.endpoints[1]);}
  else if(f.kind==='line'){const ends=svgLine(data.lines[f.lineIndex]);if(ends)[a,b]=ends;}
  else if(f.kind==='ray'){a=point(f.point);const ends=svgLine(data.lines[f.lineIndex]),origin=f.point.map(q),next=origin.map((x,i)=>x.add(q(f.direction[i]))),p=point(next),direction=[p[0]-a[0],p[1]-a[1]];if(ends)b=ends.reduce((best,x)=>(x[0]-a[0])*direction[0]+(x[1]-a[1])*direction[1]>(best[0]-a[0])*direction[0]+(best[1]-a[1])*direction[1]?x:best);}
  return a&&b?`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${stroke}" stroke-width="5" stroke-opacity=".85" pointer-events="none"/>`:'';
}

function bindNetJumping(result){
  const i=Math.max(0,Math.min(result.certificates.length-1,Number(state.netResultIndex)||0)),certificate=result.certificates[i],family=result.jumping?.[i];if(!family)return;
  const run=async(kind)=>{const params={kind,certificate};if(kind==='resonance'){params.u=$('#jump-u').value;params.v=$('#jump-v').value;}else if(kind==='pointed'){params.line=Number($('#pointed-line').value);params.order=Number($('#pointed-order').value);}else{params.order=Number($('#jump-order').value);params.r=Number($('#jump-r').value);params.s=Number($('#jump-s').value);}
    const gen=panelGeneration,el=$('#net-jumping-status');el.textContent='生成した点で chamber 複体の rank を正確に確認しています…';
    try{const r=await request('net-specialize',params);if(gen!==panelGeneration)return;change(()=>Object.assign(state,r.load),false);toast(`dim H¹ = ${r.depth}（${r.cohomology.field} 上）。生成したパラメータを読み込みました。`);$('#analysis').scrollIntoView({behavior:'smooth',block:'start'});}
    catch(e){if(gen===panelGeneration)el.textContent=e.message;}
  };
  $('#load-net-resonance').onclick=()=>run('resonance');$('#load-net-character').onclick=()=>run('character');if($('#load-pointed-character'))$('#load-pointed-character').onclick=()=>run('pointed');
  $('#export-net-jumping').onclick=()=>download('chamber-net-jumping.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,...family},null,2),'application/json');
}
function bindDoubleStar(){
  const button=$('#load-ds-character');if(!button)return;button.onclick=()=>{const N=Number($('#ds-order').value),r=Number($('#ds-r').value);if(!Number.isInteger(N)||N<2||N>60||N%2||!Number.isSafeInteger(r)){toast('N は 2–60 の偶数、r は整数にしてください');return;}const mod=x=>String((x%N+N)%N);state.localMode='cyclic';state.order=N;state.w=Array.from({length:10},(_,i)=>mod(i<5?r:N/2-r));state.homology=false;switchTab('local');toast('double star の translated component 上の局所系を読み込みました。');};
}

async function calculateGroup(){
  const el=$('#group-result'),gen=panelGeneration;if(!el)return;
  try{const r=await cachedStructure('group');if(gen!==panelGeneration)return;paintGroup(r);}
  catch(e){if(gen===panelGeneration)el.innerHTML=`<div class="structure-error">基本群表示の計算を完了できませんでした：${esc(e.message)}</div>`;}
}
function paintGroup(r){
  const el=$('#group-result');if(!el)return;el.className='';el.innerHTML=groupResultHTML(r,state);
  $('#group-basis').onchange=()=>{state.groupBasis=$('#group-basis').value;persist();paintGroup(r);};
  $$('[data-group-chamber]').forEach(b=>b.onclick=()=>{showChamber(b.dataset.groupChamber);toast(b.dataset.groupChamber+' に対応する関係式の chamber を強調しました。');});
  const basis=()=>state.groupBasis==='meridian'?'meridian':'chamber';
  $('#export-group-gap').onclick=()=>download('chamber-fundamental-group.g',groupExport(r,{format:'gap',basis:basis()}));
  $('#export-group-sage').onclick=()=>download('chamber-fundamental-group.sage',groupExport(r,{format:'sage',basis:basis()}));
  $('#export-group-json').onclick=()=>download('chamber-fundamental-group.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,flag:state.flag,...r},null,2),'application/json');
}

function bindJumpIdeals(){
  $('#compute-jump-ideals').onclick=()=>{const k=Math.max(1,Math.min(data.n+1,Number($('#jump-k').value)||1));if(k!==state.k){state.k=k;persist();renderAnalysis();}calculateJumpIdeals();};
  $('#compute-live-resonance').disabled=state.k!==1;
  $('#compute-live-resonance').onclick=()=>calculateJumpIdeals({live:true});
  $('#resonance-budget').value=String([1,3,10].includes(state.resonanceBudget)?state.resonanceBudget:3);
  $('#resonance-budget').onchange=e=>{state.resonanceBudget=Number(e.target.value);persist();};
  const completed=['local','aomoto'].every(kind=>resultCache.has(calcKey('jump-ideal',{kind,k:state.k})));
  const known=JUMP_IDEAL_CACHE.some(r=>r.geometryKey===jumpGeometryKey(data)&&r.k===state.k&&r.decomposition.complete);
  if(completed||known)calculateJumpIdeals({savedOnly:true});
}
async function calculateJumpIdeals({live=false,savedOnly=false}={}){
  const el=$('#computed-ideals-result'),gen=panelGeneration,k=state.k;if(!el)return;
  if(live&&k!==1)return;
  const budget=Number($('#resonance-budget').value)||3;
  const kinds=live?['aomoto']:['aomoto','local'].filter(kind=>!savedOnly||resultCache.has(calcKey('jump-ideal',{kind,k}))||JUMP_IDEAL_CACHE.some(r=>r.geometryKey===jumpGeometryKey(data)&&r.kind===kind&&r.k===k));
  $('#compute-jump-ideals').disabled=true;$('#compute-live-resonance').disabled=true;$('#resonance-budget').disabled=true;
  el.innerHTML=live?'<div class="calculation-placeholder" role="status">Resonance の局所成分と、全ての射影部分配置の multinet を調べています…</div>':'<div class="calculation-placeholder" role="status">多項式の生成元と、成分分解を確認しています…</div>';
  const results=await Promise.allSettled(kinds.map(kind=>live?request('jump-ideal',{kind,k,options:{liveResonance:true,maxTimeMs:budget*1000}}):cachedStructure('jump-ideal',{kind,k})));
  if(gen!==panelGeneration)return;
  $('#compute-jump-ideals').disabled=false;$('#compute-live-resonance').disabled=k!==1;$('#resonance-budget').disabled=false;
  if(live&&results[0].status==='fulfilled'){
    const key=calcKey('jump-ideal',{kind:'aomoto',k}),previous=resultCache.get(key);
    if(!previous?.decomposition.complete)resultCache.set(key,results[0].value);
  }
  const valid=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(live){const knownLocal=resultCache.get(calcKey('jump-ideal',{kind:'local',k}));if(knownLocal)valid.push(knownLocal);}
  el.innerHTML=valid.map(idealResultHTML).join('')+results.map((r,i)=>r.status==='rejected'?`<div class="structure-error">${kinds[i]==='aomoto'?'Resonance':'Characteristic'} の計算を完了できませんでした：${esc(r.reason.message)}</div>`:'').join('');
  if(savedOnly&&!kinds.includes('local'))el.insertAdjacentHTML('beforeend','<p class="note">この配置・深さの Characteristic の全成分は保存されていません。「両方のイデアル・成分を計算」で定義式の計算を試せます。</p>');
  if(!valid.length)return;
  el.insertAdjacentHTML('beforeend','<div class="button-row ideal-exports"><button id="export-jump-formulas-tex" class="secondary small">定義式の分解 TeX ↓</button><button id="export-jump-formulas-text" class="quiet small">式の一覧 TXT ↓</button><button id="export-jump-ideals" class="secondary small">生成元・成分・検証情報 JSON ↓</button><button id="export-jump-singular-local" class="quiet small">V の Singular スクリプト ↓</button><button id="export-jump-singular-aomoto" class="quiet small">R の Singular スクリプト ↓</button></div>');
  el.insertAdjacentHTML('beforeend',`<details class="formula-source"><summary>定義式の TeX・テキストを表示</summary><label>TeX<textarea readonly rows="9" spellcheck="false" aria-label="分解式の TeX">${esc(valid.map(decompositionTeX).join('\n'))}</textarea></label><label>テキスト<textarea readonly rows="7" spellcheck="false" aria-label="分解式のテキスト">${esc(valid.map(decompositionText).join('\n'))}</textarea></label></details>`);
  $('#export-jump-formulas-tex').onclick=()=>download('chamber-jumping-loci.tex',valid.map(decompositionTeX).join('\n'));
  $('#export-jump-formulas-text').onclick=()=>download('chamber-jumping-loci.txt',valid.map(decompositionText).join('\n'));
  $('#export-jump-ideals').onclick=()=>download('chamber-jump-ideals.json',JSON.stringify({source:'Chamber Lab v0.8',lines:state.lines,flag:state.flag,depth:k,results:valid},null,2),'application/json');
  for(const kind of ['local','aomoto'])$('#export-jump-singular-'+kind).onclick=()=>{try{download('chamber-'+(kind==='local'?'characteristic':'resonance')+'-ideal.sing',singularJumpScript(data,kind,k));}catch(e){toast(e.message);}};
}

let plinthController=null;
function showLab(which){
  const plinth=which==='plinth';document.body.dataset.lab=plinth?'plinth':'chambers';
  document.title=plinth?'Plinth Lab — Splitting polygon の実験室':'Chamber Lab — 実直線配置の実験室';
  $('#chamber-lab-view').hidden=plinth;$('#plinth-lab-view').hidden=!plinth;
  $$('[data-lab]').forEach(a=>{const active=a.dataset.lab===which;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#help-open').hidden=plinth;$('#save-project').hidden=plinth;$('#limits-open').hidden=plinth;
  $('footer span').textContent=plinth?'Plinth Lab · Guerville-Ballé の splitting polygon に基づく実験':'Chamber Lab · Yoshinaga の chamber complex に基づく実験';
  if(plinth&&!plinthController)plinthController=initPlinthLab($('#plinth-lab-view'),{getChamber:()=>data,onTransfer:payload=>{
    const ok=change(()=>{state.lines=payload.lines;state.extraRealFields=payload.extraRealFields;state.flag=null;state.name=payload.name;state.preset='custom';state.mode='select';state.tab='overview';state.overviewPane='invariants';state.w=[];state.a=[];state.complex=[];});
    if(ok){location.hash='chambers';showLab('chambers');syncPlotSize();fitView();renderCanvas();toast('選択した実配置を decone して読み込みました。「戻す」で元の配置に戻せます。');}
  }});
  if(plinth)plinthController?.onShow();else{plinthController?.stopSearch();syncPlotSize();if(data)renderCanvas();}
}
window.addEventListener('hashchange',()=>showLab(location.hash==='#plinth'?'plinth':'chambers'));
showLab(location.hash==='#plinth'?'plinth':'chambers');
