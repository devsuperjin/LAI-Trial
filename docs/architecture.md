# LAI architecture

LAI is an independent DSH application using published packages pinned to `config/dsh-baseline.json`. No DSH framework source is copied or patched. `config/profile.json` composes official base/Web bundles, `@lai/superagent` and LAI application defaults. Writable settings and sessions remain in the isolated `.runtime/dsh` home.

## Execution ownership

```text
GitHub / future CI Source
  → Superagent Monitor / Router
  → Superagent Ticket + per-ticket workspace and Worker session
      → triage → reproduce → ticket → review → reporter
  → Superagent report, task state and authorized external replies
```

Monitor is the upstream Superagent Router. It keeps its own session/workspace, policy evaluation, admission, routing and follow-up behavior. It is not a LAI specialist or a child of the Worker. Router and Worker are separate sessions associated through a Ticket, as in Superagent.

Each Worker uses the `iqe-orchestrator` preset from `@lai/lai-agents`. Its model invokes the five native delegation tools in order. These specialists are real children of that Worker, visible in LAI Runs and the original DSH UI at `/dsh/`. The host does not substitute independent sessions for children.

`plugins/superagent/src/app/lai-worker.ts` admits one delegation at a time, keeps a reservation through the tool result, and checks actual native child history before admitting the next stage. Failed/cancelled children stop subsequent stages. A ready report requires all five children to have completed. Progress is reconstructed from the durable child catalog; each new Assignment uses its start time to scope its chain.

## Packages

- `plugins/superagent` (`@lai/superagent`): upstream business plugin imported from `deepseek-ai/dsh-superagent-prototype` at `8c32a9dc5d72c033816c6a8110b37f40cf94fba4`, formerly under `vendor/`. Owns Sources, Policy, Router, Tickets, worker scheduling/workspaces, durable effects, retries and replies. Local changes include baseline compatibility, authenticated management, opt-in own-Issue intake, and LAI worker execution.
- `plugins/lai-agents`: Worker orchestrator plus five configurable specialist presets. Reproduction can implement explicitly requested small fixes; other role constraints and task-specific limits remain in force.
- `app/lai-web`: Tailwind Dashboard, Tasks, History, Runs and Settings. Settings exposes Superagent Sources, Policy, Eval, Execution, Prompts and Deployment alongside DSH model credentials and LAI role prompts. Complete settings editors preserve fields unsupported by the basic forms and save using revision checks.
- `packages/dsh-adapter`: public browser RPC, Superagent HTTP protocol and DSH host compatibility reads.
- `plugins/web-host`: authenticated LAI frontend, archived-session discovery, original DSH debug UI.

The former `lai-pipeline`, `pipeline-simulator`, simulation page and source-registration API have been removed. Their historical runtime data remains untouched; source history is available in Git. The unified app has one trigger/task lifecycle owner: Superagent. Profile migration removes their obsolete overlays with a backup, preserving unrelated settings and session data.

No MQ/broker or shared knowledge service is required. Superagent's local SQLite state and durable effects are application persistence, not an external broker. Worker concurrency, model routes, preparation commands and admission behavior are configured through Superagent.

## Running and data

`pnpm install` then `pnpm start` builds and starts the unified application. Open the authenticated URL printed by DSH (default port 3080). Configure Sources/Policy/Eval/Execution in Settings. Default Eval mode is observe; a source being received does not by itself authorize a task. A separate demo on port 3082 has its own state and is not overwritten or imported automatically. Do not run two watchers for the same repository unless intentionally configured.

DSH settings/credentials/sessions: `.runtime/dsh`. Superagent state: `.runtime/dsh/superagent` by default, overridable with `LAI_SUPERAGENT_STATE_DIR` for an explicitly selected offline state directory. Existing pipeline history and the separate demo remain untouched. Never share an active state directory between processes.

`pnpm check` runs architecture checks, builds, types, LAI deterministic tests and the imported Superagent local fixture suite. No real-model test is required. `.reference` is ignored audit material only and is never a runtime dependency.
