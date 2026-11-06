/** Pure JS graph pipeline. Input records contain vault-relative path/text; no I/O.
 * Host supplies YAML decoding when raw frontmatter is present. Preview HTML is a
 * presentation concern and can be attached separately without changing geometry.
 */
function buildGraph({files,config,annotations={},candidates={},parseYaml,generated=''}) {
  const cfg=pipelineConfig(config),scan=selectGraphFiles(files,cfg);
  const notes=scan.files.map(f=>parseGraphNote(f,parseYaml));
  const builder=new PipelineGraphBuilder(cfg,notes,scan.folders);
  builder.buildNodes(annotations);builder.buildHeadings();builder.buildContains();builder.buildWiki();builder.buildFrontmatter();builder.buildAnnotations(annotations,candidates);
  const maxDepth=[...builder.nodes.values()].reduce((d,n)=>Math.max(d,n.depth),scan.stats.max_depth);
  const layout=layoutGraph(builder.nodes,cfg,maxDepth),levels=builder.levels(maxDepth);
  const byKind={folder:0,note:0,heading:0},nodes=[...builder.nodes.values()].map(n=>{const copy={...n};delete copy.aliases;byKind[n.kind]++;return copy;});
  const counts=new Map();for(const n of nodes)if(n.kind==='note'&&n.domain)counts.set(n.domain,(counts.get(n.domain)||0)+1);
  const palette=graphPalette(counts,cfg.theme.domains,cfg.theme.auto_palette);
  const payload={meta:{generated,vault:cfg.vault,vault_name:cfg.vault_name,note_count:byKind.note,folder_count:byKind.folder,heading_count:byKind.heading,node_count_by_kind:byKind,max_depth:maxDepth,file_depth:scan.stats.max_depth,layer_count:layout.layers.length,layout_root_radius:kgRound(layout.rootRadius,4),nominal_fit_radius:KG_NOMINAL_FIT_RADIUS,
    zoom:{...cfg.zoom,wheel_step:kgRound(layout.wheelStep,6),home_zoom:kgRound(layout.homeZoom,6)},lod:{...cfg.lod,enter:layout.enter.map(v=>kgRound(v,6)),home_layer:layout.homeLayer},theme:{...cfg.theme,domains:palette.colors},domains:palette.domains,page_title:cfg.page_title||'知识图谱',scan:scan.stats,link_stats:{...builder.stats},unresolved:[...builder.unresolved].sort((a,b)=>b[1]-a[1]).slice(0,50),heading_total:byKind.heading,heading_link_total:builder.headingLinks.length},nodes,edges:builder.edges,layers:layout.layers,heading_links:builder.headingLinks,levels}; // i18n-allow: pipeline runs in Node/worker without i18n; page_title is an inert data default never shown by the live UI
  for(const n of nodes)if(![n.x,n.y,n.r].every(Number.isFinite))throw new Error('Non-finite layout: '+n.id);
  return payload;
}
