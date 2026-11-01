"""Only the standalone synthetic prototype; never connects to an Obsidian vault."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.local/evidence/layout-prototype'
OUT.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    page=browser.new_page(viewport={'width':1100,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda m: print(m.text,flush=True) if m.type=='error' else None)
    page.goto('http://127.0.0.1:9241/')
    page.wait_for_function('!!window.layoutPrototype')
    def state(): return page.evaluate('layoutPrototype.snapshot()')
    checks=[]
    def check(value,label):
        assert value,label
        checks.append(label)
        print(label,flush=True)
    def nodepoint(id):
        box=page.locator('circle[data-id="'+id+'"]').bounding_box()
        return box['x']+box['width']/2,box['y']+box['height']/2
    def drag(id,dx,dy,release=True):
        x,y=nodepoint(id)
        page.mouse.move(x,y)
        page.mouse.down()
        page.mouse.move(x+dx,y+dy,steps=14)
        page.wait_for_timeout(280)
        if release: page.mouse.up()
    initial=state()['nodes']
    drag('n1',30,20)
    check(state()['nodes']==initial,'reading mode preserves layout')
    page.locator('#home').click()
    page.locator('#mode').click()
    drag('h0',-6,9)
    check(state()['nodes']!=initial and state()['valid'],'heading moves inside note')
    page.locator('#undo').click()
    check(state()['nodes']==initial,'undo exactly restores group')
    page.locator('#redo').click()
    check(state()['nodes']!=initial,'redo restores change')
    page.locator('#parent').click()
    check(state()['selected']=='n0','parent selection discovers note handle')
    handle=page.locator('[data-handle="n0"]').bounding_box()
    page.mouse.move(handle['x']+handle['width']/2,handle['y']+handle['height']/2)
    before=state()['nodes']
    page.mouse.down();page.mouse.move(handle['x']+handle['width']/2+130,handle['y']+handle['height']/2,steps=25)
    page.wait_for_timeout(350);page.mouse.up()
    after=state()['nodes']
    check(after!=before and state()['valid'],'parent handle moves valid subtree')
    check([n for n in before if n['parent']=='n0']==[n for n in after if n['parent']=='n0'],'children retain local coordinates')
    check(any(a!=b for a,b in zip(before,after) if a['parent']=='root' and a['id']!='n0'),'visible sibling displacement')
    edges_before=page.locator('[data-edge="h0-n1"]').get_attribute('x1')
    drag('n1',0,25)
    check(page.locator('[data-edge="h0-n1"]').get_attribute('x1')!=edges_before,'line endpoints follow geometry')
    before=state()['nodes'];drag('n2',-30,20,False)
    page.keyboard.press('Escape');page.mouse.up()
    check(state()['nodes']==before and not state()['active'],'Escape restores entire transaction')
    before=state()['nodes'];drag('n2',-30,20,False)
    page.evaluate("window.dispatchEvent(new Event('blur'))");page.mouse.up()
    check(state()['nodes']==before and not state()['active'],'blur cancels pending move')
    before=state()['nodes'];drag('n2',-30,20,False)
    page.locator('#graph').dispatch_event('pointercancel');page.mouse.up()
    check(state()['nodes']==before and not state()['active'],'pointer cancellation restores group')
    page.locator('#hide').check()
    check(page.locator('[data-id="n3"]').count()==0 and len(state()['nodes'])==13,'filtered circles remain in model')
    page.locator('#scene').select_option('dense')
    for id in ['n1','n5','n9']: drag(id,45,-20)
    check(state()['valid'],'dense dragging preserves constraints')
    page.locator('#scene').select_option('boundary')
    drag('n1',80,0)
    check(state()['valid'],'boundary drag stops inside parent')
    page.screenshot(path=str(OUT/'desktop.png'))
    page.set_viewport_size({'width':390,'height':844})
    check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'narrow layout fits viewport')
    page.screenshot(path=str(OUT/'narrow.png'))
    check(not errors,'no browser runtime errors')
    times=state()['frameTimes'];times.sort()
    result={'checks':checks,'count':len(checks),'errors':errors,'frameSampleCount':len(times),
            'prototypeSolveAndDrawMs':{'p50':times[len(times)//2] if times else None,'p95':times[int(len(times)*.95)] if times else None,'max':max(times) if times else None},
            'scope':'Synthetic standalone prototype, not Obsidian integration or production performance certification'}
    (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False))
    browser.close()
