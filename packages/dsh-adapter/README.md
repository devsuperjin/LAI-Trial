# @lai/dsh-adapter

This library owns the browser RPC protocol (`./gateway`) and release-specific subagent completion (`./subagents`). It has no Cordis mount row or application launcher. The browser import does not load Node-only DSH services.

`waitForTreeWork(runtime, agent)` delegates to DSH `0.2.2-rc.1`'s public `waitForChildren` method and returns false when the optional provider is absent. Callers must recheck parent idle after joined work. RPC calls preserve request ids, authentication failures and optimistic settings revisions.

See [architecture](../../docs/architecture.md) and [adapter tests](../../tests/contract/adapter.spec.ts).

Provider configuration reads DSH's configurable-provider directory and writes minimal path edits using `settings/mutate`. Namespace revisions fence concurrent writes. API keys use the separate write-only `credentials/set` API; credential reads expose only presence, source and writability. The gateway propagates DSH refusal messages to the editor.
