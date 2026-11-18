---
description: "Pinned DSH upgrades, compatibility CI and rollback ownership."
kind: "maintenance-guide"
---

# Upstream updates

[中文](upstream-sync.zh.md)

## Summary

Production dependencies stay on an exact DSH release. Upgrade a separate integration branch and retain the previous application commit, lockfile and data backup until the new release is accepted.

## Contents

- [Upgrade](#upgrade)
- [Compatibility CI](#compatibility-ci)
- [Rollback](#rollback)

## Upgrade

Create `integration/dsh-<exact-version>` from the accepted application branch. Review official release notes, published package exports, Profile configuration, Session format and storage migrations. Set all DSH package pins with `node scripts/set-dsh-version.mjs <exact-version>`, then resolve a new lockfile with `pnpm install --no-frozen-lockfile`. Update Cordis peers explicitly if required by that release.

The version script clears the old upstream commit when changing releases; record the reviewed candidate commit in `config/dsh-baseline.json`. Update adapter methods and consumers together. Run `pnpm check`, broker integration tests, authenticated frontend/backend checks and real model task scenarios before merging. These are the maintenance procedure, not a claim that an upgrade candidate has already passed.

## Compatibility CI

`.github/workflows/compatibility.yml` runs the production baseline for pushes and pull requests. A manual run with an exact `candidate` input also checks the candidate in an independent checkout. Both use Redis, RabbitMQ and MQTT, build all custom packages and run protocol, lifecycle and composition tests. Missing brokers fail CI rather than skipping tests.

Default-branch upstream source is not tracked automatically; select explicit published candidates. Real model calls and production UI acceptance remain integration responsibilities requiring credentials. The initial local migration run passed builds, frontend typechecking and 42 tests before the requested application rename; 6 broker tests skipped because services were unavailable. No subsequent verification is claimed.

## Rollback

Keep the previous release commit and its lockfile; use a clean checkout of that commit and reinstall its frozen lockfile, then rebuild. Preserve `.runtime/dsh` before trying a new release. If an upgrade changes durable data, restore the matching pre-upgrade backup into the isolated home while the service is stopped; do not assume an older DSH version can read newer session generations. Do not delete or rewrite the user's original DSH home.

Each application plugin has its own semantic version and package exports. Review `pnpm pack` contents before an independent publication; a source export or source-relative path is not the runtime distribution. The first migration has no framework patches to replay.
