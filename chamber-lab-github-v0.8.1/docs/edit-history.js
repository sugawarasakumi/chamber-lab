// Snapshots are opaque strings. Recording an unsuccessful/no-op edit must not
// discard the redo branch; callers record only after a successful rebuild.
export class EditHistory{
  constructor(limit=50){this.limit=limit;this.past=[];this.future=[];}
  record(before,after){if(before===after)return false;this.past.push(before);if(this.past.length>this.limit)this.past.shift();this.future=[];return true;}
  undo(current){if(!this.past.length)return null;this.future.push(current);return this.past.pop();}
  redo(current){if(!this.future.length)return null;this.past.push(current);return this.future.pop();}
  get canUndo(){return this.past.length>0;}
  get canRedo(){return this.future.length>0;}
}

export function deleteLineModel(model,index){
  if(!Number.isInteger(index)||index<0||index>=model.lines.length)throw Error('削除する直線を選んでください');
  const result=structuredClone(model);
  for(const key of ['lines','w','a','complex'])if(Array.isArray(result[key]))result[key].splice(index,1);
  result.preset='custom';result.name='オリジナル配置';result.netSupport=null;result.netResultIndex=0;
  return result;
}
