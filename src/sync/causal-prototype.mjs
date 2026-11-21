// Experimental A2 metadata index. Not bundled, persisted, or applied to layouts.
// change.value is an opaque JSON snapshot; schema3/geometry validation comes later.
export const CAUSAL_PROTOTYPE_LIMITS = Object.freeze({
  operations:1024, recordBytes:2097152, snapshotBytes:8388608, totalBytes:33554432, parents:64, changes:128,
});
const ID = /^[a-f0-9]{32}$/;
const plain = x => x !== null && typeof x === 'object' &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);

const encoder=new TextEncoder();
const byteLength=s=>/[^\x00-\x7f]/.test(s)?encoder.encode(s).length:s.length;
function encode(value,maxBytes=CAUSAL_PROTOTYPE_LIMITS.recordBytes) {
  const seen = new Set(); let nodes = 0, bytes = 0;
  const token = s => {
    bytes += byteLength(s);
    if (bytes > maxBytes) throw Error('record-byte-budget');
    return s;
  };
  function visit(v, depth) {
    if (++nodes > 200000 || depth > 16) throw Error('json-budget');
    if (v === null || typeof v === 'boolean') return token(JSON.stringify(v));
    if (typeof v === 'string') {
      if (v.length > 16384) throw Error('string-budget');
      return token(JSON.stringify(v));
    }
    if (typeof v === 'number' && Number.isFinite(v)) return token(JSON.stringify(v));
    if (!Array.isArray(v) && !plain(v)) throw Error('not-json');
    if (seen.has(v)) throw Error('cyclic-json');
    seen.add(v);
    const keys = Object.keys(v);
    if (keys.length > 8192) throw Error('key-budget');
    if (Array.isArray(v) && (v.length > 8192 || keys.length !== v.length || keys.some((k,i) => k !== String(i)))) throw Error('not-json-array');
    for (const k of keys) {
      if (k.length > 2048 || !Object.hasOwn(Object.getOwnPropertyDescriptor(v, k), 'value')) throw Error('not-json');
    }
    const open = token(Array.isArray(v) ? '[' : '{');
    token(','.repeat(Math.max(0, keys.length - 1)));
    const out = Array.isArray(v)
      ? open + v.map(x => visit(x, depth + 1)).join(',') + token(']')
      : open + keys.sort().map(k => token(JSON.stringify(k)) + token(':') + visit(v[k], depth + 1)).join(',') + token('}');
    seen.delete(v); return out;
  }
  return visit(value, 0);
}

function validate(op, vault) {
  if(!plain(op)||![1,2].includes(op.protocol))throw Error('unknown-protocol');
  const fields=op.protocol===1?'changes,id,parents,protocol,vault':'changes,id,layoutSchema,parents,protocol,structures,vault';
  if(Object.keys(op).sort().join(',')!==fields)throw Error('envelope');
  if(op.protocol===2&&(op.layoutSchema!==3||!plain(op.structures)))throw Error('layout-envelope');
  if (op.vault !== vault) throw Error('foreign-vault');
  if (typeof op.id !== 'string' || !ID.test(op.id)) throw Error('id');
  if (!Array.isArray(op.parents) || op.parents.length > CAUSAL_PROTOTYPE_LIMITS.parents ||
      !op.parents.every(p => typeof p === 'string' && ID.test(p) && p !== op.id) ||
      new Set(op.parents).size !== op.parents.length) throw Error('parents');
  if (!Array.isArray(op.changes) || !op.changes.length || op.changes.length > CAUSAL_PROTOTYPE_LIMITS.changes) throw Error('changes');
  const groups = new Set();
  for (const c of op.changes) {
    if (!plain(c) || Object.keys(c).sort().join(',') !== 'group,value' ||
        typeof c.group !== 'string' || !c.group.length || c.group.length > 2048 || groups.has(c.group) ||
        (c.value !== null && !plain(c.value))) throw Error('change');
    groups.add(c.group);
  }
}

// Also used to isolate trusted local baselines before prototype validation.
export const cloneBoundedSyncJson = (value,{maxBytes=CAUSAL_PROTOTYPE_LIMITS.snapshotBytes}={}) => JSON.parse(encode(value,maxBytes));

