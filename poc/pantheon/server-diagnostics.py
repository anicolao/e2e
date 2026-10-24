"""Capture the live emulator's threads after an already failed browser operation."""
from pathlib import Path
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

rows = subprocess.check_output(['ps', '-axo', 'pid=,command='], text=True).splitlines()
pids = [line.strip().split(' ', 1)[0] for line in rows if 'cloud-firestore-emulator' in line and '--project_id demo-pantheon' in line and '--port 8193' in line]
result = {'capturedUtc': datetime.now(timezone.utc).isoformat(), 'pids': pids}
if len(pids) == 1:
    for label, arguments in [('threads', ['Thread.print', '-l']), ('heap', ['GC.heap_info'])]:
        try:
            environment = dict(os.environ)
            environment.pop('JAVA_TOOL_OPTIONS', None)
            command = subprocess.run(['jcmd', pids[0], *arguments], timeout=3, capture_output=True, text=True, env=environment)
            result[label] = {'exitCode': command.returncode, 'stdout': command.stdout, 'stderr': command.stderr}
        except Exception as error:
            result[label] = {'error': str(error)}
output = Path(sys.argv[1]); output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + '\n')
