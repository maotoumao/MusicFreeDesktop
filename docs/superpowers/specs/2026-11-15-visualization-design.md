# 可视化效果（Visualizations）设计文档

日期：2026-11-15
状态：待批准

## 1. 意图与背景

MusicFree 桌面版目前**没有**真正的音乐可视化。主题包 `wmp-metal` / `itunes-aqua` / `midnight-vinyl`
里的 `iframes/spectrum-bg.html` 看着像频谱，实际是**假波形**——纯正弦波数学函数"演"出来的，
鼓点包络写死 1.6 秒周期，与真实音乐无关。用户想要一套真正的、跟随音乐起伏的 WMP 风格可视化。

WMP 官方把可视化分成三组，本设计照搬这个分类：

- **条形与波浪组**：频谱分析形态，随音乐高低音和节奏起伏
- **魔幻组**：粒子与几何图形，跟随节奏变幻色彩和形态
- **其他组**：电池、声音等不同风格

## 2. 目标

1. 可视化**真实反映正在播放的音频**（频域 + 时域 + 节拍），不是装饰性动画。
2. 独立窗口承载：无边框、透明背景、可拖动、可置顶，不拖累主界面帧率。
3. app 内置一套效果引擎，效果以模块形式注册，**新增效果只需加一个文件**。
4. 首发 8 个效果，覆盖 WMP 三组：
   - 条形与波浪：Bars、Oscilloscope、Spectrum
   - 魔幻：Particle、Geometry、Fluid
   - 其他：Battery、Fireworks
5. 用户可**锁定单个效果**，也可**随机轮换**（默认每首歌切换一次）。
6. 配色**跟随当前主题包**（读主窗口的 CSS 变量）。

## 3. 非目标

- 不做插件化效果（效果不放进 MusicFree 插件系统——插件是数据层的，界面效果不属于它）。
- 不做鼠标穿透（窗口不吃点击）、不做自由缩放（用户明确选了基础形态）。
- **窗口内不做任何交互控件**（无关闭按钮、无效果切换条）。理由：无边框窗口的拖拽是
  全窗口生效的（仓库现有的 Windows 拖拽实现），任何常驻控件都会和拖拽抢鼠标事件；
  要加控件就得在拖拽实现里专门排除一块区域。窗口是**纯被动的可视化载体**：
  开关与效果选择在主窗口里做。
- 不做音频录制、均衡器、音量可视化以外的音频处理。
- 不改主题包机制，不动现有 `spectrum-bg.html`（它继续作为主题包的背景装饰存在）。

## 4. 反目标（出现即视为失败）

- **假频谱**：视觉效果与真实音频无关，或节拍是定时器模拟的。
- **影响播放**：分析链路导致音源静音、卡顿、断流，或主界面掉帧。
- **窗口拖累主界面**：可视化窗口的渲染不得让主窗口卡顿（这是选独立窗口的核心原因）。
- **效果写死成大杂烩**：8 个效果必须共用同一套引擎与同一份音频帧数据，不得每个效果各搞一套取数逻辑。

## 5. 约束（已探明的代码事实）

| 事实 | 出处 | 影响 |
| --- | --- | --- |
| 主播放器是 `HTMLAudioElement`，**从未接入 WebAudio** | `src/renderer/core/track-player/controller/audio-controller.ts:20` | 要做频谱必须新接一条分析链路 |
| 音源三条路径：HLS(MSE blob)、带 header→`URL.createObjectURL(blob)`、普通 url | 同上 `:296-319` | 普通 url 可能跨域 |
| `createMediaElementSource` 对跨域音频会**静音** | WebAudio 规范 | 不能用经典接法 |
| 音量模型是「全局音量 × 本地增益」，写在 `audio.volume` 上 | `audio-controller.ts:333` `applyEffectiveVolume` | 分析链路不能干扰这个模型 |
| 扩展窗口已有成熟范式：`transparent` + `frame:false` + `WindowDrag.setWindowDraggable` + `AppConfig` 存位置 | `src/main/window-manager/index.ts:263` `createLyricWindow` | 可视化窗口照抄，不另造轮子 |
| message-bus 的 MessagePort 是**主窗口↔扩展窗口直连** | `src/shared/message-bus/preload/main.ts` `extPorts` | 频谱帧一跳可传，不必经主进程中转 |
| 主题色拿不到：app 的默认 `:root` 变量在 `src/renderer/app.scss`（**只在主窗口 bundle 里**）；主题包的覆盖则由 preload 写进 `<style id="themepack-node">` | `src/renderer/app.scss:84-115`、`src/shared/themepack/preload.ts:56` | 独立窗口的 bundle 里两样都没有 → 颜色必须由主窗口算好后传过去（可视化窗口自己去读主题包虽然理论可行，但会与主窗口失同步） |
| forge 支持多 entry point，各自独立 bundle + preload | `forge.config.ts` `entryPoints` | 新增 `visualization_window` 入口 |
| 项目无测试框架 | — | 验证靠手动 + 截图 |

