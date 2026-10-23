# Pantheon readiness results

Three checks now wait for the state they need. Actions and readiness waits retain their two-second limits; accepted image hashes stay unchanged.

[Application changes](https://github.com/anicolao/pantheon/compare/dfc7f6307b61a8885be870e841d83895811257d1...b6f1b59ed3abf4c5ae9158685a0cfbf8e96f8037) · [Current source](source.json)

## Fixes

- The observer already centered Obol before receiving “Ariadne browsed Obol.” The test now checks the new log entry too. A regression disconnects the observer, proves centering passes before delivery, then reconnects and checks the update.
- The rules test read a heading’s position once after checking a selection that could already be true. It now waits for the heading to clear the sticky navigation.
- The lab’s Trigger click spent almost its entire deadline waiting for initialization: input was sent at 1,960 ms. The test now waits for the enabled button before clicking, as other lab tests do.

Required test identities now use file, describe groups, title, and project, so moving source lines keeps the identity. The observer regression adds three required cases, bringing the suite to 432.

## Full-suite verification

These runs used `0ea155fe`, before the final lab fix:

| Run | Passed / skipped / failed | Matching captures |
| --- | --- | --- |
| Linux 1 | 383 / 49 / 0 | 1,444 / 1,444 |
| Linux 2 | 383 / 49 / 0 | 1,444 / 1,444 |
| Linux 3 | 381 / 49 / 2 | 1,433 / 1,433 |
| macOS | 384 / 48 / 0 | 1,444 / 1,444 |

[Linux run](https://github.com/anicolao/e2e/actions/runs/40025833881) · [Linux results](results/linux-readiness-full.json) · [Mac results](results/macos-readiness-full.json)

Linux 3 failed on a gain update and Trigger. Coverage checks reject both failures, including the nonvisual lab test. Eleven later captures were missing. Every recorded PNG matches its imported hash. The earlier connection stall and phone pixel difference did not recur.

## Lab fix and emulator comparison

The final source, `b6f1b59e`, passed the affected gain and tabletop staging stories:

| Environment | Passed / declared skips | Matching captures |
| --- | --- | --- |
| Linux, emulator 1.22.0: nine repetitions across three runners | 171 / 72 | 414 / 414 |
| Linux, emulator 1.21.0: nine repetitions across three runners | 171 / 72 | 414 / 414 |
| macOS, emulator 1.22.0 | 19 / 8 | 46 / 46 |

[1.22.0 results](results/emulator-1.22.0.json) · [1.21.0 results](results/emulator-1.21.0.json) · [Mac results](results/macos-regressions.json)

## Remaining latency issue

The failed gain update includes a Firestore `batchGet` taking **3,232 ms**. This exceeds the budget; the failure remains valid. [Diagnostic summary](results/readiness-stalls.json)

A [Firebase report of similar stalls](https://github.com/firebase/firebase-tools/issues/11163) prompted the version comparison. Neither version reproduced our slow read. Their longest GC pauses were 20.3 ms and 17.3 ms; the original failure lacked GC logs. These samples do not establish its cause.

We’ll keep emulator 1.22.0 and retain request timings, connection stages, long tasks, server logs, and GC logs. Screenshot failures also save browser state and a diagnostic follow-up image while retaining the failed comparison. Cutover remains gated on resolving the latency issue and completing baseline review and storage.

## Other evidence

[Focused Mac checks](results/readiness-final.json) passed 45 cases and 207 captures; [focused Linux checks](results/readiness-original-linux.json) passed 108 cases and 621 captures.

[Cloud capture](https://github.com/anicolao/e2e/actions/runs/40026686029) and the [separate publisher](https://github.com/anicolao/e2e-baselines/actions/runs/40028903205) passed against `0ea155fe`, reusing six images. The [receipt](results/readiness-cloud-publication.json) records tested and baseline source revisions separately.

The [ledger](results/experiments.json) retains the failed client-navigation experiment. Local Nix setup now evaluates just the unchanged flake and lock files; we removed the two temporary 16 GB source copies made during setup.
