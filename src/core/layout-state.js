// Versioned parent-local positions. Display geometry and automatic layout stay separate.
// Schema 3 keeps each note's heading identity once, shared by every group of that note;
// group records hold only shape/points plus a path-independent outline digest guard.
function layoutDigest(entries) {
  // Stable, order-sensitive 64-bit-ish fingerprint over heading keys and duplicate lines.
  // Path components are relative to the note, so renaming a file or folder keeps it valid.
  const text = JSON.stringify(entries);
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x85ebca6b);
  }
  return (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16) + ':' + entries.length;
}

// Legacy records guard the whole note outline; convert it to the same relative form.
function layoutLegacyDigest(outline) {
  if (!Array.isArray(outline)) return null;
  const entries = [];
  for (const entry of outline) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string') return null;
    let relative = entry[0];
    try {
      const parts = JSON.parse(entry[0]);
      if (Array.isArray(parts) && parts.length === 3 && typeof parts[2] === 'string') relative = parts[2];
    } catch { return null; }
    entries.push([relative, entry[1] ?? null]);
  }
  return layoutDigest(entries);
}

// Legacy inline outlines lived on every shape entry. Keep them only when consistent.
function compactLayoutRecord(record) {
  if (!record || typeof record !== 'object' || !Array.isArray(record.shape)) return record;
  if (!record.shape.some(entry => entry && Object.hasOwn(entry, 'outline'))) return record;
  const outline = record.shape[0]?.outline ?? null;
  if (!record.shape.every(entry => entry && JSON.stringify(entry.outline) === JSON.stringify(outline))) return null;
  return { ...record, outline, shape: record.shape.map(({ outline: _, ...entry }) => entry) };
}

function layoutSameShape(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i], right = b[i];
    if (!left || !right || left.id !== right.id || left.r !== right.r) return false;
  }
  return true;
}

// The note a saved group belongs to, derived from durable references only.
function layoutNoteKeyOf(record) {
  if (typeof record?.note === 'string') return record.note;
  const sample = Array.isArray(record?.identity) && record.identity[0] && typeof record.identity[0].key === 'string'
    ? record.identity[0].key
    : Array.isArray(record?.outline) && record.outline[0] && typeof record.outline[0][0] === 'string'
      ? record.outline[0][0] : null;
  if (!sample) return null;
  try {
    const parts = JSON.parse(sample);
    if (!Array.isArray(parts) || parts.length !== 3) return null;
    return parts[0] === 'heading' ? JSON.stringify(['note', parts[1], '']) : parts[0] === 'note' ? sample : null;
  } catch { return null; }
}

function layoutRecordToken(record) {
  if (!record) return null;
  if (Object.hasOwn(record, 'structure')) return record.structure ?? null;
  if (record.outline != null) return layoutLegacyDigest(record.outline);
  return null;
}

// Canonical schema-3 form of persisted layout data (legacy groups are migrated lazily).
function layoutCanonical(data) {
  const groups = data && typeof data.groups === 'object' && !Array.isArray(data.groups) ? structuredClone(data.groups) : {};
  const structures = data && typeof data.structures === 'object' && !Array.isArray(data.structures) ? structuredClone(data.structures) : {};
  for (const [key, value] of Object.entries(groups)) {
    const record = compactLayoutRecord(value);
    if (!record || typeof record !== 'object' || !Array.isArray(record.shape)) { groups[key] = value; continue; }
    const note = layoutNoteKeyOf(record);
    if (Array.isArray(record.identity) && note && !structures[note]) structures[note] = structuredClone(record.identity);
    if (!Array.isArray(record.identity) && !Object.hasOwn(record, 'outline')) continue;
    const clean = { shape: record.shape };
    if (Array.isArray(record.points)) clean.points = record.points;
    if (record.repair) clean.repair = record.repair;
    if (note) {
      clean.note = note;
      const structure = layoutRecordToken(record);
      if (structure != null) clean.structure = structure;
    } else if (Array.isArray(record.identity)) clean.identity = record.identity;
    groups[key] = clean;
  }
  return { groups, structures };
}

