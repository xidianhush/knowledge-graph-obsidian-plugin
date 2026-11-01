const kgNormalizeHeading = text => String(text).replace(/[\s\u3000]+/g,'').replace(/^#+|#+$/g,'').toLowerCase();
function kgAnnotation(mapping,stem,id) {
  if(!kgDict(mapping))return null;
  for(const k of [id,stem,stem+'.md'])if(Object.hasOwn(mapping,k))return mapping[k];
  for(const[k,v]of Object.entries(mapping))if([stem.toLowerCase(),id.toLowerCase()].includes(k.toLowerCase()))return v;
  return null;
}
class PipelineGraphBuilder {
  constructor(cfg,notes,folders){
    Object.assign(this,{cfg,notes,folders});this.byId=new Map(notes.map(n=>[n.file.id,n]));
    this.nodes=new Map();this.edges=[];this.edgeKeys=new Map();this.unresolved=new Map();this.headingLinks=[];this.stats=Object.create(null);
    this.byStem=new Map();this.alias=new Map();this.suffix=new Map();
    for(const note of notes){const f=note.file,key=f.stem.toLowerCase();if(!this.byStem.has(key))this.byStem.set(key,[]);this.byStem.get(key).push(f.id);
      if(f.source_id!==f.id)this.alias.set(f.source_id.toLowerCase(),f.id);
      const parts=f.id.split('/');for(let k=1;k<=Math.min(parts.length,4);k++){const tail=parts.slice(-k).join('/');if(!this.suffix.has(tail))this.suffix.set(tail,[]);this.suffix.get(tail).push(f.id);}
    }
    for(const ids of this.byStem.values())ids.sort(kgCompare);
  }
  unresolvedLink(name){this.unresolved.set(String(name),(this.unresolved.get(String(name))||0)+1);}
  resolve(target){
    if(!target)return null;if(typeof target!=='string')return null;
    let t=target.trim().replaceAll('\\','/');if(/\.md$/i.test(t))t=t.slice(0,-3);
    if(this.byId.has(t))return t;if(this.alias.has(t.toLowerCase()))return this.alias.get(t.toLowerCase());
    if(t.includes('/')){
      const hits=t.split('/').length>4?[...this.byId.keys()].filter(i=>i===t||i.endsWith('/'+t)):this.suffix.get(t)||[];
      if(hits.length)return[...hits].sort((a,b)=>kgLength(a)-kgLength(b))[0];
      const low=t.toLowerCase(),aliased=[...this.alias].filter(([k])=>k===low||k.endsWith('/'+low)).map(([,v])=>v);
      return aliased.sort((a,b)=>kgLength(a)-kgLength(b))[0]||null;
    }
    const hits=this.byStem.get(t.toLowerCase());if(!hits?.length)return null;
    const same=hits.filter(i=>(i.includes('/')?i.slice(0,i.lastIndexOf('/')):i).toLowerCase()===t.toLowerCase());
    return same[0]||hits[0];
  }
  addNode(id,fields){if(this.nodes.has(id))return this.nodes.get(id);const node={id,label:id.split('/').at(-1),...fields};this.nodes.set(id,node);return node;}
  buildNodes(annotations){
    const annNotes=annotations.notes||{};
    for(const folder of this.folders){const parts=folder.split('/');this.addNode(folder,{kind:'folder',depth:parts.length,parent:parts.slice(0,-1).join('/')||null,domain:parts[0],note_count:0,heading_count:0});}
    for(const note of this.notes){const f=note.file,ann=kgAnnotation(annNotes,f.stem,f.id)||{},fm=note.frontmatter;
      const node=this.addNode(f.id,{kind:'note',depth:f.depth,parent:f.parts.join('/')||null,domain:f.parts[0]||f.id,heading_count:note.headings.length,excerpt:note.excerpt,path:f.rel,aliases:ann.aliases||[],subject:fm.subject||(f.parts.length>1?f.parts[1]:f.parts[0]||''),parent_course:fm.parent||f.parts.at(-1)||''});
      for(const alias of node.aliases)if(typeof alias==='string'&&alias){const key=alias.trim().toLowerCase();if(!this.byStem.has(key))this.byStem.set(key,[]);this.byStem.get(key).push(f.id);}
    }
    for(const note of this.notes){const override=(kgAnnotation(annNotes,note.file.stem,note.file.id)||{}).domain;if(override)this.nodes.get(note.file.id).domain=override;}
    for(const node of [...this.nodes.values()].sort((a,b)=>b.depth-a.depth)){
      if(node.kind!=='note')continue;let parent=node.parent;
      while(parent){const p=this.nodes.get(parent);if(!p)break;p.note_count++;p.heading_count+=node.heading_count;parent=p.parent;}
    }
  }
  buildHeadings(){
    let count=0;
    for(const note of this.notes){const n=this.nodes.get(note.file.id);if(!n)continue;const levels=[...new Set(note.headings.map(h=>h.level))].sort((a,b)=>a-b);
      for(const h of note.headings){const rank=levels.indexOf(h.level)+1;
        if(this.nodes.has(h.id))throw new Error('Heading id collides with an existing node: '+h.id);
        this.addNode(h.id,{kind:'heading',label:h.title,depth:n.depth+rank,parent:h.parent||note.file.id,domain:n.domain,level:h.level,rank,title:h.title,line:h.line,note:note.file.id,path:n.path||''});count++;
      }
    }
    this.stats.heading_nodes=count;
  }
  addEdge(source,target,type,weight,origin,evidence=''){
    if(!source||!target||source===target||!this.nodes.has(source)||!this.nodes.has(target))return;
    if(!Number.isFinite(weight))throw new Error('Invalid edge weight');
    const key=JSON.stringify([source,target,type,origin==='candidate'?origin:'']);
    if(this.edgeKeys.has(key)){const edge=this.edgeKeys.get(key);edge.weight=kgRound(edge.weight+weight,3);edge.hits++;
      if(evidence&&kgLength(edge.evidence)<120){const extra='; '+evidence;if(!edge.evidence.includes(extra))edge.evidence+=extra;}return;}
    const edge={id:'e'+(this.edges.length+1),s:source,t:target,type,weight:kgRound(weight,3),origin,evidence,hits:1};this.edges.push(edge);this.edgeKeys.set(key,edge);
  }
  buildContains(){for(const[id,n]of this.nodes)if(n.parent)this.addEdge(n.parent,id,'contains',1,'hierarchy');}
  headingAtLine(id,line){const note=this.byId.get(id);if(!note||!line)return null;let found=null;for(const h of note.headings){if(h.line<=line)found=h.id;else break;}return found;}
  recordHeadingLink(source,target,link){
    const note=this.byId.get(target);if(!note||!link.anchor)return;
    const wanted=kgNormalizeHeading(link.anchor),from=this.headingAtLine(source,link.line);
    for(const h of note.headings)if(wanted&&[kgNormalizeHeading(h.title),kgNormalizeHeading(h.path.join('/'))].includes(wanted)){
      this.headingLinks.push({source,from_heading:from,heading:h.id,note:target,raw:link.raw,anchor:link.anchor,line:link.line});kgInc(this.stats,'heading_links');
      this.addEdge(from||source,h.id,'derives',this.cfg.weight.wiki_link+this.cfg.weight.heading_link_bonus,'wiki',link.raw);return;
    }
    kgInc(this.stats,'heading_anchor_miss');
  }
  buildWiki(){
    const w=this.cfg.weight;
    for(const note of this.notes)for(const link of note.links){
      const ext=link.target.split('/').at(-1).match(/\.[^.]*$/)?.[0].toLowerCase();
      if(ext&&this.cfg.attachments.has(ext)){kgInc(this.stats,'attachment_links');continue;}
      const target=this.resolve(link.target);
      if(target===null){this.unresolvedLink(link.target);kgInc(this.stats,'unresolved_links');continue;}
      if(target===note.file.id){kgInc(this.stats,'self_links');if(link.anchor)this.recordHeadingLink(note.file.id,target,link);continue;}
      let weight=w.wiki_link;if(link.embed)weight*=w.embed_factor;if(link.anchor){weight+=w.heading_link_bonus;this.recordHeadingLink(note.file.id,target,link);}
      this.addEdge(note.file.id,target,'derives',weight,'wiki',link.raw);kgInc(this.stats,'wiki_edges_raw');
    }
  }
  buildFrontmatter(){
    for(const note of this.notes)for(const[key,type,reverse]of [['prerequisites','prerequisite',true],['derives','derives',false],['contrasts','contrast',false]]){
      for(const name of kgList(note.frontmatter[key])){const target=this.resolve(name);if(target)this.addEdge(reverse?target:note.file.id,reverse?note.file.id:target,type,this.cfg.weight.annotation_default,'frontmatter',key+': '+name);else this.unresolvedLink(name);}
    }
  }
  buildAnnotations(annotations,candidates){
    for(const[items,origin]of [[annotations.edges||[],'annotation'],[candidates.candidates||[],'candidate']])for(const item of items){
      if(!kgDict(item))continue;const status=String(item.status??(origin==='annotation'?'accepted':'pending')).toLowerCase();
      if(origin==='annotation'&&['rejected','pending','no','off'].includes(status)){kgInc(this.stats,'annotation_skipped');continue;}
      if(origin==='candidate'&&!['accepted','yes','on'].includes(status))continue;
      const source=this.resolve(String(item.source||'')),target=this.resolve(String(item.target||''));
      if(source===null||target===null){if(origin==='candidate')kgInc(this.stats,'candidate_unresolved');else this.unresolvedLink((item.source??'None')+' → '+(item.target??'None'));continue;}
      let type=String(item.type||'prerequisite');if(!['prerequisite','derives','contrast'].includes(type))type='prerequisite';
      this.addEdge(source,target,type,Number(item.weight??this.cfg.weight.annotation_default),origin,String(item.reason??(origin==='annotation'?'annotations.yaml':'candidates.yaml')));
    }
  }
  levels(maxDepth){const semantic=this.edges.filter(e=>e.type!=='contains'),table={};
    for(let depth=1;depth<=maxDepth;depth++){const visible=[...this.nodes.values()].filter(n=>n.depth<=depth);table[depth]={nodes:visible.length,notes:visible.filter(n=>n.kind==='note').length,folders:visible.filter(n=>n.kind==='folder').length,headings:visible.filter(n=>n.kind==='heading').length,edges:semantic.filter(e=>this.nodes.get(e.s).depth<=depth&&this.nodes.get(e.t).depth<=depth).length};}return table;
  }
}
