# Pantheon readiness results

Four test fixes preserve the checks they intended to make. Actions and assertions retain their two-second limits, and accepted image hashes stay unchanged.

[Application changes](https://github.com/anicolao/pantheon/compare/dfc7f6307b61a8885be870e841d83895811257d1...b37e8cefef820dba74dfa2db202cfcd665ae5a8b) · [Current source](source.json)

## Test fixes

- The observer already centered Obol before receiving “Ariadne browsed Obol.” The test now checks the new log entry too. A regression disconnects the observer, proves centering passes before delivery, then reconnects and checks the update.
- The rules test read a heading’s position once after checking a selection that could already be true. It now waits for the heading to clear the sticky navigation.
- The lab’s Trigger click spent almost its entire deadline waiting for initialization: input was sent at 1,960 ms. The test now waits for the enabled button before clicking.
- The worship flight could finish before the test inspected its active animations. The test now records the real keyframes when the animation starts, then checks them after the overlay lands. All three screen sizes pass locally.

Required test identities use file, describe groups, title, and project, so moving source lines keeps the identity. The observer regression adds three required cases, bringing the suite to 432.

## Runner storage stall

The [latest disk-based run](https://github.com/anicolao/e2e/actions/runs/40044348980) identified a storage stall. Chromium queued a purchase commit for **4,588 ms before sending it**; the emulator then responded in **53 ms**. Runner samples show **99.5% I/O wait** during the delay. A connection failure also overlaps heavy I/O wait. The separate flight failure was the animation observation race described above.

[Request timings and CPU samples](results/runner-io-stall.json)

We’re testing a **4 GiB RAM workspace** for the application, Chromium, browser profiles, emulator files, and output. Reports move to disk after testing. The run samples workspace use, memory, CPU, and I/O pressure. Firestore stays at 1.22.0.

The earlier 3,232 ms read lacked browser network timing, so its exact cause remains unproven. The new evidence shows why request duration alone cannot identify an emulator problem. [Earlier failure](results/readiness-stalls.json)

## Verification before the final flight fix

These full runs used `b6f1b59e`:

| Environment | Passed / skipped / failed | Matching captures |
| --- | --- | --- |
| Linux, emulator 1.22.0, runner 1 | 383 / 49 / 0 | 1,444 / 1,444 |
| Linux, emulator 1.22.0, runner 2 | 383 / 49 / 0 | 1,444 / 1,444 |
| Linux, emulator 1.22.0, runner 3 | 380 / 49 / 3 | 1,439 / 1,439 |
| Linux, emulator 1.21.0, all three runners | 1,149 / 147 / 0 | 4,332 / 4,332 |
| macOS, emulator 1.22.0 | 384 / 48 / 0 | 1,444 / 1,444 |

[Linux 1.22 results](results/linux-final-disk-1.22.0.json) · [Linux 1.21 results](results/linux-final-disk-1.21.0.json) · [Mac results](results/macos-readiness-final-full.json)

Every captured PNG matches. Coverage checks reject the failed run, including its nonvisual animation failure and five missing screenshots. The [ledger](results/experiments.json) retains earlier runs and the reverted navigation experiment.

## Transport checks

[Three probes](TRANSPORT.md) passed with 9,000 fresh browser clients and 84,000 timed operations across both emulator versions. They cover basic reads, live event listeners, and 9,000 full page reloads. Their slowest operation took 446 ms.

The simple transport probes didn’t reproduce the full-suite stall. Browser network timings and runner resource samples supplied the missing evidence.

## Remaining rollout work

Complete verification of the RAM workspace and final test revision, then review the baseline-change workflow and publish the complete image set before application cutover.

[Cloud capture and publication](results/readiness-cloud-publication.json) already proved separate test and publisher workflows, reusing six accepted images and recording tested and baseline source revisions separately. [Initial POC results](RESULTS.md) cover README review and backups.
