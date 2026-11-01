"""Reopen the authorized copy's existing graph; never edits notes or saved layouts."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence/layout-performance'
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9239',timeout=10000)
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve()==(ROOT/'real-vault-trial').resolve()
    page.wait_for_function("app?.workspace?.layoutReady&&app.plugins.plugins['knowledge-graph-smoke']")
    result=page.evaluate("""async()=>{
      const P=app.plugins.plugins['knowledge-graph-smoke'];if(P.manifest.version!=='0.0.6')throw Error('Unexpected candidate');
      await P.openGraph('vault');const V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;
      if(!V.graph)throw Error('Graph unavailable');
      const s=V.host.shadowRoot,R=V.graph.renderer;
      if(!s.getElementById('legend').classList.contains('collapsed'))s.getElementById('legend-toggle').click();
      if(!R.editMode)s.getElementById('layout-mode').click();
      V.graph.dismiss();R.zoomToDepth(2);
      return{plugin:P.manifest.version,vault:app.vault.adapter.basePath,notes:V.graph.data.meta.note_count,nodes:R.NODES.length,groups:Object.keys(P.savedData.layoutOverrides.groups).length};
    }""")
    page.wait_for_timeout(700)
    page.screenshot(path=str(OUT/'real-ready-current.png'))
    (OUT/'real-ready-current.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(result));browser.close()
