import {q,QQ,rref} from './math.js';
const subset=(a,b)=>(a&b)===a;
const mask=ids=>ids.reduce((s,i)=>s+2**i,0);

// Closed sets of containing hyperplanes encode reverse inclusion of flats.
// No empty affine intersection and no artificial rank-three flat is adjoined.
export function intersectionPoset(data,mode='affine'){
  const cone=mode==='cone',ambientDimension=cone?3:2,n=data.n,atomCount=n+(cone?1:0),nodes=[];
  const add=(id,label,rank,atoms,geometry)=>{const node={id,label,rank,dimension:ambientDimension-rank,atoms:atoms.slice(),mask:mask(atoms),multiplicity:atoms.length,geometry,lowerCovers:[],upperCovers:[]};nodes.push(node);return node;};
  add('V',cone?'ℝ³':'ℝ²',0,[],{kind:'ambient'});
  for(let i=0;i<atomCount;i++)add(i===n?'Hinf':'H'+(i+1),i===n?'H∞':'H'+(i+1),1,[i],{kind:i===n?'infinity-plane':'hyperplane',lineIndex:i,equation:i===n?['0','0','1']:data.lines[i].map(String)});
  data.vertices.forEach((v,i)=>add('P'+(i+1),'P'+(i+1),2,v.lines,{kind:cone?'projective-point':'point',infinity:false,point:v.p.map(String),hom:[...v.p.map(String),'1']}));
  if(cone){
    const groups=new Map();data.lines.forEach((l,i)=>{const key=l.slice(0,2).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
    [...groups.values()].forEach((g,i)=>{const l=data.lines[g[0]];add('I'+(i+1),'P∞'+(i+1),2,[...g,n],{kind:'projective-point',infinity:true,hom:[String(l[1]),String(l[0].neg()),'0']});});
  }
  const normalRank=rref(cone?[...data.lines,[q(0),q(0),q(1)]]:data.lines.map(l=>l.slice(0,2)),QQ,ambientDimension).rank;
  if(cone&&normalRank===3)add('T','{0}',3,Array.from({length:atomCount},(_,i)=>i),{kind:'origin',point:['0','0','0']});
  nodes.sort((a,b)=>a.rank-b.rank);
  const byMask=new Map(nodes.map(v=>[v.mask,v])),rank=Math.max(...nodes.map(v=>v.rank)),covers=[];
  for(const x of nodes){
    x.mu=x.rank===0?1:-nodes.filter(y=>y.rank<x.rank&&subset(y.mask,x.mask)).reduce((s,y)=>s+y.mu,0);
    for(const y of nodes)if(y.rank===x.rank+1&&subset(x.mask,y.mask)){x.upperCovers.push(y.id);y.lowerCovers.push(x.id);covers.push({from:x.id,to:y.id});}
  }
  const maximal=nodes.filter(x=>!x.upperCovers.length),top=maximal.length===1?maximal[0]:null,isLattice=!!top,joinCache=new Map();
  const meet=(x,y)=>byMask.get(x.mask&y.mask);
  const join=(x,y)=>{const union=x.mask|y.mask;if(!joinCache.has(union))joinCache.set(union,nodes.find(z=>subset(union,z.mask))||null);return joinCache.get(union);};
  const modularWitnesses={};
  for(const x of nodes){
    x.modular=isLattice?true:null;
    if(isLattice)for(const y of nodes){const m=meet(x,y),j=join(x,y);if(!m||!j)throw Error('intersection lattice の meet/join を検証できません');if(x.rank+y.rank!==m.rank+j.rank){x.modular=false;modularWitnesses[x.id]={with:y.id,meet:m.id,join:j.id,ranks:[x.rank,y.rank,m.rank,j.rank]};break;}}
  }
  const chains=new Map([['V',1]]),modularChains=new Map([['V',['V']]]);
  for(const x of nodes){if(x.rank)chains.set(x.id,x.lowerCovers.reduce((s,id)=>s+chains.get(id),0));if(x.rank&&x.modular){const lower=x.lowerCovers.find(id=>modularChains.has(id));if(lower)modularChains.set(x.id,[...modularChains.get(lower),x.id]);}}
  const whitneySecond=Array(rank+1).fill(0),whitneyFirst=Array(rank+1).fill(0),characteristic=Array(ambientDimension+1).fill(0);
  for(const x of nodes){whitneySecond[x.rank]++;whitneyFirst[x.rank]+=x.mu;characteristic[x.rank]+=x.mu;}
  const modularChain=top?modularChains.get(top.id)||null:null;
  return {mode:cone?'cone':'affine',ambientDimension,normalRank,rank,atomCount,nodes,covers,whitneyFirst,whitneySecond,characteristic,
    properties:{ranked:true,pure:new Set(maximal.map(x=>x.rank)).size===1,meetSemilattice:true,atomistic:true,geometric:true,lattice:isLattice,bounded:isLattice,central:isLattice,essential:normalRank===ambientDimension,boolean:isLattice&&atomCount===rank&&nodes.length===2**rank,modular:isLattice?nodes.every(x=>x.modular):null,supersolvable:isLattice?!!modularChain:null},
    minimum:'V',maximum:top?.id||null,maximalElements:maximal.map(x=>x.id),maximalChainCount:maximal.reduce((s,x)=>s+chains.get(x.id),0),modularElements:isLattice?nodes.filter(x=>x.modular).map(x=>x.id):null,modularChain,modularWitnesses,
    order:'reverse inclusion: X ≤ Y iff X contains Y; encoded by inclusion of all containing hyperplanes',
    convention:cone?'central cone in R^3: homogenized input lines plus z=0; dimensions refer to vector subspaces, not projective flats':'nonempty affine intersections in R^2, including the empty-family intersection R^2; the empty set is excluded',
    sources:['https://math.mit.edu/~rstan/arrangements/arr.html','https://doc.sagemath.org/html/en/reference/discrete_geometry/sage/geometry/hyperplane_arrangement/arrangement.html#sage.geometry.hyperplane_arrangement.arrangement.HyperplaneArrangementElement.intersection_poset']};
}

export const intersectionPosets=data=>({affine:intersectionPoset(data,'affine'),cone:intersectionPoset(data,'cone')});
