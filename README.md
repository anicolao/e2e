# E2E

Byte-exact screenshot checks with baselines stored in a separate public GitHub repository. Application repositories keep manifests; GitHub runners capture screenshots and check their hashes. Story READMEs embed the stored images for review.

This is the development home for a replacement for [`@machinapractica/testing`](https://github.com/machinapractica/packages/tree/main/packages/testing). We’ll prove it with Pantheon, then bring the reusable code into [Machina Practica packages](https://github.com/machinapractica/packages) and the agent skill into [Practica](https://github.com/machinapractica/practica).

Status: agreed design; implementation starts with the Pantheon proof of concept.

- [Framework proposal](E2E_FRAMEWORK_PROPOSAL.md): architecture, verification, storage, tools, and review.
- [Pantheon POC](E2E_POC_PANTHEON.md): experiments, acceptance checks, and storage recovery.
- [Writing style](STYLE_GUIDE.md): rules for project documents.

Follow [AGENTS.md](AGENTS.md) and record development prompts in [PROMPTS.md](PROMPTS.md).

Licensed under [GPL-3.0-only](LICENSE). See [LICENSES.md](LICENSES.md).
