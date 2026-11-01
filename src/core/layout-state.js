// Versioned parent-local positions. Display geometry and automatic layout stay separate.
function createLayoutModel(nodes, rootRadius) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const keyOf = n => JSON.stringify([n.kind, n.path || n.id,
    n.kind === 'heading' ? n.id.slice((n.note || '').length) : '']);
  const keys = new Map(nodes.map(n => [n.id, keyOf(n)]));
  const root = { x: 0, y: 0, r: rootRadius || 1000 };
  const baseline = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]));
  const groups = new Map(), children = new Map(), outlines = new Map(), identities = new Map();
  for (const n of nodes) {
    const parent = byId.get(n.parent), key = parent ? keys.get(parent.id) : 'root';
    if (!groups.has(key)) groups.set(key, { key, parent, nodes: [] });
    groups.get(key).nodes.push(n);
    if (!children.has(n.parent)) children.set(n.parent, []);
    children.get(n.parent).push(n);
    if (n.kind === 'heading') {
      if (!outlines.has(n.note)) outlines.set(n.note, []);
      outlines.get(n.note).push(n);
    }
  }
  for (const [note, headings] of outlines) {
    headings.sort((a, b) => a.line - b.line);
    // Duplicate headings lack durable identity: include their lines as an extra
    // conservative guard. Unique headings survive ordinary body line insertions.
    identities.set(note, headings.map(n => ({ key: keys.get(n.id), title: n.title,
      parent: keys.get(n.parent), level: n.level, evidence: n.layoutEvidence })));
    const counts = new Map();
    for (const n of headings) counts.set(n.title, (counts.get(n.title) || 0) + 1);
    outlines.set(note, headings.map(n => [keys.get(n.id), counts.get(n.title) > 1 ? n.line : null]));
  }
  for (const g of groups.values()) {
    g.nodes.sort((a, b) => keys.get(a.id).localeCompare(keys.get(b.id)));
    g.shape = g.nodes.map(n => ({ id: keys.get(n.id), r: +(n.r / (g.parent || root).r).toFixed(8) }));
    g.outline = outlines.get(g.nodes[0]?.note) || null;
  }
  // Compact each legacy group without discarding inconsistent outline guards.
  function compact(record) {
    if(!record || !Array.isArray(record.shape))return record;
    if(record.shape.some(n=>n && Object.hasOwn(n,'outline'))){
      const outline=record.shape[0]?.outline;
      if(!record.shape.every(n=>n && JSON.stringify(n.outline)===JSON.stringify(outline)))return null;
      return {...record,outline:outline??null,shape:record.shape.map(({outline,...n})=>n)};
    }
    return record;
  }
  const compatible=(record,g)=>!!record && JSON.stringify(record.shape)===JSON.stringify(g.shape) &&
    JSON.stringify(record.outline??null)===JSON.stringify(g.outline);
  function translate(n, dx, dy) {
    const stack = [n];
    while (stack.length) {
      const child = stack.pop(); child.x += dx; child.y += dy;
      stack.push(...(children.get(child.id) || []));
    }
  }
  function groupKey(id) { const n = byId.get(id); return n ? (keys.get(n.parent) || 'root') : null; }
  function capture(key) {
    const g = groups.get(key); if (!g) return null;
    const p = g.parent || root, bp = g.parent ? baseline.get(p.id) : root;
    const points = g.nodes.map(n => ({ id: keys.get(n.id), x: (n.x - p.x) / p.r, y: (n.y - p.y) / p.r }));
    const changed = points.some((point, i) => {
      const b = baseline.get(g.nodes[i].id);
      return Math.hypot(point.x - (b.x - bp.x) / p.r, point.y - (b.y - bp.y) / p.r) > 1e-9;
    });
    return changed ? { shape: structuredClone(g.shape), outline:structuredClone(g.outline), points,
      identity: structuredClone(identities.get(g.nodes[0]?.note) || null) } : null;
  }
  // Conservatively recognize a single rename in an otherwise unchanged outline.
  // Identity follows a verified alias chain saved with each group, across cold loads.
  let repairBudget=0;
  function validDisks(disks,tolerance) {
    for(let i=0;i<disks.length;i++){
      if(--repairBudget<0)return false;
      const a=disks[i];
      if(!Number.isFinite(a.x+a.y+a.r) || a.r<=0 || Math.hypot(a.x,a.y)+a.r>1+tolerance)return false;
      for(let j=0;j<i;j++){if(--repairBudget<0)return false;if(Math.hypot(a.x-disks[j].x,a.y-disks[j].y)<a.r+disks[j].r-tolerance)return false;}
    }
    return true;
  }
  function repairGroup(g,record,old,current) {
    if(!Array.isArray(record.points) || !Array.isArray(record.shape) || g.nodes.length>128)return null;
    const p=g.parent||root,tolerance=Math.max(1e-8,.002/p.r);
    if(tolerance>.002)return null;
    const previous=new Map(record.shape.map(n=>[n.id,n.r]));
    if(record.points.length!==previous.size || new Set(record.points.map(n=>n.id)).size!==previous.size ||
      !validDisks(record.points.map(n=>({...n,r:previous.get(n.id)})),.002))return null;
    const points=new Map(record.points.map(n=>[n.id,n]));
    if(g.nodes.some(n=>n.kind==='heading')){
      if(!Array.isArray(old) || !current || !old.every(n=>n && typeof n.key==='string'))return null;
      const a=new Map(old.map(n=>[n.key,n])),b=new Map(current.map(n=>[n.key,n]));
      // Only pure addition/deletion or unchanged identities. Simultaneous
      // replacement/rename is handled by the explicit rename matcher above.
      if(!old.every(n=>b.has(n.key)) && !current.every(n=>a.has(n.key)))return null;
      const counts=items=>{const c=new Map();for(const n of items)c.set(n.title,(c.get(n.title)||0)+1);return c;};
      const ac=counts(old),bc=counts(current);
      for(const n of old){const next=b.get(n.key);if(!next)continue;
        if(n.parent!==next.parent || n.level!==next.level || n.title!==next.title)return null;
        if((ac.get(n.title)>1 || bc.get(n.title)>1) && (ac.get(n.title)!==bc.get(n.title) || n.evidence!==next.evidence || !n.evidence || n.evidence.startsWith('0:')))return null;
      }
      // No reuse of a duplicate suffix if a preceding equal heading was removed.
      for(const n of g.nodes)if(points.has(keys.get(n.id)) && !a.has(keys.get(n.id)))return null;
    }
    let count=0;const stack=[...g.nodes];
    while(stack.length){const n=stack.pop();if(++count>5000)return null;stack.push(...(children.get(n.id)||[]));}
    const disks=g.nodes.map(n=>{const id=keys.get(n.id),saved=points.get(id);
      return {id,x:saved?.x??(n.x-p.x)/p.r,y:saved?.y??(n.y-p.y)/p.r,r:n.r/p.r,weight:saved ? 0.1 : 1};});
    if(!disks.some(n=>points.has(n.id)))return null;
    // First place new elements into free space with all existing centers fixed.
    const placed=disks.filter(n=>points.has(n.id));
    for(const n of disks.filter(n=>!points.has(n.id))){
      if(!validDisks([...placed,n],tolerance)){
        const radius=Math.max(0,1-n.r);
        for(let sample=0;sample<192 && repairBudget>0;sample++){
          const distance=radius*Math.sqrt(sample/191),angle=sample*2.399963229728653;
          const trial={...n,x:distance*Math.cos(angle),y:distance*Math.sin(angle)};
          if(validDisks([...placed,trial],tolerance)){n.x=trial.x;n.y=trial.y;break;}
        }
      }
      placed.push(n);
    }
    // Bounded weighted projection: established elements resist displacement.
    for(let iteration=0;iteration<128 && repairBudget>0 && !validDisks(disks,tolerance);iteration++){
      for(const n of disks){const d=Math.hypot(n.x,n.y),limit=1-n.r;if(d>limit && d>0){n.x*=limit/d;n.y*=limit/d;}}
      for(let i=0;i<disks.length && repairBudget>0;i++)for(let j=0;j<i && repairBudget>0;j++){
        repairBudget--;
        const a=disks[i],b=disks[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),over=a.r+b.r-d;
        if(over<=0)continue;if(d<1e-12){dx=1;dy=0;d=1;}
        const aw=a.weight/(a.weight+b.weight),bw=1-aw;
        a.x-=dx/d*over*aw;a.y-=dy/d*over*aw;b.x+=dx/d*over*bw;b.y+=dy/d*over*bw;
      }
    }
    if(!validDisks(disks,tolerance))return null;
    const moved=disks.filter(n=>points.has(n.id)&&Math.hypot(n.x-points.get(n.id).x,n.y-points.get(n.id).y)>1e-8).length;
    return {shape:structuredClone(g.shape),outline:structuredClone(g.outline),points:disks.map(({id,x,y})=>({id,x,y})),
      identity:structuredClone(identities.get(g.nodes[0]?.note)||null),repair:{moved,added:disks.filter(n=>!points.has(n.id)).length}};
  }
  function reconcile(records) {
    repairBudget=250000; // Shared across groups; exhausted work falls back locally.
    const output = {}, used = new Set();
    for (const [oldKey, saved] of Object.entries(records)) {
      let key=oldKey, record=compact(structuredClone(saved));
      if(!record){if(used.has(oldKey))return records;output[oldKey]=saved;used.add(oldKey);continue;}
      const old=record?.identity;
      const first=record?.shape?.[0]?.id;
      let path; try { path=JSON.parse(first)[1]; } catch {}
      const current=[...identities.values()].find(items=>items.length && JSON.parse(items[0].key)[1]===path);
      const mapping=new Map();
      if(Array.isArray(old) && old.every(n=>n && typeof n.key==='string' && typeof n.title==='string') && current && old.length===current.length && old.length>0) {
        const oldIndex=new Map(old.map((n,i)=>[n.key,i])), newIndex=new Map(current.map((n,i)=>[n.key,i]));
        const counts=items=>{const c=new Map();for(const n of items)c.set(n.title,(c.get(n.title)||0)+1);return c;};
        const oldCounts=counts(old),newCounts=counts(current);
        const nonempty=n=>typeof n.evidence==='string' && !n.evidence.startsWith('0:');
        // Duplicate labels require distinct nonempty section evidence. Position
        // alone cannot distinguish equal headings after insertion or reordering.
        const distinguishable=items=>{
          const titles=counts(items),signatures=new Set();
          for(const n of items)if(titles.get(n.title)>1){
            const signature=JSON.stringify([n.title,n.evidence]);
            if(!nonempty(n) || signatures.has(signature))return false;
            signatures.add(signature);
          }
          return true;
        };
        const differences=old.map((n,i)=>n.title===current[i].title?-1:i).filter(i=>i>=0);
        const structure=old.every((n,i)=>n.level===current[i].level &&
          (oldIndex.get(n.parent)??-1)===(newIndex.get(current[i].parent)??-1));
        const changed=differences[0];
        const evidence=old.every((n,i)=>{
          const required=i===changed || oldCounts.get(n.title)>1 || newCounts.get(current[i].title)>1;
          return !required || (typeof n.evidence==='string' && n.evidence===current[i].evidence);
        });
        // A solitary heading has no heading anchors: require nonempty body as
        // additional evidence, alongside identical note, level and parent.
        const anchored=old.length>1 || nonempty(old[0]);
        const rename=differences.length===1 && anchored && structure && evidence &&
          distinguishable(old) && distinguishable(current);
        if(rename)old.forEach((n,i)=>mapping.set(n.key,current[i].key));
      }
      const mapValue=value=>{
        if(typeof value==='string')return mapping.get(value)||value;
        if(Array.isArray(value))return value.map(mapValue);
        if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,mapValue(v)]));
        return value;
      };
      if(mapping.size){key=mapping.get(key)||key;record=mapValue(record);}
      const group=groups.get(key);
      if(group && Array.isArray(record?.shape)) {
        record.shape.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
        if(Array.isArray(record.points))record.points.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
        // Verified correspondence covers the entire outline, including duplicate
        // suffix/line guards that can change when one duplicate is renamed.
        const localShape=shape=>shape.map(n=>[n.id,n.r]);
        if(mapping.size && JSON.stringify(localShape(record.shape))===JSON.stringify(localShape(group.shape)))
          {record.shape=structuredClone(group.shape);record.outline=structuredClone(group.outline);}
        if(!mapping.size && !compatible(record,group))
          record=repairGroup(group,record,old,current)||record;
        // Legacy records are enriched only on an exactly compatible build.
        if(compatible(record,group))
          record.identity=structuredClone(identities.get(group.nodes[0]?.note)||null);
        else if(mapping.size){key=oldKey;record=structuredClone(saved);}
      }
      // Never overwrite another saved group's positions during migration.
      if(used.has(key))return records;
      used.add(key);output[key]=record;
    }
    return output;
  }
  function apply(records = {}) {
    for (const n of nodes) Object.assign(n, baseline.get(n.id));
    let restored = 0, skipped = 0;
    const ordered = [...groups.values()].sort((a, b) => (a.parent?.depth || 0) - (b.parent?.depth || 0));
    for (const g of ordered) {
      if (!Object.hasOwn(records, g.key)) continue;
      const record = compact(records[g.key]), p = g.parent || root, tolerance = Math.max(1e-8, .002 / p.r);
      const points = record?.points;
      let valid = g.nodes.length <= 128 && compatible(record,g) && Array.isArray(points) && points.length === g.nodes.length;
      if (valid) for (let i = 0; i < points.length; i++) {
        const a = points[i], r = g.nodes[i].r / p.r;
        if (a.id !== keys.get(g.nodes[i].id) || !Number.isFinite(a.x) || !Number.isFinite(a.y) || Math.hypot(a.x, a.y) + r > 1 + tolerance) { valid = false; break; }
        for (let j = 0; j < i; j++) if (Math.hypot(a.x - points[j].x, a.y - points[j].y) < r + g.nodes[j].r / p.r - tolerance) valid = false;
      }
      if (!valid) { skipped++; continue; }
      points.forEach((point, i) => {
        const n = g.nodes[i]; translate(n, p.x + point.x * p.r - n.x, p.y + point.y * p.r - n.y);
      });
      restored++;
    }
    return { restored, skipped };
  }
  return { groupKey, capture, apply, reconcile, keys: () => [...groups.keys()] };
}

