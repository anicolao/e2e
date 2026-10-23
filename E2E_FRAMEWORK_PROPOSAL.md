# E2E framework proposal

Store screenshots in a separate public GitHub repository. Keep their SHA-256 hashes with the application. Capture and verify on GitHub runners, fetching images when we need to review a change or diagnose a failure.

This will replace `@machinapractica/testing`. Pantheon will prove the design before we bring the code into Machina Practica packages and the skill into Practica. See [the POC plan](E2E_POC_PANTHEON.md).

## Verification

Each step captures a PNG and checks its SHA-256 hash and byte length against the manifest. The same hash identifies the stored image.

We’ll first prove that repeated captures produce identical bytes across fresh browser sessions and runner jobs. Compression and metadata can differ even when pixels match, so the capture environment includes the encoder settings.

A full run checks every required story, step, player view, screen size, and environment. At each step, check behavior, wait for the UI and artwork to settle, check layout, then capture and hash the PNG. Readiness, layout, capture, and comparison share a 2,000 ms deadline. Actions and assertions each get 2,000 ms. Use one browser worker per runner, explicit readiness checks, and zero retries.

Verifying a screenshot only requires checking its hash and length against the manifest, so we don’t need to download baselines or save matching screenshots.

When a comparison fails, save the screenshot, fetch and verify the baseline, and show both images with a diff. Label differences caused only by PNG encoding. Build the report after the timed check, with a separate timeout. If the download fails, keep the screenshot and explain the failure.

## Files and ownership

| Location | Contents |
| --- | --- |
| Framework repository | TypeScript package, Playwright adapter, CLI, agent skill, reusable workflows |
| Application repository | Tests, assertions, story text, design links, environment definitions, baseline manifests |
| Baseline repository | Image catalog, publication records, PNGs attached to GitHub Releases |
| Runner | Build, isolated services, browser, temporary candidates and failure reports |
| Developer machine | Local tools and a bounded image cache |

The application layout starts with:

```text
e2e/
  framework.config.ts
  environments.json
  suite.json
  stories/<story>.json
  baselines/<environment>/<story>.json
  storage.lock.json
tests/e2e/
  <feature>/<story>.spec.ts
```

Give stories, steps, and player views stable IDs. Number steps for display so inserting one leaves later IDs unchanged. List the required tests and steps, then check that each ran in order. Label runs of selected stories as diagnostic. A full run combines results from every test group.

A baseline entry contains:

```json
{
  "schemaVersion": 1,
  "storyId": "buy-action",
  "stepId": "purchase-confirmed",
  "viewpointId": "ariadne",
  "projectId": "tabletop-4k",
  "environmentDigest": "sha256:...",
  "blobDigest": "sha256:...",
  "byteLength": 5100000,
  "width": 3840,
  "height": 2160
}
```

Keep one manifest per story and environment. `storage.lock.json` records the store and exact catalog version, so each application commit keeps its own baselines.

Record exact versions and settings for the container, architecture, browser, Playwright, fonts, rendering, capture, screen size, DPR, locale, timezone, and motion preference. Fix visible URLs, seeds, names, and other variable input in each story. Check the environment before running tests.

## Steps and walkthroughs

One step API handles the action, assertions, readiness, layout, screenshot, and story text. Application helpers define what to wait for and what to check.

Stories use the production UI and isolated supporting services. Capture meaningful decisions, results, and what other players see. Test phone, desktop, and 4K sizes where the product supports them.

Generate each story’s `README.md` from its step records. Embed public release URLs from the catalog, using fixed release tags and hash filenames. Show desktop and phone images together, with expandable 4K images and links to the originals. GitHub renders the walkthrough directly. Failed stories show the steps completed before the failure.

Review the walkthrough against the accepted designs before approving baseline changes.

## Image storage

Upload original PNGs as GitHub Release assets with `Content-Type: image/png`, up to 512 images per release. Publish each batch as an immutable release. The catalog maps each hash to its repository, release, asset ID, filename, and byte length.

The storage API provides `has`, `get`, `publish`, and `audit`. Check downloaded hashes before using images. Cache writes are atomic; when the cache fills, remove the least recently used images.

Upload each unique hash once, verify the uploaded bytes, then commit the catalog. Merge concurrent catalog updates safely. Split generation into story groups and publish one batch at a time to limit temporary disk use.

Back up images and catalog records. Check new uploads and regularly check retained baselines. Keep images needed by current baselines, supported historical versions, pending changes, and reviews. Track storage growth.

GitHub’s [release limits](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases#storage-and-bandwidth-quotas) currently allow 1,000 assets per release, each under 2 GiB. Confirm account limits, runner capacity, and costs during setup.

## Baseline changes

1. Generate a candidate using the usual assertions and capture checks.
2. Review added, changed, and removed steps with full-resolution images, diffs, captions, assertions, viewpoints, and design references.
3. Publish reviewed images and the catalog, then update application manifests and the storage lock.
4. Run a separate full verification against the final source and proposed baselines.
5. Accept the application change through normal code review.

A candidate records the source, starting manifest, environment, and image hashes. Before publishing, check that it is complete, reviewed, and still matches the source and baselines.

Run application tests with read-only permissions. A workflow in the baseline repository checks candidates and uploads images using its own `GITHUB_TOKEN`. It reads artifacts from the public application repository with `actions: read` and publishes with `contents: write`. Deployment requires a full verification run.

## Tools and skill

| Command | Purpose |
| --- | --- |
| `e2e init` | Set up a new project |
| `e2e doctor` | Check configuration, environment, and inventory |
| `e2e verify [--remote] [--story ID]` | Verify a suite or diagnose one story |
| `e2e baseline generate [--remote]` | Capture a candidate |
| `e2e review CANDIDATE` | Review the illustrated changes |
| `e2e baseline publish CANDIDATE` | Publish images and prepare manifest changes |
| `e2e diagnose RUN` | Fetch failure images and build diffs |
| `e2e store audit` | Check stored images |
| `e2e cache prune` | Reclaim cache space |

Commands return readable output and JSON. Each run records the source commit, manifest and catalog versions, framework version, environment, tests and steps run, hashes, timings, and results.

The same package runs locally and on GitHub. Remote jobs check out a specific commit. To test uncommitted work, upload the selected changes and record their hash in the diagnostic result.

The skill explains how to write stories, wait for readiness, diagnose failures, review images, and accept baselines. Tools enforce the checks. Build capture and manifest comparison first, prove storage and README review on one Pantheon story, expand to its full suite, then package the initializer and skill.