### 5.1 已实测的事实（一次性 spike，脚本在 `tmp/viz-spike*.js`）

在项目自带的 Electron 25 上实测 `captureStream` + `AnalyserNode`（440Hz 正弦）：

| 项 | 实测值 | 结论 |
| --- | --- | --- |
| `captureStream()` 的 audio track 数 | **1** | blob URL 下成立 |
| `AudioContext` 初始 `state` | **`running`** | Electron 放宽了自动播放策略，`resume()` 仍保留但通常不需要 |
| 440Hz 对应 bin 的值 | **241，且是全谱最大值** | FFT 分析准确，频率→bin 映射正确 |
| 非零 bin 数 | 11 | 单音信号，符合预期 |
| `AudioContext.sampleRate` | **48000**（不是源文件的 44100） | **bin 宽度必须用 `actx.sampleRate` 算，不能硬编码 44100** |

**三条音源路径的 captureStream 可用性（决定功能覆盖面）**：

| 音源路径 | 元素上的 URL | captureStream | 实测依据 |
| --- | --- | --- | --- |
| 带 header 的音源（fetch→blob） | `blob:` | **✓ 可用**，440Hz 能量 241 | spike #1 |
| HLS / m3u8（hls.js → MSE） | `blob:` (MediaSource) | **✓ 可用**，440Hz 能量 241 | spike #2（用 MediaRecorder 造 opus 片段喂 SourceBuffer 模拟 MSE） |
| 普通跨域直链（无 header） | `http(s):` 跨域 | **✗ 抛 SecurityError** | spike #3：`Cannot capture from element with cross-origin data` |
| 本地音乐 | `file:` | 推测同源可用 | 未实测（§10 补验） |

**三个必须记住的推论**：

1. **跨域元素即使服务器发了 CORS 头也 capture 不了**——因为元素没有设
   `crossOrigin = "anonymous"`，是以 opaque origin 加载的。
2. **绝不能为了可视化给主播放器加 `crossOrigin = "anonymous"`**：
   那会让大量没有 CORS 头的音源**直接播不出来**，是严重回归。
   可视化不能反过来伤害播放。
3. **跨域直链场景两条路都不通**：captureStream 抛 SecurityError，
   而回退方案 B（`createMediaElementSource`）对跨域会让播放器静音。
   所以跨域只能**明确降级**：窗口显示「此音源无法可视化」，
   而不是静默冻结让人以为功能坏了。

## 6. 方案对比

### 6.1 音频数据来源

| 方案 | 做法 | 取舍 |
| --- | --- | --- |
| **A. captureStream（首选）** | `audio.captureStream()` → 独立 `AudioContext.createMediaStreamSource()` → `AnalyserNode` | **不碰主播放器的音频链路**：跨域不静音、现有音量模型零影响、分析用的 AudioContext 不接 `destination` |
| B. createMediaElementSource（仅在 A 不可用时回退） | 把 audio 元素接进 WebAudio 图 | 对**普通跨域 url** 会让整个播放器静音——但对 blob URL（headers 路径与 HLS/MSE 路径）**同源、安全**。代价：一旦调用就永久改变该元素的音频路径，必须 `connect(destination)` 保证出声 |
| C. 可视化窗口自己拉流 | 窗口内 fetch + decode 音频 | 重复下载整首歌、跨域、延迟——排除 |

**为什么 A 是首选、B 只作回退**：

- A 完全不介入主播放器的音频路径，对「全局音量 × 本地增益」模型零影响，是最干净的方案。
- B 有个致命约束：`createMediaElementSource` 对**跨域**音频会让元素静音。
  MusicFree 的三条音源路径里，**headers 路径和 HLS 路径都是 blob URL（同源，安全）**，
  只有「普通 url 且无 header」那条可能跨域。所以 B 不能无差别使用。
- **但 B 在 MSE/HLS 场景反而是安全且必要的**：Chromium 历史上对 MediaSource 场景的
  `captureStream()` 有过限制（crbug 141906 / wpt#15816 讨论过 MSE 下 `addtrack` 的问题），
  而 MSE 的 blob URL 必定同源。因此当 A 在 HLS 音源上取不到音轨时，回退到 B 是安全的。

