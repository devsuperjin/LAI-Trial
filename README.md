# LAI Trial

Independent DSH application with one LAI orchestrator with monitoring and five specialist subagents.

```sh
pnpm install
pnpm start
```

Open the authenticated URL printed in the terminal (default port 3080). Configure a model and credentials in Settings, then simulate a CI failure or commit on the Pipeline page. The orchestrator monitors inputs itself, then invokes Triage → Reproduction → Ticket → Reviewer → Reporting as five native children using `@lai/lai-agents` presets and configurable prompts.

No broker, MQ, or shared knowledge service is required. Inputs are local fixtures; model calls and agent tool execution are real. Ticket and report outputs remain local. Future source plugins can submit normalized CI/GitHub events through `laiPipeline.registerSource`.

Original DSH debugging UI: `/dsh/`. User settings and session data: `.runtime/dsh` (ignored). If port 3080 is occupied, stop the existing instance before starting another.

See [architecture](docs/architecture.md) and [upstream synchronization](docs/upstream-sync.md). Run `pnpm check` for local checks.
