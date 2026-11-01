// Match Python Unicode ordering and decimal rounding, independent of host locale.
function kgCompare(a, b) {
  const x = Array.from(String(a)), y = Array.from(String(b));
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0) - y[i].codePointAt(0); if (d) return d;
  }
  return x.length - y.length;
}
function kgRound(value, digits = 0) {
  if (!Number.isFinite(value) || value === 0) return value;
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, Math.abs(value));
  const bits = view.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n);
  let numerator = bits & ((1n << 52n) - 1n);
  if (exponent) numerator += 1n << 52n;
  const shift = (exponent || 1) - 1023 - 52;
  let denominator = 1n;
  if (shift >= 0) numerator <<= BigInt(shift); else denominator <<= BigInt(-shift);
  if (digits >= 0) numerator *= 10n ** BigInt(digits); else denominator *= 10n ** BigInt(-digits);
  let q = numerator / denominator; const remainder = numerator % denominator;
  if (2n * remainder > denominator || (2n * remainder === denominator && q % 2n)) q++;
  return Math.sign(value) * Number(q) / 10 ** digits;
}
const kgLength = text => Array.from(String(text)).length;
const kgSlice = (text, end) => Array.from(text).slice(0, end).join('');
const kgList = value => value == null ? [] : Array.isArray(value) ? value.filter(v => v != null) : [value];
const kgDict = value => value != null && typeof value === 'object' && !Array.isArray(value);
const kgInc = (object, key) => object[key] = (object[key] || 0) + 1;
function kgMerge(base, override) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(override || {})) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid config key: ' + key);
    out[key] = kgDict(value) && kgDict(out[key]) ? kgMerge(out[key], value) : structuredClone(value);
  }
  return out;
}
function pipelineConfig(input = {}) {
  const cfg = kgMerge(PIPELINE_DEFAULTS, input);
  for (const key of ['include', 'exclude', 'exclude_notes', 'remap']) {
    if (cfg[key] == null && key === 'remap') cfg[key] = [];
    if (!Array.isArray(cfg[key])) throw new Error(key + ' must be an array');
  }
  if (!cfg.include.length) throw new Error('include must explicitly select the graph scope');
  for (const key of ['include','exclude']) if (!cfg[key].every(v => typeof v === 'string' && v.length)) throw new Error(key + ' must contain glob strings');
  const positive = (group, key, min, strict = true) => {
    const v = cfg[group][key];
    if (typeof v !== 'number' || !Number.isFinite(v) || (strict ? v <= min : v < min)) throw new Error(group + '.' + key + ' is out of range');
  };
  for (const key of ['leaf_radius','norm_root_radius','size_exponent']) positive('layout',key,0);
  positive('layout','level_ratio',1); positive('layout','padding',1,false);
  positive('lod','min_px',0); positive('lod','fade_span',1,false);
  positive('zoom','home_fit',0); positive('zoom','zoom_out_floor',1,false); positive('zoom','zoom_in_ceiling',1);
  if (cfg.layout.size_exponent > 1 || cfg.zoom.home_fit > cfg.layout.padding) throw new Error('Invalid size exponent or home fit');
  if (!Number.isInteger(cfg.zoom.home_level) || cfg.zoom.home_level < 1 || !(cfg.zoom.home_band >= 0 && cfg.zoom.home_band <= 1)) throw new Error('Invalid home level/band');
  for (const key of ['max_note_chars','total_chars_budget']) if (!Number.isInteger(cfg.preview[key]) || cfg.preview[key] < 0) throw new Error('Invalid preview budget');
  cfg.attachments = new Set(cfg.attachment_ext.map(v => '.' + v.toLowerCase().replace(/^\./,'')));
  return cfg;
}
function kgGlob(pattern) {
  // Python fnmatch: '*' also matches '/', and ** has no special directory meaning.
  let result = '^'; const p = String(pattern).replaceAll('\\','/');
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '*') result += '[\\s\\S]*';
    else if (ch === '?') result += '[\\s\\S]';
    else if (ch === '[') {
      let end = i + 1; if (p[end] === '!') end++; if (p[end] === ']') end++;
      while (end < p.length && p[end] !== ']') end++;
      if (end === p.length) result += '\\[';
      else { let body = p.slice(i+1,end); if (body[0] === '!') body = '^'+body.slice(1); else if (body[0] === '^') body='\\'+body; result += '['+body.replaceAll('\\','\\\\')+']'; i=end; }
    } else result += ch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }
  return new RegExp(result + '$','iu');
}
function selectGraphFiles(files, cfg) {
  const include = cfg.include.map(kgGlob), exclude = cfg.exclude.map(kgGlob);
  const skip = new Set(['.git','.obsidian','.trash','.smtcmp_json_db','node_modules','.smart-env']);
  const named = new Set(cfg.exclude_notes), seen = new Set(); let total = 0;
  const notes = [];
  for (const source of files) {
    const rel = String(source.path).replaceAll('\\','/');
    if (!rel || rel.startsWith('/') || /^[A-Za-z]:/.test(rel) || rel.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Expected vault-relative path: ' + rel);
    const parts = rel.split('/'), name = parts.at(-1);
    if (!/\.md$/i.test(name) || parts.slice(0,-1).some(p => p.startsWith('.') || skip.has(p))) continue;
    total++;
    const stem = name.slice(0,-3);
    const match = patterns => patterns.some(pattern => pattern.test(rel) || pattern.test(name));
    if (!match(include) || match(exclude) || named.has(stem) || named.has(rel) || named.has(rel.slice(0,-3))) continue;
    let display = rel;
    for (const rule of [...cfg.remap].sort((a,b) => kgLength(b.from || '')-kgLength(a.from || ''))) {
      const from = String(rule.from || '').replace(/^\/+|\/+$/g,''), to = String(rule.to || '').replace(/^\/+|\/+$/g,'');
      if (from && to && (rel === from || rel.startsWith(from+'/'))) { display = to+rel.slice(from.length); break; }
    }
    const id = display.slice(0,-3);
    if (seen.has(id)) throw new Error('Multiple notes map to the same id: ' + id);
    seen.add(id);
    notes.push({ ...source, rel, stem, id, source_id:rel.slice(0,-3), display, parts:display.split('/').slice(0,-1), depth:display.split('/').length });
  }
  // os.walk yields each directory's files before descending, with directory/file names sorted.
  notes.sort((a,b) => {
    const x=a.rel.split('/'), y=b.rel.split('/'), xd=x.slice(0,-1), yd=y.slice(0,-1);
    for(let i=0;i<Math.min(xd.length,yd.length);i++) { const d=kgCompare(xd[i],yd[i]); if(d)return d; }
    return xd.length-yd.length || kgCompare(x.at(-1),y.at(-1));
  });
  const folders = [...new Set(notes.flatMap(n => n.parts.map((_,i) => n.parts.slice(0,i+1).join('/'))))].sort(kgCompare);
  if (folders.some(f => seen.has(f))) throw new Error('A note id collides with a folder id');
  const histogram = {}; for (const note of notes) kgInc(histogram, note.depth);
  return { files:notes, folders, stats:{vault_md_total:total,included:notes.length,excluded:total-notes.length,folders:folders.length,max_depth:Math.max(1,...notes.map(n=>n.depth)),depth_histogram:histogram} };
}
function splitGraphFrontmatter(file, parseYaml) {
  const text = String(file.text || '').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const lines=text.split('\n'); let fm={},body=text,offset=0;
  if (lines[0].trim()==='---') {
    for (let i=1;i<Math.min(lines.length,400);i++) if (['---','...'].includes(lines[i].trim())) {
      if (Object.hasOwn(file,'frontmatter')) fm=file.frontmatter;
      else {
        if (!parseYaml) throw new Error('Frontmatter requires a host YAML parser: '+file.rel);
        try { fm=parseYaml(lines.slice(1,i).join('\n')); } catch { fm={}; }
      }
      if (!kgDict(fm)) fm={}; body=lines.slice(i+1).join('\n');offset=i+1;break;
    }
  }
  return {text,frontmatter:fm,body,offset};
}
function parseGraphNote(file, parseYaml) {
  const {text,frontmatter:fm,body,offset}=splitGraphFrontmatter(file,parseYaml);
  const headings=[], links=[], stack=[], seen=new Map(); let fence=null;
  for (const [index,line] of body.split('\n').entries()) {
    const marker=line.match(/^\s*(```|~~~)/);
    if(marker){if(fence===null)fence=marker[1];else if(fence===marker[1])fence=null;continue;}
    if(fence!==null)continue;
    const h=line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if(h && h[2].trim()) {
      const level=h[1].length,title=h[2].trim();
      while(stack.length && stack.at(-1).level>=level)stack.pop();
      const parent=stack.length?stack.at(-1).id:file.id, path=[...stack.map(s=>s.title),title];
      const base=file.id+'#'+path.join('/'),n=seen.get(base)||0;seen.set(base,n+1);
      const id=n?base+'~'+(n+1):base;
      const heading={level,title,line:index+1+offset,path,id,parent}; headings.push(heading);stack.push(heading);
    }
    for(const m of line.matchAll(/(!?)\[\[([^\[\]]+?)\]\]/g)) {
      let inner=m[2],alias=null,anchor=null;
      if(inner.includes('|')){const i=inner.indexOf('|');alias=inner.slice(i+1).trim()||null;inner=inner.slice(0,i);}
      if(inner.includes('#')){const i=inner.indexOf('#');anchor=inner.slice(i+1).trim()||null;inner=inner.slice(0,i);}
      const target=inner.trim().replaceAll('\\','/');
      if(target)links.push({target,anchor,alias,embed:m[1]==='!',raw:m[0],line:index+1+offset});
    }
  }
  let excerpt=body.replace(/^\s{0,3}(#{1,6})\s+.*$/gm,'').replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm,'').replace(/^\s*\|.*\|\s*$/gm,'').replace(/`[^`]*`/g,'').replace(/!?\[[^\]]*\]\([^)]*\)/g,'').replace(/(!?)\[\[([^\[\]]+?)\]\]/g,(_,b,s)=>s.split('|')[0].split('#')[0]).replace(/[*_>`]/g,'').replace(/\s+/g,' ').trim();
  if(kgLength(excerpt)>220)excerpt=kgSlice(excerpt,220).trimEnd()+'…';
  return { file,frontmatter:fm,body,headings,links,excerpt,text,offset };
}
