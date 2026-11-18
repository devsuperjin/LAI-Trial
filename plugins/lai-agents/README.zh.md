---
description: "独立于 MQ 传输配置六个 IQE 专业 Agent 及其协调者。"
kind: "package-reference"
---

# @lai/lai-agents

[English](README.md)

## 概要

独立配置 Monitor、Triage、Reproduction、Ticket、Review、Reporting 六个角色及协调者的 Prompt。插件通过 DSH 公开的 Preset 注册表声明既有 `iqe-*` Preset；MQ 与 Web 只作为使用者。

## 目录

- [配置 Prompt](#配置-prompt)
- [生命周期](#生命周期)
- [限制](#限制)

## 配置 Prompt

LAI 应用 Bundle 以 `lai-agents` 为 id 挂载插件。在 **Settings → LAI agents** 中展开角色、编辑 Prompt 并保存。写入携带命名空间版本，其他编辑器的并发改动会导致冲突，不会被覆盖。也可在 Profile 覆盖中配置 `prompts`：

```yaml
- id: lai-agents
  config:
    prompts:
      monitor: >-
        检查 CI 日志，识别需要处理的失败并列出证据位置。
      triage: >-
        为每项失败分类，并记录支持判断的证据。
```

省略的角色使用默认值。六个键为 `monitor`、`triage`、`reproduce`、`ticket`、`review`、`report`；`orchestrator` 配置协调者。完整默认值与工具组合由 [definitions.ts](src/definitions.ts) 管理。Prompt 是纯文本，Preset 的 Persona 引用设置驱动的提示变量。

## 生命周期

提示变量与 Preset 注册均由 Cordis 清理。Preset id 和委派工具名保持兼容，MQ 任务仍可使用 `agentPreset: iqe-orchestrator`。Prompt 更新在下一次提示组装时读取，包括已有会话的后续步骤，不重写之前的会话事件。模型适配器与标准 DSH Loop 继续负责记录模型可见输入。

本插件管理六个专业角色的工具和协调者的委派工具；MQ 包仅管理任务消息和传输。卸载插件会移除可选 Preset，既有 Agent 使用的代次由 DSH 注册表保留到使用者释放。

## 限制

Prompt 用于指导行为，不能代替工具级授权。既有 Shell 与文件系统组合仍是权限依据。保存 Prompt 不会启动任务，也不会配置模型 Provider；模型和凭据需要单独配置。
