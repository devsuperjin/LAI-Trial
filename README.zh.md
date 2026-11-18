---
description: "基于固定 DeepSeek Harness 版本的独立 LAI 应用与插件。"
kind: "application-guide"
---

# LAI-Trial

[English](README.md)

## 概要

LAI Web 监控消息队列任务、展示运行统计与委派关系图，并配置模型路由。五个独立插件与一个 Bundle 扩展已发布的 DSH 运行时，无需修改框架源码。

## 目录

- [运行](#运行)
- [项目结构](#项目结构)
- [迁移与维护](#迁移与维护)

## 运行

使用 Node.js >=24.9 与 pnpm 11.28.5。先执行 `pnpm install --frozen-lockfile`，再执行 `pnpm build`。通过 `pnpm start:backend` 启动 DSH 后端，在另一个终端执行 `pnpm dev:web` 启动 LAI Web。

后端默认地址为 `http://127.0.0.1:3080`，LAI Web 地址为 `http://127.0.0.1:5174`。将后端打印的 token 粘贴到 LAI Web。`LAI_WEB_TARGET` 可修改开发代理地址。Vite 服务用于开发；生产部署需要实现相同的带认证同源 API 转发。

队列消费者默认禁用。将 `.env.example` 复制为 `.env`，填写实际绝对工作目录、模型路由和凭据，然后选择一个环境覆盖，例如 `pnpm start:backend --patch config/development/redis.yml`。Redis、RabbitMQ、MQTT 和基于 MQTT 的 IQE 流水线各有独立配置。模型 Provider 仍由 DSH 官方设置管理，填写 Provider 名称不会自动创建该路由。

## 项目结构

```text
app/lai-web/             独立 React 前端
packages/dsh-adapter/    版本兼容与浏览器 RPC
plugins/                mq、mq-redis、mq-rabbitmq、mq-mqtt、prompt-sections
bundles/agent-mq-bundle/ 可选能力组合
config/                 基线版本、Profile 与部署覆盖
patches/                Core Patch 维护策略（当前无补丁）
tests/                  协议与迁移兼容性
.github/workflows/      生产基线与可选候选版本检查
```

## 迁移与维护

代码来源为 LAI 的 `jin/agent-plugins`，提交 `78d635a214476dbbde87a38d91452f9ff83b76b5`。运行时依赖固定为 DSH `0.2.2-rc.1`；自有包使用独立的 `@lai` 命名空间与 `0.1.0` 版本。

参阅[架构说明](docs/architecture.zh.md)、[上游升级与回滚](docs/upstream-sync.zh.md)以及覆盖全部 [159 个变更文件的迁移清单](docs/migration-inventory.json)。旧分支缺少四个前端模型模块，本仓库在 `app/lai-web/src/model` 中补齐，并在清单中单独记录。

应用使用 `.runtime/dsh` 存放 Profile、配置与会话数据，不导入或修改既有的用户 DSH 主目录。本地 `.reference/lai` 源码检出被忽略，安装、构建与 CI 均不依赖它。

`pnpm check` 执行架构检查、构建、类型检查和测试。本地无可达服务时 Broker 测试会跳过；CI 提供三种 Broker 并要求测试运行。真实模型调用与生产部署需要单独的集成验证。
