"""Refreshes the list of app files in sw.js (between FILES-START and FILES-END)
and bumps the cache version, so phones pick up the new set of files.
Run from the project folder after adding or removing app files:
    python3 tools/update-sw.py
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = re.compile(r"^(tools/|\.claude/|\.test/|\.gitignore|README|lib/README|sw\.js$)")
APP_EXT = (".html", ".css", ".js", ".png", ".webmanifest", ".json", ".svg", ".woff2")

files = subprocess.run(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
    cwd=ROOT, capture_output=True, text=True, check=True,
).stdout.split()
files = sorted(f for f in files if not SKIP.match(f) and f.endswith(APP_EXT) and not f.startswith("icons/splash/"))

sw = ROOT / "sw.js"
src = sw.read_text()
block = "const FILES = [\n" + "".join(f'  "{f}",\n' for f in ["./", *files]) + "];\n"
src = re.sub(r"(// FILES-START\n).*?(// FILES-END)", lambda m: m.group(1) + block + m.group(2), src, flags=re.S)
src = re.sub(r'const CACHE = "boekenhoekje-v(\d+)";', lambda m: f'const CACHE = "boekenhoekje-v{int(m.group(1)) + 1}";', src)
sw.write_text(src)
print(f"sw.js: {len(files) + 1} files,", re.search(r'const CACHE = "([^"]+)"', src).group(1))
