"""Restore the original verifier in a disposable checkout for a focused control run."""
from pathlib import Path
import json
import subprocess
import sys

framework = Path(__file__).resolve().parents[2]
original = Path(sys.argv[1]).resolve()
control = Path(sys.argv[2]).resolve()
if original == control or not (control / '.e2e-poc').is_dir():
    raise RuntimeError('Use a disposable POC checkout')
config = json.loads((framework / 'poc/pantheon/source.json').read_text())
for file in ['tests/e2e/helpers/test-step-helper.ts', 'tests/e2e/helpers/fixtures.ts']:
    (control / file).write_bytes(subprocess.check_output(['git', '-C', str(original), 'show', config['commit'] + ':' + file]))
manifest = json.loads((framework / 'poc/pantheon/baselines.json').read_text())
for path in manifest['images']:
    if '/follow-worship-and-a-purchase-once-while-reconnecting-without-an-animation-backlog/' in path and path.endswith('-darwin.png'):
        target = control / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists(): target.symlink_to(original / path)
print('Original verifier restored; selected reference PNGs are symlinks to the original checkout')
