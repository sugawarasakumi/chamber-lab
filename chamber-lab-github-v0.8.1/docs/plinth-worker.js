import {modelFromJSON,makePlinth,checkPolygon} from './plinth-core.js';
import {polynomialRoots} from './plinth-field.js';
self.onmessage=({data})=>{
  try{
    const base=modelFromJSON(data.model),support=data.model.support,r=support.length,choices=support.map((s,i)=>base.points.filter(p=>!p.lines.includes(s)&&!p.lines.includes(support[(i+1)%r]))),limit=Math.max(1,Math.min(5000,Number(data.limit)||500)),results=[];let tested=0,stopped=false;
    const walk=pivots=>{
      if(stopped)return;
      if(pivots.length===r){
        if(tested>=limit){stopped=true;return;}tested++;const foundBefore=results.length;
        try{const plinth=makePlinth(base,support,pivots.map(p=>p.lines.slice(0,2))),sol=polynomialRoots(plinth.coefficients,base.field);
          if(sol.roots.length===2&&sol.roots.every(root=>checkPolygon(plinth,root,sol.field).valid))results.push({support,pivots:pivots.map(p=>p.lines.slice(0,2)),coefficients:plinth.coefficients.map(base.field.str),kind:sol.kind});
        }catch{}
        if(tested%25===0||results.length>foundBefore)self.postMessage({tested,results,complete:false});
        if(results.length>=8)stopped=true;return;
      }
      for(const p of choices[pivots.length])if(!pivots.includes(p)){walk([...pivots,p]);if(stopped)break;}
    };
    walk([]);self.postMessage({tested,results,complete:!stopped,done:true});
  }catch(e){self.postMessage({error:e.message,done:true});}
};
