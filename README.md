# LAI Trial

An independent DSH application combining Superagent task management with LAI native subagents.

## Quick start

```sh
pnpm install
pnpm start
```

Open the authenticated URL printed in the terminal (default port 3080). In **Settings → Superagent**, configure Sources, Policy, Eval and Execution. Configure model providers and credentials in the same Settings page.

```text
GitHub / CI → Monitor (Superagent Router) → Ticket / Worker
                                             ↓
                      triage → reproduce → ticket → review → reporter
```

The Monitor/Router retains Superagent behavior. Each Worker runs the five LAI specialists strictly in sequence as native children. **Tasks** shows Superagent tickets and links to the Monitor and Worker; **Runs** shows their sessions, child calls and results. **History** shows ended tasks and routing decisions. Original DSH debugging UI: `/dsh/`.

Default Eval mode is observe. Receiving an Issue does not bypass admission policy. For a single GitHub account, enable both new-Issue intake and “Receive issues opened by the agent account”; own comments and PRs remain filtered to avoid loops.

No broker, MQ or shared knowledge service is required. The former simulator/trigger engine has been removed. DSH user settings, credentials and sessions remain under `.runtime/dsh`; Superagent state defaults to `.runtime/dsh/superagent`. The separate port-3082 demo is not overwritten or imported automatically.

The top-bar EN / 中文 switch saves the interface language locally. Delete run uses the native DSH archive with Undo. Active runs must be stopped before archiving.

See [architecture](docs/architecture.md) and [upstream synchronization](docs/upstream-sync.md). `pnpm check` builds, typechecks and runs deterministic/local fixture tests without paid model calls.
