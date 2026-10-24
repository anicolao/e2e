# Pantheon E2E proof of concept

Prove [the framework](E2E_FRAMEWORK_PROPOSAL.md) on Pantheon, then recover the space used by its baseline images and Git history.

## Starting point

Pantheon lives at `../games/pantheon`. Measurements from October 23, 2026:

| Area | Size |
| --- | --- |
| Checkout including Git | 102 GB |
| `.git` | 83 GB |
| E2E screenshots | About 15 GB: 1,528 images per platform |

CI currently downloads both Linux and macOS screenshots. Its helper captures PNGs through CDP with `optimizeForSpeed: true` and compares decoded pixels using `sharp`.

Work on a separate branch and record its commit. Keep the application, stories, renderer, and capture settings fixed while testing hash comparison. Keep the original images and verifier for rollback.

Take the exact environment from `playwright.config.ts` and `.github/workflows/ci-and-deploy.yml`. The current Linux setup uses `ubuntu-24.04-arm`, a digest-pinned Playwright 1.61.1 Noble container, Bun 1.3.10, DPR 1, `en-CA`, `America/Toronto`, and one browser worker.

Keep phone 393 × 852, desktop 1440 × 1000, and tabletop 3840 × 2160 coverage, with separate Linux and macOS baselines. Preserve the behavioral, readiness, animation, layout, and viewpoint checks in `E2E_GUIDE.md`, including the shared 2,000 ms capture deadline.

## 1. Prove byte repeatability

List every baseline and story image link. Record path, story, step, viewpoint, viewport, environment, dimensions, byte length, and SHA-256. Count unique hashes to measure how much storage sharing will save.

Choose examples of gameplay, other players’ views, phone and 4K screens, artwork-heavy screens, documents, and paused animations. Repeat them three times in fresh browser sessions, then across three independent Linux runner jobs. Corresponding PNG hashes must match.

Compare new captures with accepted images. Use the existing pixel comparison to explain differences. If only the old PNG encoding differs, review the new captures as a baseline change. Resolve unstable captures before proceeding.

## 2. Integrate one story

Adapt `tests/e2e/helpers/test-step-helper.ts` for one complete story across all viewports:

- Import original-image hashes into manifests with stable step IDs.
- Replace reference decoding with SHA-256 and byte-length comparison.
- Keep readiness, layout, capture, and hashing within the shared deadline.
- Record which steps ran, their hashes, timings, and failures.
- Fetch baselines and build diffs after the timed check.

Compare old and new results using the same captures. Run any extra pixel analysis after the timed check and report its cost separately.

The story must pass from an empty cache with zero baseline-image reads or downloads.

## 3. Prove storage and review

Publish one PNG to a public GitHub baseline repository with `Content-Type: image/png`. Embed its fixed release URL in the story’s README and check inline rendering and full-resolution access. Then publish the story’s images, record the catalog version, and test downloads and backup. Keep upload credentials in the publishing workflow.

Generate the walkthrough as `README.md` with embedded release images. Keep captions, assertions, player views, desktop/phone comparison, expandable 4K originals, and design links. Read it on GitHub to check the complete story.

Exercise the full lifecycle: generate a candidate, review it, publish images, update manifests, and run independent verification.

## 4. Exercise failures

| Experiment | Expected result |
| --- | --- |
| Visible image change | Failed comparison with useful diff |
| Encoding-only PNG change | Failed comparison labeled encoding-only |
| Missing baseline or omitted, duplicate, reordered, or skipped step | Coverage or expectation failure |
| Wrong environment | Setup failure |
| Capture or hash exceeds 2,000 ms | Timeout |
| Missing or corrupt expected image | Diagnostic retrieval/integrity error; actual image retained |
| Store offline during a passing run | Verification succeeds from manifests |
| Candidate source or starting baseline changes | Publishing waits for an updated candidate |
| Missing test group | Incomplete candidate rejected |
| Concurrent upload of identical bytes | One stored image with a consistent catalog entry |
| Cache reaches its limit | Eviction keeps disk use bounded |

Test storage errors with fixtures; test capture, behavior, and deadlines in the browser.

## 5. Run the full suite

Run every required story, screen size, player view, and platform. Update `scripts/check-e2e-policy.ts` and tooling tests. Check that every expected test and step ran.

Split generation into story groups, each with isolated emulators and one browser worker. Use a 4 GiB RAM workspace for the application, browser profiles, services, and test output, then copy reports to disk after testing. Measure peak workspace, memory, and disk use.

Update generated READMEs and `FIDELITY.md` links to use release images. Review a complete story on GitHub from a fresh application commit.

Run the full Linux suite twice on independent fresh runners. Repeat the supported macOS suite before its cutover. Record every run’s results, including failures.

Accept the POC when the full suite passes with repeatable PNG bytes and the existing checks and deadlines. Passing runs download no baselines; failed runs fetch only the images they need. README review, backups, and generation within the disk budget must also work.

## 6. Switch Pantheon

After review:

1. Publish and back up the accepted image set.
2. Commit manifests, storage lock, framework integration, policy checks, and updated documentation links.
3. Remove baseline PNGs from the application tree and replace the CI image-download step.
4. Keep generated images, reports, and caches in temporary or ignored locations.
5. Verify the full suite from a fresh checkout and empty cache.

This should save about 15 GB per checkout. Measure the actual saving and storage used by unique images. Historical images remain in Git until the next step.

## 7. Recover Git history

Prepare and rehearse a history cleanup in a separate clone. Identify the exact screenshot paths, measure their historical size, and preserve product artwork and design assets.

Use the findings to plan the history cleanup. List the historical images we’ll keep, backups, old-to-new commit mappings, affected branches and tags, collaborator steps, and rollback. Get approval for that plan before changing published history.

Measure a fresh clone after the cleanup. Report repository savings and archive/backup space separately. Measure how much of the current 83 GB Git history we can reclaim.

## Results

Write a short report with the source commit, environment, framework version, commands, tests and steps run, repeatability results, failure tests, a sample README, published image references, and backup checks.

Compare old and new setup time, capture time, transfer bytes, peak disk use, and checkout size. Report history recovery separately once completed. Use the results to finish the new-project initializer and skill.
