# 贡献指南 | Contributing Guide

感谢你有兴趣为 MusicFree 贡献代码！以下是参与贡献的流程和规范。

Thank you for your interest in contributing to MusicFree! Below are the guidelines and workflow for contributing.

---

## 📋 目录 | Table of Contents

- [行为准则 | Code of Conduct](#-行为准则--code-of-conduct)
- [开发环境 | Development Setup](#-开发环境--development-setup)
- [提交流程 | Contribution Workflow](#-提交流程--contribution-workflow)
- [代码规范 | Code Style](#-代码规范--code-style)
- [提交规范 | Commit Convention](#-提交规范--commit-convention)
- [项目架构 | Project Architecture](#-项目架构--project-architecture)

---

## 📝 行为准则 | Code of Conduct

- 尊重所有参与者，保持友善和建设性的讨论
- 不要提交包含具体音源的代码——MusicFree 仅是播放器，音源通过插件提供
- 遵守 AGPL 3.0 协议

> Be respectful to all participants. Do not submit code containing specific music sources — MusicFree is a player only; sources are provided via plugins. Follow the AGPL 3.0 license.

---

## 🛠️ 开发环境 | Development Setup

### 环境要求 | Prerequisites

| 依赖 Dependency | 版本 Version |
| :-------------: | :----------: |
|     Node.js     |    >= 18     |
|      pnpm       |    latest    |
|       Git       |    latest    |

### 快速启动 | Quick Start

```bash
git clone https://github.com/maotoumao/MusicFreeDesktop.git
cd MusicFreeDesktop
pnpm install
pnpm run dev
```

---

## 🔄 提交流程 | Contribution Workflow

```
1. Fork ──→ 2. Branch ──→ 3. Develop ──→ 4. Lint & Test ──→ 5. PR
```

### 详细步骤 | Steps

**1. Fork 并克隆 | Fork & Clone**

```bash
# Fork 仓库后克隆你的 fork
git clone https://github.com/<your-username>/MusicFreeDesktop.git
cd MusicFreeDesktop
pnpm install
```

**2. 创建分支 | Create a Branch**

```bash
git checkout -b feat/your-feature-name
# 或 / or
git checkout -b fix/your-bug-fix
```

**3. 开发 | Develop**

- 遵循下方的代码规范
- 确保你的改动范围尽量精简，每个 PR 专注于一个功能或修复

> Keep changes focused — one feature or fix per PR.

**4. 提交前检查 | Pre-commit Check**

```bash
pnpm run lint        # 检查代码规范
pnpm run format      # 格式化代码
```

> 项目配置了 Husky + lint-staged，提交时会自动运行 Prettier 和 ESLint。
>
> Husky + lint-staged are configured — Prettier and ESLint run automatically on commit.

**5. 提交 PR | Create a Pull Request**

- 填写清晰的 PR 描述，说明改动内容和原因
- 关联相关 Issue（如有）

---

## 🎨 代码规范 | Code Style

项目已配置自动化工具，提交时会自动执行格式化和检查：

|    工具 Tool     |     配置 Config     | 说明 Description                         |
| :--------------: | :-----------------: | ---------------------------------------- |
|   **Prettier**   |    `.prettierrc`    | 4 空格缩进、单引号、100 字符行宽、尾逗号 |
|    **ESLint**    | `eslint.config.mjs` | TypeScript 严格模式 + import 排序        |
| **EditorConfig** |   `.editorconfig`   | UTF-8、LF 换行、2 空格（基础）           |

### 要点 | Key Points

- 使用 **TypeScript** 编写所有代码
- 缩进：**4 空格**
- 引号：**单引号**
- 行宽限制：**100 字符**
- 尾随逗号：**始终添加**

---

## 📦 提交规范 | Commit Convention

推荐使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

# 示例 | Examples
feat(plugin): add comment support
fix(player): resolve playback stutter on seek
docs(readme): update theme pack section
style(sidebar): adjust item spacing
refactor(database): migrate to new query builder
```

**常用类型 | Common Types**

| 类型 Type  | 说明 Description                        |
| :--------: | --------------------------------------- |
|   `feat`   | 新功能 New feature                      |
|   `fix`    | 修复 Bug fix                            |
|   `docs`   | 文档 Documentation                      |
|  `style`   | 样式调整（非 CSS） Code style (not CSS) |
| `refactor` | 重构 Refactoring                        |
|   `perf`   | 性能优化 Performance                    |
|  `chore`   | 构建/工具 Build/tooling                 |

---

## 🏗️ 项目架构 | Project Architecture

```
src/
├── main/              # Electron 主进程 | Main process
├── preload/           # 预加载脚本 | Preload scripts
├── renderer/          # 渲染进程 | Renderer process
│   ├── mainWindow/    #   主窗口 | Main window
│   ├── lyricWindow/   #   歌词窗口 | Lyric window
│   └── minimodeWindow/#   迷你模式 | Mini mode
├── infra/             # 基础设施层 | Infrastructure layer
│   ├── pluginManager/ #   插件管理 | Plugin manager
│   ├── themepack/     #   主题包 | Theme packs
│   ├── database/      #   数据库 | Database
│   ├── downloadManager/#  下载管理 | Downloads
│   ├── musicSheet/    #   歌单管理 | Music sheets
│   ├── i18n/          #   国际化 | i18n
│   └── ...            #   其他模块 | Other modules
├── common/            # 跨进程共享代码 | Shared utilities
└── types/             # 类型定义 | Type definitions
```

### 架构要点 | Architecture Highlights

- **进程分层**：代码按 `main` / `preload` / `renderer` 分层，通过 IPC 通信
- **Infra 模块**：每个基础设施模块都遵循分层结构（`main/` · `preload/` · `renderer/` · `common/`）
- **状态管理**：使用 [Jotai](https://jotai.org/) 进行原子化状态管理
- **路由**：使用 React Router v7
- **样式**：CSS Modules + 语义化 CSS 变量（Design Tokens）

> **Process layering**: Code is split into `main` / `preload` / `renderer`, communicating via IPC. Each infra module follows this layered structure. State is managed with Jotai atoms.

---

感谢你的贡献！🎉

Thank you for contributing! 🎉
