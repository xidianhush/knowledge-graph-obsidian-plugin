// Optional transport encoding. Live rendering also accepts the expanded payload.
function encodeGraphPayload(payload) {
  const data=structuredClone(payload),nodes=data.nodes||[];
  if(!nodes.length)return data;
  if(data.meta.codec==='idx1')return data;
  const ids=new Map(nodes.map((n,i)=>[n.id,i]));
  const domains=new Map((data.meta.domains||[]).map((d,i)=>[d.name,i]));
  const types=[],typeIndex=new Map();
  const ref=value=>typeof value==='string'&&ids.has(value)?ids.get(value):value;
  for(const n of nodes){for(const key of ['parent','note'])if(key in n)n[key]=ref(n[key]);
    if(typeof n.domain==='string'&&domains.has(n.domain))n.domain=domains.get(n.domain);
    for(const l of n.links||[])if('t'in l)l.t=ref(l.t);}
  for(const edge of data.edges||[]){for(const key of ['s','t'])if(key in edge)edge[key]=ref(edge[key]);
    if(typeof edge.type==='string'){if(!typeIndex.has(edge.type)){typeIndex.set(edge.type,types.length);types.push(edge.type);}edge.type=typeIndex.get(edge.type);}}
  for(const link of data.heading_links||[])for(const key of ['s','t','source','from_heading','heading','note'])if(key in link)link[key]=ref(link[key]);
  data.meta.edge_types=types;data.meta.codec='idx1';return data;
}
