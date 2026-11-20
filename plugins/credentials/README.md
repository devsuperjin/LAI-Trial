# @lai/credentials

Standalone DSH credential tools and a **Plugin → Credentials** page in LAI Web. The plugin uses standard `ctx.tools.register()` registrations; LAI Agents discovers tools through the public registry; its specialist presets separately compose the exported Skill entry.

## Configure and grant access

1. Add a named credential (for example `jenkins-readonly`) with a service/purpose and optional API endpoint, host/IP, port, username, token or password. Connection-only entries are supported.
2. Select the agent presets permitted to read that credential. The default is no authorized presets. `*` explicitly authorizes all presets. Disabling a credential or removing a preset revokes further reads immediately.
3. For LAI specialists, enable `credentials_list` and `credentials_get` in **Plugin → LAI Agents → role → Tools → Registered DSH tools**, apply the draft and save configuration. Tool selection applies to newly created subagent Runs.
4. Ask the authorized agent to list credentials and retrieve the required entry by name for its research task. Native DSH agents must also be authorized by preset; the public tools registry alone does not grant credential access.

The original DSH plugin manager also exposes the component's ordinary settings form. Settings live under `lai-credentials.entries` in the isolated application profile, never committed configuration. Each entry contains `description`, `service`, `enabled`, `allowedPresets`, and secret-role `username`, `token`, `password` fields. The custom page uses revision-checked path edits, preserves blank secret inputs, and loads an existing secret only after an explicit eye-icon action in the modal. Configured-state indicators distinguish stored values from empty fields.

The `@lai/credentials/skill` entry registers the bundled `credentials-access` DSH Skill in its mounting scope. LAI mounts this entry in each specialist preset, so it is not advertised globally or added to role system prompts. Other agents can opt in by composing that entry and the standard skill tool in their own presets. Specialists load it with the `skill` tool before accessing authenticated services. It covers discovery, connection information, legacy description notes, authorization and rotation. LAI role prompts no longer include the old shared credentials prefix; only that exact legacy prefix is removed from saved prompts. The standard `skill` capability is enabled by default for all five specialists; select the required credential tools separately; loading a Skill does not grant tool or credential permissions.

The editor is a modal with Generic, API and SSH/server connection types. Optional `endpoint`, `host` and `port` fields support connection-only entries. Existing descriptions and secrets are preserved. `allowUpdates` defaults to false and must be enabled explicitly to permit agent updates.

## Security and persistence

These are local DSH settings with secret-field redaction, not a separate encrypted vault. Protect the application state directory. Retrieval deliberately returns plaintext to the selected model; it can be persisted in that Run's history. Choose credentials and model providers accordingly. The list tool returns authorized metadata including connection fields and update capability, never username/token/password; requests without an agent identity, disabled entries and unauthorized presets cannot retrieve values. Access is checked at execution time, including after live settings changes.

Credential access does not authorize external writes, posting messages or sending secrets to unrelated services. Superagent Ticket guards and LAI tool selections remain in effect. This is not an OS sandbox; it does not restrict credentials an agent might already access through other tools such as Shell.

## Tools

- `credentials_list()` — authorized metadata only.
- `credentials_get({ id })` — authorized plaintext values, or an unavailable/unauthorized result. No filesystem path or environment-variable lookup is accepted.

- `credentials_update({ id, username?, token?, password? })` — updates an existing authorized local record only when `allowUpdates` is enabled. Omitted fields are preserved; empty strings clear them. Returns field names and confirmation, never replacement values. It cannot change grants or create credentials. Upstream account rotation requires separate task authorization. Replacement tool arguments may be retained in Run history.

Registrations are owned by Cordis effects and disposed when the plugin unloads. Tests use fixture strings only and make no network or real-model calls.


## Authorization and integration

The caller identity is `exec.agent.session.header.agentPreset` supplied by DSH, not an argument chosen by the model. Entries authorize preset IDs, so instances using the same preset share a grant. Missing agent identity, disabled entries and unmatched grants deny access. Revocation affects future calls and cannot retract previously disclosed values.

The authenticated human management APIs `/lai-api/credentials/status` and `/lai-api/credentials/reveal` are separate from model-facing tools. They provide configured-state flags and explicit per-field reveal; responses are not cached. The modal uses a compact layout and eye icons, and does not load stored plaintext by default.

New plugin development follows a dedicated branch → PR → merge workflow. Any update to this component, including documentation, bumps its package version in the same change; see [AGENTS.md](../../AGENTS.md).
