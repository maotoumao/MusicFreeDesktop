<div align="center">

# 🎵 MusicFree 桌面版

**插件化、定制化、无广告的免费音乐播放器**

[![GitHub Stars](https://img.shields.io/github/stars/maotoumao/MusicFreeDesktop?style=flat&logo=github&color=yellow)](https://github.com/maotoumao/MusicFreeDesktop/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/maotoumao/MusicFreeDesktop?style=flat&logo=github)](https://github.com/maotoumao/MusicFreeDesktop/network/members)
[![GitCode Stars](https://gitcode.com/maotoumao/MusicFreeDesktop/star/badge.svg)](https://gitcode.com/maotoumao/MusicFreeDesktop)
[![License](https://img.shields.io/github/license/maotoumao/MusicFreeDesktop?style=flat&color=blue)](./LICENSE)
[![Downloads](https://img.shields.io/github/downloads/maotoumao/MusicFreeDesktop/total?style=flat&color=green)](https://github.com/maotoumao/MusicFreeDesktop/releases)
[![Issues](https://img.shields.io/github/issues/maotoumao/MusicFreeDesktop?style=flat)](https://github.com/maotoumao/MusicFreeDesktop/issues)
[![Version](https://img.shields.io/github/package-json/v/maotoumao/MusicFreeDesktop?style=flat&color=orange)](./package.json)

<a href="https://trendshift.io/repositories/3961" target="_blank"><img src="https://trendshift.io/api/badge/repositories/3961" alt="maotoumao%2FMusicFreeDesktop | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

**[English](./README_EN.md)** | 简体中文

</div>

---

> [!IMPORTANT]
> **项目使用约定**
>
> 本项目基于 [AGPL 3.0](./LICENSE) 协议开源，使用此项目时请遵守开源协议。此外，希望你在使用代码时已了解以下额外说明：
>
> 1. 打包、二次分发**请保留代码出处**：https://github.com/maotoumao/MusicFree
> 2. 请不要用于商业用途，合法合规使用代码
> 3. 如果开源协议变更，将在此 GitHub 仓库更新，不另行通知

---

## ✨ 简介

一个插件化、定制化、无广告的免费音乐播放器，支持 **Windows**、**macOS** 和 **Linux**。

<img src="./src/assets/imgs/wechat_channel1.png" height="144px" title="微信公众号" />

### 📥 下载

👉 [飞书云文档](https://r0rvr854dd1.feishu.cn/drive/folder/IrVEfD67KlWZGkdqwjecLHFNnBb?from=from_copylink)

---

## 🚀 特性

|     特性      | 说明                                                                                                                                                                     |
| :-----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **🔌 插件化** | 本软件仅仅是一个播放器，本身**不集成**任何平台的任何音源。所有搜索、播放、歌单导入等功能全部基于**插件**——只要互联网上有对应音源的插件，你都可以用本软件进行搜索和播放。 |
| **🎨 定制化** | 通过主题包自定义软件外观与背景，支持全新的语义化 CSS 变量系统和 iframe 背景。详见下方 [主题包](#-主题包) 章节。                                                          |
| **🚫 无广告** | 基于 AGPL 3.0 协议开源，将会保持免费。                                                                                                                                   |
|  **🔒 隐私**  | 所有数据存储在本地，不会上传你的个人信息。                                                                                                                               |

**插件支持的功能**：搜索（音乐、专辑、作者、歌单）、播放、查看专辑、查看作者详情、导入单曲、导入歌单、获取歌词、排行榜、推荐歌单、歌曲评论、多音质切换（标准 / 高品 / 超品 / 无损）。

---

## 🔌 插件

MusicFree 的核心能力由插件驱动。插件协议与 [安卓版](https://github.com/maotoumao/MusicFree) 保持兼容，桌面版在此基础上扩展了更多能力。

### 插件仓库

- **示例插件**：[MusicFreePlugins](https://github.com/maotoumao/MusicFreePlugins)
- **开发文档**：[插件开发指南](https://musicfree.catcat.work/plugin/introduction.html)

### 插件能力一览

```
搜索 ─── 音乐 / 专辑 / 作者 / 歌单
播放 ─── 多音质切换 · 音源重定向
内容 ─── 专辑详情 · 作者作品 · 歌词 · 歌曲评论
发现 ─── 排行榜 · 推荐歌单 · 歌单分类
导入 ─── 单曲导入 · 歌单导入
```

### 插件沙箱

插件运行在安全沙箱中，可使用以下内置模块：

`axios` · `cheerio` · `dayjs` · `big-integer` · `qs` · `he` · `crypto-js` · `webdav`

---

## 🎨 主题包

MusicFree 支持通过主题包自定义界面外观。内置两套主题：**浅色** 和 **纯黑（AMOLED）**。

### 主题包结构

一个主题包是一个文件夹（或 `.mftheme` 压缩包），包含以下文件：

```
my-theme/
├── config.json      # 主题配置（必需）
├── index.css        # 样式定义（必需）
├── preview.png      # 预览图（可选）
└── iframes/         # iframe 背景（可选）
    └── app.html
```

### config.json

```jsonc
{
    "name": "主题名称", // 必需
    "preview": "#000000", // 预览色或图片路径
    "description": "主题描述",
    "author": "作者",
    "authorUrl": "https://...",
    "version": "1.0.0",
    "srcUrl": "https://...", // 远程更新地址
    "thumb": "@/thumb.png", // 缩略图
    "blurHash": "LEHV6nWB2yk8pyo...", // 加载占位（BlurHash）
    "iframe": {
        "app": "@/iframes/app.html", // 软件整体背景
    },
}
```

> 路径中使用 `@/` 表示主题包根目录。

### index.css — 语义化 CSS 变量系统

新版采用 **语义化 CSS 变量** 设计，按视觉用途分为六大类。你可以在 `index.css` 中覆盖这些变量来定义主题色彩：

|   分类   |        前缀        | 用途                      | 示例                                               |
| :------: | :----------------: | ------------------------- | -------------------------------------------------- |
| **背景** |   `--color-bg-*`   | 页面、侧栏、弹窗等背景色  | `--color-bg-base`、`--color-bg-sidebar`            |
| **填充** |  `--color-fill-*`  | 按钮、交互元素的填充色    | `--color-fill-brand`、`--color-fill-neutral-hover` |
| **文本** |  `--color-text-*`  | 各级文本颜色              | `--color-text-primary`、`--color-text-secondary`   |
| **边框** | `--color-border-*` | 分割线、边框              | `--color-border-default`、`--color-border-subtle`  |
| **状态** | `--color-status-*` | 信息 / 警告 / 危险 / 成功 | `--color-status-danger-text`                       |
| **阴影** |    `--shadow-*`    | 各级投影                  | `--shadow-sm`、`--shadow-lg`                       |

> 完整变量列表请参考内置主题 [`res/builtin-themes/light/index.css`](./res/builtin-themes/light/index.css)。

### iframe 背景

通过 `config.json` 中的 `iframe.app` 字段，你可以将任意 HTML 页面设为软件背景，实现粒子、动画等纯 CSS 无法实现的效果。支持本地 HTML 文件和远程 URL。

### 主题包示例

示例仓库：https://github.com/maotoumao/MusicFreeThemePacks

---

## 🛠️ 启动项目

### 环境要求

|  依赖   |  版本  |
| :-----: | :----: |
| Node.js | >= 18  |
|  pnpm   | latest |

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/maotoumao/MusicFreeDesktop.git
cd MusicFreeDesktop

# 安装依赖
pnpm install

# 启动应用
pnpm start

# 开发模式（启用 Electron DevTools）
pnpm run dev
```

### 常用命令

|       命令        | 说明       |
| :---------------: | ---------- |
|   `pnpm start`    | 启动应用   |
|  `pnpm run dev`   | 开发模式   |
|  `pnpm run make`  | 构建安装包 |
|  `pnpm run lint`  | 代码检查   |
| `pnpm run format` | 代码格式化 |

---

## 🤝 参与贡献

欢迎参与贡献！请阅读 [贡献指南](./CONTRIBUTING.md) 了解开发规范与提交流程。

---

## � 支持这个项目

如果你喜欢这个项目，或者希望我可以持续维护下去，你可以通过以下方式支持：

1. ⭐ Star 这个项目，分享给你身边的人
2. 关注公众号【一只猫头猫】获取最新信息

<img src="./src/assets/imgs/wechat_channel.jpg" height="160px" title="微信公众号" />

---

## 📸 截图

#### 主页

![主页](./.imgs/screenshot-home.png)

#### 搜索

![搜索](./.imgs/screenshot-search.png)

#### 插件管理

![插件管理](./.imgs/screenshot-plugin.png)

#### 主题广场

![主题](./.imgs/screenshot-theme.png)

#### 设置

![设置](./.imgs/screenshot-settings.png)

#### 迷你模式

<div align="center">

![迷你模式](./.imgs/screenshot-minimode.png)

</div>
