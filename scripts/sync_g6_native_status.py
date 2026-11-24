"""Read-only diagnostic for one explicitly named owned G6 native profile."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
a=argparse.ArgumentParser();a.add_argument('metadata');a.add_argument('--close-owned',action='store_true');args=a.parse_args();p=Path(args.metadata).resolve();root=Path(__file__).resolve().parents[1];assert p.is_relative_to(root/'.local');m=json.loads(p.read_text(encoding='utf-8'))
with sync_playwright() as pw:
 try:b=pw.chromium.connect_over_cdp('http://127.0.0.1:'+str(m['port']),timeout=5000)
 except Exception:
  if args.close_owned:print('Owned test profile already stopped');raise SystemExit(0)
  raise
 observed=set()
 for c in b.contexts:
  for page in c.pages:
   actual=page.evaluate('window.app?.vault?.adapter?.basePath')
   if actual:observed.add(str(Path(actual).resolve()))
   if actual and Path(actual).resolve()==Path(m['paths']['A']).resolve():
    print(json.dumps(page.evaluate("()=>{const p=app.plugins.getPlugin('knowledge-map-sync-unified'),s=p?.syncHost?.state();return {status:s?.status,error:s?.error,saveError:s?.saveError,operations:s?.session?.accepted?.operations.length,pending:s?.session?.pending?.id,draft:!!s?.session?.localState?.layoutDraft,rotation:!!s?.rotationPending,graph:!!app.workspace.getLeavesOfType('knowledge-graph-vault-view')[0]?.view.graph}}")))
   if page.locator('.kg-sync-settings').count():print(json.dumps({'settings':page.locator('.kg-sync-settings').text_content()[-1800:]}))
 if args.close_owned:
  assert observed and observed.issubset({str(Path(v).resolve()) for v in m['paths'].values()})
  b.new_browser_cdp_session().send('Browser.close');print('Closed only the explicitly verified owned G6 profile')