// Read-only reachability over a validated topological sequence. A bit matrix
// bounds 1024-node ancestor storage to 128 KiB rather than hundreds of Sets.
export function buildSyncReachability(ready) {
  const positions=new Map(ready.map((op,i)=>[op.id,i])),rows=new Map(),words=Math.ceil(ready.length/32);
  for(const op of ready){const bits=new Uint32Array(words);
    for(const parent of op.parents){const i=positions.get(parent),row=rows.get(parent);if(i===undefined||!row)throw Error('non-topological-input');
      bits[i>>>5]|=1<<(i&31);for(let w=0;w<words;w++)bits[w]|=row[w];}
    rows.set(op.id,bits);
  }
  return {has(id,ancestor){const i=positions.get(ancestor);return i!==undefined&&!!(rows.get(id)?.[i>>>5]&(1<<(i&31)));},
    before(id){const bits=rows.get(id),out=new Set();ready.forEach((op,i)=>{if(bits?.[i>>>5]&(1<<(i&31)))out.add(op.id);});return out;}};
}

// Analyze the full available set again on each call. No mutation, I/O or clock.
// Null values are retained reset tombstones. No materialization/auto-apply API.
export function analyzeSyncCausality(input, {vault, validateOperation} = {}) {
  if (typeof vault !== 'string' || !ID.test(vault)) throw Error('vault');
  if (!Array.isArray(input) || input.length > CAUSAL_PROTOTYPE_LIMITS.operations) throw RangeError('operation-budget');
  if (validateOperation !== undefined && typeof validateOperation !== 'function') throw Error('validator');
  const known = new Map(), bodies = new Map(), tainted = new Set(), issues = [];
  let total = 0;
  input.forEach((raw, index) => {
    let op, body, identity;
    try {
      if (plain(raw)) {
        const v = Object.getOwnPropertyDescriptor(raw, 'vault')?.value;
        const id = Object.getOwnPropertyDescriptor(raw, 'id')?.value;
        if (v === vault && typeof id === 'string' && ID.test(id)) identity = id;
      }
      body = encode(raw);
      const bytes = byteLength(body); total += bytes;
      if (total > CAUSAL_PROTOTYPE_LIMITS.totalBytes) throw RangeError('total-byte-budget');
      if (bytes > CAUSAL_PROTOTYPE_LIMITS.recordBytes) throw Error('record-byte-budget');
      op = JSON.parse(body);
      if (op?.vault === vault && typeof op.id === 'string' && ID.test(op.id)) {
        if (bodies.has(op.id) && bodies.get(op.id) !== body) tainted.add(op.id);
        bodies.set(op.id, body);
      }
      validate(op, vault);
      if (validateOperation) validateOperation(structuredClone(op));
      known.set(op.id, op);
    } catch (error) {
      if (error instanceof RangeError) throw error; // Caller must retain inputs and stop.
      issues.push({index, reason:error.message});
      // If an identifiable same-vault record is invalid, never use its other copy.
      if (identity) tainted.add(identity);
    }
  });
  for (const id of tainted) known.delete(id);
  const indegree = new Map(), children = new Map(), ready = [],done=new Set();
  for (const op of known.values()) {
    indegree.set(op.id, op.parents.length);
    for (const parent of op.parents) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(op.id);
    }
  }
  const queue = [...known.keys()].filter(id => indegree.get(id) === 0).sort();
  while (queue.length) {
    const id = queue.shift(), op = known.get(id);
    done.add(id);ready.push(op);
    for (const child of children.get(id) || []) {
      const n = indegree.get(child) - 1; indegree.set(child, n);
      if (n === 0) { queue.push(child); queue.sort(); }
    }
  }
  const reach=buildSyncReachability(ready),writers = new Map();
  for (const op of ready) for (const c of op.changes) {
    if (!writers.has(c.group)) writers.set(c.group, []);
    writers.get(c.group).push(op.id);
  }
  const frontiers = [...writers].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([group, ids]) => ({
    group, heads:ids.filter(id => !ids.some(other => reach.has(other,id))).sort(),
  }));
  const referenced = new Set(ready.flatMap(op => op.parents));
  return {
    ready, heads:ready.map(op => op.id).filter(id => !referenced.has(id)).sort(),
    pending:[...known.keys()].filter(id => !done.has(id)).sort().map(id => ({
      id, reason:'missing-or-cyclic-dependency',
      missing:known.get(id).parents.filter(p => !known.has(p)).sort(),
    })),
    quarantined:[...tainted].sort(), issues, frontiers,
    conflicts:frontiers.filter(f => f.heads.length > 1),
  };
}
