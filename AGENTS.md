# LAI development

This is an independent DSH application repository. Read docs/architecture.md and config/dsh-baseline.json before changing integration code.

- Keep application packages under @lai; pin official DSH peers to the baseline version.
- Use published exports, Bundle/Profile composition and environment overlays. Do not copy or edit official framework source.
- Keep DSH version differences and the browser RPC protocol in packages/dsh-adapter.
- Own registrations through Cordis effects and await task teardown before releasing transports.
- Preserve MQ task/result envelopes and session data; cover compatibility changes with regression tests.
- Run pnpm check for integration changes. Broker tests may skip locally; CI requires all three brokers.
- .reference is an ignored source checkout for migration auditing only. Runtime, builds, tests and CI must not depend on it.
- Do not add credentials to committed configuration. Keep .runtime separate from existing user DSH data.
