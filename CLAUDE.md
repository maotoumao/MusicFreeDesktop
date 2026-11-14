# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

MusicFree Desktop 的**源码仓库**（Electron + React 18 + TypeScript）。
fork 自上游 `maotoumao/MusicFreeDesktop` v0.0.8，`origin` 指向 `acientemple/ElegantMusicFreeDesktop`，
`upstream` 指向上游原始仓库。在上游基础上加了 MV 播放/搜索、唱卡拉OK、歌曲信息编辑与时长校正、
播放队列定位到歌单、窗口置顶、窗口自由缩放等本地定制功能。

- **改代码在这个仓库**，但**运行时不在**：用户实际在用的便携版是
  `D:\work\OneDrive\Desktop\projects\MusicFree`（含 `portable/userData` 用户数据）。
  两者之间靠 `npm run package` + `robocopy` 同步，见下面「发布」。
- 代码在 `src/`，**没有测试框架**（不要试图跑 `npm test`）。

## 常用命令

```bash
npm start                # electron-forge 开发模式
npm run dev              # 同上，带 --inspect-electron
npx tsc --noEmit         # 类型检查（package.json 里没有 typecheck 脚本）
npm run lint             # eslint ./src --fix
npm run package          # 打包到 out/MusicFree-win32-x64（整包约 5 分钟，exe 160MB+）
```

- 提交走 husky `pre-commit` → `npm run lint-staged`（对暂存文件跑 `npm run lint`，**会自动改代码**，
  改完要一并 `git add`）。提交信息用中文，一件事一个 commit。
- `npm run package` 之前先 `npx tsc --noEmit`；webpack 用 `fork-ts-checker`，类型错误不一定会让打包失败。

### 发布到便携版

覆盖前先结束正在运行的 `MusicFree.exe`，否则 exe 被占用：

```bash
npx tsc --noEmit
npm run package
robocopy out\MusicFree-win32-x64 "D:\work\OneDrive\Desktop\projects\MusicFree" /E /R:1 /W:1 /NFL /NDL
```

**robocopy 绝不能加 `/MIR`** —— 会删掉 `portable/` 里的用户数据（插件、设置、歌单数据库）。

### 发版（GitHub Actions 自动）

改 `package.json` 的 version → 提交 → 打同名 tag 推送：

```bash
git tag v0.0.9
git push origin v0.0.9
```

`.github/workflows/release.yml` 会依次：校验 tag 与 `package.json` 版本一致 → 构建 Windows 便携版 →
创建 GitHub Release → 更新 `release/version.json` 并回写 master。

改这个 workflow 时有三个约束别破坏：

- **资产名必须匹配 `-win32-x64-portable.zip`**：`src/main/updater/parse.ts` 的 `assetKindPriority`
  按文件名里的 `-<平台token>-<类型>` 匹配资产，名字对不上，应用内就找不到可安装包。
- **`release/version.json` 必须跟着发版更新**：应用内「检查更新」读的是 master 分支上的 raw 文件
  （见 `appUpdateSources`），不同步的话更新检查永远停在旧版本。workflow 已自动处理。
- **只发便携版，不发 setup.exe**：安装版要 Inno Setup 的 AppId（上游的 secret，fork 里没有），
  而且 `canAutoInstall()` 本来就只对「打包 + Windows + 便携版」放行。

### 调试

```bash
MUSICFREE_DEBUG_PORT=9225 ./MusicFree.exe    # 开 CDP 远程调试端口（Windows 下直接设环境变量）
# http://127.0.0.1:9225/json/list 拿 target，再用 ws 连过去 Runtime.evaluate
```

开关在 `src/main/index.ts`（读 `process.env.MUSICFREE_DEBUG_PORT` → `remote-debugging-port`）。

## 架构总览

### 三类渲染进程 + 三个 webworker

`forge.config.ts` 定义了多个 entry point，各自是独立的 webpack bundle 和 preload：

