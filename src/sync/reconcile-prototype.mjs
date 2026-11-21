// Explicit relative-path rename events over accepted schema3 identities only.
// No filename inference, deletion, filesystem access or note-content rewriting.
import {cloneBoundedSyncJson} from './causal-prototype.mjs';
import {validateSchema3Change} from './layout-prototype.mjs';
export function remapAcceptedSchema3Paths(snapshot,pathChanges=[]) {
  let state=cloneBoundedSyncJson(snapshot);
  const events=cloneBoundedSyncJson(pathChanges);
  if(!Array.isArray(events)||events.length>64)throw Error('reconcile-path-budget');
  for(const event of events){
    if(!event||Array.isArray(event)||Object.keys(event).sort().join(',')!=='folder,newPath,oldPath'||typeof event.folder!=='boolean')throw Error('reconcile-path-event');
    for(const value of [event.oldPath,event.newPath]){
      if(typeof value!=='string')throw Error('reconcile-path-event');
      validateSchema3Change({group:JSON.stringify(['note',value,'']),value:null});
    }
    const {oldPath,newPath,folder}=event;
    if(oldPath===newPath)continue;
    if(folder&&newPath.startsWith(oldPath+'/'))throw Error('reconcile-path-descendant');
    const matches=p=>p===oldPath||(folder&&p.startsWith(oldPath+'/'));
    function key(value){
      if(value==='root')return value;
      const parts=JSON.parse(value);if(matches(parts[1]))parts[1]=newPath+parts[1].slice(oldPath.length);
      return JSON.stringify(parts);
    }
    function table(input,convert){
      const result=new Map();
      for(const [name,value]of Object.entries(input)){
        const next=key(name);if(result.has(next))throw Error('reconcile-path-collision');
        result.set(next,convert(value));
      }
      return Object.fromEntries(result);
    }
    const groups=table(state.groups,record=>({...record,
      ...(record.note?{note:key(record.note)}:{}),
      shape:record.shape.map(row=>({...row,id:key(row.id)})).sort((a,b)=>a.id.localeCompare(b.id)),
      points:record.points.map(row=>({...row,id:key(row.id)})).sort((a,b)=>a.id.localeCompare(b.id)),
    }));
    const structures=table(state.structures,rows=>rows.map(row=>({...row,key:key(row.key),parent:key(row.parent)})));
    state={...state,groups,structures};
  }
  return state;
}
