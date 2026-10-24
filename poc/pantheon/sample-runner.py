"""Sample Linux CPU, cgroup limits, and memory alongside the browser run."""
from pathlib import Path
from datetime import datetime, timezone
import json
import sys
import time

paths = ['/proc/stat', '/proc/loadavg', '/proc/meminfo', '/sys/fs/cgroup/cpu.stat', '/sys/fs/cgroup/cpu.max', '/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory.events']
with Path(sys.argv[1]).open('w', buffering=1) as output:
    while True:
        sample = {'utc': datetime.now(timezone.utc).isoformat()}
        for path in paths:
            try:
                value = Path(path).read_text()
                if path == '/proc/stat': value = value.splitlines()[0]
                if path == '/proc/meminfo': value = '\n'.join(line for line in value.splitlines() if line.startswith(('MemTotal:', 'MemAvailable:', 'SwapFree:')))
                sample[path] = value.strip()
            except OSError:
                pass
        output.write(json.dumps(sample) + '\n')
        time.sleep(1)
