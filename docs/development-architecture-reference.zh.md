# DeepSeek Harness（DSH）二次开发架构与上游同步方案

> 目标：让自定义插件、业务代码与 DSH 上游框架解耦，同时可控地引入官方新特性、修复与安全更新。
>
> 说明：以下是推荐的工程设计。具体插件 API、Profile/Bundle 配置格式和构建脚本应以所采用的 DSH 版本为准。

## 1. 核心原则

1. **业务逻辑不侵入 Core**：优先通过公开插件 API、事件和服务扩展功能。
2. **上游版本固定**：生产环境使用明确的版本号、Tag 或 Commit，不直接追踪 `master`。
3. **插件独立管理**：自定义插件以独立包组织，允许单独测试、发布和回滚。
4. **最小化 Core Patch**：必须修改框架核心时，一个改动对应一个独立提交和回归测试。
5. **先集成，后升级**：上游更新先进入集成分支，通过兼容性测试后再合并到产品分支。

## 2. 推荐架构

```text
┌──────────────────────────────────────────────┐
│               Your Application               │
│          Frontend / Backend / API            │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────────────▼───────────────────────┐
│            Integration / Adapter             │
│       DSH API 封装、版本兼容、依赖注入        │
└──────────────────────┬───────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
┌───────────▼──────────┐ ┌────────▼────────────┐
│  Custom Plugins      │ │ Minimal Core Patch  │
│  memory/tools/flow   │ │ 仅未暴露的核心能力  │
└───────────┬──────────┘ └────────┬────────────┘
            │                     │
            └──────────┬──────────┘
                       │
┌──────────────────────▼───────────────────────┐
│          DeepSeek Harness Upstream           │
│       固定版本 / 可控升级 / 自动化测试        │
└──────────────────────────────────────────────┘
```

推荐采用**独立应用仓库 + 独立插件包 + 固定 DSH 版本 + 自动化兼容性测试**。

## 3. 项目目录结构

```text
my-agent/
├── app/
│   ├── frontend/                 # 产品前端
│   └── backend/                  # 产品后端/API
│
├── packages/
│   └── dsh-adapter/              # DSH API 封装与兼容层
│
├── plugins/
│   ├── my-memory/                # 记忆能力
│   ├── my-tools/                 # 工具集
│   ├── my-workflow/              # Agent 工作流/执行策略
│   └── my-ui/                    # 可选：界面扩展
│
├── bundles/                      # 若当前 DSH 版本支持 Bundle
│   └── my-agent-bundle/
│
├── config/
│   ├── development/
│   ├── production/
│   └── cordis.patch.yml          # 具体格式以版本文档为准
│
├── patches/                      # 不可避免的框架修改
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/                 # 插件 API/Hook 契约测试
│   └── migration/                # 配置、会话和持久化迁移
│
├── vendor/
│   └── deepseek-harness/         # 可选：Submodule / Fork
├── pnpm-workspace.yaml
└── README.md
```

> `vendor/` 并非必需。如果 DSH 可以作为依赖包使用，应优先使用包依赖而非复制源码。

## 4. 自定义插件的控制与生命周期

### 4.1 插件职责边界

| 模块 | 职责 | 推荐方式 |
| --- | --- | --- |
| `my-tools` | 增加 Agent 可调用工具 | 插件与公开工具注册 API |
| `my-memory` | 搜索、存储和召回上下文 | 独立服务 + 插件适配 |
| `my-workflow` | 工作流、工具执行策略和拦截 | 公开 Hook / Event |
| `my-ui` | 自定义 UI 能力 | 客户端插件或独立前端 |
| `dsh-adapter` | 屏蔽 DSH API 版本差异 | 单独适配层 |

### 4.2 插件配置分层

如果所用版本提供 Profile、Bundle 和 Patch 机制，建议采用以下配置分层：

- **Bundle**：定义功能组合及默认依赖。
- **Profile**：选择环境或产品形态所需的插件组合。
- **Environment Patch**：区分本地、测试和生产环境配置。
- **User/Home Patch**：仅存放适合用户级覆盖的配置，避免承载核心业务逻辑。

插件的启用、禁用、替换，优先通过这些配置控制；**不要通过反复修改官方源文件来切换功能**。

### 4.3 插件开发规范

- 每个插件维护独立 `package.json`、README、配置 Schema 和测试。
- 插件只能依赖公开 API；不直接导入 DSH 内部私有文件路径。
- 服务接口必须明确输入、输出、错误语义和超时约束。
- 对插件版本进行语义化管理；重大兼容性变更提升 Major 版本。
- 权限敏感的工具需验证授权、记录审计日志，并支持禁用。
- 避免插件间形成循环依赖。

以下是**示意性伪代码**（并非保证适用于所有 DSH 版本）：

```ts
export function apply(ctx: Context) {
  ctx.on('tools/pre-execute', async (execution, next) => {
    // 例如：权限检查 / 审计 / 参数校验
    return next()
  })
}
```

具体 Hook 名称、`Context` 类型导入位置及插件注册方式，应以当前 DSH 官方文档和类型定义为准。

## 5. 上游更新策略

### 方案 A：包依赖升级（首选）

适用条件：不修改 DSH Core，所有需求均可通过 API、插件、Adapter 实现。

