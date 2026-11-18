---
description: "应用职责、DSH 组合方式与配置分层。"
kind: "architecture-overview"
---

# 架构说明

[English](architecture.md)

## 概要

应用依赖已发布的 DSH 包，产品仓库不复制框架源码。`config/dsh-baseline.json` 记录固定版本和迁移使用的精确源码提交。

## 目录

- [职责](#职责)
- [配置](#配置)
- [兼容性](#兼容性)

## 职责

| 模块 | 职责 |
| --- | --- |
| `app/lai-web` | React 页面、任务可视化、开发 API 代理 |
| `packages/dsh-adapter` | 公开 Gateway RPC 封装与版本相关的子任务等待 |
| `plugins/mq` | 队列任务解析、独立会话生命周期、先发布结果再确认消息 |
| `plugins/mq-*` | 可替换的 Redis、RabbitMQ 与 MQTT 传输实现 |
| `plugins/prompt-sections` | 通过公开提示服务注册提示片段与上下文 |
| `bundles/agent-mq-bundle` | 包级默认插件行，消费者默认禁用 |
| `plugins/lai-web` | 用公开 DSH 静态服务托管 LAI 资源，并公布认证地址 |
| 已发布 DSH | Agent Loop、持久化、认证、模型 Provider、工具与 API 服务 |

每个插件拥有独立清单、Schema、README、测试与版本。运行时服务通过已发布包的导出导入。适配层将旧源码专有的 `waitForTreeWork` 调用转换为发布版公开的 `waitForChildren`，不修改运行时。

## 配置

`config/profile.json` 按顺序选择官方 base、Web Bundle，最后叠加应用 Bundle。`scripts/prepare-profile.mjs` 仅初始化 `.runtime/dsh/profiles/lai`，链接依赖与应用覆盖文件。`scripts/run-dsh.mjs` 将启动交给已安装的 `dsh --profile lai` CLI。`pnpm start` 自动构建并启动完整应用；`web-runtime` 行替换为 `@lai/dsh-web-app`，通过 DSH 公开的认证静态服务托管 LAI 构建产物，前后端共享同一来源。

配置按 Bundle 默认值 → 应用 Profile 覆盖 → 隔离主目录覆盖 → 有序 `--patch` 环境覆盖依次叠加。Profile 按 id 禁用 `ui-settings-account` 与 `account-controller`。开发覆盖启用一种队列后端并提供部署参数。生产示例使用环境变量，可复制为被忽略的 `*.local.yml`。DSH 覆盖会替换完整配置值，不会深度合并。

IQE 覆盖管理协调者、六个专业角色的 Preset、工具选择与提示词。模型和工作目录默认值来自 `.env`。凭据与用户偏好不应写入 Bundle。当前 Redis 后端仅支持 host/port；需要认证或 TLS 的部署必须扩展传输实现，不能静默忽略这些要求。

## 兼容性

自有 MQ 消息结构与会话日志由插件管理，不重写已有会话文件代次或存储 Schema。新的隔离主目录使用独立状态；评估版本时应保留原主目录。自动迁移检查覆盖配置组合与源码完整归类，不负责复制既有用户会话。

`docs/migration-inventory.json` 为旧分支全部变更文件指定目标或明确处理方式。上游生成的目录与白名单由本仓库的包归属及架构检查取代。官方 tool-cordis 不新增外部 MQ API 条目，MQ 使用者阅读插件文档。旧分支缺少的四个前端模型模块已补齐并单独记录。

当前无需 Core Patch。后续例外遵循[补丁策略](../patches/README.md)；集成与回滚流程见[上游同步](upstream-sync.zh.md)。
