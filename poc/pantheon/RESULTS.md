# Pantheon POC results

The representative experiment passes: 540 Linux captures and 180 macOS captures match their original baseline PNGs byte for byte. Full-suite testing is underway; application cutover waits for its results.

## Evidence

| Check | Result |
| --- | --- |
| Linux repeatability | Three independent ARM64 runners × three repetitions × 60 captures; every hash matches |
| macOS repeatability | Three repetitions × 60 captures; every hash matches |
| Capture deadline | Representative tests pass with the existing shared 2,000 ms limit |
| Passing verification | Manifests loaded; baseline PNGs absent from the runner checkout |
| README review | All 24 sanctuary image references load at original dimensions, including expandable 4K |
| Image storage | Public immutable release assets, `image/png`, hash-checked downloads |
| Backup | Downloaded the sanctuary archive and verified all 24 references against 18 unique PNGs |
| Failure diagnosis | Re-encoding is labeled encoding-only; a one-pixel change produces a one-pixel diff; store outages retain the actual image |

[Linux run](https://github.com/anicolao/e2e/actions/runs/39951440547) · [Linux summary](results/representative-linux.json) · [macOS hashes](results/representative-macos.json) · [diagnostic examples](results/diagnostic-examples.json) · [walkthrough](stories/enter-the-sanctuary-learn-create-and-continue-a-real-table/README.md)

The source is Pantheon commit `dfc7f6307b61a8885be870e841d83895811257d1`. That local commit is unavailable from its GitHub remote, so runners use a [hash-checked source archive](source.json). It includes build/test inputs and runtime bot policies. Each runner creates a fresh source checkout, installs pinned dependencies, and runs the existing UI scenarios with the experimental comparison adapter.

## Storage

The original inventory has 3,056 PNGs totaling 15,974,706,904 bytes. Its 2,690 unique images total 13,939,114,896 bytes. All 1,556 local story image references resolve.

The sanctuary story has 24 references to 18 unique images: 82,773,045 bytes. Its verified original-byte backup is 82,696,551 bytes. The [public catalog](https://github.com/anicolao/e2e-baselines/blob/main/catalog.json) is pinned by [storage.lock.json](storage.lock.json).

GitHub loads images inside collapsed details too. Opening a README downloads the story’s images; passing test runs still need only hashes.

## What the full run found

Several baseline directories contain stale numbered files alongside the current steps. Sorting filenames therefore produces an incorrect step inventory. We’re recording the current suite’s steps separately, checking each capture against its existing hash, and preparing that inventory for independent verification.

The first full macOS attempt also found a motion-preference assertion failure and a real pixel difference in an observer view. These remain failures. The new diagnostic path identifies the changed pixels; the full suite has not met the adoption gate yet.

Pantheon’s original checkout, verifier, and baseline PNGs remain available. History cleanup follows the POC and its separate reviewed plan.
