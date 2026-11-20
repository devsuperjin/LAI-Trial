# LAI Development Guide

**English** | [简体中文](development.zh-CN.md)

For maintainers and plugin authors. For user configuration see [Guide](guide.md), for system ownership see [architecture](architecture.md), and for repository rules see [AGENTS.md](../AGENTS.md).

## DSH application development conventions

LAI maintains its extensions in an independent application repository. The current official DSH baseline is **`0.2.2-rc.1`**, recorded in [`config/dsh-baseline.json`](config/dsh-baseline.json).

### Dependencies and plugin composition

- Use the **`@lai`** namespace for application packages. Pin official DSH dependencies and peers to the baseline version.
- Extend DSH through published exports, **Bundle / Profile composition and environment overlays**.
- Do not copy or edit official DSH framework source or import private build paths.
- Keep DSH version differences and the browser RPC protocol in **`packages/dsh-adapter`**.
- Preserve Superagent's ownership of events, routing and task lifecycle. New CI / GitHub inputs should use its Source mechanism without adding a parallel trigger layer or MQ dependency.

### Agents and lifecycle

- Define specialist roles in `plugins/lai-agents`. LAI Orchestrator instances must invoke native child agents; independent root sessions do not replace parent–child relationships.
- Enforce stage order through runtime guards rather than relying only on prompt instructions.
- Own tool, event, prompt and service registrations through Cordis lifecycle effects and dispose them correctly.
- On shutdown or unload, await task cancellation, child termination and LAI Orchestrator cleanup before releasing dependencies.
- Preserve native sessions, tool calls, execution receipts and durable records so lai-web and the original DSH interface can inspect the same execution.

### Configuration, data and credentials

- Store application defaults in repository configuration and user overrides in the runtime Profile. Upgrades and migrations must preserve existing model settings, credentials and sessions.
- Save configuration through settings interfaces with revision checks to avoid overwriting concurrent changes.
- Manage credentials through DSH's credential interface. Keep them out of committed configuration, source and examples.
- Keep `.runtime` separate from other user DSH data and excluded from Git.

### Validation and upstream upgrades

For integration changes, run:

```sh
pnpm check
```

This checks architecture, builds, types and local tests, including Superagent fixtures. Pipeline tests use deterministic drivers and local data. Real-model validation is separate and incurs actual API costs.

Upgrade DSH on a separate integration branch. Select an exact release, update dependencies and the lockfile, review public interfaces and persistence formats, and complete compatibility checks before merging. The repository provides a version-update script:

```sh
node scripts/set-dsh-version.mjs <exact-version>
pnpm install --no-frozen-lockfile
pnpm check
```

Update the baseline record and retain the previous code, lockfile and matching data backups. When updating Superagent business logic, preserve LAI's LAI Orchestrator preset, sequential guards, management API authentication and own-Issue configuration.

## Development commands

| Command | Purpose |
| --- | --- |
| `pnpm start` | Build and start the unified application |
| `pnpm build` | Build all workspace packages |
| `pnpm start:backend` | Start the backend from existing builds without opening a browser |
| `pnpm dev:web` | Start the frontend development server; requires a backend |
| `pnpm config:dump` | Inspect the composed DSH configuration |
| `pnpm check:architecture` | Check namespaces, dependency versions and import boundaries |
| `pnpm check` | Run the complete local check suite |

## Branches and component versions

Start new plugins on dedicated branches from current main and merge through PRs, never direct additions on main. Every component update, including docs, bumps its manifest in the same commit/PR: patch for compatible fixes/docs, minor for features, major for breaking changes unless explicitly specified. Application-wide changes also bump the root manifest; the official DSH baseline is independent.

## Web directories

`app/lai-web/src/router/routes.tsx` owns routes, menu metadata, page headings and rendering. `layout/` owns shared chrome, headings, panels and tabs; `pages/` owns business pages; `components/` owns reusable widgets, without page aliases.

## Checks and task limits

The checks above are the normal workflow. Respect explicit user exclusions of tests, validation or browser use, and report the actual checks performed. A successful build does not imply passing tests. Real-model/external-service validation is separate; never put real tokens or passwords in logs or fixtures.

See also [the development architecture reference (Chinese)](development-architecture-reference.zh.md).
