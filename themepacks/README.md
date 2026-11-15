# 主题包（themepack）

MusicFree 桌面版的视觉层。**不是插件**——插件（`src/shared/plugin-manager`）只负责取音乐数据，
做不了界面外观；能改界面的是主题包：一层 CSS 变量覆盖 + 可选的 iframe 动态背景。

## 目录

```
themepacks/
└── wmp-metal/            # WMP 风格深色金属主题
    ├── config.json       # 必须：元信息 + iframe 映射
    ├── index.css         # 必须：CSS 变量覆盖 + 组件级覆盖
    ├── iframes/
    │   └── spectrum-bg.html   # 频谱柱可视化（canvas）
    └── imgs/
        └── preview.svg   # 预览图（也可直接写 "#232c36" 色值）
```

运行时位置：`portable/userData/musicfree-themepacks/<主题名>/`。
源码仓库里放一份，运行时那份要**同步过去**（两边各一份，不会自动同步）。

## 这个版本的变量体系是 camelCase

社区新版本主题市场用的是 `--color-bg-base` / `--color-fill-brand` 这类 kebab-case 变量，
**在本仓库（0.0.8）里完全不存在**。本版本只有 `src/renderer/document/styles/variables.scss` 里那 20 个：

```
--primaryColor  --backgroundColor  --backdropColor  --placeholderColor
--textColor     --headerTextColor --musicBarTextColor
--linkColor     --successColor     --dangerColor     --infoColor
--dividerColor --listEvenColor    --listHoverColor --listActiveColor
--maskColor     --shadowColor     --headerPlaceholderColor
--scrollbarWidth --fontSize --appHeaderHeight --appMusicBarHeight --animate-duration
```

完整清单见 `src/renderer/document/styles/variables.scss` 与 `src/renderer/app.scss` 的 `:root` 块。
`--backdropColor` / `--headerPlaceholderColor` / `--musicBarTextColor` 在 app.scss 里是**注释掉的**，
不定义就会回退到 `--backgroundColor`，想要不同值必须自己定义。

## 三个必踩的坑

### 1. 用 `html:root`，不要用 `:root`

webpack 的样式在运行时注入到 `<head>`，**加载顺序晚于**主题包的 `<style id="themepack-node">`。
两边都是 `:root`（特异性 0,1,0）时，应用自己的 `:root` 会把主题变量覆盖回去。

```css
/* 对：特异性 (0,1,1) > (0,1,0)，压得住 */
html:root { --primaryColor: #f0a020; }
```

同理，组件级覆盖要提高特异性：

```css
/* .background-color 是工具类，特异性相同会按加载顺序输 */
.music-bar-container.music-bar-container { background: linear-gradient(...); }
```

### 2. iframe 定位必须显式写 `top: auto`

应用自带一条全局规则：

```css
iframe { width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0; ... }
```

`top: 0` 会一直生效。只写 `bottom: 0` 的话，`top` 和 `bottom` 同时存在、而 `height` 非 auto，
浏览器按 `top` 定位 —— 元素会被顶到容器顶部而不是底部。

```css
.app-container > iframe {
    position: absolute;
    top: auto;                              /* 必须 */
    bottom: var(--appMusicBarHeight);
    height: 20%;
}
```

### 3. 改完必须重启应用

打包版没有主题热重载（`plugin-manager` 的 chokidar watcher 在 `app.isPackaged` 时直接 return）。
改完 `index.css` 或 iframe，重启应用才生效。

## iframe 挂载点

`config.json` 的 `iframe` 是 `Record<键, 路径>`，键固定这 6 个，路径会被 `@/` 替换成主题包内的绝对路径：

| 键 | 挂到哪个容器 |
| --- | --- |
| `app` | `.app-container` |
| `header` | `.header-container` |
| `body` | `.body-container` |
| `music-bar` | `.music-bar-container` |
| `side-bar` | `.side-bar-container` |
| `page` | `.page-container` |

iframe 是 `prepend` 进容器的（排在最前面），默认样式就是上面那条全局 `iframe` 规则，
所以要用 `position: absolute` + 显式 `top/left/width/height` 摆位，并记得加 `pointer-events: none`。

## 打包与安装

`.mftheme` 就是 zip，**根目录直接放** `config.json` 和 `index.css`（`installThemePack` 解压后
在解压目录里找这两个文件，多一层目录就认不出来）：

```bash
cd themepacks/wmp-metal
powershell -NoProfile -Command "Compress-Archive -Path 'D:\...\wmp-metal\*' -DestinationPath 'D:\...\wmp-metal.mftheme' -Force"
```

装法二选一：

- **直接用**：把整个主题目录拷到 `portable/userData/musicfree-themepacks/<名字>/`，重启应用，
  在「主题」页就能看到并切换。
- **装包**：应用「主题」页 → 「安装主题包」→ 选 `.mftheme`。
