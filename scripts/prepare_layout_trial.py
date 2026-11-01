"""Open already-created synthetic examples in the isolated test-vault only."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9238',timeout=10000)
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'test-vault').resolve()
    info=page.evaluate('''async()=>{
      const P=app.plugins.plugins['knowledge-graph-smoke'];
      if(P.manifest.version!=='0.0.4')throw new Error('Wrong candidate');
      app.workspace.getLeaf(false);
      P.pipelineSettings={config:{include:['__kg_layout_trial__/**'],preview:{enabled:true}}};
      P.graphSettings={...P.graphSettings,autoUpdate:false};
      await P.openGraph('vault',true);
      const V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;
      app.workspace.setActiveLeaf(V.leaf,{focus:true});
      const note=V.graph.data.nodes.find(n=>n.kind==='note');
      if(note)V.graph.renderer.focusOn(note.id,1.25,0);
      app.setting.open();app.setting.openTabById('about');
      const about=app.setting.activeTab?.containerEl?.innerText||'';app.setting.close();
      return {plugin:P.manifest.version,vault:app.vault.getName(),nodes:V.graph.data.nodes.length,about,scope:'in-memory synthetic examples; automatic rebuild disabled for this trial only'};
    }''')
    page.wait_for_timeout(300)
    out=ROOT/'.local/evidence/layout-integration'
    (out/'trial-ready.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf8')
    page.screenshot(path=str(out/'trial-ready.png'))
    print(json.dumps(info,ensure_ascii=True));browser.close()
