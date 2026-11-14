"""Local-only preview of Next's static export, including clean URLs."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=4173)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / "out"
if not (root / "index.html").exists():
    raise SystemExit("Falta out/index.html. Ejecuta npm run build antes de preview.")


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        route = unquote(urlsplit(self.path).path).lstrip("/").rstrip("/")
        candidate = (root / (route + ".html")).resolve()
        if route and candidate.is_relative_to(root) and candidate.is_file():
            self.path = "/" + route + ".html"
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


print(f"El Último Escaño · revisión local: http://127.0.0.1:{args.port}", flush=True)
ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(root))).serve_forever()
