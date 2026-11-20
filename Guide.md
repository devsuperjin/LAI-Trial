# LAI Configuration Guide

**English** | [简体中文](Guide.zh-CN.md)

For startup commands and the project introduction, see the [README](README.md). Open the authenticated URL printed at startup; the default port is 3080.

## Initial configuration

1. In **Settings**, configure model providers, model-provider API keys and the default model. Configure LAI role prompts and specialist model overrides in **Plugin → LAI Agents**.
2. Open **Plugin → Superagent → Sources** and configure the GitHub repository (`owner/repo`), GitHub CLI path and events to receive.
3. In **Policy**, configure allowed senders, task scope and admission rules.
4. In **Eval**, configure evaluation mode, timeout and the Superagent Router(Monitor) model. The default is `observe`; choose `auto` when the intended workflow should automatically accept inferred tasks under policy.
5. In **Execution**, configure the LAI Orchestrator model, concurrency, working directory, workspace preparation command and command restrictions.
6. Use **Superagent Router(Monitor)** to inspect accepted work and **Runs** to inspect Superagent Router(Monitor), LAI Orchestrator and subagent execution.

If one GitHub account both opens Issues and executes tasks, enable new-Issue intake and **Receive issues opened by the agent account**. Own comments and PRs remain filtered. This switch does not replay previously skipped Issues, and received Issues still pass through Policy.

The minimum polling interval is 60 seconds; longer intervals requested by GitHub take precedence. Start with a small, clearly defined task to inspect routing behavior and model costs.

## Pages and configuration

| Page | Purpose |
| --- | --- |
| Dashboard | Superagent intake and task metrics, Superagent Router(Monitor) / LAI Orchestrator health, five-stage activity and recorded model usage |
| Superagent Router(Monitor) | Superagent tasks with links to their Superagent Router(Monitor) and LAI Orchestrator sessions |
| Runs | Timeline with Waterfall / List views, grid-backed DAG, native subagents and execution results |
| Plugin → Superagent | Dedicated management page for Sources, Policy, Eval, Execution, Prompts and Deployment |
| Plugin → LAI Agents | LAI Orchestrator and specialist prompts, plus per-specialist model and tool selection |
| Plugin → Feishu tools | Standalone Feishu app credentials or tenant access token |
| Plugin → Credentials | Agent service connections, credentials, preset grants and local update permission |
| Settings | General: appearance, language and version information; Model configuration: providers, credentials and the default model |

The interface supports English and Chinese. The original DSH debugging UI remains available at **`/dsh/`**, sharing the same backend. Deleting a Run uses native DSH archiving with Undo; running sessions must be stopped first.

**Prompts** on the Superagent page manages its Superagent Router(Monitor) / LAI Orchestrator instructions. **Plugin → LAI Agents** manages LAI role definitions and specialist model overrides. It is an independent DSH Bundle with its own sidebar and configuration entry in the original DSH interface. Unpinned specialists inherit the LAI Orchestrator model; pinned routes apply to new children without changing the global default. Source, policy and execution settings use revisions to detect concurrent changes. Advanced editors expose complete configuration fields beyond the basic forms.

## Agent service credentials and Skills

Model-provider API keys belong in Settings → Model configuration. Accounts and connection information for agent research belong in **Plugin → Credentials**; these are independent stores.

1. Add a credential, select Generic, API or SSH, and enter the endpoint, host/IP, port, purpose and required username/token/password. Connection-only entries are supported; descriptions can hold access instructions and environment details.
2. Enable the entry and select its authorized agent presets. No presets are authorized by default. Instances of one preset share its grant; All agents is an explicit wildcard grant.
3. In **Plugin → LAI Agents → role → Tools**, select `credentials_list` and `credentials_get`, apply, then save configuration. New subagents use the new selection; existing Run snapshots remain unchanged.
4. All five specialists enable `skill` and mount `credentials-access` by default. Load its body on demand through `skill`; it is not preloaded, and it grants neither tools nor credential access.
5. To persist rotated local values, also select `credentials_update` and enable the entry's update permission. It does not rotate the remote account, create entries or change grants. Remote rotation requires explicit authorization.

Configured fields show mask dots; use the eye icon for explicit reveal. Blank secret edits preserve stored values. Retrieved plaintext and tool arguments can persist in Run history. Revocation prevents future calls, not prior disclosures.

## Standalone Feishu tools

Configure App ID / App Secret or Tenant Access Token in **Plugin → Feishu tools**, then select the required tools for LAI roles. This is independent from the Feishu input Source in **Plugin → Superagent → Sources**. It starts no second message listener and does not automatically read its configuration from the Credentials plugin.

## Saving and troubleshooting

Apply changes in a role modal only updates the page draft; save configuration afterward. Settings writes use revisions. On conflict, reload and reapply the intended edits rather than replacing the entire settings document, which can discard unrelated fields and credentials.

Settings → General displays application/plugin manifests captured at build time, not a live inventory of enabled plugins. Rebuild after version changes. Hash paths support browser history and direct links, for example `/#/plugins/credentials`.
