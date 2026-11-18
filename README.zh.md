---
description: "基于固定 DeepSeek Harness 版本的独立 LAI 应用与插件。"
kind: "application-guide"
---

# LAI-Trial

[English](README.md)

## 概要

LAI Web 监控消息队列任务、展示运行统计与委派关系图，并配置模型路由。独立的 Agent、队列与 Web 托管插件及分层 Bundle 扩展已发布的 DSH 运行时，无需修改框架源码。

## 目录

- [运行](#运行)
- [项目结构](#项目结构)
- [迁移与维护](#迁移与维护)

## 运行

使用 Node.js >=24.9 与 pnpm 11.28.5。首次克隆后执行一次 `pnpm install --frozen-lockfile` 安装依赖。之后只需一条启动命令：

```bash
pnpm start
```

该命令自动构建 LAI Web 与插件，再启动 DSH 的 `lai` Profile。同一个服务在 `http://127.0.0.1:3080` 提供前端与 API，并打开已经认证的浏览器地址，不需要单独启动前端或复制 token。`pnpm start --no-open` 仅打印地址，`pnpm start --port 8080` 可更换端口。

只有开发前端时，才需要在两个终端分别运行 `pnpm start:backend` 和 `pnpm dev:web`。Vite 使用 5174 端口，通过 `LAI_WEB_TARGET` 代理后端，默认目标为 `http://127.0.0.1:3080`。

队列消费者默认禁用。将 `.env.example` 复制为 `.env`，填写实际绝对工作目录、模型路由和凭据，然后选择一个环境覆盖，例如 `pnpm start --patch config/development/redis.yml`。Redis、RabbitMQ、MQTT 和基于 MQTT 的 IQE 流水线各有独立配置。在 LAI Web → Settings → Model providers 中配置模型 Provider。前端直接使用 DSH 官方设置与凭据 API；在 MQ 覆盖中填写 Provider 名称前，仍需先配置对应路由。

点击顶部 **Original DSH ↗**，或访问 `/dsh/`，可以使用已安装的官方前端调试。两个界面共享后端、浏览器认证、设置和会话。**Settings → LAI agents** 通过独立的 [`@lai/lai-agents` 插件](plugins/lai-agents/README.zh.md)编辑各专业角色的 Prompt。

## 项目结构

```text
app/lai-web/             独立 React 前端
packages/dsh-adapter/    版本兼容与浏览器 RPC
plugins/                lai-agents、web-host、mq 及传输与提示插件
bundles/agent-mq-bundle/ 可选能力组合
config/                 应用默认值 Bundle、基线、Profile 与部署覆盖
patches/                Core Patch 维护策略（当前无补丁）
tests/                  协议与迁移兼容性
.github/workflows/      生产基线与可选候选版本检查
```

## 迁移与维护

代码来源为 LAI 的 `jin/agent-plugins`，提交 `78d635a214476dbbde87a38d91452f9ff83b76b5`。运行时依赖固定为 DSH `0.2.2-rc.1`；自有包使用独立的 `@lai` 命名空间与 `0.1.0` 版本。

参阅[架构说明](docs/architecture.zh.md)、[上游升级与回滚](docs/upstream-sync.zh.md)以及覆盖全部 [159 个变更文件的迁移清单](docs/migration-inventory.json)。旧分支缺少四个前端模型模块，本仓库在 `app/lai-web/src/model` 中补齐，并在清单中单独记录。

应用使用 `.runtime/dsh` 存放 Profile、配置与会话数据。项目默认值来自 `@lai/application-config`，用户设置保留在 Profile 覆盖文件中；旧版复制的默认配置会一次性迁移并备份，Provider 设置保留。应用不导入或修改既有的用户 DSH 主目录。本地 `.reference/lai` 源码检出被忽略，安装、构建与 CI 均不依赖它。

`pnpm check` 执行架构检查、构建、类型检查和测试。本地无可达服务时 Broker 测试会跳过；CI 提供三种 Broker 并要求测试运行。真实模型调用与生产部署需要单独的集成验证。
