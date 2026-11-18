# LAI architecture

LAI is an independent DSH application using published, pinned packages. No framework source is copied or patched. Application defaults compose official base and Web bundles through `config/profile.json`; user settings stay in the isolated `.runtime/dsh` home.

- `plugins/lai-agents`: five specialist presets and `iqe-orchestrator` with monitoring, configurable prompts and existing role tools.
- `plugins/lai-pipeline`: one orchestrator parent; the orchestrator model invokes its real `triage`, `reproduce`, `ticket`, `review` and `reporter` delegation tools; monitoring is performed by the parent itself. The host submits stage tasks and observes results; it does not spawn children. Native tool calls, receipts, child execution and completion notifications remain in the DSH conversation. The parent monitors, then delegates to five subagents in order. Children enter DSH's durable parent catalog; they are not independent root sessions. Idle roles do not issue model calls.
- `plugins/pipeline-simulator`: normalized local CI-failure or commit fixtures. Future CI/GitHub connectors register a source and submit the same event interface.
- `app/lai-web`: Tailwind React UI for simulation, stage outputs, history, sessions and settings.
- `packages/dsh-adapter`: public browser RPC and pipeline HTTP API.
- `plugins/web-host`: same-origin authenticated LAI UI; original DSH remains available at `/dsh/`.

No MQ or shared knowledge store is used. One run executes at a time. Evidence and stage outputs persist locally. Simulations create local ticket drafts and reports, without submitting remote tickets or triggering external CI.

`pnpm install` then `pnpm start` builds and starts everything. Use the authenticated URL printed by DSH. Configure the model and credentials in Settings, then simulate an input. Provider settings and existing sessions are preserved across profile migrations. `pnpm check` checks composition, package ownership, builds, types and deterministic tests.

Delegation order is strictly `triage → reproduce → ticket → review → reporter`. Each stage waits for the child result and parent acknowledgement. A scoped public `tools/pre-execute` policy denies other-stage and duplicate delegation calls before dispatch; errors or cancellation stop subsequent stages.
