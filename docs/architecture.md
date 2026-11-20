# LAI architecture

LAI is an independent DSH application using published packages pinned to `config/dsh-baseline.json`. No DSH framework source is copied or patched. `config/profile.json` composes official base/Web bundles, `@lai/lai-agents`, `@lai/superagent` and LAI application defaults. Writable settings and sessions remain in the isolated `.runtime/dsh` home.

## Execution ownership

```text
GitHub / optional Feishu / Jenkins Sources
  → Superagent Router(Monitor)
  → LAI Orchestrator (Worker · iqe-orchestrator)
      triage → reproduce → ticket → review → reporter
```

The single Monitor / Router business boundary includes event intake, deduplication, admission rules, assessment and routing. Intake/rule checks run in code; semantic assessment/request routing uses the Router main session, with decisions validated and applied by code. Monitor is the upstream Superagent Router. It keeps its own session/workspace, policy evaluation, admission, routing and follow-up behavior. It is not a LAI specialist or a child of the Worker. Router and Worker are separate sessions associated through a Ticket, as in Superagent.

Each Worker uses the `iqe-orchestrator` preset from `@lai/lai-agents`. Its model invokes the five native delegation tools in order. These specialists are real children of that Worker, visible in LAI Runs and the original DSH UI at `/dsh/`. The host does not substitute independent sessions for children.

`plugins/superagent/src/app/lai-worker.ts` admits one delegation at a time, keeps a reservation through the tool result, and checks actual native child history before admitting the next stage. Failed/cancelled children stop subsequent stages. A ready report requires all five children to have completed. Progress is reconstructed from the durable child catalog; each new Assignment uses its start time to scope its chain.

## Packages

- `plugins/superagent` (`@lai/superagent`): upstream business plugin imported from `deepseek-ai/dsh-superagent-prototype` at `8c32a9dc5d72c033816c6a8110b37f40cf94fba4`, formerly under `vendor/`. Owns Sources, Policy, Router, Tickets, worker scheduling/workspaces, durable effects, retries and replies. Local changes include baseline compatibility, authenticated management, opt-in own-Issue intake, and LAI worker execution.
- `plugins/lai-agents`: independent Bundle with native DSH sidebar and plugin configuration views, Worker orchestrator plus five configurable specialist presets. Prompts and per-specialist model overrides share the stable `lai-agents` settings namespace. Overrides seed fresh children through public `agent.model.select`; existing durable selections are preserved. Reproduction can implement explicitly requested small fixes; other role constraints and task-specific limits remain in force.
- `app/lai-web`: Tailwind Dashboard, Router, Runs and Settings. `src/router/routes.tsx` is the single static route/menu source (paths, components, names, icons, groups, order and visibility). `src/layout` owns application chrome, consistent page headers, gutters, panels and tabs; `src/pages` owns business implementations. Hash navigation preserves deep links and browser history without changing the DSH host protocol. Plugin → Superagent is a dedicated page for Sources, Policy, Eval, Execution, Prompts and Deployment. Plugin → LAI Agents contains LAI role prompts and specialist model overrides; Settings contains appearance, build/plugin versions, model-provider credentials and the default model; agent-accessible service credentials have their own Plugin → Credentials page. Complete settings editors preserve fields unsupported by the basic forms and save using revision checks.
- `packages/dsh-adapter`: public browser RPC, Superagent HTTP protocol and DSH host compatibility reads.
- `plugins/feishu-tools` (`@lai/feishu-tools`): MIT-licensed Feishu tools imported from `LJH-snow/dsh-tool-feishu`. Registers standard DSH tools discovered by LAI Agents; credentials stay in runtime settings. It is separate from Superagent incoming message sources.
- `plugins/credentials` (`@lai/credentials`): standalone standard DSH credential tools with live per-preset authorization and a dedicated LAI Web configuration page. Secret-role settings are redacted on reads; explicit retrieval returns plaintext to the authorized model and its Run history. The modal supports optional API endpoints and server host/port fields; explicit human reveal uses an authenticated management route. The separate `@lai/credentials/skill` entry is composed in specialist presets for scoped skill discovery. Agent updates require both live preset authorization and explicit per-entry `allowUpdates`, and persist only local secret replacements through revision-checked settings mutations.
- `plugins/web-host`: authenticated LAI frontend, archived-session discovery, original DSH debug UI.

The former `lai-pipeline`, `pipeline-simulator`, simulation page and source-registration API have been removed. Their historical runtime data remains untouched; source history is available in Git. The unified app has one trigger/task lifecycle owner: Superagent. Profile migration removes their obsolete overlays with a backup, preserving unrelated settings and session data.

No MQ/broker or shared knowledge service is required. Superagent's local SQLite state and durable effects are application persistence, not an external broker. Worker concurrency, model routes, preparation commands and admission behavior are configured through Superagent.

## Running and data

`pnpm install` then `pnpm start` builds and starts the unified application. Open the authenticated URL printed by DSH (default port 3080). Configure Sources/Policy/Eval/Execution in Plugin → Superagent. Default Eval mode is observe; a source being received does not by itself authorize a task. A separate demo on port 3082 has its own state and is not overwritten or imported automatically. Do not run two watchers for the same repository unless intentionally configured.

DSH settings/credentials/sessions: `.runtime/dsh`. Superagent state: `.runtime/dsh/superagent` by default, overridable with `LAI_SUPERAGENT_STATE_DIR` for an explicitly selected offline state directory. Existing pipeline history and the separate demo remain untouched. Never share an active state directory between processes.

`pnpm check` runs architecture checks, builds, types, LAI deterministic tests and the imported Superagent local fixture suite. No real-model test is required. `.reference` is ignored audit material only and is never a runtime dependency.

## Branches and component versions

New plugins require a dedicated branch from current `main`, a PR to `main`, and PR merge. Do not add new plugins directly on `main`. Every changed component, including plugin documentation changes, bumps its own manifest version in the same change: patch for compatible fixes/docs, minor for features, major for breaking changes unless explicitly specified. Application-wide changes also bump the root manifest. Keep workspace dependencies and lockfiles consistent; this does not change the official DSH baseline. Settings displays the manifests captured by the build, not a live inventory of enabled plugins.

The same rules are maintained in [AGENTS.md](../AGENTS.md). The simplified overview is shared by both READMEs and design documents; detailed task, session, credential and lifecycle boundaries remain documented separately.
