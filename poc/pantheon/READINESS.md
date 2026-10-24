# Pantheon readiness results

The final revision passes the complete suite on three fresh Linux runners and Mac: **5,776 byte-exact screenshots**, with unchanged two-second deadlines, zero retries, and zero baseline downloads.

[Application changes](https://github.com/anicolao/pantheon/compare/dfc7f6307b61a8885be870e841d83895811257d1...b37e8cefef820dba74dfa2db202cfcd665ae5a8b) · [Pinned source](source.json)

## Test fixes

- The observer already centered Obol before receiving “Ariadne browsed Obol.” The test now checks the new log entry too. A regression disconnects the observer, proves centering passes before delivery, then reconnects and checks the update.
- The rules test now waits for the heading to clear the sticky navigation before checking its position.
- The lab now waits for Trigger to become enabled before clicking. Previously, input was sent at 1,960 ms, leaving almost no time for the click to finish.
- The worship test records the real flight keyframes when the animation starts, then checks them after the overlay lands. Previously, it could inspect the animation after it had finished.

Required test identities use file, describe groups, title, and project, so moving source lines keeps the identity. The observer regression adds three required cases, bringing the suite to 432.

## Runner storage

The [disk-based run](https://github.com/anicolao/e2e/actions/runs/40044348980) exposed a storage stall. Chromium queued a purchase commit for **4,588 ms before sending it**; the emulator then responded in **53 ms**. I/O wait was elevated before failure and reached **99.5%** during diagnostics. A connection failure also overlaps heavy I/O wait. The longest recorded GC pause was 48 ms.

[Request timings and CPU samples](results/runner-io-stall.json)

Timed Linux runs now use a **4 GiB RAM workspace** for the application, Chromium, browser profiles, emulator files, and output. Reports move to disk after testing. Sampled workspace use peaked at **3.18 GiB**, with at least **8.06 GiB** of runner memory available. The largest recorded browser request queue was **6.4 ms**. Firestore stays at 1.22.0.

The earlier 3,232 ms read lacked browser network timing, so its exact cause remains unproven. The new evidence shows why request duration alone cannot identify an emulator problem. [Earlier failure](results/readiness-stalls.json)

## Final verification

All runs below use `b37e8cef` and emulator 1.22.0:

| Run | Passed / declared skips | Matching captures |
| --- | --- | --- |
| Linux RAM runner 1 | 383 / 49 | 1,444 / 1,444 |
| Linux RAM runner 2 | 383 / 49 | 1,444 / 1,444 |
| Linux RAM runner 3 | 383 / 49 | 1,444 / 1,444 |
| Mac | 384 / 48 | 1,444 / 1,444 |
| Focused Linux disk checks, nine repetitions | 198 / 72 | 414 / 414 |

Every full run passed its required test inventory and ordered screenshot inventory. Screenshot hashing took about 1.4 ms at the Linux median and at most 24.3 ms.

[Linux run](https://github.com/anicolao/e2e/actions/runs/40047998663) · [Linux results and resource measurements](results/linux-memory-full.json) · [Mac results](results/macos-readiness-complete.json) · [Focused checks](results/disk-regressions-final.json)

The [ledger](results/experiments.json) retains failures, version comparisons, and the reverted navigation experiment. Before the final flight fix, two Linux 1.22 runners passed and one failed; all three 1.21 runners passed. [1.22 results](results/linux-final-disk-1.22.0.json) · [1.21 results](results/linux-final-disk-1.21.0.json)

## Transport and publication

[Three transport probes](TRANSPORT.md) passed with 9,000 fresh browser clients and 84,000 timed operations across both emulator versions. They cover basic reads, live event listeners, and 9,000 full page reloads. Their slowest operation took 446 ms.

[Cloud capture and separate publication](results/memory-cloud-capture.json) also passed from the RAM workspace. The publisher verified and reused six accepted images, recording tested and baseline source revisions separately. [Initial POC results](RESULTS.md) cover README review and backups.

## Next stage

Review the baseline-change workflow and publish the complete image set, then switch Pantheon to the framework. The [POC plan](../../E2E_POC_PANTHEON.md) covers application cutover and Git history cleanup.