| entry | 源码目录 | preload |
| --- | --- | --- |
| `main_window` | `src/renderer/` | `src/preload/index.ts` |
| `lrc_window` | `src/renderer-lrc/` | `src/preload/extension.ts` |
| `minimode_window` | `src/renderer-minimode/` | `src/preload/extension.ts` |

webworker：`downloader`、`local_file_watcher`、`db`（`db` 是**孤儿 entry**，源码里零引用）。

preload 分两层：`src/preload/common-preload.ts`（i18n / global-context / themepack / app-config / utils /
window-drag / window-resize，lrc 和 minimode 窗口也用）＋ 主窗口独有的 service-manager / plugin-manager /
message-bus / short-cut。

### shared 模块的 IPC 模式

`src/shared/<module>/` 下每个模块固定三个文件，**没有中央注册表，全靠约定**：

- `main.ts` — 单例 class，导出 `setup()`，在里面注册 `ipcMain.handle/on`。在 `src/main/index.ts` 里统一装配。
- `preload.ts` — `contextBridge.exposeInMainWorld("@shared/<module>", mod)`。
- `renderer.ts` — 从 `window["@shared/<module>"]` 取出来，包成带本地缓存 + 订阅回调的友好 API。

现有模块：`app-config`、`database`(死代码)、`global-context`、`i18n`、`logger`、`message-bus`、
`plugin-manager`、`service-manager`、`short-cut`、`themepack`、`utils`、`window-drag`、`window-resize`。

### 渲染进程状态

**不是 zustand 也不是 redux**，是自研的 `src/common/store.ts`：`Store<T>` 提供
`getValue` / `setValue`（可传值或 updater）/ `onValueChange`，配套的 `StateMapper` 驱动
`useValue()` hook（内部 useState + 订阅者集合）。用 `useStore(store)` 拿到 `[value, setValue]`。

store 按领域就近存放：

- `src/renderer/core/track-player/store.ts` — 队列、当前歌曲、歌词、循环模式、进度、播放状态、音量、倍速、音质。
- `src/renderer/core/music-sheet/frontend/index.ts` — 歌单、收藏歌单（`backend/index.ts` 只负责 Dexie 读写）。
- `src/renderer/core/music-mv/index.ts` — MV 绑定；`src/renderer/core/local-music/store.ts` — 本地音乐。

`src/renderer/core/track-player/index.ts` 是基于 EventEmitter 的**命令式**播放器控制器
（事件名在 `enum.ts` 的 `PlayerEvents`），组件既读 store 也调它。

`src/renderer/core/` 下的其余模块：`music-meta`（歌曲信息覆盖）、`music-duration`（实测时长校正）、
`music-locate`（播放队列定位到歌单）、`recently-playlist`（最近播放）、`downloader`、
`smart-lyric`（歌词搜索与滚动）、`link-lyric`（把两首歌关联起来、共享/翻译歌词，LRU 缓存）、
`audio-recognition`（听歌识曲，走 audd.io）、`backup-resume`（歌单备份与恢复）、
`karaoke`（本地新增）。

启动顺序在 `src/renderer/document/bootstrap.ts`：
`AppConfig.setup()` + `PluginManager.setup()`（并行）→ 歌单 / 播放器 / meta / MV / 时长（并行）→
i18n → 快捷键 → 拖放处理 → 设备变化 → 本地音乐 → 下载器 → 最近播放 → `ServiceManager.setup()`。
同一文件里还注册了 message-bus 命令（`SkipToNext` / `TogglePlayerState` / `VolumeUp`…）与
播放器状态 → message-bus 的单向同步。

### 插件系统

插件 **不是** vm 沙箱也不是 worker，而是 `new Function(...)` 包装执行
（`src/shared/plugin-manager/main/plugin.ts`）。传给插件的 `require` 是个假的 packages 表：
cheerio、crypto-js、axios、dayjs、big-integer、qs、he、webdav，外加 `musicfree/storage` polyfill；
另有 `env`（`getUserVariables` / os / appVersion / lang）、`module`、`exports`、`console`、`process`。
插件唯一标识 = 源码的 sha256。

