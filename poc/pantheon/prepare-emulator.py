"""Pin the diagnostic emulator binary independently of the Firebase CLI override."""
from pathlib import Path
import hashlib
import json
import sys
import urllib.request

version, cache = sys.argv[1], Path(sys.argv[2]).resolve()
expected = json.loads(Path(__file__).with_name('emulators.json').read_text())[version]
cache.mkdir(parents=True, exist_ok=True)
destination = cache / f'cloud-firestore-emulator-v{version}.jar'
def verified(path):
    if not path.exists() or path.stat().st_size != expected['byteLength']: return False
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024): digest.update(chunk)
    return digest.hexdigest() == expected['sha256']
if not verified(destination):
    temporary = destination.with_suffix('.download')
    try:
        with urllib.request.urlopen(expected['url'], timeout=60) as response, temporary.open('wb') as output:
            while chunk := response.read(1024 * 1024): output.write(chunk)
        if not verified(temporary): raise RuntimeError('Emulator download integrity failed')
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
print(json.dumps({'version': version, 'sha256': expected['sha256'], 'path': str(destination)}))
