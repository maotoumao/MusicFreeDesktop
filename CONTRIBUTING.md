# 贡献指南 | Contributing Guide

感谢你对 MusicFree 的关注！在参与之前，请先了解下面的说明。

Thank you for your interest in MusicFree! Please read the notes below before getting involved.

---

## 📋 目录 | Table of Contents

- [行为准则 | Code of Conduct](#-行为准则--code-of-conduct)
- [参与方式 | How to Participate](#-参与方式--how-to-participate)
- [开发环境 | Development Setup](#-开发环境--development-setup)
- [代码规范 | Code Style](#-代码规范--code-style)
- [提交规范 | Commit Convention](#-提交规范--commit-convention)
- [项目架构 | Project Architecture](#-项目架构--project-architecture)

---

## 📝 行为准则 | Code of Conduct

- 尊重所有参与者，保持友善和建设性的讨论
- MusicFree 仅是播放器，不包含任何具体音源，音源通过插件提供
- 遵守 AGPL 3.0 协议

> Be respectful to all participants. MusicFree is a player only and contains no music sources; sources are provided via plugins. Follow the AGPL 3.0 license.

---

## 🤝 参与方式 | How to Participate

**本项目目前不接受 Pull Request。** 为了保持整体设计和代码风格的一致，代码改动都由维护者完成，收到的 PR 会被关闭，还请见谅。

这并不意味着你的想法不重要，非常欢迎通过以下方式参与：

- **反馈问题**：提交 [Bug 报告](https://github.com/maotoumao/MusicFreeDesktop/issues/new/choose)，附上复现步骤和日志会很有帮助
- **提出建议**：提交 [功能建议](https://github.com/maotoumao/MusicFreeDesktop/issues/new/choose)，说明使用场景和期望的效果
- **交流讨论**：前往 [Discussions](https://github.com/maotoumao/MusicFreeDesktop/discussions) 提问或分享使用经验
- **分享思路**：如果你已经在自己的 fork 里实现了某个改动，欢迎在 Issue 里描述思路并附上链接，维护者可能会参考它来实现

> **Pull requests are not accepted at the moment.** To keep the overall design and code style consistent, all code changes are made by the maintainer, and pull requests will be closed — thank you for understanding.
>
> Your ideas still matter, and you are very welcome to take part by:
>
> - **Reporting bugs** via a [bug report](https://github.com/maotoumao/MusicFreeDesktop/issues/new/choose); steps to reproduce and logs help a lot
> - **Suggesting features** via a [feature request](https://github.com/maotoumao/MusicFreeDesktop/issues/new/choose), describing the use case and the expected result
> - **Joining the conversation** in [Discussions](https://github.com/maotoumao/MusicFreeDesktop/discussions)
> - **Sharing your approach**: if you have already implemented a change in your own fork, describe it in an issue with a link; the maintainer may use it as a reference

---

## 🛠️ 开发环境 | Development Setup

以下内容供自行构建或在 fork 中开发时参考。

> The following is for reference when building locally or developing in your own fork.

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
│   ├── playlist/      #   歌单管理 | Playlists
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

感谢你的支持！🎉

Thank you for your support! 🎉