**结论**：实现时按 A →（失败时）B 的顺序尝试，两者都以「不产生静音」为硬约束。
具体分支与判定条件见 §8.1 与 §9。

### 6.2 数据传输

| 方案 | 做法 | 取舍 |
| --- | --- | --- |
| **A. 复用 message-bus 的 MessagePort（选定）** | 加一种 `"visualizationFrame"` 消息类型 + 订阅标记 | 一跳直传，基础设施现成；代价是要动 message-bus 的类型系统 |
| B. 新建专用 IPC | 主窗口 `ipcRenderer.send` → 主进程 → `webContents.send` → 窗口 | 三跳 + 一整套新样板代码，收益为零 |

### 6.3 效果组织

| 方案 | 做法 | 取舍 |
| --- | --- | --- |
| **A. 引擎 + 效果注册表（选定）** | 统一接口，效果各一个文件，引擎负责 canvas/循环/分发 | 新增效果 = 加一个文件；引擎可复用 |
| B. 每个效果一个独立窗口 | 一次只开一个效果窗口 | 开销大、切换要重建窗口——排除 |
| C. 插件化 | 复用 MusicFree 插件系统 | 插件是数据层契约，塞界面效果是滥用——排除 |

### 6.4 主题色传递

| 方案 | 做法 | 取舍 |
| --- | --- | --- |
| **A. 主窗口读 CSS 变量 → appState 同步（选定）** | 主窗口 `getComputedStyle` 读 `--primaryColor` 等，主题切换时同步一次 | 复用现成状态通道，切换主题即时生效 |
| B. 主题包 config 里加配色字段 | 每个主题包显式声明可视化配色 | 要改所有主题包，且与 CSS 变量重复维护 |
| C. 固定配色 | 效果用固定色 | 与"跟随主题"的需求冲突——排除 |

## 7. 架构总览

```
主窗口 (renderer)
  track-player/audio-controller.ts
        │  audio.mediaElement (新增 getter)
        ▼
  core/visualization/analyzer.ts          ← 采集：captureStream + AnalyserNode
        │  每帧 { frequency, waveform, beat, bpm, level }
        ▼
  message-bus (主窗口 preload)
        │  MessagePort "visualizationFrame"（一跳）
        ▼
可视化窗口 (renderer-visualization)
  core/engine.ts          ← canvas 管理、rAF 循环、resize/DPR
  core/effects/*.ts       ← 8 个效果，共用同一份帧数据
```

主进程侧只做两件事：建窗口（`window-manager`）、提供开关 IPC。

## 8. 详细设计

### 8.1 音频分析（主窗口）

新建 `src/renderer/core/visualization/`：

