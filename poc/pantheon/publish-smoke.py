"""Publish one previously accepted PNG to exercise public README embedding."""
from pathlib import Path
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[2]
manifest = json.loads((root / 'poc/pantheon/baselines.json').read_text())
path, image = min(manifest['images'].items(), key=lambda item: item[1]['byteLength'])
source = root.parent / 'games/pantheon' / path
assert hashlib.sha256(source.read_bytes()).hexdigest() == image['blobDigest'][7:]
repository = 'anicolao/e2e-baselines'
tag = 'png-smoke-001'
releases = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repository}/releases']))
release = next((r for r in releases if r['tag_name'] == tag), None)
if release is None:
    subprocess.run(['gh', 'release', 'create', tag, '--repo', repository, '--draft', '--title', 'PNG README smoke test', '--notes', 'Previously accepted Pantheon rules screenshot; original bytes.'], check=True)
    releases = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repository}/releases']))
    release = next(r for r in releases if r['tag_name'] == tag)
endpoint = f"https://uploads.github.com/repos/{repository}/releases/{release['id']}/assets?name={image['blobDigest'][7:]}.png"
asset = next((a for a in release['assets'] if a['name'] == image['blobDigest'][7:] + '.png'), None)
if asset is None:
    asset = json.loads(subprocess.check_output(['gh', 'api', '--method', 'POST', endpoint, '--header', 'Content-Type: image/png', '--input', str(source)]))
if release['draft']:
    subprocess.run(['gh', 'release', 'edit', tag, '--repo', repository, '--draft=false', '--latest=false'], check=True)
entry = {**image, 'release': tag, 'assetId': asset['id']}
catalog = {'schemaVersion': 1, 'repository': repository, 'images': {image['blobDigest']: entry}}
(root / 'poc/pantheon/catalog.json').write_text(json.dumps(catalog, indent=2) + '\n')
url = f"https://github.com/{repository}/releases/download/{tag}/{image['blobDigest'][7:]}.png"
(root / 'poc/pantheon/README.md').write_text(f'''# Pantheon: rules screenshot\n\nThis accepted screenshot is stored as a public release asset. Open the image for its original resolution.\n\n[![Open the illustrated rules]({url})]({url})\n\nSource: `{manifest['source']['commit']}` · Phone: 393 × 852 · PNG: {image['byteLength']:,} bytes\n''')
print(json.dumps({'url': url, 'contentType': asset['content_type'], 'image': image}, indent=2))
