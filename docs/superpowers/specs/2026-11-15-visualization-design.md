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
| 主题包 CSS 变量只注入**主窗口 DOM**（preload 里 `themepack-node`） | `src/shared/themepack/preload.ts:56` | 独立窗口**没有**主题变量，必须由主窗口传过去 |
| forge 支持多 entry point，各自独立 bundle + preload | `forge.config.ts` `entryPoints` | 新增 `visualization_window` 入口 |
| 项目无测试框架 | — | 验证靠手动 + 截图 |

## 6. 方案对比

### 6.1 音频数据来源

| 方案 | 做法 | 取舍 |
| --- | --- | --- |
| **A. captureStream（选定）** | `audio.captureStream()` → 独立 `AudioContext.createMediaStreamSource()` → `AnalyserNode` | **不碰主播放器的音频链路**：跨域不静音、现有音量模型零影响、分析用的 AudioContext 不接 `destination`。代价：`captureStream()` 在个别场景可能返回空音轨，需兜底（无数据时效果静默降级） |
| B. createMediaElementSource | 把 audio 元素接进 WebAudio 图 | 标准做法，但普通跨域 url 会**整个播放器静音**——不可接受 |
| C. 可视化窗口自己拉流 | 窗口内 fetch + decode 音频 | 重复下载整首歌、跨域、延迟——排除 |

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
  - `attach(mediaElement: HTMLMediaElement)`：`captureStream()` → `new AudioContext()` →
    `createMediaStreamSource(stream)` → `AnalyserNode`（`fftSize = 2048`，
    `smoothingTimeConstant = 0.75`）。
  - **`AudioContext` 不接 `destination`**：只做分析，绝不影响出声。
  - `start()` / `stop()`：随播放状态启停；`captureStream` 在暂停时仍可用，但要防止分析器在换歌时残留旧流——
    换歌时 `stop()` → `attach()` 重新绑定。
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
  - **兜底**：`captureStream()` 拿不到音轨时（`getAudioTracks().length === 0`），
    analyzer 进入"无数据"状态，帧里 `level=0`，效果静默降级（不报错、不卡界面）。

- **`index.ts`** — 对外入口，负责：
  - 在 `track-player` 播放/暂停/换歌时调用 analyzer 的启停与重绑；
  - 用 `requestAnimationFrame`（或 16ms `setInterval`）驱动 `readFrame()`，
    把帧推给 message-bus。

**`audio-controller.ts` 改动**：新增只读 getter 暴露 audio 元素
```ts
get mediaElement() { return this.audio; }
```
不改动任何现有音量逻辑。

### 8.2 数据传输（message-bus 扩展）

改动三处：

1. **`src/shared/message-bus/type.d.ts`**
   - `IPortMessage` 增加消息类型 `"visualizationFrame"`（payload 为 `IAudioFrame`）。
   - `IAppState` 增加 `themeColors?: IThemeColors`（供可视化窗口读主题色）。
2. **`src/shared/message-bus/preload/main.ts`**
   - 暴露 `pushVisualizationFrame(frame)`：只发给**已订阅**的扩展窗口。
   - 扩展窗口订阅机制：新增 `"subscribeVisualization"` 消息，主窗口侧记下订阅者集合。
   - 暴露 `pushThemeColors(colors)`：走既有的 `syncAppState` 通道（新增 key）。
3. **`src/shared/message-bus/preload/extension.ts`**
   - 暴露 `onVisualizationFrame(cb)` / `offVisualizationFrame(cb)`，用 EventEmitter 派发。

**主窗口侧驱动**（`src/renderer/core/visualization/index.ts`）：
- 主题色在启动时和主题切换时各读一次
  （`getComputedStyle(document.documentElement).getPropertyValue('--primaryColor')` 等，
  注意主题包用的是 `html:root` 提升特异性，计算样式能取到最终值）。
- 采集到的帧以 60fps 推送。**只在有播放时推**，暂停时不推（省带宽）。

### 8.3 可视化窗口

**主进程**（`src/main/window-manager/index.ts`）：
- 新增 `visualizationWindow`，照 `createLyricWindow` 的写法：
  `transparent: true`、`frame: false`、`alwaysOnTop: true`、`resizable: false`、
  `show: false` 后 `showInactive()`（不抢焦点）、`skipTaskbar` 视情况。
- `WindowDrag.setWindowDraggable(visualizationWindow, {...})`（复用现有拖动）。
- 位置/尺寸存 `AppConfig`（`private.visualizationWindowPosition` /
  `private.visualizationWindowSize`），与歌词窗口同一套约定。
- 窗口开关走 `ipcMain.handle("@shared/visualization/toggle")`，主窗口的按钮调用它。

**新增 renderer entry**：
- 目录 `src/renderer-visualization/`，结构照 `src/renderer-lrc/`：
  `document/{index.html,index.tsx,bootstrap.ts}`、`pages/`、`core/`。
- `forge.config.ts` 增加 entryPoint `visualization_window`，
  preload 用 `src/preload/extension.ts`（已含 `common-preload` + message-bus extension）。
- `config/webpack.renderer.config.ts` 增加 alias `@renderer-visualization`。
- 窗口默认尺寸 480×300。

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
主窗口读取后经 appState 的新 key `themeColors` 同步；可视化窗口订阅。
主题切换时主窗口重读并再次同步。

### 8.6 设置与 UI

- **主窗口 MusicBar 加一个按钮**（频谱图标），点击 → IPC 开关可视化窗口。
- **设置页新增「可视化」分区**：
  - 效果选择：8 个效果 + 「随机轮换」
  - 随机轮换时：每首歌切换一次效果
  - 窗口开关状态
- 文案补 `res/lang/{zh-CN,en-US,zh-TW}.json` 三个文件。

### 8.7 配置项（`config.json` 顶层扁平键）

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `visualization.enabled` | boolean | false | 可视化窗口是否打开 |
| `visualization.effect` | string | `"random"` | 效果 id 或 `"random"` |
| `private.visualizationWindowPosition` | {x,y} | — | 窗口位置 |
| `private.visualizationWindowSize` | {width,height} | 480×300 | 窗口尺寸 |

（`private.` 前缀沿用歌词窗口的既有约定。）

## 9. 风险与规避

| 风险 | 规避 |
| --- | --- |
| `captureStream()` 在某些音源下拿不到音轨 | 检查 `getAudioTracks().length`，为空则静默降级（效果静止），并在日志里记录一次 |
| 分析器泄漏（换歌后旧流仍在跑） | 换歌时 `stop()` 并重新 `attach()`；`AudioContext` 在 `stop()` 时 `close()` |
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
  4. 切换主题后可视化配色跟着变；
  5. 拖动窗口、置顶、关闭重开位置保持；
  6. 主界面播放不卡顿、音量正常；
  7. 换到跨域音源（如需要 header 的平台）验证**没有静音**。

## 11. 验收标准

- §10 的 7 条手动验证全部通过。
- `npx tsc --noEmit` 与 `npm run lint` 无报错。
- 8 个效果全部实现并登记在注册表。
- 新增第 9 个效果时，只改一个文件 + 注册表一行（不改引擎）。