// One owner and one durable history per plugin, shared by all its views.
// write() must merge the supplied field into the latest settings in the host queue.
function createLayoutStore(initial, write) {
  let data = [1,2].includes(initial?.schemaVersion) && initial.groups && typeof initial.groups === 'object' && !Array.isArray(initial.groups)
    ? structuredClone(initial) : { schemaVersion: 2, revision: 0, groups: {} };
  let owner = null, busy = 0, tail = Promise.resolve(), message = '拖动后自动保存';
  const undo = [], redo = [], listeners = new Set();
  const unsupported = initial != null && (![1,2].includes(initial.schemaVersion) || !initial.groups || typeof initial.groups !== 'object' || Array.isArray(initial.groups));
  if (unsupported) message = '布局数据版本不受支持，调整已禁用；原数据保留';
  function state() { return { ...structuredClone(data), busy: busy > 0, locked: owner !== null,
    canUndo: undo.length > 0, canRedo: redo.length > 0, message, unsupported }; }
  function emit() { for (const fn of listeners) fn(state()); }
  function acquire(token) {
    if (unsupported || busy || (owner !== null && owner !== token)) return false;
    owner = token; return true;
  }
  function release(token) { if (owner === token) owner = null; }
  function run(token, transform, mode = 'edit') {
    if (unsupported) return Promise.reject(new Error(message));
    busy++; message = '正在保存布局…'; emit();
    const operation = tail.catch(() => {}).then(async () => {
      const next = transform(structuredClone(data.groups));
      if (next == null || JSON.stringify(next) === JSON.stringify(data.groups)) {
        if(mode==='invalidate'){undo.length=0;redo.length=0;message='笔记结构已更新；撤销记录已清空';}
        else message = '布局未改变';
        return;
      }
      const updated = { schemaVersion: 2, revision: (Number.isSafeInteger(data.revision) ? data.revision : 0) + 1, groups: next };
      await write(updated);
      if (mode === 'undo') { redo.push(data.groups); undo.pop(); }
      else if (mode === 'redo') { undo.push(data.groups); redo.pop(); }
      else if (mode === 'invalidate' || mode === 'migrate') { undo.length = 0; redo.length = 0; }
      else { undo.push(data.groups); if (undo.length > 50) undo.shift(); redo.length = 0; }
      data = updated; message = mode === 'migrate' && Object.values(next).some(g=>g?.repair) ? '布局已保存；已局部适配结构变化，撤销记录已清空' : mode === 'invalidate' ? '笔记结构已更新；撤销记录已清空' : '布局已保存';
    }).catch(error => { message = '布局保存失败，已恢复上次保存的位置：' + error.message; throw error; })
      .finally(() => { busy--; release(token); emit(); });
    tail = operation; return operation;
  }
  function command(token, kind, key, value) {
    if (owner !== token && !acquire(token)) return Promise.reject(new Error('另一视图正在调整或保存布局，请稍后重试'));
    if (busy) { release(token); return Promise.reject(new Error('布局正在保存，请稍后重试')); }
    return run(token, groups => {
      if (kind === 'undo') return undo.at(-1) || null;
      if (kind === 'redo') return redo.at(-1) || null;
      if (kind === 'reset-all') return {};
      if (key == null) return null;
      if (value == null) delete groups[key]; else groups[key] = value;
      return groups;
    }, kind);
  }
  // Rename only identities with an explicit path mapping; no fuzzy heading match.
  function changePath(oldPath, newPath, folder, allowRename = true) {
    const matches = p => p === oldPath || (folder && p.startsWith(oldPath + '/'));
    function mapKey(key) {
      let parts; try { parts = JSON.parse(key); } catch { return key; }
      if (!Array.isArray(parts) || parts.length !== 3) return key;
      if (matches(parts[1])) { parts[1] = newPath + parts[1].slice(oldPath.length); return JSON.stringify(parts); }
      return key;
    }
    const touches = value => {
      if (typeof value === 'string') { try { const p = JSON.parse(value); return Array.isArray(p) && typeof p[1] === 'string' && matches(p[1]); } catch { return false; } }
      return value && typeof value === 'object' && Object.values(value).some(touches);
    };
    function migrate(value) {
      if (typeof value === 'string') return mapKey(value);
      if (Array.isArray(value)) return value.map(migrate);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, migrate(v)]));
      return value;
    }
    return run(null, groups => Object.fromEntries(Object.entries(groups).flatMap(([key, value]) => {
      if (!touches(key) && !touches(value)) return [[key, value]];
      if (!newPath) return touches(key) ? [] : [[key,value]];
      if (!allowRename) return [];
      const migrated=migrate(value);
      if(Array.isArray(migrated.shape))migrated.shape.sort((a,b)=>a.id.localeCompare(b.id));
      if(Array.isArray(migrated.points))migrated.points.sort((a,b)=>a.id.localeCompare(b.id));
      return [[mapKey(key), migrated]];
    })), 'invalidate');
  }
  return { state, acquire, release, command, changePath,
    reconcile(model, valid = () => true) { return unsupported ? Promise.resolve() : run(null, groups => valid() ? model.reconcile(groups) : null, 'migrate'); },
    settled: () => tail.catch(() => {}),
    subscribe(fn) { listeners.add(fn); fn(state()); return () => listeners.delete(fn); },
    clearHistory() { undo.length = 0; redo.length = 0; message = '图谱结构已变化；撤销记录已清空'; emit(); } };
}
