---
description: "Configure six IQE specialist agents and their orchestrator independently of MQ transport."
kind: "package-reference"
---

# @lai/lai-agents

[中文](README.zh.md)

## Summary

Configure prompts for Monitor, Triage, Reproduction, Ticket, Review and Reporting, plus their coordinating agent. The plugin declares the existing `iqe-*` presets through DSH's public preset registry; MQ and Web remain independent consumers.

## Contents

- [Configure prompts](#configure-prompts)
- [Lifecycle](#lifecycle)
- [Limitations](#limitations)

## Configure prompts

The LAI application Bundle mounts this plugin as `lai-agents`. In **Settings → LAI agents**, expand a role, edit its prompt and save. Settings writes use the namespace revision, so another editor's changes cause a conflict instead of being overwritten. The plugin's `prompts` configuration also accepts overrides in a Profile patch:

```yaml
- id: lai-agents
  config:
    prompts:
      monitor: >-
        Inspect CI logs, identify qualifying failures and report their evidence locations.
      triage: >-
        Classify each failure and document the supporting evidence.
```

Omitted roles retain their defaults. The six keys are `monitor`, `triage`, `reproduce`, `ticket`, `review` and `report`; `orchestrator` configures the coordinator. The source owns the full defaults and tool composition in [definitions.ts](src/definitions.ts). Prompt text is plain text; preset personas reference settings-backed prompt variables.

## Lifecycle

Each prompt variable and preset registration has a Cordis disposer. Existing preset ids and delegation tool names remain compatible with MQ tasks using `agentPreset: iqe-orchestrator`. Prompt changes are read at the next prompt assembly, including a later step in an existing session; they do not rewrite previous session events. The model adapter and normal DSH loop remain responsible for logging model-visible input.

The plugin owns the six specialists' tools and the coordinator's delegation tools; MQ packages own task envelopes and transport only. Removing the plugin removes its presets from the roster while the DSH registry retains generations used by existing agents until their owners release them.

## Limitations

Prompts guide agent behavior but do not implement tool-level authorization. The existing shell and filesystem composition remains authoritative. Saving prompts does not launch a task or configure a model provider. Configure a usable model and credentials separately.