- **`analyzer.ts`** — 单例 `AudioAnalyzer`
  - `attach(mediaElement: HTMLMediaElement)`：**按 A → B 顺序尝试**，成功即锁定该策略：
    1. **A（首选）**：`captureStream()` → 检查 `getAudioTracks().length > 0` →
       `new AudioContext()` → `createMediaStreamSource(stream)` → `AnalyserNode`
       （`fftSize = 2048`，`smoothingTimeConstant = 0.75`）。
       **该 AudioContext 不接 `destination`**：只做分析，绝不影响出声。
    2. **B（回退）**：A 取不到音轨时，判断该元素是否同源 blob URL
       （`audio.src.startsWith("blob:")`）——**只有同源才允许回退**，
       因为跨域走 `createMediaElementSource` 会静音整个播放器。
       同源时：`createMediaElementSource(audio)` → `AnalyserNode` →
       **必须 `connect(destination)`**（否则播放器静音）→ 再从 analyser 单独引一路做分析。
    3. 两者都不可用 → 进入"无数据"状态（`level = 0`），效果静默降级，**不报错、不卡界面**。
       并且**明确告知用户**：窗口内显示一行提示「此音源无法可视化」
       （静默冻结与「功能坏了」在用户眼里没有区别，必须说出来）。
       典型的触发场景就是跨域直链（§5.1）。
  - **策略在 attach 时一次性决定并记录**，不在每帧反复尝试。
  - **`AudioContext` 全局复用一个**，不随换歌重建（重建要 ~50-100ms 且会多出上下文）；
    换歌只重建 `MediaStreamAudioSourceNode` 与 `AnalyserNode` 的连接。
  - **必须 `audioContext.resume()`**：新建的 `AudioContext` 可能停在 `suspended`，
    此时 `AnalyserNode` 不产出数据（`level` 恒为 0，看起来就是"可视化没反应"）。
    attach 后立即 `resume()` 并监听 `statechange`。
    （实测 Electron 25 里新建即 `running`，但保留 resume 无害且防其他环境。）
  - **attach 时机：跟着元素走，不跟播放器事件走**。
    `PlayerEvents.MusicChanged` 是在 `setCurrentMusic()` 里发的，
    **早于** `setTrack()` → `audioController.setTrackSource()` 赋新 `src`——
    那一刻元素上还没有资源，capture 不到东西。
    可靠做法：监听元素自身的 `playing` 事件（开始出声），
    并监听 `src` 变化——**换源会让旧的 capture track 结束，必须重新 capture**。
  - **静音时可视化同步静止（实测）**：capture 捕获的是元素**音量之后**的信号
    （`audio.volume = 0` 时频谱实测全零，详见 §5.1）。
    这正是"所见即所听"的期望行为，**不需要**额外做音量映射。
  - `readFrame(): IAudioFrame` — 每帧产出：
    ```ts
    interface IAudioFrame {
      frequency: Uint8Array;  // 512 个 bin，对数分布映射（低频稀、高频密）
      waveform: Uint8Array;   // 256 个时域采样点，-1..1 归一到 0..255
      level: number;          // 总体能量 0..1
      beat: number;           // 本帧节拍强度 0..1（低频能量突发的包络）
      bpm: number;            // 估算 BPM
      playing: boolean;
    }
    ```
  - **节拍检测**：取最低 ~8 个 bin 的能量，做滑动平均（约 43 帧 ≈ 0.7s）；
    当瞬时能量 > 均值 × 1.35 时判定一拍，`beat` 输出一个指数衰减的包络（1 → 0，约 0.3s）。
  - **BPM 估算**：记录连续拍点间隔，取最近 8 个间隔的中位数倒数。
  - **bin 宽度按 `actx.sampleRate` 计算**：`binHz = sampleRate / fftSize`。
    实测 `sampleRate` 是 **48000**（跟随系统，不是源文件的 44100），硬编码 44100 会让
    频率映射整体偏移（详见 §5.1）。
  - **兜底**：任何一步失败都只降级，不抛错、不中断播放。

- **`index.ts`** — 对外入口，负责：
  - 订阅元素的 `playing` / `src` 变化，驱动 analyzer 重新绑定（见上面的「attach 时机」）；
  - **响应可视化窗口的取帧请求**（pull 模型，见 §8.2），在消息回调里同步 `readFrame()` 并回帧。

**`audio-controller.ts` 改动**：新增只读 getter 暴露 audio 元素
```ts
get mediaElement() { return this.audio; }
```
不改动任何现有音量逻辑（`applyEffectiveVolume` 在 `:343`，是音量模型的落点，别碰）。

### 8.2 数据传输（message-bus 扩展）

**采用 pull 模型：可视化窗口拉帧，而不是主窗口推帧。**

理由：音频元素只存在于主窗口的渲染进程，而**主窗口在可视化真正有用的场景下是隐藏的**
（最小化到托盘、`closeBehavior: minimize`）。Electron 的 `backgroundThrottling` 默认开启
（本仓库没有设置过它），隐藏/最小化的窗口其 `requestAnimationFrame` 与定时器会被节流到
约 1fps，5 分钟后还会进入「 intensive throttling」。若由主窗口用 rAF 驱动推帧，
**可视化恰好会在用户最想看它的时候冻住**——而且开发时窗口可见，测不出来。

反过来：可视化窗口是**可见**的，它的 rAF 不被节流；主窗口虽然被节流，但
**IPC 消息回调不受节流影响**，`AnalyserNode` 在页面隐藏时也照常工作
（分析用的 `AudioContext` 没有接 `destination`，Chrome 不会因此挂起它）。
所以「可见窗口拉、隐藏窗口应」是唯一两边都不受影响的组合。

> 备选方案 `backgroundThrottling: false` 被否：那是改整个 app 的空闲行为，
> 会让隐藏的主窗口一直满载，代价远大于收益。

改动四处：

1. **`src/shared/message-bus/type.d.ts`**
   - `IPortMessage` 增加消息类型 `"requestFrame"`（扩展→主）与
     `"visualizationFrame"`（主→扩展，payload 为 `IAudioFrame`）。
   - `IAppState` 增加 `themeColors?: IThemeColors`（供可视化窗口读主题色）。
2. **`src/shared/message-bus/preload/extension.ts`**
   - 扩展窗口侧：暴露 `requestFrame()`（发 `"requestFrame"`）与
     `onVisualizationFrame(cb)` / `offVisualizationFrame(cb)`（EventEmitter 派发）。
