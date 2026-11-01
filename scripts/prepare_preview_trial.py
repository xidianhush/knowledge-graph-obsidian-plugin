"""Leave synthetic preview examples open in the independent test vault only."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9238', timeout=5000)
    page = next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve() == (ROOT/'test-vault').resolve()
    result = page.evaluate(r'''async()=>{
      const P=app.plugins.plugins['knowledge-graph-smoke'],root='__kg_preview_trial__';
      if(!app.vault.getAbstractFileByPath(root))await app.vault.createFolder(root);
      const examples={
        '01-Short.md':'# 短笔记\n这是独立库的合成体验样本。\n公式 $E=mc^2$\n![[pixel.png]]\n## 体验操作\nCtrl 悬停后松开；再次悬停并点击固定，再按 Esc。\n[[02-Formulas]]',
        '02-Formulas.md':'# 密集公式\n'+Array.from({length:500},(_,i)=>'Formula '+i+': $E_'+i+'=\\frac{a^2+b^2}{c}$.\n').join(''),
        '03-Long.md':'# 长笔记\n'+Array(200).fill('用于验证长笔记截取的合成正文。'.repeat(10)).join('\n')+'\n## 远处标题\n如果从这个标题预览，应直接看到这一段，而不用滚动整篇长文。'
      };
      for(const [name,text]of Object.entries(examples))if(!app.vault.getAbstractFileByPath(root+'/'+name))await app.vault.create(root+'/'+name,text);
      if(!app.vault.getAbstractFileByPath(root+'/pixel.png'))await app.vault.createBinary(root+'/pixel.png',Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6uoAAAAASUVORK5CYII='),c=>c.charCodeAt(0)).buffer);
      P.pipelineSettings={config:{include:[root+'/**'],preview:{enabled:true,max_note_chars:60000}}};
      P.graphSettings={...P.graphSettings,autoUpdate:false};
      // Keep this trial scope in memory only; do not overwrite saved settings.
      app.workspace.getLeaf(false);
      await P.openGraph('vault',true);
      const V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;
      app.workspace.setActiveLeaf(V.leaf,{focus:true});
      const n=V.graph.data.nodes.find(n=>n.kind==='note'&&n.path.endsWith('01-Short.md'));
      if(n)V.graph.renderer.focusOn(n.id,1.25);
      return {version:P.manifest.version,vault:app.vault.getName(),notes:V.graph.data.nodes.filter(n=>n.kind==='note').length};
    }''')
    print(json.dumps(result, ensure_ascii=False))
    browser.close()
