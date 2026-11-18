---
description: "Independent LAI application and plugins over a pinned DeepSeek Harness release."
kind: "application-guide"
---

# LAI-Trial

[中文](README.zh.md)

## Summary

LAI Web monitors message-queue tasks, displays run dashboards and delegation graphs, and configures model routes. Five independent plugins and one Bundle extend the published DSH runtime without framework source patches.

## Contents

- [Run](#run)
- [Project layout](#project-layout)
- [Migration and maintenance](#migration-and-maintenance)

## Run

Use Node.js >=24.9 and pnpm 11.28.5. Install with `pnpm install --frozen-lockfile`, then build with `pnpm build`. Start the DSH backend with `pnpm start:backend` and LAI Web in another terminal with `pnpm dev:web`.

The backend defaults to `http://127.0.0.1:3080`; LAI Web runs at `http://127.0.0.1:5174`. Paste the backend's printed token into LAI Web. `LAI_WEB_TARGET` changes the development proxy destination. The Vite server is a development proxy; production hosting must implement the same authenticated, same-origin API forwarding.

Queue consumers are disabled by default. Copy `.env.example` to `.env`, provide the actual absolute workspace, model route and credentials, then select one overlay, for example `pnpm start:backend --patch config/development/redis.yml`. Redis, RabbitMQ, MQTT and the MQTT-based IQE pipeline have separate overlays. Configure model providers in LAI Web → Settings → Model providers. The frontend uses official DSH settings and credential APIs; selecting a provider in an MQ overlay still requires that route to be configured first.

## Project layout

```text
app/lai-web/             independent React frontend
packages/dsh-adapter/    version compatibility and browser RPC
plugins/                mq, mq-redis, mq-rabbitmq, mq-mqtt, prompt-sections
bundles/agent-mq-bundle/ optional capability composition
config/                 baseline pin, Profile, deployment overlays
patches/                core patch policy (no patches)
tests/                  protocol and migration compatibility
.github/workflows/      production baseline and optional candidate checks
```

## Migration and maintenance

The source is LAI `jin/agent-plugins` at `78d635a214476dbbde87a38d91452f9ff83b76b5`. Runtime dependencies are pinned to DSH `0.2.2-rc.1`; custom packages use the independent `@lai` scope and version `0.1.0`.

Read [architecture](docs/architecture.md), [upstream updates and rollback](docs/upstream-sync.md), and the exhaustive [159-file migration inventory](docs/migration-inventory.json). The old branch omits four frontend model modules; this repository supplies them under `app/lai-web/src/model` and records them explicitly in that inventory.

The application uses `.runtime/dsh` for its Profile, configuration and session data. Existing user DSH homes are not imported or modified. The local `.reference/lai` clone is ignored and is not required by installation, builds or CI.

`pnpm check` runs architecture checks, builds, typechecking and tests. Broker tests skip locally without reachable services; CI supplies all three brokers and requires them. Live model calls and production deployment require separate integration validation.
