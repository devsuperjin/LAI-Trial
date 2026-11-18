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


## Superagent business integration

The application imports `deepseek-ai/dsh-superagent-prototype` at commit `8c32a9dc5d72c033816c6a8110b37f40cf94fba4`. Its former `vendor/dsh-superagent` tree now lives in `plugins/superagent` as workspace package `@lai/superagent`; its MIT license is preserved. This is application business logic, not official DSH framework source.

When updating, compare against that upstream commit and preserve LAI changes: baseline-pinned peers, package-root/client module identity, authenticated management API, adapter-backed session reads, own-Issue intake opt-in, Worker preset selection and sequential native delegation guard. Keep Router admission/task lifecycle upstream-owned. Run `pnpm check`, including the imported fixture suite. Do not replace active SQLite state, DSH credentials or existing sessions during a code update.
