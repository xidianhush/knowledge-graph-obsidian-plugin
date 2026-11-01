"""Run existing upstream checks without rebuilding or changing its sources."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r'D:\obsidian_vault\knowledge-graph')
EVIDENCE = ROOT / '.local/evidence'
EVIDENCE.mkdir(parents=True, exist_ok=True)

def run(scope):
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    if scope == 'verify':
        cmd = [sys.executable, 'build.py', 'verify', '--scope', 'all']
    else:
        cmd = [sys.executable, 'browser_check.py']
        shots = EVIDENCE / ('baseline-' + scope)
        shots.mkdir(exist_ok=True)
        env['KG_SHOT_DIR'] = str(shots)
        env['KG_HTML'] = 'knowledge-graph.public.html' if scope == 'public' else 'knowledge-graph.html'
    with (EVIDENCE / ('baseline-' + scope + '.log')).open('w', encoding='utf-8') as out:
        proc = subprocess.run(cmd, cwd=SOURCE, env=env, stdout=out, stderr=subprocess.STDOUT)
    lines = (EVIDENCE / ('baseline-' + scope + '.log')).read_text(encoding='utf-8').splitlines()
    result = {'scope': scope, 'exit': proc.returncode, 'results': [x for x in lines if '_RESULT ' in x]}
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    results = list(pool.map(run, ['verify', 'private', 'public']))
(EVIDENCE / 'baseline.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
sys.exit(any(r['exit'] != 0 for r in results))
