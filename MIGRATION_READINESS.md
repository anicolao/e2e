# Pantheon migration readiness

The verification PoC passes, but two rollout gates remain before opening the migration PR.

## Publish the complete baselines

The live store catalog contains 24 images. Pantheon’s active Linux and Mac baselines require 2,528 unique images across 2,888 screenshot paths. We still need to publish and back up **2,504 images totaling 13,113,148,842 bytes**.

Import the existing accepted bytes, audit every published hash and backup, then pin the complete catalog in Pantheon. This supplies the images needed by failure reports and story READMEs before the PR removes local PNGs.

## Finish the baseline-change workflow

The current publisher accepts only six existing Linux Oracle captures. It proves the transport and storage path, but cannot publish arbitrary stories or reviewed visual changes.

Connect complete candidates, review approval, publication, manifest updates, and independent verification. Exercise that path before replacing Pantheon’s current baseline-update command. The candidate validation library already checks source, starting manifest, environment, coverage, and approval digest.

## Keep the PR focused

Published Pantheon `main` is `4a14001a352d2ccdc2a1e5883bca9414284b21ca`. The tested revision, `b37e8cefef820dba74dfa2db202cfcd665ae5a8b`, also includes nine bot-development commits that are absent from published `main`.

Build the migration branch from published `main`, apply the four E2E test fixes, and add the framework integration, manifests, policy checks, CI changes, and release image links. Run complete Linux and Mac verification against that exact branch.

The PR will remove baseline PNGs from the current tree. Git history cleanup follows the separate approval step in the [POC plan](E2E_POC_PANTHEON.md).

## Evidence

- [Passing verification and resource measurements](poc/pantheon/READINESS.md)
- [Live store catalog](https://github.com/anicolao/e2e-baselines/blob/main/catalog.json), checked October 23, 2026
- [Publisher implementation](https://github.com/anicolao/e2e-baselines/blob/94a177db3855de275f2a88cc3f420e350d06020d/scripts/publish-seed.py)
- [Candidate validation](src/candidate.ts)
