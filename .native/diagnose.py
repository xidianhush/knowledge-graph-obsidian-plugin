from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 b=p.chromium.connect_over_cdp('http://127.0.0.1:9237');pg=next(x for x in b.contexts[0].pages if 'app://obsidian.md' in x.url)
 print(json.dumps(pg.evaluate('''()=>{const b=V.contentEl.querySelector('.kg-native-preview-body'),a=b.querySelector('[id^=kg-native-target]');return {state:S.preview.state(),body:{top:b.getBoundingClientRect().top,bottom:b.getBoundingClientRect().bottom,scroll:b.scrollTop,height:b.clientHeight,scrollHeight:b.scrollHeight},anchor:a?.outerHTML,ar:a?.getBoundingClientRect().toJSON(),math:b.querySelector('.math')?.outerHTML,image:b.querySelector('img')?.outerHTML,tail:b.innerHTML.slice(-1500)};}'''),ensure_ascii=False))
