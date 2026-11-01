"""Serve only the synthetic prototype, with explicit module MIME types on Windows."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript'}

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1] / 'prototypes/layout-edit'
    print('Synthetic prototype: http://127.0.0.1:9241/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 9241), partial(Handler, directory=str(root))).serve_forever()
