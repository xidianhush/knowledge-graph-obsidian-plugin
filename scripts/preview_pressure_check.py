"""Bounded preview and request lifecycle checks, only in the independent vault.

The queue tests use a deliberately stalled renderer on real DOM. The final tests
use Obsidian's actual MarkdownRenderer with synthetic formulas.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local/evidence/preview-pressure-results.json'
results = []

def check(name, ok, detail=None):
    row = dict(name=name, passed=bool(ok), detail=detail)
    results.append(row)
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps(row, ensure_ascii=False), flush=True)
    assert ok, name

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9238', timeout=5000)
    page = next(pg for pg in browser.contexts[0].pages if 'app://obsidian.md' in pg.url)
    assert Path(page.evaluate('app.vault.adapter.basePath')).resolve() == (ROOT / 'test-vault').resolve()
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("window.app?.workspace?.layoutReady && app.plugins.plugins['knowledge-graph-smoke']")
    source = (ROOT / 'src/adapters/obsidian-native.js').read_text(encoding='utf8')
    page.evaluate('''source => {
      window.preparePreview = new Function(source + ';return prepareNativePreview;')();
    }''', source)
    cases = page.evaluate(r'''() => {
      const p=preparePreview, result=[];
      const check=(name,pass)=>result.push({name,pass});
      const short='# Title\nA $x$ and ![[pixel.png]].\n## Target\nBody';
      const s=p(short,2,'target',60000);
      check('Short note retains text, formula, image and heading marker',!s.truncated && s.markdown.includes('$x$') && s.markdown.includes('![[pixel.png]]') && s.markdown.includes('## <span id="target"></span>Target'));
      const long=Array(100).fill('Paragraph '.repeat(30)).join('\n')+'\n## Far target\nUnique target content';
      const t=p(long,100,'target',60000);
      check('Heavy note starts at requested distant heading',t.truncated && t.markdown.startsWith('## <span') && t.markdown.includes('Unique target content'));
      const c=p(Array(200).fill('A'.repeat(100)).join('\n'),-1,'x',60000);
      check('Safety character ceiling applies to large configured budgets',c.truncated && c.markdown.length<=12000);
      const small=p('first\nsecond\nthird',-1,'x',10);
      check('Smaller user budget is honored at complete lines',small.truncated && small.markdown==='first\n');
      const m=p(Array(500).fill('$x$').join('\n'),-1,'x',60000);
      check('Dense math is bounded to 80 markers',m.truncated && (m.markdown.match(/\$/g)||[]).length===80);
      const e=p(Array(20).fill('![[pixel.png]]').join('\n'),-1,'x',60000);
      check('Top-level embed count is bounded',e.truncated && (e.markdown.match(/!\[/g)||[]).length===6);
      const f=p('```js\n'+Array(100).fill('const a=1;').join('\n'),-1,'x',100);
      check('Truncated code fence is closed',f.truncated && f.markdown.endsWith('\n```\n'));
      return result;
    }''')
    for row in cases:
        check(row['name'], row['pass'])
    page.evaluate(r'''source => {
      window.qRead=0;window.qStarted=[];window.qReleased=[];window.qLive=0;window.qPeak=0;
      window.qHost=document.body.appendChild(document.createElement('div'));
      window.qNode=i=>({id:'note'+i,note:'note'+i,kind:'note',path:'note'+i+'.md'});
      const view={contentEl:qHost,plugin:{pipelineSettings:{config:{preview:{enabled:true}}}},
        app:{vault:{getAbstractFileByPath:path=>({path,extension:'md'}),cachedRead:async f=>{qRead++;return f.path;}},workspace:{}},
        addChild(c){c.active=true;qLive++;qPeak=Math.max(qPeak,qLive);},
        removeChild(c){if(c.active){c.active=false;qLive--;}}};
      const renderer={render:async(app,markdown,el,path,component)=>{
        qStarted.push(path);await new Promise(resolve=>qReleased.push(resolve));el.textContent=markdown;
      }};
      window.Q=new Function('Component','MarkdownRenderer','graphPathAllowed','splitGraphFrontmatter', 'parseYaml',source+';return createNativeGraphServices;')(
        class {},renderer,()=>true,({text})=>({body:text}),()=>{})(view);
    }''', source)
    try:
        page.evaluate('()=>{window.first=Q.preview.show(qNode(0),100,100,true);}')
        page.wait_for_function('qStarted.length===1')
        page.evaluate('()=>{window.all=[first];for(let i=1;i<=30;i++)all.push(Q.preview.show(qNode(i),100,100,true));}')
        check('Stalled renderer permits only one in-flight request and one latest queued target', page.evaluate('qRead===1 && qStarted.length===1 && Q.diagnostics().rendering===1 && Q.diagnostics().queued && Q.diagnostics().peakRendering===1'))
        page.evaluate('()=>{qReleased.shift()();}')
        page.wait_for_function('qStarted.length===2')
        check('Superseded requests do not read or render', page.evaluate("qRead===2 && qStarted[1]==='note30.md' && qPeak===1"))
        page.evaluate('async()=>{qReleased.shift()();await Promise.all(all);}')
        check('Latest target is displayed after old completion', page.evaluate("Q.preview.state().note==='note30' && qHost.querySelector('.kg-native-preview-body').textContent.trim()==='note30.md' && Q.diagnostics().rendering===0"))
        page.evaluate('async()=>{Q.preview.hide();window.readBefore=qRead;const pending=Q.preview.show(qNode(40),100,100,false);Q.preview.hide();await pending;}')
        page.wait_for_timeout(180)
        check('Cancel before hover delay avoids body read and clears timer',page.evaluate('qRead===readBefore && Q.diagnostics().timers===0 && !Q.diagnostics().queued && qLive===0'))
        page.evaluate('()=>{window.disposedFirst=Q.preview.show(qNode(41),100,100,true);}')
        page.wait_for_function('qReleased.length===1')
        page.evaluate('async()=>{window.disposedQueued=Q.preview.show(qNode(42),100,100,true);Q.dispose();qReleased.shift()();await Promise.all([disposedFirst,disposedQueued]);}')
        check('Dispose clears queue, component, listeners, observer and late DOM',page.evaluate('Q.diagnostics().disposed && !Q.diagnostics().queued && Q.diagnostics().rendering===0 && Q.diagnostics().active===0 && Q.diagnostics().listeners===0 && Q.diagnostics().observers===0 && qHost.childElementCount===0'))
    finally:
        page.evaluate('Q.dispose();qHost.remove()')

    page.evaluate(r'''async()=>{
      window.P=app.plugins.plugins['knowledge-graph-smoke'];window.saved=P.pipelineSettings;window.gs=P.graphSettings;
      P.graphSettings={...gs,autoUpdate:false};P.pipelineSettings={config:{include:['__kg_pressure__.md']}};
      for(const t of ['knowledge-graph-smoke-view','knowledge-graph-vault-view'])for(const l of app.workspace.getLeavesOfType(t))l.detach();
      window.F=app.vault.getAbstractFileByPath('__kg_pressure__.md');
      const text='# Synthetic target\n'+Array.from({length:500},(_,i)=>'Formula '+i+': $E_'+i+'=\\frac{a^2+b^2}{c}$.\n').join('');
      if(F)await app.vault.modify(F,text);else F=await app.vault.create('__kg_pressure__.md',text);
      await P.openGraph('vault',true);window.V=app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0].view;
      window.N=V.graph.data.nodes.find(n=>n.kind==='note');
    }''')
    try:
        detail=page.evaluate('''async()=>{
          let last=performance.now(),gap=0;const timer=setInterval(()=>{const now=performance.now();gap=Math.max(gap,now-last);last=now;},50);
          try{await V.nativeServices.preview.show(N,200,200,true);await new Promise(r=>setTimeout(r,500));
            return {maxGapMs:gap,math:V.contentEl.querySelectorAll('.math').length,hint:!!V.contentEl.querySelector('.kg-native-preview-hint'),ready:!!V.contentEl.querySelector('[data-ready="true"]'),resources:V.nativeServices.diagnostics()};
          }finally{clearInterval(timer);}
        }''')
        check('Real native renderer completes a bounded 500-formula preview',detail['math']==40 and detail['hint'] and detail['ready'],detail)
        page.evaluate('V.nativeServices.preview.hide()')
        check('Real renderer component is released after close',page.evaluate('V.nativeServices.diagnostics().active===0 && V.nativeServices.diagnostics().created===V.nativeServices.diagnostics().unloaded'))
    finally:
        page.evaluate('async()=>{V.leaf.detach();P.pipelineSettings=saved;P.graphSettings=gs;await app.vault.delete(F);}')
        browser.close()
