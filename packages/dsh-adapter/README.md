# @lai/dsh-adapter

This library owns the browser RPC protocol (`./gateway`) and release-specific subagent completion (`./subagents`). It has no Cordis mount row or application launcher. The browser import does not load Node-only DSH services.

`waitForTreeWork(runtime, agent)` delegates to DSH `0.2.2-rc.1`'s public `waitForChildren` method and returns false when the optional provider is absent. Callers must recheck parent idle after joined work. RPC calls preserve request ids, authentication failures and optimistic settings revisions.

See [architecture](../../docs/architecture.md) and [adapter tests](../../tests/contract/adapter.spec.ts).

Provider configuration reads DSH's configurable-provider directory and writes minimal path edits using `settings/mutate`. Namespace revisions fence concurrent writes. API keys use the separate write-only `credentials/set` API; credential reads expose only presence, source and writability. The gateway propagates DSH refusal messages to the editor.

The `./superagent` export owns the authenticated same-origin Superagent management protocol. `./runs` reads archived roots for LAI run filtering. `./host` contains baseline-specific cold session event reads through published DSH persistence APIs; browser code must not import it.

The `./credentials` browser export owns authenticated human configured-state and explicit reveal calls to the Credentials plugin. It is distinct from DSH model-provider credential RPC and from agent-facing `credentials_list/get/update` tools. Ordinary settings reads remain redacted; human reveal is explicit and same-origin.

Keep browser protocol work here, page implementations in `app/lai-web/src/pages` and shared UI in its `layout`/`components` directories. Every update to this component, including docs, bumps its manifest version. New plugins use dedicated branches and PR merge; see [AGENTS.md](../../AGENTS.md).

The gateway also adapts DSH's public `pluginManager` inventory, Bundle installation/cancellation/removal and enablement methods. Management uses the current authenticated Profile; settings editors consume schema metadata and submit revision-checked path mutations. No plugin code is copied into the frontend.
