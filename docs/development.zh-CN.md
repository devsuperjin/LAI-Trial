# LAI Superagent 开发手册

[English](development.md) | **简体中文**

本文面向维护者和插件开发者。使用与配置见 [Guide](guide.zh-CN.md)，系统职责见[架构](architecture.zh.md)，协作规则见 [AGENTS.md](../AGENTS.md)。

## DSH 二次开发规范

本项目采用独立应用仓库的方式维护二次开发，当前官方 DSH 基线为 **`0.2.2-rc.1`**，以 [`config/dsh-baseline.json`](config/dsh-baseline.json) 为准。

### 依赖与插件组合

- 应用包统一使用 **`@lai`** 命名空间；官方 DSH 依赖和 Peer 依赖固定到基线版本。
- 使用官方发布的导出接口，以及 **Bundle / Profile 组合和环境覆盖** 扩展功能。
- 不复制、不直接修改官方 DSH 框架源码，不导入其私有构建路径。
- DSH 版本差异和浏览器 RPC 协议集中在 **`packages/dsh-adapter`**，业务代码不分散处理兼容分支。
- 保持 Superagent 对事件、路由和任务生命周期的统一所有权；新增 CI / GitHub 来源沿用其 Source 机制，不再增加平行触发层或 MQ 依赖。

### Agent 与生命周期

- 专业角色由 `plugins/lai-agents` 定义，LAI Orchestrator 必须调用原生子 Agent，不能用新建独立会话来替代父子关系。
- 五阶段顺序由运行约束保证，不能仅依赖 Prompt 中的口头约定。
- 工具、事件监听、Prompt 和服务注册通过 Cordis 生命周期管理并释放。
- 停止或卸载时，先等待任务取消、子 Agent 停止和 LAI Orchestrator 清理，再释放所依赖的服务。
- 保留原生会话、工具调用、执行回执与持久化记录，使 lai-web 和原版 DSH 能查看同一执行过程。

### 配置、数据与凭据

- 应用默认值属于仓库配置，用户覆盖值属于运行 Profile；升级和迁移不得覆盖已有模型设置、凭据或会话。
- 使用设置接口及版本检查保存配置，避免无条件覆盖其他页面或进程的修改。
- 凭据通过 DSH 的凭据接口维护，不写入提交的配置、源码或示例。
- `.runtime` 与用户原有的其他 DSH 数据目录保持隔离，不将本地状态纳入 Git。

### 验证与上游升级

集成改动应运行：

```sh
pnpm check
```

这会检查架构、构建、类型和本地测试，包括 Superagent 的 Fixture 测试。流水线验证使用确定性驱动和本地数据；真实模型验证单独进行，会产生实际 API 费用。

升级 DSH 时，在独立集成分支中选择明确版本，更新依赖和锁文件，核对公开接口及持久化格式，并在合并前完成兼容检查。仓库提供版本更新脚本：

```sh
node scripts/set-dsh-version.mjs <exact-version>
pnpm install --no-frozen-lockfile
pnpm check
```

同时更新基线记录，并保留旧版本代码、锁文件及匹配的数据备份。更新 Superagent 业务代码时，需要保留 LAI 的 LAI Orchestrator 预设、串行约束、管理 API 鉴权和同账号 Issue 配置等本地改动。

## 常用开发命令

| 命令 | 用途 |
| --- | --- |
| `pnpm start` | 构建并启动统一应用 |
| `pnpm build` | 构建全部工作区包 |
| `pnpm start:backend` | 使用已有构建启动后端，不自动打开浏览器 |
| `pnpm dev:web` | 单独启动前端开发服务器，需配合后端使用 |
| `pnpm config:dump` | 查看组合后的 DSH 配置 |
| `pnpm check:architecture` | 检查命名空间、依赖版本和导入边界 |
| `pnpm check` | 执行完整本地检查 |

## 分支与组件版本

新增插件从最新 main 创建独立分支，通过 PR 合并；不直接在主分支新增插件。每次更新组件（包括文档）在同一提交／PR bump 对应 package.json。日常界面、汉化、文档、修复和小步迭代只递增末尾 patch，末尾数字可无限增加（例如 0.3.9 → 0.3.10），不自动升 minor／major，除非用户明确指定。全应用修改同时 bump 根 manifest；官方 DSH 基线独立维护。

## Web 目录

`app/lai-web/src/router/routes.tsx` 统一配置路由、菜单、标题及页面渲染。`layout/` 放公共外壳、标题、Panel 和 Tab，`pages/` 放业务页面，`components/` 放复用组件，不放页面转发文件。

## 检查与用户限制

上述检查是常规开发流程；用户明确限制测试、验证或浏览器时遵守限制，并报告实际执行范围。构建不等于测试通过。真实模型／外部服务验证单独执行，不将实际 token 或密码写入日志和 fixture。

更详细的分层与升级步骤见[开发架构参考](development-architecture-reference.zh.md)。
