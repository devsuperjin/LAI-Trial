# LAI development

This is an independent DSH application repository. Read `docs/architecture.md` and `config/dsh-baseline.json` before changing integration code. Current design is in `docs/design.md` (Chinese: `docs/design.zh-CN.md`).

## Ownership and integration

- Keep application packages under `@lai`; pin official DSH peers to the baseline. Application versions and the DSH baseline are independent.
- Use published exports, Bundle/Profile composition and environment overlays. Do not copy or edit official framework source. `.reference` is ignored migration audit material; runtime, builds, tests and CI must not depend on it.
- `Superagent Router(Monitor)` owns intake, admission, assessment and routing as one business role. Its deterministic code and model session are implementation details, not extra agents.
- Each accepted task has a separate LAI Orchestrator (`iqe-orchestrator`) with five native child agents, strictly `triage → reproduce → ticket → review → reporter`. Keep actual child-history checks, failure/cancellation stops and per-Assignment progress boundaries.
- Sources submit provider-neutral Triggers through Superagent's public Source interface. Do not recreate the removed `lai-pipeline`, simulator or source-registration API; no broker/MQ dependency belongs in this application.
- Own registrations through Cordis effects. Await cancellation, child work and worker disposal before releasing dependencies. Preserve existing DSH sessions and user settings.
- Keep DSH version differences and browser protocols in `packages/dsh-adapter`; browser code must not import Node-only host modules.

## Web structure

- `app/lai-web/src/router/routes.tsx` is the only route/menu source: path, component, name, icon, order, group and visibility. Derive navigation, breadcrumbs and page headings from it.
- `src/layout/` owns chrome, page headers, gutters, panels, tabs and common actions. Titles belong outside content cards. Reuse these components instead of page-specific outer wrappers or heading styles.
- `src/pages/` owns page implementations; `src/components/` owns reusable widgets. Do not leave page files or compatibility page re-exports in components. Shared Run loading belongs in `components/RunDetailLoader.tsx`.

## Credentials and Skills

- `@lai/credentials` owns local credential settings/tools; `@lai/credentials/skill` registers instructions in the mounting preset scope. Five specialist presets mount the Skill and enable `skill` by default. Load bodies on demand; keep only the short discovery hint in role prompts.
- Tool selection, per-entry preset grants and update permission are separate. Check live `exec.agent.session.header.agentPreset`, entry enabled state and allowed presets on every access. `credentials_update` additionally requires `allowUpdates`; it cannot create entries or alter grants.
- Do not add secrets to committed configuration, examples or logs. Ordinary settings reads stay redacted. Human reveal must remain authenticated and explicit; model retrieval/arguments can persist in Run history. Local updates do not rotate remote accounts.
- Use revision-checked settings edits; preserve blank secret inputs and existing notes. Keep `.runtime` separate from other user DSH data.

## Branches, versions and delivery

- For every new plugin, start a dedicated branch from the latest `main` (default `codex/<plugin-name>` unless the user specifies another name). Implement and review through a PR targeting `main`, then merge the PR. Do not introduce new plugins directly on `main`.
- Every component update must bump that component's `package.json` version in the same change, including its documentation updates. Use a patch bump for compatible fixes/docs, a minor bump for new capabilities, and a major bump for breaking changes unless the user specifies a version.
- Bump each affected package independently, not just the root application version. Keep dependencies/lockfile consistent. Bump the root version for application-wide changes; do not change the official DSH baseline as part of an application release.
- Version information reads application/plugin manifests at build time. Rebuild after a version bump; never hardcode displayed plugin versions.
- Keep English/Chinese README, design and architecture documents consistent. Their overview should use a single `Superagent Router(Monitor)` node and one LAI Orchestrator group containing the five stages; implementation detail belongs in prose/reference sections.
- Run `pnpm check` for integration changes unless the user's task limits exclude checks/tests. Deterministic drivers/local fixtures are separate from real-model validation. Respect explicit exclusions of tests or browser use. Report the actual checks performed.
- Never commit runtime data or credentials. Push to the task's configured remote; the primary repository is `https://github.com/IQE-SUZHOU/LAI-Superagent`.

## Documentation terms and locations

- Use exactly `LAI Orchestrator` and `Superagent Router(Monitor)` for application roles in maintained prose. Preserve actual code identifiers, package names, paths and quoted upstream contracts.
- Keep README focused on introduction, overview, startup and documentation links. User setup/page reference belongs in root `Guide.md` (Chinese: `Guide.zh-CN.md`); development conventions and commands belong in `docs/development.md` (Chinese: `docs/development.zh-CN.md`).
- Keep screenshots near the end of README, immediately before Documentation. Keep English/Chinese guides and overview diagrams synchronized.
