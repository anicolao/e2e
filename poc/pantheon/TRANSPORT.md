# Firebase transport checks

Three probes passed with **9,000 fresh browser clients and 84,000 timed operations**. Each probe ran 500 clients on three fresh ARM runners per emulator version, using Firestore 1.21.0 and 1.22.0.

| Probe | Clients | What it exercises | Slowest operation |
| --- | --- | --- | --- |
| [Basic reads](results/transport-rooms.json) | 3,000 | Anonymous sign-in, server read, read-only transaction | 256 ms |
| [Event listener](results/transport-events.json) | 3,000 | Create a room and event through security rules, listen for server confirmation, read in a transaction | 382 ms |
| [Page reloads](results/transport-reloads.json) | 3,000 | Keep the event listener active, reload three times, reconnect, and repeat the reads | 446 ms |

Every operation retains its two-second limit. The reload probe completed 9,000 full page reloads. These checks use Pantheon’s Firebase SDK, security rules, browser launch flags, and pinned emulator binaries. They isolate Firebase traffic; full stories exercise it alongside gameplay and rendering.

The probes did **not reproduce** the earlier 3,232 ms read. They give us no reason to change emulator versions. The [full-suite investigation](READINESS.md#runner-storage-stall) found a browser request queued during heavy runner I/O wait. Diagnostics record browser network timing, runner CPU and memory, GC logs, and JVM threads after failures.

## Reproduce

```sh
gh workflow run pantheon-transport.yml -f clients=500 -f mode=rooms
gh workflow run pantheon-transport.yml -f clients=500 -f mode=events
gh workflow run pantheon-transport.yml -f clients=500 -f mode=reloads
```

The workflow tests both emulator versions on three runners each. Results include stage timings and the bundled client hash. A failed operation stays failed while diagnostics wait up to ten seconds for its eventual result. The probe stops after five failed clients.

The first event-listener experiment was cancelled because the probe omitted `includeMetadataChanges`, which its server-confirmation check requires. After fixing that bug, small listener and reload checks passed before the larger runs. [Cancelled experiment](https://github.com/anicolao/e2e/actions/runs/40045409589)
