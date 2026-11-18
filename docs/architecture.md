---
description: "Application ownership, DSH composition and configuration layers."
kind: "architecture-overview"
---

# Architecture

[中文](architecture.zh.md)

## Summary

The application depends on published DSH packages; the framework is not copied into the product repository. `config/dsh-baseline.json` records the pinned release and the exact source commits used for migration.

## Contents

- [Ownership](#ownership)
- [Configuration](#configuration)
- [Compatibility](#compatibility)

## Ownership

| Owner | Responsibility |
| --- | --- |
| `app/lai-web` | React pages, task visualization, development API proxy |
| `packages/dsh-adapter` | Public gateway RPC envelopes and release-specific subagent completion |
| `plugins/mq` | Queue task parsing, dedicated Session lifecycle, result publication before acknowledgement |
| `plugins/mq-*` | Replaceable Redis, RabbitMQ and MQTT transport implementations |
| `plugins/prompt-sections` | Prompt sections and contexts through the public prompt service |
| `bundles/agent-mq-bundle` | Package-owned default plugin rows, with consumers disabled |
| Published DSH | Agent loop, persistence, authentication, model providers, tools and API services |

Each plugin has its own package manifest, Schema, README, tests and version. Runtime service imports use published package exports. The adapter converts the old source-only `waitForTreeWork` call into the release's public `waitForChildren` call; it does not modify the runtime.

## Configuration

`config/profile.json` selects the ordered official base and Web bundles, then the application Bundle. `scripts/prepare-profile.mjs` initializes only `.runtime/dsh/profiles/lai`, linking dependencies and the application patch. `scripts/run-dsh.mjs` delegates launching to the installed `dsh --profile lai` CLI.

Layers apply as Bundle defaults → application Profile patch → isolated home patch → ordered `--patch` environment overlays. The Profile patch disables `ui-settings-account` and `account-controller` by id. Development overlays enable one queue backend and supply deployment-specific values. Production examples use environment values and may be copied to ignored `*.local.yml` files. DSH patches replace whole configuration values; they do not deep-merge them.

The IQE overlay owns the orchestrator and six specialist presets, tool selection and personas. Model and workspace defaults come from `.env`. Keep credentials and user preferences outside Bundle defaults. Redis currently exposes host/port only; deployments needing authentication or TLS require a transport extension rather than silently ignoring those requirements.

## Compatibility

Custom MQ wire envelopes and session logging remain plugin-owned. No existing session generation or storage schema is rewritten. The new isolated home starts with independent state; existing users must retain their old home when evaluating a release. Automated migration checks cover configuration composition and complete source-file accounting, not copying existing user sessions.

`docs/migration-inventory.json` assigns every old diff file a target or an explicit disposition. Upstream-generated catalogs and allowlists are replaced by local package ownership and architecture checks. Official tool-cordis does not gain external MQ API entries; MQ consumers use plugin-owned documentation. Four frontend model modules absent from the source branch are reconstructed and marked separately.

No Core Patch is required. Future exceptions follow [the patch policy](../patches/README.md); integration and rollback follow [upstream updates](upstream-sync.md).
