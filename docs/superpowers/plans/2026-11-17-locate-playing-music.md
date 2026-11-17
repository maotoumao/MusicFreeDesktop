# 底栏空白处定位当前歌曲 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点底部播放栏控制块里的空白处，跳到当前播放歌曲所在的歌单并滚动、选中它。

**Architecture:** 把播放队列面板里已有的「找歌单 → 跳转 → 请求定位」逻辑抽成 hook
`useLocateMusicInSheet`，队列面板与底栏共用；底栏 `Controller` 容器只在点击落在
空白（`e.target === e.currentTarget`）且当前有歌时调用它。

**Tech Stack:** React 18 + react-router-dom + react-i18next + react-toastify，SCSS。

**Spec:** `docs/superpowers/specs/2026-11-17-locate-playing-music-design.md`

## Global Constraints

- 新增文案必须同时补 `res/lang/zh-CN.json`、`en-US.json`、`zh-TW.json` 三份，
  键为 `music_bar.locate_music_in_sheet`。
- 找不到歌单时沿用既有 `panel.play_list_locate_not_found` 文案，不新造。
- 没有正在播放的歌时点击无反应。
- 打包版无热重载；覆盖便携版前关闭 `MusicFree.exe`，`robocopy` 不加 `/MIR`。
- 不新增依赖。

## Review Focus

- 点在播放/上一首/下一首按钮上：应只触发按钮本身，不能顺带跳转歌单。
- 悬停在按钮上：不能出现「定位到当前歌曲所在的歌单」的提示。
- 队列面板里点一首歌定位：迁移到 hook 后行为要和以前完全一致（含跳转到最近播放、
  以及自动关掉面板）。
- 当前歌曲不在任何歌单、也不在最近播放里：只弹提示，不跳转。
- 当前歌曲所在的歌单已经打开：仍要滚到那首歌并选中（依赖既有 locate store 的 nonce）。

---

### Task 1: 抽出定位 hook 并让队列面板改用

**Files:**
- Create: `src/renderer/core/music-locate/use-locate-music-in-sheet.ts`
- Modify: `src/renderer/components/Panel/templates/PlayList/index.tsx:107-152`（删除
  `locateMusicInSheet`，改用 hook），以及文件顶部的 import

**Interfaces:**
- Consumes: `requestLocateMusic(musicItem, sheetId?)`、`useLocateTarget()`（既有，
  `src/renderer/core/music-locate/index.ts`）、`MusicSheet.frontend.getAllSheets()`、
  `getRecentlyPlaylist()`、`getMediaPrimaryKey`、`timeStampSymbol`、`localPluginName`。
- Produces: `useLocateMusicInSheet(): (musicItem: IMusic.IMusicItem) => boolean`。
  只做查找、`navigate` 和 toast，返回是否真的跳转了；**不**关面板。

- [ ] **Step 1: 新建 hook 文件**

导出 `useLocateMusicInSheet`，内部用 `useCallback` 包裹，依赖 `[navigate, t]`。
查找顺序与现有实现一致：本地歌单（多个命中取 `timeStampSymbol` 最大的那个）→
最近播放（`sheetId` 传 `"recently-play"`，路由 `/main/recently_play`）→
`toast.info(t("panel.play_list_locate_not_found"))`。命中时先
`requestLocateMusic(musicItem, sheetId)`，再 `navigate`。

- [ ] **Step 2: 队列面板改用 hook**

删除 `PlayList/index.tsx` 里的 `locateMusicInSheet` 定义和随之不再使用的 import
（`getMediaPrimaryKey`、`timeStampSymbol`、`requestLocateMusic`、
`MusicSheet`、`getRecentlyPlaylist`、`toast` 中只有这段用到的），
在组件里加 `const locateMusicInSheet = useLocateMusicInSheet();`，
原调用点 `locateMusicInSheet(rawItem)` 保持不变，其后再补 `hidePanel();`。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（exit 0）。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/core/music-locate/use-locate-music-in-sheet.ts src/renderer/components/Panel/templates/PlayList/index.tsx
git commit -m "refactor: extract locate-music-in-sheet into a shared hook"
```

---

### Task 2: 底栏控制块空白处接入

**Files:**
- Modify: `src/renderer/components/MusicBar/widgets/Controller/index.tsx`
- Modify: `src/renderer/components/MusicBar/widgets/Controller/index.scss`
- Modify: `res/lang/zh-CN.json` / `en-US.json` / `zh-TW.json`（`music_bar` 下）

**Interfaces:**
- Consumes: Task 1 的 `useLocateMusicInSheet()`；`useCurrentMusic()`
  （`@renderer/core/track-player/hooks`）。
- Produces: 无对外接口。

- [ ] **Step 1: 组件里加定位**

`Controller` 内取 `const currentMusic = useCurrentMusic();` 与
`const locate = useLocateMusicInSheet();`。容器 `.music-controller` 上：
`title={t("music_bar.locate_music_in_sheet")}`、
`onClick={(e) => { if (e.target === e.currentTarget && currentMusic) locate(currentMusic); }}`。
给播放按钮补一个自己的 `title`（`playerState === PlayerState.Playing ? t("music_bar.pause") : t("music_bar.play")`，
这两个键已存在），否则悬停在播放按钮上会显示容器的定位提示；上一首/下一首按钮已有各自的 `title`。

- [ ] **Step 2: 样式**

`Controller/index.scss` 的 `.music-controller` 里加 `cursor: pointer;`，
让空白处看起来可点（三个按钮本身已是 pointer）。

- [ ] **Step 3: 三语文案**

`music_bar.locate_music_in_sheet`：

| 文件 | 文案 |
| --- | --- |
| zh-CN | 定位到当前歌曲所在的歌单 |
| en-US | Locate in playlist |
| zh-TW | 定位到目前歌曲所在的歌單 |

- [ ] **Step 4: 类型检查 + JSON 校验**

Run: `npx tsc --noEmit`
Expected: exit 0。再 `node -e "['zh-CN','en-US','zh-TW'].forEach(f=>JSON.parse(require('fs').readFileSync('res/lang/'+f+'.json','utf8')))"`
Expected: 无异常。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/components/MusicBar/widgets/Controller res/lang/zh-CN.json res/lang/en-US.json res/lang/zh-TW.json
git commit -m "feat: click blank area next to play button to locate current song"
```

---

### Task 3: 打包部署与实机验证

**Files:**
- 无源码改动；产物覆盖到 `D:\work\OneDrive\Desktop\projects\MusicFree`。

**Interfaces:**
- Consumes: Task 1-2 的全部改动。

- [ ] **Step 1: 确认 `MusicFree.exe` 未运行**

`Get-Process MusicFree` 无输出。

- [ ] **Step 2: 打包并覆盖**

```bash
npm run package
robocopy out\MusicFree-win32-x64 "D:\work\OneDrive\Desktop\projects\MusicFree" /E /R:1 /W:1 /NFL /NDL
```

Expected: 打包 SUCCESS；robocopy 退出码 < 8（1/3 表示有文件复制）。 

- [ ] **Step 3: 实机验证**

播放一首**在某个歌单里**的歌后逐项确认：

- 点播放按钮左右两侧的空白：跳到该歌单，那首歌滚到眼前并选中。
- 点三个按钮本身：只执行本身行为，不跳转。
- 悬停在空白处出现「定位到当前歌曲所在的歌单」，悬停在按钮上没有这句提示。
- 播一首不在任何歌单的歌：只弹「这首歌还不在任何歌单里…」。
- 打开播放队列面板，点某一行：定位行为与改动前一致，面板自动关闭。
