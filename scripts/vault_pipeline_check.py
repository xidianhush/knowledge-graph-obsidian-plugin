"""Exercise real Obsidian vault input, raw YAML, worker cleanup and rebuilds."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence'
RESULTS=[]
TYPE='knowledge-graph-vault-view'
def check(name,ok,detail=None):
    row={'name':name,'pass':bool(ok),'detail':detail};RESULTS.append(row)
    (OUT/'vault-pipeline-results.json').write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(row,ensure_ascii=False),flush=True)
    assert ok,name
with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp('http://127.0.0.1:9238')
    page=next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    page.wait_for_function('window.app?.vault')
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve() == (ROOT/'test-vault').resolve(), 'Refusing non-workspace vault'
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("window.app && app.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']")
    check('Isolated test vault',page.evaluate("app.vault.getName()==='test-vault'"))
    if page.locator('.modal-container').count():page.keyboard.press('Escape')
    page.evaluate('''async () => {
      window.P=app.plugins.plugins['knowledge-graph-smoke']; window.savedPipelineSettings=P.pipelineSettings;
      for(const leaf of app.workspace.getLeavesOfType('knowledge-graph-vault-view'))leaf.detach();
      const root='__kg_pipeline_acceptance__';
      if(!app.vault.getAbstractFileByPath(root))await app.vault.createFolder(root);
      const notes={
        'Alpha.md':'---\\nsubject: Integration\\nprerequisites: [Beta]\\n---\\n# Alpha\\n[[Beta#Start]]\\n### Detail\\nBody.\\n',
        'Beta.md':'# Start\\nTarget body.\\n',
        'Skip.md':'Synthetic excluded note; should never be read by the graph builder.\\n'
      };
      for(const [name,text]of Object.entries(notes)){const path=root+'/'+name,old=app.vault.getAbstractFileByPath(path);if(old)await app.vault.modify(old,text);else await app.vault.create(path,text);}
      P.pipelineSettings={config:{include:[root+'/**'],exclude:['**/Skip.md']}};
      window.vaultReads=[]; window.originalRead=app.vault.cachedRead;
      app.vault.cachedRead=function(file){vaultReads.push(file.path);if(file.path.endsWith('/Skip.md')||file.path==='Utilities/API Key.md')throw new Error('Excluded note read');return originalRead.call(this,file);};
    }''')
    try:
        page.evaluate("P.openGraph('vault',true)")
        page.wait_for_function("app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph?.renderer.stats.painted>0",timeout=30000)
        page.evaluate("window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view")
        check('Builds two current-vault notes, no snapshot',page.evaluate('V.graph.data.meta.note_count===2 && V.graph.data.nodes.length===6'),page.evaluate('V.graph.data.meta.node_count_by_kind'))
        check('Raw YAML handled by Obsidian',page.evaluate("V.graph.data.nodes.some(n=>n.kind==='note'&&n.label==='Alpha'&&n.subject==='Integration')"))
        check('Frontmatter and heading links built',page.evaluate("V.graph.data.edges.some(e=>e.type==='prerequisite') && V.graph.data.heading_links.length===1"))
        check('Excluded files filtered before reading',page.evaluate("vaultReads.length===2 && vaultReads.every(p=>/\\/(Alpha|Beta)\\.md$/.test(p))"),page.evaluate('vaultReads'))
        check('Worker released on successful build',page.evaluate('P.pipelineResources.active===0 && P.pipelineResources.started===P.pipelineResources.stopped'),page.evaluate('P.pipelineResources'))
        check('Live view content has zero padding',page.evaluate("getComputedStyle(V.contentEl).padding==='0px'"))
        page.evaluate('''async () => {
          window.oldSession=V.session;
          const file=app.vault.getAbstractFileByPath('__kg_pipeline_acceptance__/Alpha.md');
          await app.vault.modify(file,(await originalRead.call(app.vault,file))+'\\n## Added\\nFresh content.\\n');
          await P.openGraph('vault',true);
        }''')
        page.wait_for_function('V.graph?.data.meta.heading_total===4')
        check('Rebuild picks up edited Markdown',page.evaluate("V.graph.data.nodes.some(n=>n.title==='Added')"))
        check('Rebuild disposes previous session',page.evaluate('oldSession.diagnostics().disposed && oldSession.diagnostics().listeners===0'))
        check('Command rebuild reuses one view',page.evaluate("app.workspace.getLeavesOfType('knowledge-graph-vault-view').length===1"))
        # Keep a real worker alive but withhold its completion callback, then close.
        page.evaluate('''() => {
          window.RealWorker=window.Worker;
          window.Worker=class extends RealWorker {set onmessage(callback){this.withheld=callback;} get onmessage(){return this.withheld;}};
          window.pendingBuild=P.openGraph('vault',true);
        }''')
        page.wait_for_function('P.pipelineResources.active===1')
        page.evaluate('() => { V.leaf.detach(); window.Worker=RealWorker; }')
        page.wait_for_function('P.pipelineResources.active===0')
        check('Closing pending build terminates worker',page.evaluate('P.pipelineResources.started===P.pipelineResources.stopped'),page.evaluate('P.pipelineResources'))
        check('Cancelled build does not remount DOM',page.evaluate('V.session===null && V.contentEl.childElementCount===0'))
        # Close while a vault read is pending: its completion must not start a worker.
        page.evaluate('''() => {
          window.beforeReadCancel=P.pipelineResources.started; window.releaseRead=null;
          app.vault.cachedRead=function(file){return new Promise(resolve=>{window.releaseRead=()=>originalRead.call(app.vault,file).then(resolve);});};
          window.pendingReadBuild=P.openGraph('vault',true);
        }''')
        page.wait_for_function('releaseRead!==null')
        page.evaluate("() => { app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].detach();releaseRead();app.vault.cachedRead=originalRead; }")
        page.wait_for_timeout(200)
        check('Closing during file read prevents worker start',page.evaluate('P.pipelineResources.started===beforeReadCancel && P.pipelineResources.active===0'))
        page.evaluate("P.pipelineSettings={config:{include:['__no_such_folder__/**']}};P.openGraph('vault',true)")
        page.wait_for_selector('[data-pipeline-empty="true"]')
        check('Empty scope gives a clear message',page.evaluate("app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view.contentEl.textContent.includes('没有可显示')"))
        page.evaluate("P.pipelineSettings={config:{include:['__kg_pipeline_acceptance__/**'],exclude:['**/Skip.md']}};P.openGraph('vault',true)")
        page.wait_for_function("app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph?.renderer.stats.painted>0")
        check('Build works again after cancellation and empty scope',page.evaluate("app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view.graph.data.meta.note_count===2"))
        page.mouse.move(1,1);page.wait_for_timeout(1000)
        page.screenshot(path=str(OUT/'vault-pipeline-final.png'))
        check('No uncaught page errors',not errors,errors)
    finally:
        page.evaluate('''() => {
          app.vault.cachedRead=originalRead;
          if(window.RealWorker)window.Worker=RealWorker;
          P.pipelineSettings=savedPipelineSettings;
        }''')
print('VAULT_PIPELINE_RESULT',json.dumps({'ok':len(RESULTS),'fail':0}))