3. **`src/shared/message-bus/preload/main.ts`**
   - 暴露 `pushVisualizationFrame(frame)`：回给请求方窗口。
   - `handleMessage` 里加 `"requestFrame"` 分支：**preload 在隔离世界，
     不能直接调主世界的函数**，要用 `ipcRenderer.send("@shared/visualization/frame-request")`
     把请求转给主世界；主世界同步 `readFrame()` 后再调用 preload 暴露的
     `pushVisualizationFrame()` 回帧。
   - 注意 `subscribedAppStates.set(from, payload)` 是**整体替换**该窗口的订阅键集合，
     `themeColors` 与 `musicItem` 必须在同一次 `subscribeAppState` 调用里一起订阅。
4. **主窗口侧**（`src/renderer/core/visualization/index.ts`）
   - 监听 `@shared/visualization/frame-request` → 同步取帧 → 回帧。
   - 主题色：启动时读一次，之后用 **`MutationObserver` 观察
     `document.querySelector("#themepack-node")`** 的 `childList`/`characterData` 变化，
     变了就重读并同步。
     （不新增 themepack 的对外 API——preload 里 `themeNode.innerHTML = ...` 的写入
     会触发 observer；app 默认的 `:root` 变量本来就常驻，重读即可拿到最终值。
     注意主题包用 `html:root` 提高特异性，`getComputedStyle` 取到的就是最终值。）

**帧率与流量**：可视化窗口用自己的 rAF 按 60fps 发请求，主窗口每请求回一帧
（512B 频域 + 256B 时域 ≈ 0.8KB/帧，约 46KB/s）。
窗口不可见（`document.hidden`）时停止请求；暂停播放时主窗口照常回帧，
但帧里 `playing: false`、`level: 0`，效果静止而不报错。

### 8.3 可视化窗口

**主进程**（`src/main/window-manager/index.ts`）：
- 新增 `visualizationWindow`，照 `createLyricWindow` 的写法：
  `transparent: true`、`frame: false`、`alwaysOnTop: true`、`resizable: false`、
  `show: false` 后 `showInactive()`（不抢焦点）、`skipTaskbar` 视情况。
- `WindowDrag.setWindowDraggable(visualizationWindow, {...})`（复用现有拖动）。
- 位置/尺寸存 `AppConfig`（`private.visualizationWindowPosition` /
  `private.visualizationWindowSize`），与歌词窗口同一套约定。
- 窗口开关走 `appWindowUtil.setVisualizationWindow(enabled)`，
  与 `setLyricWindow` 同一套 IPC 模式。

**新增 renderer entry**：
- 目录 `src/renderer-visualization/`。参照 `src/renderer-lrc/` 的两层结构
  （`document/` + `pages/`），本功能多一层 `core/` 放引擎与效果——`src/renderer-lrc/` 本身**没有** core 目录。
- `forge.config.ts` 增加 entryPoint `visualization_window`，
  preload 用 `src/preload/extension.ts`（已含 `common-preload` + message-bus extension）。
- **别名要加两处**，漏一处 `npx tsc --noEmit` 就失败（它是验收项）：
  - `config/webpack.renderer.config.ts` 的 `resolve.alias` → `@renderer-visualization`
  - `tsconfig.json` 的 `paths`（现已有 `@renderer-lrc/*` 等）→ `@renderer-visualization/*`
- 窗口默认尺寸 480×300，`resizable: false`（用户未选自由缩放）——
  因此**不设** `private.visualizationWindowSize`，固定尺寸即可，只存位置。
- **窗口是纯被动的**：内容只有一块 canvas（+ 降级时的一行提示文字），没有任何控件。
  关闭只能从主窗口的 MusicBar 按钮（或 Alt+F4）；
  窗口的 `close` 事件要回写 `visualization.enabled = false`，否则配置与实际状态会脱节。
  主窗口退出时窗口随之关闭（应用退出会关掉所有窗口）。

**窗口的接入点清单（漏一处窗口就会「创建了但没反应」）**：

