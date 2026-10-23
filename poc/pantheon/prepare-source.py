"""Fetch and verify the exact source archive, without baseline images or Git history."""
from pathlib import Path
import hashlib
import json
import subprocess
import tarfile
import sys
import urllib.request

root = Path(sys.argv[1]).resolve()
config = json.loads((Path(__file__).parent / 'source.json').read_text())
archive = root.parent / 'pantheon-source.tar.gz'
with urllib.request.urlopen(config['url'], timeout=60) as response, archive.open('wb') as output:
    digest = hashlib.sha256()
    while chunk := response.read(1024 * 1024):
        digest.update(chunk)
        output.write(chunk)
if digest.hexdigest() != config['archiveSha256'] or archive.stat().st_size != config['archiveBytes']:
    raise RuntimeError('Source archive integrity check failed')
root.mkdir(parents=True, exist_ok=True)
with tarfile.open(archive) as source:
    source.extractall(root, filter='data')
archive.unlink()
for args in [['init', '-b', 'poc'], ['add', '.'], ['-c', 'user.name=E2E POC', '-c', 'user.email=poc@localhost', 'commit', '-qm', f"Source archive {config['commit']}"]]:
    subprocess.run(['git', '-C', str(root), *args], check=True)
print(json.dumps(config, indent=2))