1. 锁定当前稳定可用的 DSH 依赖版本。
2. 在独立集成分支升级依赖和锁文件。
3. 运行单元、插件契约、集成及回归测试。
4. 检查 Release Notes 与破坏兼容的 API 变更。
5. 测试通过后再合并到 `develop` 和生产发布分支。

**优势：** 不需要维护长期 Fork，也几乎没有上游源码合并冲突。

### 方案 B：Fork + Upstream（必须改 Core 时）

```bash
# 首次配置
 git clone git@github.com:YOUR_NAME/deepseek-harness.git
 cd deepseek-harness
 git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
 git fetch upstream
```

建议分支职责：

| 分支 | 用途 |
| --- | --- |
| `upstream-sync` | 保存已验证的上游基线 |
| `develop` | 你的产品开发分支 |
| `integration/dsh-<version>` | 引入指定上游版本并验证 |
| `release/*` | 生产发布与热修复 |

**示例更新流程**：

```bash
# 在 Fork 中获取上游更新
 git fetch upstream

# 从产品开发分支创建隔离的集成分支
 git switch develop
 git switch -c integration/dsh-update

# 示例：当上游默认分支确为 master 时
 git merge upstream/master

# 处理冲突后，运行项目实际存在的构建和测试脚本
 pnpm install --frozen-lockfile
 pnpm run build
 pnpm test
```

> 注意：官方默认分支未必叫 `master`，应先检查实际仓库。构建命令也应以仓库 `package.json` 中的脚本为准。正式升级更建议以特定 Tag 或 Commit 为合并目标，而不是无条件合并最新默认分支。

可开启 `rerere` 辅助处理重复出现的 Git 冲突：

```bash
 git config rerere.enabled true
```

`rerere` 只能复用冲突解决记录，不能保证修改后的程序语义正确。

## 6. 兼容性与回归测试

推荐维护以下兼容性矩阵：

| 目标版本 | 目的 | 合并条件 |
| --- | --- | --- |
| 当前生产版本 | 防止现有功能回归 | 全部关键测试通过 |
| 最新官方 Release | 验证近期升级可行性 | 契约、集成、迁移测试通过 |
| 上游默认分支 | 预警未来破坏性变更 | 可允许实验性失败，但需记录原因 |

至少覆盖以下测试场景：

1. **插件装载**：启动、卸载、依赖关系与配置覆盖。
2. **工具执行**：工具注册、调用、错误处理、权限校验。
3. **Agent 流程**：普通请求、多轮会话、工具调用、失败恢复。
4. **状态与数据迁移**：Session、配置、存储 Schema 的前后兼容。
5. **应用集成**：前端请求、后端 API、插件服务链路。
6. **版本回滚**：更新失败后能否恢复到原有可运行版本。

建议在 CI 中自动执行**生产基线版本**和**候选升级版本**两组测试；上游默认分支的兼容性检查可以单独设为非阻塞任务。

## 7. 插件还是 Core Patch：决策矩阵

| 需求 | 优先实现方式 |
| --- | --- |
| 新增工具或工具策略 | Plugin |
| 新增记忆、搜索或上下文处理 | Plugin + 独立服务 |
| 新增模型 Provider | Plugin / Adapter |
| 定制 Prompt 和上下文组装 | 配置或公开扩展点 |
| 监听或拦截执行过程 | Event / Hook |
| 自定义业务 UI | 独立前端或支持的客户端插件 |
| 更改 Agent Loop 内部算法 | 先检查可替换模块，必要时 Core Patch |
| 修改未暴露的协议 / 私有 API | 最小化 Core Patch，优先争取上游扩展点 |

判断顺序：

```text
有公开 API / Hook 吗？
   ├─ 是 → 实现插件
   └─ 否 → 能用 Adapter/Wrapper 实现吗？
             ├─ 是 → 独立适配层
             └─ 否 → 最小化 Core Patch + 测试 + 上游提案
```

## 8. 推荐落地步骤

**阶段 1：隔离业务代码**

- 建立 `app/`、`plugins/`、`packages/dsh-adapter/`。
- 确定 DSH 基线版本和锁文件。
- 禁止业务代码直接引用 DSH 私有源码。

**阶段 2：建立插件生命周期**

- 将已有定制逻辑拆分为插件。
- 配置插件开关、版本与环境差异。
- 引入单元测试和契约测试。

**阶段 3：建立上游集成流水线**

- 增加独立升级分支。
- 在 CI 中运行生产版本及候选版本测试。
- 增加 Release Notes 审查、迁移检查和回滚策略。

**阶段 4：优化长期维护成本**

- 清理重复或失效的 Core Patch。
- 将通用能力尽可能贡献回上游。
- 对易变的 DSH API 统一收敛到 Adapter 层。

## 9. 一句话结论

> **将 DSH 视为可升级的基础框架，而不是长期直接修改的业务仓库。** 自有插件和业务代码独立维护；上游更新通过固定版本、集成分支、契约测试和可回滚发布进入应用。

## 10. 参考资料

- [DeepSeek Harness GitHub](https://github.com/deepseek-ai/deepseek-harness)
- [DSH Architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [DSH Extension Cookbook](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/extension-cookbook.md)

*注：参考链接中的文档路径及分支名可能随着上游项目演进而变化。*