| 文件 | 必须做的事 |
| --- | --- |
| `src/types/main/window-manager.d.ts` | `IWindowNames` 加 `"visualization"`；`IWindowManager` 加 `showVisualizationWindow()` / `closeVisualizationWindow()` |
| `src/main/window-manager/index.ts` | 加 `declare const VISUALIZATION_WINDOW_WEBPACK_ENTRY` / `…PRELOAD_WEBPACK_ENTRY`（forge 按 entry 生成） |
| 同上 | **加入 `getExtensionWindows()`** —— message-bus 只给这个列表里的扩展窗口建 MessagePort，不加就没有数据通道 |
| 同上 | **加入 `getAllWindows()`** —— AppConfig 变更只广播给这个列表里的窗口（`src/shared/app-config/main.ts:219`），不加就收不到设置变化 |
| `src/shared/message-bus/preload/extension.ts` | `extPort.onmessage` 里加 `visualizationFrame` 分支（现在只处理 `syncAppState` 与 `ping`） |
| `src/shared/message-bus/preload/main.ts` | 加 `subscribeVisualization` 分支与 `pushVisualizationFrame()`；注意 `subscribedAppStates.set(from, payload)` 是**整体替换**该窗口的订阅键集合，`themeColors` 与 `musicItem` 必须在同一次调用里一起订阅 |
| `src/types/app-config.d.ts` | `_IAppConfig` 新增 §8.7 的键 |
| `src/shared/app-config/default-app-config.ts` | 同上的默认值 |

### 8.4 效果引擎

`src/renderer-visualization/core/`：

- **`types.ts`**
  ```ts
  export interface IVisualizationEffect {
    id: string;                 // "bars" / "oscilloscope" / ...
    nameKey: string;            // i18n key
    init(ctx: CanvasRenderingContext2D, size: ISize): void;
    render(ctx: CanvasRenderingContext2D, size: ISize, frame: IAudioFrame, colors: IThemeColors): void;
    reset?(): void;             // 换效果时清理内部状态
  }
  ```
- **`engine.ts`** — 负责：canvas 与 DPR 缩放、`requestAnimationFrame` 循环、
  窗口 resize 重算、按当前效果 id 分发 `render`、切换效果时调 `reset`。
- **`effects/index.ts`** — 效果注册表（id → 工厂函数），新增效果在此登记一行。

**8 个效果的行为约定**（共用同一份 `IAudioFrame`）：

| id | 名称 | 画什么 | 怎么随音乐变 |
| --- | --- | --- | --- |
| `bars` | 条形频谱 | 底部向上的柱状图，低频柱高、高频柱矮 | 每 bin 的能量决定柱高；上升快回落慢（模拟频谱包络）；`beat` 时整体抬升 |
| `oscilloscope` | 示波器 | 横向流动的时域波形 | 直接画 `waveform`；`level` 决定线宽与辉光强度 |
| `spectrum` | 频谱山脊 | 铺满宽度的频谱曲线山脊 | 由 `frequency` 连成平滑曲线，填充渐变；`beat` 时峰值跳动 |
| `particle` | 粒子 | 从底部/中心发射的粒子群 | 低频能量控制发射速率与初速度，`level` 控制粒子亮度，高频控制色相偏移 |
| `geometry` | 几何多边形 | 中心旋转的多层多边形 | 中频能量控制旋转速度与形变幅度，`beat` 触发一次形状脉冲 |
| `fluid` | 流体涡旋 | 噪声场驱动的涡旋流动 | 用 `level` 与 `beat` 调制流场的强度与涡旋速度 |
| `battery` | 电池 | 电池轮廓 + 内部液面 | 能量积分充放电（放电慢、充电快），液面高度即电量；`beat` 时轻微抖动 |
| `fireworks` | 烟花 | 鼓点处炸开的粒子火花 | `beat` 触发一次爆炸，粒子按随机方向飞散并衰减 |

**共用的绘制约定**：
- 全部用 `ctx.clearRect` 清屏（窗口透明），不填背景色。
- 颜色统一取自 `colors.primary` / `colors.text`，需要渐变时由 primary 派生明暗。
- 帧率目标 60fps；窗口不可见时暂停 rAF（`document.hidden`）。
- 所有效果必须容忍 `level=0`（静音/未播放）——此时画面静止或淡出，不得报错。

### 8.5 主题色

`IThemeColors`：
```ts
interface IThemeColors {
  primary: string;    // --primaryColor
  text: string;       // --textColor
  background: string; // --backgroundColor
}
```
主窗口读取后经 appState 的新 key `themeColors` 同步；可视化窗口订阅（与 `musicItem` 一起订阅）。
主题变化由主窗口用 `MutationObserver` 观察 `#themepack-node` 感知，变了就重读并再次同步（§8.2）。

### 8.6 设置与 UI

**效果的归属（已定）**：
- 用户的选择存在 **AppConfig**（`visualization.effect` = 效果 id 或 `"random"`），
  不是 appState。理由：这是**用户的持久偏好**，该进 config.json；
  appState 是易失的运行状态。
