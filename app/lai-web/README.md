# @lai/lai-web

Independent React frontend for MQ run lists, dashboards, delegation graphs and model settings. Run `pnpm start` from the repository root to build and serve the frontend alongside the DSH API at `http://127.0.0.1:3080`. The application opens its authenticated browser URL automatically.

For frontend development only, `pnpm dev:web` runs Vite on port 5174; `LAI_WEB_TARGET` selects its authenticated DSH proxy target (default `http://127.0.0.1:3080`).

The public DSH wire protocol lives in `@lai/dsh-adapter/gateway`; components do not import framework internals. The four model modules under `src/model` reconstruct modules absent from the old source branch. The normal application uses DSH’s authenticated static frontend service; only the optional Vite development server needs an API proxy.

The Settings page offers **Model providers**: configure an installed provider or add a custom OpenAI Chat Completions, OpenAI Responses or Anthropic Messages endpoint. Edit the API endpoint, protocol, write-only API key and model list (IDs, names and optional token limits). Saving refreshes the default and pipeline model selectors. Existing model metadata and unedited provider options are preserved. API keys go to DSH's credential service; an empty key input keeps the existing credential. If settings save but the credential write fails, the form reports partial completion and retries only the key.

Provider configuration calls the existing `llm/listConfigurableProviders`, `settings/describe`, `settings/mutate` and `credentials/describe` / `credentials/set` endpoints through `@lai/dsh-adapter/gateway`. It does not require a custom backend plugin. Writes include the settings namespace revision, so concurrent edits are rejected instead of overwritten.
