---
description: "通过配置添加系统提示片段和动态上下文，无需修改 DSH 提示组装。"
kind: "package-reference"
---

# @lai/dsh-prompt-sections

[English](README.md)

## 概要

通过配置添加系统提示片段和动态上下文，无需修改 DSH 提示组装。

## 目录

- [使用](#使用)
- [实现与配置](#实现与配置)
- [限制](#限制)

## 使用

从项目根目录执行 `pnpm build`，然后用独立 Profile 启动。环境覆盖示例与配置顺序见[架构说明](../../docs/architecture.zh.md)。

## 实现与配置

配置 Schema 与公开导出由[源代码](src/index.ts)定义；依赖与导出路径由[包清单](package.json)声明。

插件挂载由 [Bundle](../../bundles/agent-mq-bundle/cordis.patch.yml)管理；每次仅启用一种传输后端。

## 限制

兼容目标固定为 DSH `0.2.2-rc.1`。真实 Broker 与模型端到端行为需要可达服务和凭据；没有服务时本地 Broker 测试会跳过。任务可能重复投递，生产者和外部写操作需要处理幂等性。

## 开发说明

插件独立版本为 `0.1.0`。框架依赖保持精确版本；升级和回滚流程见[上游同步说明](../../docs/upstream-sync.zh.md)。
