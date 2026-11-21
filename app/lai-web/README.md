# @lai/lai-web

Independent React frontend for pipeline runs, sessions, delegation graphs and model settings. Run `pnpm start` from the repository root to build and serve the frontend alongside the DSH API at `http://127.0.0.1:3080`. The application opens its authenticated browser URL automatically.

For frontend development only, `pnpm dev:web` runs Vite on port 5174; `LAI_WEB_TARGET` selects its authenticated DSH proxy target (default `http://127.0.0.1:3080`).

The public DSH wire protocol lives in `@lai/dsh-adapter/gateway`; components do not import framework internals. Pure projections of runtime data live under `src/model`; pages consume those projections without introducing another task lifecycle. The normal application uses DSH’s authenticated static frontend service; only the optional Vite development server needs an API proxy.

The Settings page offers **Model providers**: configure an installed provider or add a custom OpenAI Chat Completions, OpenAI Responses or Anthropic Messages endpoint. Edit the API endpoint, protocol, write-only API key and model list (IDs, names and optional token limits). Saving refreshes the default and pipeline model selectors. Existing model metadata and unedited provider options are preserved. API keys go to DSH's credential service; an empty key input keeps the existing credential. If settings save but the credential write fails, the form reports partial completion and retries only the key.

Provider configuration calls the existing `llm/listConfigurableProviders`, `settings/describe`, `settings/mutate` and `credentials/describe` / `credentials/set` endpoints through `@lai/dsh-adapter/gateway`. It does not require a custom backend plugin. Writes include the settings namespace revision, so concurrent edits are rejected instead of overwritten.

The built-in DeepSeek provider speaks Anthropic Messages and uses `https://api.deepseek.com/anthropic`. Its form rejects the Chat Completions root (`https://api.deepseek.com` or `/v1`) to prevent requests to a missing `/v1/messages` route. OpenAI-compatible endpoints belong in a custom provider with the matching protocol.

## Routes, layout and pages

`src/router/routes.tsx` is the single static route/menu source. Routes declare path, component, name, icon, order, optional group/placement and hideInMenu; the sidebar, breadcrumbs, titles and renderer derive from it. Hash navigation supports deep links, refresh and browser back/forward without additional DSH host routes.

`src/layout` owns application chrome, page width/gutters, headings outside content panels, cards, tabs and common actions. `src/pages` contains the eight business pages; `src/components` contains reusable widgets, including `RunDetailLoader`, not page aliases. See [layout conventions](src/layout/README.md).

Plugin pages separately configure Superagent, LAI Agents, Feishu tools and Credentials. Agent-accessible service credentials are distinct from model-provider API keys: they use the standalone Credentials plugin, per-preset grants, explicit human reveal and optional local update permission. Each specialist has the scoped credential Skill and default Skill capability, but credential tools/access still require independent selection/grants.

## Build metadata and maintenance

Settings → General shows application/DSH versions, build time, and every bundled `@lai` plugin's name, package and version collected from manifests by Vite. This is build metadata, not a live enabled-plugin inventory. The source link points to [IQE-SUZHOU/LAI-Superagent](https://github.com/IQE-SUZHOU/LAI-Superagent).

Every update to this package, including docs, bumps its manifest version; rebuild to expose changed metadata. New plugins use dedicated branches and PR merge into main. Follow [AGENTS.md](../../AGENTS.md), including task-specific exclusions of tests and browser use.

The Run DAG header provides an expand icon. `ExpandedView` moves a stable portal host into a native dialog, preserving DAG interaction state and the live child component instead of mounting a duplicate graph. Escape/Close restores the inline host.

Child tool rows create a compact connected `ToolCallDetails` node inside the DAG on click. Receipts are matched by call ID, with pending/error/empty states and arguments before results. No extra fetch or out-of-canvas tooltip is used. Nested lists, outputs and messages own their wheel scrolling, even at boundaries; only canvas regions use wheel zoom.

Selection controls share scoped `SelectionGroup` / `SelectionIndicator` animations across tabs, menus, filters and Run rows. `AnimatedDisclosure` animates execution environment expansion. Both respect reduced-motion preferences.

Sidebar navigation shares the selection animation and animates plugin group expansion. Settings → General → Reduce motion persists in this browser, defaults to the system preference, and controls Motion and CSS effects application-wide.

Boolean switches in General settings and Superagent sources share the accessible `Switch` widget, with primary-color checked state, keyboard focus and disabled state.

General settings use a bounded content width and shared responsive `SettingsRow` layout: descriptions on the left, aligned controls on the right, with stacked rows on small screens. Theme choices use the shared animated selection control.
