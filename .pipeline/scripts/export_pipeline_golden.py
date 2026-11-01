"""Read synthetic fixture vaults; run the independent Python reference in memory.
No source-repository writes. HTML preview emission belongs to the host adapter.
"""
import sys, json, hashlib, copy
from pathlib import Path
sys.dont_write_bytecode = True
SOURCE = Path(r'D:\obsidian_vault\knowledge-graph')
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(SOURCE))
import yaml
from kg import config, parse, codec
import build

out = ROOT / '.local/pipeline-golden'
out.mkdir(parents=True,exist_ok=True)
manifest = yaml.safe_load((SOURCE/'fixtures/manifest.yaml').read_text(encoding='utf8'))['fixtures']
rows=[]
contracts=ROOT/'.local/pipeline-contracts'
contracts.mkdir(parents=True,exist_ok=True)
contract_notes={
 'Src/Long/A.md':'---\nsubject: Signals\nparent: Course\nprerequisites: [B]\nderives: [B, Missing]\ncontrasts: B\n---\n# 开始\n[[B#标题]] [[B]] ![[B]] [[别名]] [[A#开始]] ![[asset.png]] [[Missing]]\n```\n# ignored\n[[Ignored]]\n```\n### 跳级\n[[B#NoSuchHeading]]\n### 跳级\n~~~\n[[IgnoredToo]]\n~~~\n',
 'Src/Long/B.md':'# 标题\n正文。\n## 细节\n[[A#开始]]\n',
 'Src/Else/B.md':'# Other duplicate stem\n[[Long/B]]\n',
 'Src/Empty.md':'no headings\n',
 'Src/d/嵌套.md':'# 一个\n',
 'Src/d-/邻居.md':'# 两个\n',
 'Src/表情😀.md':'# 标题😀\n'+('😀中文'*120)+'\n',
 'Src/Excluded.md':'must not be included\n',
 '.hidden/Secret.md':'hidden directory\n',
 'Outside.md':'outside include\n',
}
for rel,text in contract_notes.items():
    p=contracts/'vault'/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf8')
extra={'vault':'vault','vault_name':'pipeline-contract','scopes':{'main':{'include':['Src/**'],'exclude':['*/Excluded.md'],'remap':[{'from':'Src','to':'Top'},{'from':'Src/Long','to':'Special'}]}}}
(contracts/'config.yaml').write_text(yaml.safe_dump(extra,allow_unicode=True),encoding='utf8')
annotations={'notes':{'Special/B':{'aliases':['别名'],'domain':'Override'}},'edges':[{'source':'A','target':'B','type':'derives','weight':2,'reason':'merge wiki'},{'source':'A','target':'B','status':'pending'},{'source':'Missing','target':'B'},{'source':'B','target':'A','type':'unknown'}]}
(contracts/'annotations.yaml').write_text(yaml.safe_dump(annotations,allow_unicode=True),encoding='utf8')
candidates={'candidates':[{'source':'A','target':'B','status':'accepted','type':'derives'},{'source':'A','target':'Missing','status':'yes'},{'source':'A','target':'B','status':'pending'}]}
(contracts/'candidates.yaml').write_text(yaml.safe_dump(candidates,allow_unicode=True),encoding='utf8')
sources=[(name,SOURCE/'fixtures'/spec['config']) for name,spec in manifest.items()]+[('semantic-contract',contracts/'config.yaml')]
for name,config_path in sources:
    cfg=config.load(str(config_path))
    cfg['preview']['enabled']=False
    files=[]
    vault=Path(cfg['vault'])
    for path in sorted(vault.rglob('*.md')):
        text=parse.read_text(str(path))
        fm,_,_=parse.split_frontmatter(text)
        files.append({'path':path.relative_to(vault).as_posix(),'text':text,'frontmatter':fm})
    payload,_=build.build_payload(cfg,quiet=True)
    payload['meta']['generated']='golden'
    ann=build.load_annotations(cfg)
    candidates=build.cand_mod.load(cfg)
    clean_cfg={k:v for k,v in cfg.items() if k!='attachments'}
    entry={'name':name,'input':{'files':files,'config':clean_cfg,'annotations':ann,'candidates':candidates,'generated':'golden'},'expected':payload,'encoded':codec.encode(copy.deepcopy(payload))}
    (out/(name+'.json')).write_text(json.dumps(entry,ensure_ascii=False,indent=2),encoding='utf8')
    rows.append({'name':name,'notes':len(files),'nodes':len(payload['nodes']),'edges':len(payload['edges'])})
(out/'manifest.json').write_text(json.dumps({'fixtures':rows,'source_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (SOURCE/'kg').glob('*.py')}},indent=2),encoding='utf8')
print(json.dumps({'exported':rows},ensure_ascii=False))
