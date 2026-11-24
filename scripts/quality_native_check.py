"""Owned Windows Obsidian smoke: fresh synthetic vault/profile, never daily data."""
from pathlib import Path
import hashlib,json,os,re,shutil,socket,subprocess,tempfile,time
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.local/quality-1.0'
ID='knowledge-graph-smoke'

def run():
    BASE.mkdir(parents=True,exist_ok=True)
    out=Path(tempfile.mkdtemp(prefix='native-',dir=BASE)).resolve()
    assert out.is_relative_to(BASE.resolve()) and out!=BASE.resolve()
    vault=out/'Synthetic quality vault';profile=out/'profile'
    plugin=vault/'.obsidian/plugins'/ID
    plugin.mkdir(parents=True);profile.mkdir()
    (vault/'Synthetic').mkdir()
    (vault/'Synthetic/A.md').write_text('# First\nSynthetic body\n# Second\nSynthetic body',encoding='utf-8')
    config=vault/'.obsidian'
    for name,value in {'app.json':{'showUnsupportedFiles':True},'community-plugins.json':[ID],'core-plugins.json':[]}.items():
        (config/name).write_text(json.dumps(value),encoding='utf-8')
    for name in ['main.js','manifest.json','styles.css']:shutil.copyfile(ROOT/'dist'/name,plugin/name)
    (plugin/'data.json').write_text(json.dumps({'settings':{'language':'zh'},'pipeline':{'config':{'include':['Synthetic/**']}}}),encoding='utf-8')
    asars=list((Path(os.environ['APPDATA'])/'obsidian').glob('obsidian-*.asar'))
    assert asars,'Installed Obsidian application code unavailable'
    asar=max(asars,key=lambda p:tuple(map(int,p.stem.removeprefix('obsidian-').split('.'))))
    shutil.copyfile(asar,profile/asar.name)
    (profile/'obsidian.json').write_text(json.dumps({'vaults':{os.urandom(8).hex():{'path':str(vault),'open':True,'ts':int(time.time()*1000)}},'updateDisabled':True}),encoding='utf-8')
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    owned_pids=[]
    q=lambda value:"'"+str(value).replace("'","''")+"'"
    def launch():
        args=['--user-data-dir="'+str(profile)+'"','--remote-debugging-port='+str(port),'--remote-debugging-address=127.0.0.1']
        command='Start-Process -FilePath '+q('D:/Obsidian/Obsidian.exe')+' -ArgumentList @('+','.join(q(a) for a in args)+') -WindowStyle Hidden'
        powershell=Path(os.environ['WINDIR'])/'System32/WindowsPowerShell/v1.0/powershell.exe'
        result=subprocess.run([str(powershell),'-NoProfile','-Command',command],check=True,capture_output=True,text=True)
        owned_pids.append(int(result.stdout.strip()))
    checks=[];browser=None;owned=False
    def record(value):checks.append(value);print(value,flush=True)
    with sync_playwright() as pw:
        def connect():
            nonlocal browser,owned
            launch()
            for _ in range(200):
                try:browser=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(port),timeout=1000);break
                except Exception:time.sleep(.1)
            else:raise AssertionError('Owned endpoint unavailable')
            for _ in range(200):
                for context in browser.contexts:
                    for page in context.pages:
                        try:actual=page.evaluate('window.app?.vault?.adapter?.basePath')
                        except Exception:continue
                        if actual and Path(actual).resolve()==vault:
                            owned=True
                            page.on('dialog',lambda d:d.dismiss())
                            page.wait_for_function("!!app.plugins.getPlugin('"+ID+"')?.syncHost || /信任.*启用|Trust.*enable/i.test(document.body.innerText)",timeout=30000)
                            trust=page.get_by_role('button',name=re.compile('信任.*启用|Trust.*enable',re.I))
                            if trust.count():trust.first.click()
                            page.wait_for_function("!!app.plugins.getPlugin('"+ID+"')?.syncHost",timeout=30000)
                            return page
                time.sleep(.1)
            raise AssertionError('Expected synthetic vault unavailable; no other vault is operated')
        def ui(page):
            page.evaluate("app.setting.open();app.setting.openTabById('"+ID+"');app.setting.win.document.documentElement.dataset.qualityOwned='yes'")
            for _ in range(100):
                for context in browser.contexts:
                    for target in context.pages:
                        if target.locator('html[data-quality-owned="yes"] .kg-sync-settings').count():return target
                time.sleep(.1)
            raise AssertionError('Owned settings unavailable')
        state=lambda p:p.evaluate("app.plugins.getPlugin('"+ID+"').syncHost.state()")
        try:
            page=connect()
            assert state(page)['selected'] is None
            target=ui(page);assert target.locator('[data-sync-guidance="start"]').count()==1
            target.locator('[data-sync-route="existing"]').click();target.locator('[data-sync-action="find"]').click()
            target.locator('[data-sync-guidance="empty"]').wait_for();assert state(page)['selected'] is None
            record('Native settings: existing-device empty search is guided without creating a connection')
            page.evaluate("app.setting.close();app.plugins.getPlugin('"+ID+"').openGraph('vault',true)")
            target=ui(page);target.locator('[data-sync-route="first"]').click();target.locator('[data-sync-action="new"]').click()
            target.locator('[data-sync-cancel]').click();assert state(page)['selected'] is None
            record('Native first-device route and selection cancellation leave connection unselected')
            target.locator('[data-sync-action="new"]').click();target.locator('[data-sync-confirm]').click()
            target.locator('[data-sync-action="join"]').click();target.locator('[data-join-choice]:not([disabled])').first.click();target.locator('[data-join-confirm]').click()
            page.wait_for_function("app.plugins.getPlugin('"+ID+"').syncHost.state().session?.initialized===true")
            selected=state(page)['selected'];record('Native selection, explicit layout preview and confirmed first join succeed')
            target.screenshot(path=str(out/'settings.png'),full_page=True)
            target.locator('[data-sync-action="disable"]').click();target.locator('[data-sync-guidance="disabled"]').wait_for()
            record('Native sync off retains connection and provides Enable sync next step')
            browser.new_browser_cdp_session().send('Browser.close');browser=None;owned=False;time.sleep(1)
            page=connect();target=ui(page)
            assert state(page)['selected']==selected
            assert target.locator('[data-sync-guidance="disabled"]').count()==1
            record('Full owned profile restart retains selected ID and disabled guidance')
            result={'pass':True,'checks':checks,'build':hashlib.sha256((plugin/'main.js').read_bytes()).hexdigest(),'scope':'Actual owned Windows Obsidian fresh synthetic vault/profile; no other device, provider, upgrade or daily vault.'}
            (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps({'pass':True,'out':str(out),'checks':len(checks)}),flush=True)
        finally:
            if browser and owned:
                try:browser.new_browser_cdp_session().send('Browser.close')
                except Exception:pass
            powershell=Path(os.environ['WINDIR'])/'System32/WindowsPowerShell/v1.0/powershell.exe'
            for pid in owned_pids:
                subprocess.run([str(powershell),'-NoProfile','-Command',f'Stop-Process -Id {pid} -Force -ErrorAction SilentlyContinue'],capture_output=True)

if __name__=='__main__':run()
