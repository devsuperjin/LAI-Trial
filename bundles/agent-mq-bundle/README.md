---
description: "Compose prompt sections, the MQ runtime and three selectable queue backends as a DSH bundle. Runtime and broker rows are disabled until an environment overlay enables them."
kind: "package-bundle"
---

# @lai/dsh-agent-mq-bundle

[中文](README.zh.md)

## Summary

Compose prompt sections, the MQ runtime and three selectable queue backends as a DSH bundle. Runtime and broker rows are disabled until an environment overlay enables them.

## Contents

- [Use](#use)
- [Implementation and configuration](#implementation-and-configuration)
- [Limitations](#limitations)

## Use

Build with `pnpm build` from the repository root, then launch the isolated Profile. See the [architecture guide](../../docs/architecture.md) for environment overlays and configuration order.

## Implementation and configuration

The [source](src/index.ts) owns the configuration Schema and public exports; the [manifest](package.json) declares dependencies and exported paths.

The [Bundle](../../bundles/agent-mq-bundle/cordis.patch.yml) owns mounting; enable exactly one transport backend at a time.

## Limitations

Compatibility targets DSH `0.2.2-rc.1`. Live broker and model end-to-end behavior requires reachable services and credentials; local broker tests skip when services are absent. Tasks may be redelivered; producers and external writes must handle idempotency.

## Dev note

Plugin versions are independently set to `0.1.0`. Framework dependencies use exact versions; see [upstream updates](../../docs/upstream-sync.md) for upgrade and rollback procedures.
