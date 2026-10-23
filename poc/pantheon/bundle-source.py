"""Create the pinned source fixture from Git, streaming around the baseline corpus."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

framework = Path(__file__).resolve().parents[2]
root = Path(sys.argv[1] if len(sys.argv) > 1 else framework.parent / 'games/pantheon').resolve()
if len(sys.argv) < 3: raise SystemExit('Usage: bundle-source.py application-directory new-release-tag')
tag = sys.argv[2]
if not tag.startswith('poc-source-') or not all(character.isalnum() or character in '-_' for character in tag): raise SystemExit('Invalid source release tag')
archive = framework / 'poc-output/pantheon-runtime-source.tar.gz'
archive.parent.mkdir(parents=True, exist_ok=True)
paths = subprocess.check_output(['git', '-C', str(root), 'ls-tree', '-rz', '--name-only', 'HEAD']).decode().split('\0')
excluded_dirs = {'docs', 'balance-results', 'leader-opening-study'}
paths = [p for p in paths if p and p.split('/')[0] not in excluded_dirs and not (p.startswith('tests/e2e/') and p.endswith('.png'))]
subprocess.run(['git', '-C', str(root), 'archive', '--format=tar.gz', '--output', str(archive), 'HEAD', '--', *paths], check=True)
digest = hashlib.sha256()
with archive.open('rb') as source:
    while chunk := source.read(1024 * 1024):
        digest.update(chunk)
config = {'repository': 'anicolao/pantheon', 'commit': subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD']).decode().strip(),
          'archiveSha256': digest.hexdigest(), 'archiveBytes': archive.stat().st_size,
          'url': f'https://github.com/anicolao/e2e-baselines/releases/download/{tag}/pantheon-runtime-source.tar.gz',
          'excludedDirectories': sorted(excluded_dirs), 'excluded': 'tests/e2e/**/*.png'}
(framework / 'poc/pantheon/source.json').write_text(json.dumps(config, indent=2) + '\n')
print(json.dumps(config, indent=2))