function layoutPutRecord(layout, key, value) {
  const record = compactLayoutRecord(value);
  if (!record || typeof record !== 'object' || !Array.isArray(record.shape)) { layout.groups[key] = value; return; }
  const note = layoutNoteKeyOf(record);
  const clean = { shape: record.shape };
  if (Array.isArray(record.points)) clean.points = record.points;
  if (record.repair) clean.repair = record.repair;
  if (note) {
    if (Array.isArray(record.identity)) layout.structures[note] = structuredClone(record.identity);
    clean.note = note;
    const structure = layoutRecordToken(record);
    if (structure != null) clean.structure = structure;
  } else if (Array.isArray(record.identity) && record.identity.length) clean.identity = record.identity;
  layout.groups[key] = clean;
}

// Drop identity entries no saved group (or undo/redo snapshot) can reference again.
function layoutTrimStructures(layout, snapshots) {
  const keep = new Set();
  const collect = groups => {
    for (const record of Object.values(groups || {})) if (record && typeof record.note === 'string') keep.add(record.note);
  };
  collect(layout.groups);
  for (const snapshot of snapshots) collect(snapshot?.groups);
  layout.structures = Object.fromEntries(Object.entries(layout.structures).filter(([key]) => keep.has(key)));
  return layout;
}

function createLayoutModel(nodes, rootRadius) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const keyOf = n => JSON.stringify([n.kind, n.path || n.id,
    n.kind === 'heading' ? n.id.slice((n.note || '').length) : '']);
  const keys = new Map(nodes.map(n => [n.id, keyOf(n)]));
  const root = { x: 0, y: 0, r: rootRadius || 1000 };
  const baseline = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]));
  const groups = new Map(), children = new Map(), headingsByNote = new Map();
  for (const n of nodes) {
    const parent = byId.get(n.parent), key = parent ? keys.get(parent.id) : 'root';
    if (!groups.has(key)) groups.set(key, { key, parent, nodes: [] });
    groups.get(key).nodes.push(n);
    if (!children.has(n.parent)) children.set(n.parent, []);
    children.get(n.parent).push(n);
    if (n.kind === 'heading') {
      if (!headingsByNote.has(n.note)) headingsByNote.set(n.note, []);
      headingsByNote.get(n.note).push(n);
    }
  }
  // Identity and outline guards are note-scoped; one copy serves every group of the note.
  const identities = new Map(), digests = new Map(), noteKeys = new Map();
  for (const [noteId, headings] of headingsByNote) {
    headings.sort((a, b) => a.line - b.line);
    const noteNode = byId.get(noteId);
    let noteKey = noteNode ? keys.get(noteId) : null;
    if (!noteKey) {
      const parts = JSON.parse(keys.get(headings[0].id));
      noteKey = JSON.stringify(['note', parts[1], '']);
    }
    noteKeys.set(noteId, noteKey);
    identities.set(noteKey, headings.map(n => ({ key: keys.get(n.id), title: n.title,
      parent: keys.get(n.parent), level: n.level, evidence: n.layoutEvidence })));
    const counts = new Map();
    for (const n of headings) counts.set(n.title, (counts.get(n.title) || 0) + 1);
    // Duplicate headings lack durable identity: include their lines as an extra
    // conservative guard. Unique headings survive ordinary body line insertions.
    digests.set(noteId, layoutDigest(headings.map(n => [(n.id || '').slice((n.note || '').length),
      counts.get(n.title) > 1 ? n.line : null])));
  }
  for (const g of groups.values()) {
    g.nodes.sort((a, b) => keys.get(a.id).localeCompare(keys.get(b.id)));
    g.shape = g.nodes.map(n => ({ id: keys.get(n.id), r: +(n.r / (g.parent || root).r).toFixed(8) }));
    const noteId = g.nodes[0]?.kind === 'heading' ? g.nodes[0].note : null;
    g.note = noteId ? noteKeys.get(noteId) || null : null;
    g.structureId = noteId ? digests.get(noteId) ?? null : null;
  }
  const tokenOf = record => layoutRecordToken(record);
  const compatible = (record, g) => !!record && layoutSameShape(record.shape, g.shape) &&
    tokenOf(record) === g.structureId;
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
    if (!changed) return null;
    const record = { shape: structuredClone(g.shape), points };
    if (g.note) {
      record.note = g.note; record.structure = g.structureId;
      // Transient: the store promotes this into the shared per-note table before writing.
      record.identity = structuredClone(identities.get(g.note) || null);
    }
    return record;
  }
  // Conservatively recognize a single rename in an otherwise unchanged outline.
  // Identity follows a verified alias chain saved with each note, across cold loads.
  let repairBudget = 0;
  function validDisks(disks, tolerance) {
    for (let i = 0; i < disks.length; i++) {
      if (--repairBudget < 0) return false;
      const a = disks[i];
      if (!Number.isFinite(a.x + a.y + a.r) || a.r <= 0 || Math.hypot(a.x, a.y) + a.r > 1 + tolerance) return false;
      for (let j = 0; j < i; j++) { if (--repairBudget < 0) return false; if (Math.hypot(a.x - disks[j].x, a.y - disks[j].y) < a.r + disks[j].r - tolerance) return false; }
    }
    return true;
  }
  function repairGroup(g, record, old, current) {
    if (!Array.isArray(record.points) || !Array.isArray(record.shape) || g.nodes.length > 128) return null;
    const p = g.parent || root, tolerance = Math.max(1e-8, .002 / p.r);
    if (tolerance > .002) return null;
    const previous = new Map(record.shape.map(n => [n.id, n.r]));
    if (record.points.length !== previous.size || new Set(record.points.map(n => n.id)).size !== previous.size ||
      !validDisks(record.points.map(n => ({ ...n, r: previous.get(n.id) })), .002)) return null;
    const points = new Map(record.points.map(n => [n.id, n]));
    if (g.nodes.some(n => n.kind === 'heading')) {
      if (!Array.isArray(old) || !current || !old.every(n => n && typeof n.key === 'string')) return null;
      const a = new Map(old.map(n => [n.key, n])), b = new Map(current.map(n => [n.key, n]));
      // Only pure addition/deletion or unchanged identities. Simultaneous
      // replacement/rename is handled by the explicit rename matcher above.
      if (!old.every(n => b.has(n.key)) && !current.every(n => a.has(n.key))) return null;
      const counts = items => { const c = new Map(); for (const n of items) c.set(n.title, (c.get(n.title) || 0) + 1); return c; };
      const ac = counts(old), bc = counts(current);
      for (const n of old) {
        const next = b.get(n.key); if (!next) continue;
        if (n.parent !== next.parent || n.level !== next.level || n.title !== next.title) return null;
        // Duplicate titles keep the same conservative evidence guard, but an
        // empty section (evidence "0:...") is still a stable value: two equal
        // empty duplicates stay interchangeable after unrelated edits, so only
        // reject when the values themselves differ or are missing.
        if ((ac.get(n.title) > 1 || bc.get(n.title) > 1) && (ac.get(n.title) !== bc.get(n.title) || typeof n.evidence !== 'string' || n.evidence !== next.evidence)) return null;
      }
      // No reuse of a duplicate suffix if a preceding equal heading was removed.
      for (const n of g.nodes) if (points.has(keys.get(n.id)) && !a.has(keys.get(n.id))) return null;
    }
    let count = 0; const stack = [...g.nodes];
    while (stack.length) { const n = stack.pop(); if (++count > 5000) return null; stack.push(...(children.get(n.id) || [])); }
    const disks = g.nodes.map(n => {
      const id = keys.get(n.id), saved = points.get(id);
      return { id, x: saved?.x ?? (n.x - p.x) / p.r, y: saved?.y ?? (n.y - p.y) / p.r, r: n.r / p.r, weight: saved ? 0.1 : 1 };
    });
    if (!disks.some(n => points.has(n.id))) return null;
    // First place new elements into free space with all existing centers fixed.
    const placed = disks.filter(n => points.has(n.id));
    for (const n of disks.filter(n => !points.has(n.id))) {
      if (!validDisks([...placed, n], tolerance)) {
        const radius = Math.max(0, 1 - n.r);
        for (let sample = 0; sample < 192 && repairBudget > 0; sample++) {
          const distance = radius * Math.sqrt(sample / 191), angle = sample * 2.399963229728653;
          const trial = { ...n, x: distance * Math.cos(angle), y: distance * Math.sin(angle) };
          if (validDisks([...placed, trial], tolerance)) { n.x = trial.x; n.y = trial.y; break; }
        }
      }
      placed.push(n);
    }
    // Bounded weighted projection: established elements resist displacement.
    for (let iteration = 0; iteration < 128 && repairBudget > 0 && !validDisks(disks, tolerance); iteration++) {
      for (const n of disks) { const d = Math.hypot(n.x, n.y), limit = 1 - n.r; if (d > limit && d > 0) { n.x *= limit / d; n.y *= limit / d; } }
      for (let i = 0; i < disks.length && repairBudget > 0; i++) for (let j = 0; j < i && repairBudget > 0; j++) {
        repairBudget--;
        const a = disks[i], b = disks[j]; let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), over = a.r + b.r - d;
        if (over <= 0) continue; if (d < 1e-12) { dx = 1; dy = 0; d = 1; }
        const aw = a.weight / (a.weight + b.weight), bw = 1 - aw;
        a.x -= dx / d * over * aw; a.y -= dy / d * over * aw; b.x += dx / d * over * bw; b.y += dy / d * over * bw;
      }
    }
    if (!validDisks(disks, tolerance)) return null;
    const moved = disks.filter(n => points.has(n.id) && Math.hypot(n.x - points.get(n.id).x, n.y - points.get(n.id).y) > 1e-8).length;
    const repaired = {
      shape: structuredClone(g.shape),
      points: disks.map(({ id, x, y }) => ({ id, x, y })),
      repair: { moved, added: disks.filter(n => !points.has(n.id)).length },
    };
    if (g.note) { repaired.note = g.note; repaired.structure = g.structureId; }
    return repaired;
  }
  function reconcile(input) {
    const fromData = !!input && typeof input === 'object' && !Array.isArray(input) &&
      typeof input.groups === 'object' && input.groups !== null;
    const records = fromData ? input.groups : (input || {});
    const savedStructures = fromData && input.structures && typeof input.structures === 'object' && !Array.isArray(input.structures)
      ? input.structures : {};
    repairBudget = 250000; // Shared across groups; exhausted work falls back locally.
    const output = {}, structures = {}, used = new Set(), refreshed = new Map();
    const keepWhole = () => ({ groups: structuredClone(records), structures: structuredClone(savedStructures) });
    const refresh = note => {
      if (typeof note !== 'string') return;
      let items = refreshed.get(note);
      if (items === undefined) { items = structuredClone(identities.get(note) || null); refreshed.set(note, items); }
      if (items) structures[note] = items;
    };
    for (const [oldKey, saved] of Object.entries(records)) {
      let key = oldKey;
      let record = compactLayoutRecord(structuredClone(saved));
      if (!record || typeof record !== 'object' || !Array.isArray(record.shape)) {
        if (used.has(oldKey)) return keepWhole();
        used.add(oldKey); output[oldKey] = record || saved; continue;
      }
      const note = layoutNoteKeyOf(record);
      const old = note && Array.isArray(savedStructures[note]) ? savedStructures[note]
        : Array.isArray(record.identity) ? record.identity : null;
      const current = note ? identities.get(note) || null : null;
      const mapping = new Map();
      if (Array.isArray(old) && old.every(n => n && typeof n.key === 'string' && typeof n.title === 'string') && current && old.length === current.length && old.length > 0) {
        const oldIndex = new Map(old.map((n, i) => [n.key, i])), newIndex = new Map(current.map((n, i) => [n.key, i]));
        const counts = items => { const c = new Map(); for (const n of items) c.set(n.title, (c.get(n.title) || 0) + 1); return c; };
        const oldCounts = counts(old), newCounts = counts(current);
        const nonempty = n => typeof n.evidence === 'string' && !n.evidence.startsWith('0:');
        const signatureCounts = items => {
          const m = new Map();
          for (const n of items) { const s = JSON.stringify([n.title, n.evidence]); m.set(s, (m.get(s) || 0) + 1); }
          return m;
        };
        const oldSignatures = signatureCounts(old), newSignatures = signatureCounts(current);
        // Duplicate labels require distinct nonempty section evidence. Position
        // alone cannot distinguish equal headings after insertion or reordering.
        // Identical *empty* duplicate sections are interchangeable, so a rename
        // elsewhere in such a note may still migrate: index mapping stays stable
        // as long as the counts of the identical signatures did not change.
        const distinguishable = items => {
          const titles = counts(items), signatures = new Set();
          for (const n of items) if (titles.get(n.title) > 1) {
            const signature = JSON.stringify([n.title, n.evidence]);
            if (!nonempty(n)) {
              if ((oldSignatures.get(signature) || 0) !== (newSignatures.get(signature) || 0)) return false;
              signatures.add(signature); continue;
            }
            if (signatures.has(signature)) return false;
            signatures.add(signature);
          }
          return true;
        };
        const differences = old.map((n, i) => n.title === current[i].title ? -1 : i).filter(i => i >= 0);
        const structure = old.every((n, i) => n.level === current[i].level &&
          (oldIndex.get(n.parent) ?? -1) === (newIndex.get(current[i].parent) ?? -1));
        const changed = differences[0];
        const evidence = old.every((n, i) => {
          const required = i === changed || oldCounts.get(n.title) > 1 || newCounts.get(current[i].title) > 1;
          return !required || (typeof n.evidence === 'string' && n.evidence === current[i].evidence);
        });
        // A solitary heading has no heading anchors: require nonempty body as
        // additional evidence, alongside identical note, level and parent.
        const anchored = old.length > 1 || nonempty(old[0]);
        const rename = differences.length === 1 && anchored && structure && evidence &&
          distinguishable(old) && distinguishable(current);
        if (rename) old.forEach((n, i) => mapping.set(n.key, current[i].key));
      }
      const mapValue = value => {
        if (typeof value === 'string') return mapping.get(value) || value;
        if (Array.isArray(value)) return value.map(mapValue);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapValue(v)]));
        return value;
      };
      if (mapping.size) { key = mapping.get(key) || key; record = mapValue(record); }
      const group = groups.get(key);
      if (group && Array.isArray(record.shape)) {
        record.shape.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        if (Array.isArray(record.points)) record.points.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        // Verified correspondence covers the entire outline, including duplicate
        // suffix/line guards that can change when one duplicate is renamed.
        let final = null;
        if (!mapping.size || layoutSameShape(record.shape, group.shape)) {
          if (mapping.size) {
            // Verified correspondence covers the whole note: adopt the current shape
            // and the current outline guard for every group of that note.
            record.shape = structuredClone(group.shape);
            if (group.note) { record.note = group.note; record.structure = group.structureId; }
            else delete record.structure;
          }
          if (compatible(record, group)) {
            final = { shape: structuredClone(group.shape) };
            if (Array.isArray(record.points)) final.points = record.points;
            if (record.repair) final.repair = record.repair;
            if (group.note) {
              final.note = group.note;
              if (group.structureId != null) final.structure = group.structureId;
              refresh(group.note);
            }
          } else if (!mapping.size) {
            const repaired = repairGroup(group, record, old, current);
            if (repaired) { final = repaired; refresh(group.note); }
          }
        }
        if (final) { used.add(key); output[key] = final; continue; }
      }
      // Unverified records are returned untouched so a later build can recover them.
      if (used.has(oldKey)) return keepWhole();
      used.add(oldKey); output[oldKey] = structuredClone(saved);
      if (note && old && !structures[note]) structures[note] = structuredClone(old);
    }
    return { groups: output, structures };
  }
  function apply(input = {}) {
    const fromData = !!input && typeof input === 'object' && !Array.isArray(input) &&
      typeof input.groups === 'object' && input.groups !== null;
    const records = fromData ? input.groups : input;
    for (const n of nodes) Object.assign(n, baseline.get(n.id));
    let restored = 0, skipped = 0;
    const ordered = [...groups.values()].sort((a, b) => (a.parent?.depth || 0) - (b.parent?.depth || 0));
    for (const g of ordered) {
      if (!Object.hasOwn(records, g.key)) continue;
      const record = compactLayoutRecord(records[g.key]), p = g.parent || root, tolerance = Math.max(1e-8, .002 / p.r);
      const points = record?.points;
      let valid = g.nodes.length <= 128 && compatible(record, g) && Array.isArray(points) && points.length === g.nodes.length;
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
  const usable = initial != null && [1, 2, 3].includes(initial.schemaVersion) && initial.groups &&
    typeof initial.groups === 'object' && !Array.isArray(initial.groups);
  let data = usable ? structuredClone(initial) : { schemaVersion: 3, revision: 0, groups: {}, structures: {} };
  if (!Object.hasOwn(data, 'groups')) data.groups = {};
  let owner = null, busy = 0, tail = Promise.resolve(), message = '拖动后自动保存';
  const undo = [], redo = [], listeners = new Set();
  const unsupported = initial != null && !usable;
  if (unsupported) message = '布局数据版本不受支持，调整已禁用；原数据保留';
  const revision = value => Number.isSafeInteger(value) ? value : 0;
  function state() {
    return { schemaVersion: data.schemaVersion, revision: data.revision, groups: structuredClone(data.groups),
      busy: busy > 0, locked: owner !== null, canUndo: undo.length > 0, canRedo: redo.length > 0, message, unsupported };
  }
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
      const current = layoutCanonical(data);
      const result = transform(structuredClone(current));
      if (result == null) {
        if (mode === 'invalidate') { undo.length = 0; redo.length = 0; message = '笔记结构已更新；撤销记录已清空'; }
        else message = '布局未改变';
        return;
      }
      const next = layoutTrimStructures({
        groups: result.groups && typeof result.groups === 'object' && !Array.isArray(result.groups) ? result.groups : {},
        structures: result.structures && typeof result.structures === 'object' && !Array.isArray(result.structures) ? result.structures : {},
      }, [...undo, ...redo]);
      if (data.schemaVersion === 3 && JSON.stringify(next) === JSON.stringify(current)) {
        if (mode === 'invalidate') { undo.length = 0; redo.length = 0; message = '笔记结构已更新；撤销记录已清空'; }
        else message = '布局未改变';
        return;
      }
      const updated = { schemaVersion: 3, revision: revision(data.revision) + 1, groups: next.groups, structures: next.structures };
      await write(updated);
      if (mode === 'undo') { redo.push(current); undo.pop(); }
      else if (mode === 'redo') { undo.push(current); redo.pop(); }
      else if (mode === 'invalidate' || mode === 'migrate') { undo.length = 0; redo.length = 0; }
      else { undo.push(current); if (undo.length > 50) undo.shift(); redo.length = 0; }
      data = updated;
      message = mode === 'migrate' && Object.values(next.groups).some(g => g?.repair)
        ? '布局已保存；已局部适配结构变化，撤销记录已清空'
        : mode === 'invalidate' ? '笔记结构已更新；撤销记录已清空' : '布局已保存';
    }).catch(error => { message = '布局保存失败，已恢复上次保存的位置：' + error.message; throw error; })
      .finally(() => { busy--; release(token); emit(); });
    tail = operation; return operation;
  }
  function command(token, kind, key, value) {
    if (owner !== token && !acquire(token)) return Promise.reject(new Error('另一视图正在调整或保存布局，请稍后重试'));
    if (busy) { release(token); return Promise.reject(new Error('布局正在保存，请稍后重试')); }
    return run(token, layout => {
      if (kind === 'undo') return undo.at(-1) || null;
      if (kind === 'redo') return redo.at(-1) || null;
      if (kind === 'reset-all') return { groups: {}, structures: {} };
      if (key == null) return null;
      if (value == null) delete layout.groups[key];
      else layoutPutRecord(layout, key, value);
      return layout;
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
    const migrateRecord = (key, value) => {
      if (!touches(key) && !touches(value)) return value;
      if (!newPath) return touches(key) ? undefined : value;
      if (!allowRename) return undefined;
      const migrated = migrate(value);
      if (Array.isArray(migrated.shape)) migrated.shape.sort((a, b) => a.id.localeCompare(b.id));
      if (Array.isArray(migrated.points)) migrated.points.sort((a, b) => a.id.localeCompare(b.id));
      return migrated;
    };
    return run(null, layout => {
      const groups = {};
      for (const [key, value] of Object.entries(layout.groups)) {
        const migrated = migrateRecord(key, value);
        if (migrated !== undefined) groups[migrated === value ? key : mapKey(key)] = migrated;
      }
      const structures = {};
      for (const [key, value] of Object.entries(layout.structures)) {
        const migrated = migrateRecord(key, value);
        if (migrated !== undefined) structures[migrated === value ? key : mapKey(key)] = migrated;
      }
      return { groups, structures };
    }, 'invalidate');
  }
  return {
    state, acquire, release, command, changePath,
    reconcile(model, valid = () => true) { return unsupported ? Promise.resolve() : run(null, layout => valid() ? model.reconcile(layout) : null, 'migrate'); },
    settled: () => tail.catch(() => {}),
    subscribe(fn) { listeners.add(fn); fn(state()); return () => listeners.delete(fn); },
    clearHistory() { undo.length = 0; redo.length = 0; message = '图谱结构已变化；撤销记录已清空'; emit(); },
  };
}
