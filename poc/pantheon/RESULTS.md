# Pantheon POC results

[Readiness follow-up](READINESS.md): investigation and fixes after these initial results.

Hash verification works on Pantheon’s existing PNGs. Two independent fresh Linux runners each passed all 380 required tests and 1,444 captures, with zero baseline downloads. Other runs found UI instability that keeps the application cutover gated.

## Full-suite results

Each Linux run collected 429 cases, including 49 declared platform skips. macOS has 48 declared skips. Capture checks keep the original shared 2,000 ms deadline, with one browser worker and zero retries.

| Run | Passed / failed tests | Matching / recorded captures |
| --- | --- | --- |
| Linux verification, runner 1 | 380 / 0 | 1,444 / 1,444 |
| Linux verification, runner 2 | 380 / 0 | 1,444 / 1,444 |
| Linux verification, runner 3 | 378 / 2 | 1,437 / 1,437 |
| macOS verification | 380 / 1 | 1,440 / 1,441 |

[Linux run](https://github.com/anicolao/e2e/actions/runs/39959408828) · [Linux results](results/linux-full-strict.json) · [macOS results](results/macos-full-strict.json)

Runner 3 failed while waiting for a connection and checking a rules heading’s position. Seven captures were therefore missing; the coverage check rejects that run. Its captured images have no hash differences. The earlier [Linux discovery run](results/linux-full-discovery.json) also captured only matching PNGs: 4,322 across three runners, with two UI assertion failures and one complete passing suite.

The macOS failure changes 62,613 pixels in the 4K observer view’s activity log. An earlier phone observer mismatch changed 1,027 pixels; the [original pixel verifier](results/original-verifier-control.json) reproduced that failure and captured exactly the same PNG hash. These failures require investigation before macOS cutover.

The initial experiment used Pantheon commit `dfc7f6307b61a8885be870e841d83895811257d1` and its [source archive](https://github.com/anicolao/e2e-baselines/releases/tag/poc-source-003). The [current fixture](source.json) includes the readiness follow-up. Archives include build/test inputs and runtime bot policies. Each runner installs pinned dependencies and runs the existing UI scenarios with the [comparison adapter](adapter.py).

## Repeatability and diagnosis

The [representative experiment](https://github.com/anicolao/e2e/actions/runs/39951440547) repeated three stories across phone, desktop, and 4K. All 540 Linux captures across three runners and all 180 macOS captures match their original PNGs byte for byte.

[Linux summary](results/representative-linux.json) · [macOS hashes](results/representative-macos.json) · [diagnostic examples](results/diagnostic-examples.json)

Failure tests distinguish encoding-only changes from changed pixels, detect a one-pixel edit, and retain the actual image when storage is unavailable. Framework tests also reject omitted or reordered steps, missing tests, unplanned skips, retries, stale candidate reviews, and corrupt downloads. Cache tests cover eviction and concurrent reads; package checks install the compiled package in a separate consumer.

## Storage and review

The original inventory has 3,056 PNGs totaling 15,974,706,904 bytes. Its 2,690 unique images total 13,939,114,896 bytes. All 1,556 local story image references resolve.

Each platform has 1,444 current captures and 84 stale numbered PNGs. We recorded the live step order separately and verified every retained step against its existing hash. The macOS stale files total 368,230,557 bytes. [Inventory](inventory-summary.json) · [Live steps](active-inventory.json)

The [sanctuary README](stories/enter-the-sanctuary-learn-create-and-continue-a-real-table/README.md) has 24 image references to 18 unique PNGs, totaling 82,773,045 bytes. Every image loads from the separate public store at its original dimensions. We downloaded its 82,696,551-byte backup and verified all references. [Catalog](https://github.com/anicolao/e2e-baselines/blob/main/catalog.json) · [Storage lock](storage.lock.json)

The [cloud capture run](https://github.com/anicolao/e2e/actions/runs/39966058715) generated six Oracle PNGs totaling 34,964,389 bytes. A [workflow in the store repository](https://github.com/anicolao/e2e-baselines/actions/runs/39966439384) fetched that artifact, checked every hash, published an immutable release and backup, downloaded both for verification, and committed the catalog. Its own `GITHUB_TOKEN` supplied the permissions. Only metadata came back to this machine.

[Publication receipt](results/cloud-publication.json) · [Oracle walkthrough](stories/oracle-draw-reveals-and-lands-in-its-sorted-hand-layer/README.md)

[Publishing the same run again](https://github.com/anicolao/e2e-baselines/actions/runs/39966554865) reused all six images and uploaded none. [Reuse receipt](results/cloud-publication-reuse.json)

These imports retain already accepted hashes. Reviewing and publishing a changed baseline remains a rollout gate.

GitHub loads images inside collapsed details too. Opening a README downloads the story’s images; passing tests still need only hashes.

## Next gates

The [final readiness checks](READINESS.md) pass on three fresh Linux runners and Mac. Pantheon adoption still needs the reviewed baseline-change workflow, a complete stored corpus and backup, and application integration. The initializer and agent skill follow those checks.

The source archive is 41.7 MB, versus 16.0 GB of baseline PNGs in the original tree. Full Linux runner logs show about 43 GB total filesystem use, including the runner image and build tools, with over 100 GB free. Hashing took about 1.4 ms per capture at the median and at most 18.5 ms across the strict Linux runs. A complete timing and peak-disk benchmark remains part of rollout.

Pantheon’s original checkout and baseline images remain available. This experiment has demonstrated the savings available from removing images; application and Git-history space recovery follow the reviewed cutover plan.

The [experiment ledger](results/experiments.json) includes earlier setup failures, the cancelled stale-inventory run, and local diagnostic attempts.

## Reproduce

Run framework checks with `npm run check`, `npm test`, and `npm run test:package`.

```sh
gh workflow run pantheon-poc.yml --repo anicolao/e2e -f mode=verify -f scope=full
gh workflow run pantheon-poc.yml --repo anicolao/e2e -f mode=seed -f scope=oracle
gh workflow run publish-seed.yml --repo anicolao/e2e-baselines -f source_run_id=SUCCESSFUL_SEED_RUN
```

Download evidence with `gh run download RUN --repo anicolao/e2e -D poc-output/RUN`. Analyze a full run with `E2E_POC_SCOPE=full E2E_POC_MODE=verify bun poc/pantheon/analyze.ts poc-output/RUN`; failed runs retain their coverage and comparison results. For a local Mac run, add `E2E_POC_PLATFORM=darwin`; its full-suite check expects one complete run.