关键文件：

- `src/types/plugin.d.ts` — `IPluginDefine`（方法全可选）、`IPluginInstanceMethods`、`IPluginDelegate`。
- `src/shared/plugin-manager/main/plugin-methods.ts` — `PluginMethods` 类，实现每个插件方法，
  包含兜底、重试、`resetMediaItem()` 归一化。
- `src/shared/plugin-manager/main/index.ts` — 从 `userData/musicfree-plugins/*.js` 加载，
  支持从远程 URL / 本地 `.js` / `.json` 订阅列表安装，chokidar 监听热重载（**仅开发模式**，300ms 防抖）。

**加插件方法要同时改三处**：`src/types/plugin.d.ts`、`plugin-methods.ts`、插件自身。
主进程包装层 `plugin-methods.ts` 的参数是**按位置透传**的，加参数时注意对应关系。

### 持久化：两处活的，一处是死的

| 层 | 位置 | 归属 | 内容 |
| --- | --- | --- | --- |
| IndexedDB（Dexie） | `src/renderer/core/db/music-sheet-db.ts`（库 `musicSheetDB`） | 渲染进程 | `sheets`、`musicStore`、`localMusicStore`、`musicMeta`、`musicMv`、`musicDuration`（版本 1.4） |
| IndexedDB（Dexie） | `src/renderer/utils/user-perference.ts`（库 `userPerferenceDB`） | 渲染进程 | 大对象走 `perference` 表；小值走 localStorage |
| JSON 配置 | `userData/config.json`（`src/shared/app-config/`） | 主进程 | 扁平键、插件元信息、窗口位置 |
| SQLite（better-sqlite3） | `src/shared/database/`、`src/webworkers/db-worker/` | — | **死代码**，全仓库零引用 `@shared/database` |

- 加 Dexie 表要在 `music-sheet-db.ts` 里**递增版本号**（现有 1.1 → 1.4，每版都重写全量 stores）。
- `socket.io` 是**未使用的依赖**（源码里零引用）。
- `better-sqlite3` / `sharp` 在 `forge.config.ts` 里设了 `rebuildConfig.onlyModules: []`，
  跳过原生模块重编译，直接用预编译的 `.node`。

### 多窗口通信

`src/shared/message-bus/`，基于 `MessageChannelMain` 的 MessagePort：主进程为每个扩展窗口建一对 port，
`port1` 通过 `postMessage("port", {type:"mount"})` 交给主窗口，`port2` 交给扩展窗口。
扩展窗口 → 主窗口的命令（`TogglePlayerState`、`SkipToNext`、`Navigate`…）定义在
`src/shared/message-bus/type.d.ts`；主进程状态镜像在 `message-bus/main.ts` 的 `appState`。

### 播放链路

`src/renderer/core/track-player/controller/audio-controller.ts` — 纯 `HTMLAudioElement`，
`.m4s`/HLS 走 `hls.js`。

媒体 URL 来自插件：`PluginManager.callPluginDelegateMethod({platform, hash}, "getMediaSource", item, quality)`
→ IPC → `PluginMethods.getMediaSource` → `plugin.instance.getMediaSource`。
带 header 的音源经 `ServiceManager.RequestForwarderService.forwardRequest`（fork 出的子进程）转发，
兜底是 `encodeUrlHeaders`（`src/common/normalize-util.ts`）。

### 本地定制功能（上游没有的）

