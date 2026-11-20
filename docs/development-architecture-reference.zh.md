# LAI Superagent 开发架构与上游同步参考

本文是当前仓库的实施约定，不再提供 Fork Core、vendor 框架源码或旧 pipeline 的替代方案。系统职责见 [architecture.zh.md](architecture.zh.md)，业务设计见 [design.zh-CN.md](design.zh-CN.md)，Agent 执行规则见 [AGENTS.md](../AGENTS.md)。

## 分层与扩展入口

- 官方 DSH：使用已发布公共导出，依赖固定到 `config/dsh-baseline.json`；不复制、patch 或修改框架源码。
- 应用插件：`plugins/` 下独立 `@lai/*` 包，以 Bundle / Profile 组合。新增来源使用 Superagent Source 接口和 provider-neutral Trigger；新增工具使用标准 `ctx.tools.register`。
- 编排：`Superagent Router(Monitor)` 负责监控与路由；LAI Orchestrator 依次调用五个原生子 Agent。不要新增第二套调度、MQ 或独立模拟 pipeline。
- 浏览器与兼容层：协议和版本适配在 `packages/dsh-adapter`。`app/lai-web/src/router/routes.tsx` 唯一维护路由与菜单；布局在 `layout/`、页面在 `pages/`、复用组件在 `components/`。
- 配置：仓库默认值、环境覆盖、用户运行时设置分开。真实凭证和历史留在 `.runtime/dsh`，不提交到 Git。

## 新增插件流程

1. 获取最新 `main`，为该插件创建独立分支；默认 `codex/<plugin-name>`，用户指定的分支名优先。
2. 新建 `plugins/<name>/package.json`，使用 `@lai` 命名，固定官方 peer 版本。通过公开导出、Cordis effects 和 Bundle 注册；不要依赖 `.reference`。
3. 按需要接入应用 Profile、配置界面、工具或 scoped Skill。工具挂载、Skill 可发现性、数据访问授权分别设计，不能互相替代。
4. 同步插件 README、相关中英文架构／设计说明，以及版本号和依赖元数据；不写入真实账号、密钥、token 或运行时数据。
5. 按任务允许的范围构建／检查；真实模型和外部服务验证另行授权。用户禁止测试或浏览器时不执行。
6. 提交并推送插件分支，创建指向 `main` 的 PR，通过 PR 合并。不要直接在主分支实现新插件。

## 组件版本

每次更新组件，包括组件文档，必须在同一提交／PR bump 对应 package.json。日常界面、汉化、文档、修复和小步迭代只递增末尾 patch，末尾数字可无限增加（例如 0.3.9 → 0.3.10）；不自动升 minor／major，除非用户明确指定。多个组件分别 bump，不以根版本替代插件版本。全应用改动同时 bump 根 manifest。

Settings 显示构建时从 manifest 收集的应用和插件版本，因此修改版本后需重新构建；不要手写 UI 版本号。应用版本独立于官方 DSH 基线，普通业务更新不升级官方依赖。发布前保持 workspace 依赖和 lockfile 一致，不在文档中固定容易过期的当前应用版本。

## 生命周期与权限

服务、工具、Skill、路由和监听器通过 Cordis effects 注册并释放。停止时先取消并等待执行、子 Agent、LAI Orchestrator 和持久化 effects，再释放依赖和状态锁。

Credentials 工具从执行上下文取得调用 Agent 的 preset，实时检查 enabled、allowedPresets；更新再检查 allowUpdates。Skill 只传递操作说明，既不授予工具，也不授予凭证访问。角色工具选择在新 Run 留存快照，不能随配置变化悄悄改写既有执行权限。

## 升级官方 DSH

1. 在独立升级分支中阅读目标版本的公共 API 与迁移说明。
2. 明确更新 `config/dsh-baseline.json` 及相关官方 peer/dev 依赖。
3. 差异封装到 `packages/dsh-adapter`，业务使用公开服务和接口。
4. 保留用户设置、session、Ticket 和 Assignment 历史，明确迁移与回退步骤。
5. 按允许范围运行架构检查、构建、类型和本地确定性 fixtures；真实模型验证单独报告。
6. 提 PR 评审并合并，不通过编辑 node_modules 或复制框架源码规避差异。

源码主仓库：[IQE-SUZHOU/LAI-Superagent](https://github.com/IQE-SUZHOU/LAI-Superagent)。
