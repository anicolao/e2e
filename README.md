# E2E

Byte-exact screenshot checks with baselines stored in a separate public GitHub repository. Application repositories keep manifests; GitHub runners capture screenshots and check their hashes. Story READMEs embed the stored images for review.

This is the development home for a replacement for [`@machinapractica/testing`](https://github.com/machinapractica/packages/tree/main/packages/testing). We’ll prove it with Pantheon, then bring the reusable code into [Machina Practica packages](https://github.com/machinapractica/packages) and the agent skill into [Practica](https://github.com/machinapractica/practica).

Status: working prototype. Two independent full Linux runs pass with zero baseline downloads. [POC results](poc/pantheon/RESULTS.md) record the evidence and remaining cutover gates.

- [Framework proposal](E2E_FRAMEWORK_PROPOSAL.md): architecture, verification, storage, tools, and review.
- [Pantheon POC](E2E_POC_PANTHEON.md): experiments, acceptance checks, and storage recovery.
- [Writing style](STYLE_GUIDE.md): rules for project documents.

Follow [AGENTS.md](AGENTS.md) and record development prompts in [PROMPTS.md](PROMPTS.md).

Licensed under [GPL-3.0-only](LICENSE). See [LICENSES.md](LICENSES.md).

## Try the prototype

Requires Node 24.18.1 or later.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
npm run test:package
```

`src/index.ts` checks PNG hashes and ordered steps. `src/store.ts` fetches and verifies release images with a bounded cache. `src/diagnose.ts` builds image diffs after failed checks.

[Representative runner results](https://github.com/anicolao/e2e/actions/runs/39951440547) cover 540 Linux captures across three runners. [Read a complete story](poc/pantheon/stories/enter-the-sanctuary-learn-create-and-continue-a-real-table/README.md) with images served by [the public baseline store](https://github.com/anicolao/e2e-baselines).
