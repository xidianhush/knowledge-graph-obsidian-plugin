import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
TRACE="""(plugin) => {
 const R=plugin ? __smokeView.graph.renderer : KG.renderer;
 const cv=plugin ? __smokeView.host.shadowRoot.getElementById('cv') : document.getElementById('cv');
 const ctx=cv.getContext('2d'), proto=CanvasRenderingContext2D.prototype;
 const log=[], restore=[], ids=new Map(); let seq=0;
 function value(v) { if (typeof v!=='object'||v===null) return v; if(!ids.has(v))ids.set(v,++seq); return 'object'+ids.get(v); }
 for (const key of Object.getOwnPropertyNames(proto)) {
   if(key==='constructor'||key==='canvas')continue;
   const desc=Object.getOwnPropertyDescriptor(proto,key);
   if(typeof desc.value==='function') {
     Object.defineProperty(ctx,key,{configurable:true,value:function(...args){
       const result=desc.value.apply(this,args);
       log.push([key,...args.map(value),key==='measureText'?result.width:null]); return result;
     }});restore.push(key);
   } else if(desc.set&&desc.get) {
     Object.defineProperty(ctx,key,{configurable:true,get(){return desc.get.call(this)},set(v){log.push([key,value(v)]);desc.set.call(this,v);}});restore.push(key);
   }
 }
 R.hover=null; R.selected=null; R.draw();
 for(const key of restore)delete ctx[key];
 return {log,attrs:ctx.getContextAttributes(),dpr:devicePixelRatio,css:{font:getComputedStyle(cv).font,letterSpacing:getComputedStyle(cv).letterSpacing,direction:getComputedStyle(cv).direction},camera:R.camera,stats:R.stats};
}"""
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:9237')
 pg=b.contexts[0].pages[0]
 ref=pg.locator('#kg-test-reference').element_handle().content_frame()
 a=pg.evaluate(TRACE,True); z=ref.evaluate(TRACE,False)
 for t in [a,z]: print(json.dumps({k:v for k,v in t.items() if k!='log'},ensure_ascii=False))
 diffs=[{'index':i,'plugin':x,'source':y} for i,(x,y) in enumerate(zip(a['log'],z['log'])) if x!=y]
 print('LENGTHS',len(a['log']),len(z['log']),'DIFFS',len(diffs))
 print(json.dumps(diffs[:15],ensure_ascii=False))
 (ROOT/'.local/evidence/draw-trace.json').write_text(json.dumps({'plugin':a,'source':z,'differences':diffs},ensure_ascii=False),encoding='utf-8')