| 功能 | 主要文件 |
| --- | --- |
| MV 播放 / 搜索（bilibili-mv 插件） | `src/renderer/core/music-mv/index.ts`、`components/Modal/templates/MusicVideoSearch/`、`components/Modal/templates/MVPlayer/` |
| 唱卡拉OK（逐字歌词 + 打分 + 双轨混音） | `src/renderer/core/karaoke/{recorder,scorer,mixer,instrumental}.ts`、`src/renderer/utils/word-lyric.ts`、`components/Modal/templates/Karaoke/` |
| 歌曲信息编辑 / 时长校正 | `src/renderer/core/music-meta/index.ts`、`src/renderer/core/music-duration/`、`musicDuration` 表 |
| 播放队列定位到歌单 | `src/renderer/core/music-locate/index.ts`、`components/Panel/templates/PlayList/index.tsx` |
| 窗口置顶 | `src/shared/app-config/` 的 `normal.alwaysOnTop` |
| 窗口自由缩放（自绘感应条） | `src/common/window-resize-util.ts`、`src/shared/window-resize/`、`components/WindowResize/` |
| 桌面歌词 / 迷你模式 | `src/renderer-lrc/`、`src/renderer-minimode/` |

## 几个容易踩的点

- **无边框窗口缩放**：Windows 上 `frame:false` 没有系统缩放边框，所以自己画了 8 条感应条
  （`calculateResizeBounds()` 纯函数在 `src/common/window-resize-util.ts`，IPC 在 `src/shared/window-resize/main.ts`，
  最小尺寸 400×320 在 `src/common/constant.ts` 的 `mainWindowMinSize`）。
  坐标系是「渲染进程 CSS px == Electron DIP == Win32 逻辑 px」，用 `e.screenX` 做位移、
  `win.getBounds()` 拿边界，同一体系不换算。感应条必须 `position: fixed` + `z-index: 999999` +
  `-webkit-app-region: no-drag`，按下时 `setPointerCapture`，否则鼠标拖出窗口事件就断了。
  再加一条缩放方向要改 `IResizeDirection` + `calculateResizeBounds` + 组件里的 `directions` 数组 + SCSS。
- **混音不污染全局音量**：`audio-controller` 把音量拆成「全局音量 × 本地增益」两个因子。
  `onvolumechange` 只在音量被**外部**改掉时才上报，内部改的（混音推子）一律忽略，
  否则会把增益写进用户偏好。
- **伴奏轨有响度补偿**：`mixer.ts` 里给伴奏乘 `ACCOMPANIMENT_BOOST`，否则伴奏拉满也只有原唱那么响。
  伴奏轨电平依赖全局音量，全局音量变了要重算。
- **双轨会各自漂移**：`mixer.ts` 每 500ms 比一次进度，偏差 > 0.4s 重新对齐（MV 播放器同一思路）。
- **逐字歌词是「有则用真、无则伪造」**：插件拿不到词级时间戳就按行内字数均分生成伪逐字，扫光效果照样有。
  公开接口目前基本不给真逐字（网易云 klyric、QQ qrc 要登录，酷狗 KRC 是加密格式），所以伪逐字是常态。
- **伴奏候选靠挨个问插件**：伴奏本身是另一首歌，KTV 界面挨个问支持 `getMusicInstrumentals` 的插件，
  合并去重后让人挑；候选带 `isKaraoke`（伴唱轨）与 `hasMv`（带画面）两个标记，排序时优先。

## 约定

- 新增文案要同时补 `res/lang/zh-CN.json`、`en-US.json`、`zh-TW.json` 三个文件。
- 配置项键名**扁平**：`normal.alwaysOnTop` 这种写法直接写在 `config.json` 顶层，不要嵌套。
- 仓库里的 `plugins/` 只是副本，运行时用的是便携版的 `portable/userData/musicfree-plugins/`，
  **改插件时两边同步**。
- 插件文件在运行时会热重载（仅开发模式），改完刷新页面即可生效。
- 便携版的 `portable/userData` 在 OneDrive 同步目录下，直接改里面的 JSON 偶发读不出来（占位文件状态），
  要改先 hydrate 到本地再编辑。