- **随机轮换由可视化窗口自己做**：它订阅 appState 的 `musicItem`，
  发现换歌就换一个效果。效果注册表只在可视化窗口的 bundle 里，
  轮换逻辑也在那儿，**不需要把注册表共享给主窗口**。
- 因此：主窗口只负责「同步设置 + 转发帧 + 同步主题色」，
  效果的选择与轮换全部在可视化窗口内闭环。

- **开关按钮放在 `src/renderer/components/MusicBar/widgets/Extra/index.tsx`**：
  那里已经住着 `LyricBtn`（桌面歌词开关）和 `KaraokeBtn`（本地定制），可视化开关与它们同级最自然。
  照 `LyricBtn` 的写法：读 `useAppConfig("visualization.enabled")` → 点击调
  `appWindowUtil.setVisualizationWindow(!enabled)` → 用 `SvgAsset` 取图标，
  `highlight` 类表示开启状态。
- **`appWindowUtil` 新增 `setVisualizationWindow(enabled: boolean)`**：
  走**仓库既有的 IPC 约定**——`ipcRenderer.send("@shared/utils/set-visualization-window", enabled)`
  → `ipcMain.on` 于 `src/shared/utils/main.ts` → 在 `src/shared/utils/preload.ts` 暴露。
  **不要**新造 `ipcMain.handle("@shared/visualization/toggle")` 这条 `invoke` 路径——
  仓库里没有对应的封装，会平白多出一套 preload 管道。
- **设置页新增「可视化」分区**
  （`src/renderer/pages/main-page/views/setting-view/routers/` 下新增 router）：
  - 效果选择：8 个效果 + 「随机轮换」
  - 随机轮换时：每首歌切换一次效果
- 文案补 `res/lang/{zh-CN,en-US,zh-TW}.json` 三个文件，
  键名建议 `music_bar.visualization` 与 `settings.visualization.*`。

### 8.7 配置项（`config.json` 顶层扁平键）

类型声明在 `src/types/app-config.d.ts`（`_IAppConfig`），默认值在
`src/shared/app-config/default-app-config.ts`。

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `visualization.enabled` | boolean | false | 可视化窗口是否打开 |
| `visualization.effect` | string | `"random"` | 效果 id 或 `"random"` |
| `private.visualizationWindowPosition` | `ICommon.IPoint` | — | 窗口位置 |
| `private.visualizationWindowSize` | `ICommon.ISize` | 480×300 | 窗口尺寸 |

（`private.` 前缀沿用歌词窗口的既有约定：`private.lyricWindowPosition` /
`private.lyricWindowSize`，见 `src/types/app-config.d.ts:108-116`。）

## 9. 风险与规避

| 风险 | 规避 |
| --- | --- |
| **`captureStream()` 在 MSE/HLS 音源下取不到音轨** | **已实测：MSE 场景完全可用**（§5.1）。代码仍保留 A→B 顺序尝试作为兜底 |
| **跨域直链无法可视化**（`SecurityError: Cannot capture from element with cross-origin data`） | **已实测且无法绕过**：除非给元素设 `crossOrigin="anonymous"`，但那会让无 CORS 头的音源播不出来。**只能明确降级并提示用户**（§8.1） |
| **回退到 B 时把播放器搞静音** | `createMediaElementSource` 必须 `connect(destination)`；且只对 `blob:` 开头的 src 启用 B。**这条是硬约束，宁可视化不可用也不能静音** |
| **主窗口隐藏时可视化冻结** | 用 pull 模型（§8.2）：由可见的可视化窗口用 rAF 拉帧，隐藏主窗口的 rAF 被节流但 IPC 回调不受影响 |
| 分析器泄漏（换歌后旧流仍在跑） | 换歌时 `stop()` 并重新 `attach()`；`AudioContext` 在 `stop()` 时 `close()` |
| **`AudioContext` 停在 `suspended` 导致永远无数据** | attach 后立即 `resume()` + 监听 `statechange`；这是"可视化完全没反应"最常见的原因 |
| 60fps 推送拖慢主窗口 | 仅在播放时推；帧数据 512B + 256B，实测约 46KB/s；主窗口只做 FFT（廉价） |
| 主题色在独立窗口取不到 | 由主窗口读 CSS 变量后经 appState 同步（§8.5） |
| 效果切换残留状态 | 引擎在切换时调 `reset()` |
| `visualization.enabled` 与窗口实际状态不同步 | 窗口关闭事件回写配置（照歌词窗口的位置保存模式） |

## 10. 留给实现者的

