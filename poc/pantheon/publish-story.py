"""Import one accepted story and build its README from observed step records."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import io
import json
import subprocess
import tarfile
import sys

framework = Path(__file__).resolve().parents[2]
source = framework.parent / 'games/pantheon'
records = [json.loads(line) for line in Path(sys.argv[1]).read_text().splitlines()]
story = 'enter-the-sanctuary-learn-create-and-continue-a-real-table'
rows = [row for row in records if row['story'] == story]
assert rows and all(row['matches'] for row in rows)
manifest = json.loads((framework / 'poc/pantheon/baselines.json').read_text())
repository, tag = 'anicolao/e2e-baselines', 'story-sanctuary-001'
paths = [p for p in manifest['images'] if p.split('/')[-2] == story and p.endswith('-linux.png')]
assert len(paths) == len(rows), (len(paths), len(rows))
releases = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repository}/releases']))
release = next((r for r in releases if r['tag_name'] == tag), None)
if release is None:
    payload = json.dumps({'tag_name': tag, 'name': 'Pantheon sanctuary walkthrough',
                          'body': 'Imported original reviewed PNGs, with an original-byte backup archive.', 'draft': True}).encode()
    release = json.loads(subprocess.check_output(['gh', 'api', '--method', 'POST', f'repos/{repository}/releases', '--input', '-'], input=payload))
existing = {a['name']: a for a in release['assets']}

def upload(path):
    image = manifest['images'][path]
    local = source / path
    assert hashlib.sha256(local.read_bytes()).hexdigest() == image['blobDigest'][7:]
    name = image['blobDigest'][7:] + '.png'
    asset = existing.get(name)
    if asset is None:
        endpoint = f"https://uploads.github.com/repos/{repository}/releases/{release['id']}/assets?name={name}"
        asset = json.loads(subprocess.check_output(['gh', 'api', '--method', 'POST', endpoint, '--header', 'Content-Type: image/png', '--input', str(local)]))
    assert asset['size'] == image['byteLength']
    assert asset['digest'] == image['blobDigest'], 'Uploaded bytes differ from the accepted PNG'
    return image['blobDigest'], {**image, 'release': tag, 'assetId': asset['id']}

# Deduplicate before uploads, including identical steps within this release.
unique = {manifest['images'][p]['blobDigest']: p for p in paths}
with ThreadPoolExecutor(max_workers=4) as pool:
    published = dict(pool.map(upload, unique.values()))
backup = framework / 'poc-output/sanctuary-originals.tar.gz'
with tarfile.open(backup, 'w:gz') as archive:
    for p in unique.values(): archive.add(source / p, arcname=p)
    body = json.dumps({p: manifest['images'][p] for p in paths}, indent=2).encode()
    info = tarfile.TarInfo('manifest.json'); info.size = len(body)
    archive.addfile(info, io.BytesIO(body))
if backup.name not in existing:
    subprocess.run(['gh', 'release', 'upload', tag, str(backup), '--repo', repository], check=True)
if release['draft']:
    subprocess.run(['gh', 'release', 'edit', tag, '--repo', repository, '--draft=false', '--latest=false'], check=True)
catalog_path = framework / 'poc/pantheon/catalog.json'
catalog = json.loads(catalog_path.read_text()); catalog['images'].update(published)
catalog_path.write_text(json.dumps(catalog, indent=2) + '\n')

def url(path):
    image = manifest['images'][path]
    return f"https://github.com/{repository}/releases/download/{published[image['blobDigest']]['release']}/{image['blobDigest'][7:]}.png"

def view(row, project):
    baseline = row['baseline'].replace('-darwin.png', '-linux.png')
    for original in ['phone', 'desktop', 'tabletop-4k']:
        suffix = f'-{original}-linux.png'
        if baseline.endswith(suffix): baseline = baseline[:-len(suffix)] + f'-{project}-linux.png'; break
    width = 240 if project == 'phone' else 720 if project == 'desktop' else 960
    address = url(baseline)
    return f'<a href="{address}"><img src="{address}" alt="{project}" width="{width}"></a>'

body = ['# Enter the sanctuary, learn, create and continue a real table', '',
        f"Original Linux baselines at `{manifest['source']['commit']}`. Images live in a separate public release repository.", '']
for row in [r for r in rows if r['project'] == 'desktop']:
    body += [f"## {row['caption']}", '']
    if row.get('player'): body += [f"Viewpoint: **{row['player']}**.", '']
    body += ['<table><tr><th>Desktop</th><th>Phone</th></tr>',
             f"<tr><td>{view(row, 'desktop')}</td><td>{view(row, 'phone')}</td></tr></table>", '',
             '<details><summary>4K screenshot</summary>', '', view(row, 'tabletop-4k'), '', '</details>', '']
    body += ['- [x] ' + assertion for assertion in row['assertions']] + ['']
folder = framework / 'poc/pantheon/stories' / story
folder.mkdir(parents=True, exist_ok=True)
(folder / 'README.md').write_text('\n'.join(body))
print(json.dumps({'images': len(published), 'originalBytes': sum(i['byteLength'] for i in published.values()), 'backupBytes': backup.stat().st_size, 'story': str(folder)}, indent=2))
