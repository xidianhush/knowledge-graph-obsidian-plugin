// JSON payloads are copied before decoding: renderer caches belong to one mount.
function decodeGraphPayload(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(JSON.stringify(payload));
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !data.meta) {
    throw new Error('图谱快照缺少 nodes / edges / meta');
  }
  const meta = data.meta;
  if (meta.codec && meta.codec !== 'idx1') throw new Error('Unsupported graph codec: ' + meta.codec);
  if (meta.codec !== 'idx1') return data;
  const ids = data.nodes.map(n => n.id);
  const domains = (meta.domains || []).map(d => d.name);
  const types = meta.edge_types || [];
  const unref = v => typeof v === 'number' ? (v >= 0 ? ids[v] : null) : v;
  for (const n of data.nodes) {
    if ('parent' in n) n.parent = unref(n.parent);
    if ('note' in n) n.note = unref(n.note);
    if (typeof n.domain === 'number') n.domain = domains[n.domain] || '';
    for (const link of n.links || []) if ('t' in link) link.t = unref(link.t);
  }
  for (const edge of data.edges) {
    edge.s = unref(edge.s); edge.t = unref(edge.t);
    if (typeof edge.type === 'number') edge.type = types[edge.type] || '';
  }
  for (const link of data.heading_links || []) {
    for (const key of ['source', 'from_heading', 'heading', 'note']) {
      if (key in link) link[key] = unref(link[key]);
    }
  }
  delete meta.codec; // Decoded payloads can safely be passed to another core.
  return data;
}
