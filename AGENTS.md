# LAI development

This is an independent DSH application repository. Read docs/architecture.md and config/dsh-baseline.json before changing integration code.

- Keep application packages under @lai; pin official DSH peers to the baseline version.
- Use published exports, Bundle/Profile composition and environment overlays. Do not copy or edit official framework source.
- Keep DSH version differences and the browser RPC protocol in packages/dsh-adapter.
- Own registrations through Cordis effects and await pipeline cancellation and worker disposal before releasing dependencies.
- Keep input events provider-neutral. Connectors submit through the public pipeline source interface; no broker or MQ dependency belongs in the application. Preserve DSH session data and existing user settings.
- Run pnpm check for integration changes. Pipeline tests use deterministic drivers and local fixtures; real-model validation is separate.
- .reference is an ignored source checkout for migration auditing only. Runtime, builds, tests and CI must not depend on it.
- Do not add credentials to committed configuration. Keep .runtime separate from existing user DSH data.