- 效果的具体视觉参数（颜色插值、粒子数量上限、流体噪声参数）由实现者定，
  但必须遵守 §8.4 的「共用绘制约定」。
- 8 个效果建议**先做 bars 和 oscilloscope** 打通引擎，再批量补其余 6 个——
  引擎接口若不合理，越晚发现返工越多。
- i18n key 命名建议 `settings.visualization.*` 与 `visualization.effect.<id>`。
- 手动验证清单：
  1. 播放时效果随音乐变化（对比频谱与实际音乐，低音重时低频柱明显更高）；
  2. 暂停后画面静止、无报错；
  3. 切歌后效果跟随新歌（不能残留上一首的频谱）；
  4. **主窗口最小化/隐藏时可视化仍在动**（验证 pull 模型，这是最容易被忽略的失败模式）；
  5. **HLS 音源（m3u8）下可视化有反应**（spike #2 已验证 MSE 可行，此处用真实歌曲复验）；
  6. **本地音乐（file://）下可视化有反应**（唯一未实测的路径）；
  7. **跨域直链下窗口显示「此音源无法可视化」而不是静默冻结**；
  8. 切换主题后可视化配色跟着变；
  9. 拖动窗口、置顶、关闭重开位置保持；
  10. 主界面播放不卡顿、音量正常；
  11. 换到跨域音源验证**没有静音**（可视化绝不能伤害播放）。

## 11. 验收标准

- §10 的 7 条手动验证全部通过。
- `npx tsc --noEmit` 与 `npm run lint` 无报错。
- 8 个效果全部实现并登记在注册表。
- 新增第 9 个效果时，只改一个文件 + 注册表一行（不改引擎）。

---

## 12. 实现说明（2026-11-16 落地时的偏差记录）

实现过程中与上文 spec 有出入的地方，逐条记录原因。

| # | spec 原文 | 实际做法 | 原因 |
| --- | --- | --- | --- |
| 1 | §8.7 列了 `private.visualizationWindowSize` | **不设**，只存 `private.visualizationWindowPosition` | §8.3 正文与实施计划都写明「窗口固定 480×300」；§8.7 表格是罗列，尺寸固定就没有存的意义 |
| 2 | §9 风险栏写「换歌时 stop() 并重新 attach()；AudioContext 在 stop() 时 close()」 | **AudioContext 全局复用，不 close**，只断开 source/analyser 连接 | §8.1 正文明确「全局复用一个，不随换歌重建」；重建 context 要 50~100ms 且会多出上下文 |
| 3 | §8.1 未指明 level 用原始频域还是对数映射后的 bin | level 用**原始频域** bin 的均值 | 对数映射把低频能量摊到多个输出 bin，用映射后的值算总能量会偏小数倍；「总体能量」按原始 FFT 幅度算才符合物理含义 |
| 4 | §8.4 效果表未定义「节拍被抑制」时包络如何表现 | 间隔过密（< `minIntervalMs`）被抑制时，包络**归零** | 指数衰减在 50ms 后必然还有 0.717（`exp(-50/150)`），「明显小于 1」这个语义用归零表达更准确；包络参数本身不变，仍符合 §8.1「指数衰减包络（1→0，约 0.3s）」 |
| 5 | §8.3 只说窗口照抄歌词窗口的 `webPreferences` | 实际用 `nodeIntegration: false` + `contextIsolation: true` + `sandbox: true`，并**另写一份精简 preload** | 可视化窗口只需要一块 canvas + contextBridge 暴露的 API，不需要 Node 能力；收紧安全边界不损失任何功能。精简 preload 只含 global-context / i18n / app-config / message-bus / window-drag，均不依赖 Node 文件系统 |
| 6 | §8.4 未提「不可用时如何停画」 | 引擎增加 `pause()` / `resume()` | §8.1 要求「无数据状态」要有明确反馈；停画 + 提示文字比让效果在空数据上抖动更清楚 |
| 7 | §5.1 的三条路径实测在 spike 脚本里 | 固化为 `npm run verify:capture`（`scripts/verify-visualization-capture.js`） | spike 是一次性的；固化成脚本后每次改采集逻辑都能回归验证，结论与 §5.1 完全一致 |
| 8 | 未提及模块解析方式 | 被 `node --test` 直接加载的模块用**相对路径 + `.ts` 扩展名**导入 | Node 原生类型剥离要求显式扩展名，且不认 webpack 别名；只有被测试直接 import 的文件需要这样写 |

此外，spec §11 写的「§10 的 7 条手动验证」实际是 11 条——按 11 条验收。
