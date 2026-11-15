# 可视化效果（Visualizations）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 MusicFree 桌面版做一套真·跟随音乐的可视化——独立窗口承载，app 内置引擎，8 个 WMP 风格效果，配色跟随当前主题。

**Architecture:** 音频元素只在主窗口的渲染进程里，所以频谱采集（`captureStream` → `AudioContext` → `AnalyserNode`）放在主窗口；可视化是一个**独立 BrowserWindow**（新 renderer entry `visualization_window`），它可见、其 rAF 不被节流，用 **pull 模型**每帧向主窗口要数据（走 message-bus 的 `MessagePort` 直连）。主窗口隐藏/最小化时 rAF 被节流但 IPC 回调不受影响，所以 pull 是唯一两边都不受影响的组合。主题色由主窗口读 CSS 变量后经 appState 同步给可视化窗口。

**Tech Stack:** Electron 25 + React 18 + TypeScript 5.0、Web Audio API（`captureStream` / `AnalyserNode`）、Canvas 2D、Node 内置 `node:test` 跑 TS 单测（零新运行时依赖）。

**Spec:** `docs/superpowers/specs/2026-11-15-visualization-design.md`

## Global Constraints

以下约束来自 spec，**每个任务都隐含包含**，逐条照做：

- **绝不修改主播放器的音频路径**：不给 `<audio>` 加 `crossOrigin` 属性，不动 `applyEffectiveVolume`（`audio-controller.ts:343`）的「全局音量 × 本地增益」模型，不把 `audio` 元素接进 WebAudio 图（除非同源 blob 的回退路径，且必须 `connect(destination)`）。可视化绝不能让播放器静音或播不出声。
- **`AudioContext` 只做分析**：不接 `destination`；全局复用一个实例，不随换歌重建。
- **bin 宽度按 `actx.sampleRate` 计算**（实测 48000），不得硬编码 44100。
- **pull 模型**：帧由可视化窗口用 rAF 拉取，主窗口应答；不得改成主窗口定时推送。
- **帧数据常量**：频域 512 个 bin（0..255），时域 256 个采样点（0..255），单帧约 0.8KB。
- **效果一律走同一套引擎与同一份 `IVisualization.IAudioFrame`**，不得每个效果自己取数；新增第 9 个效果只能改一个效果文件 + 注册表一行。
- **所有效果必须容忍 `level = 0`**（静音/未播放/不可用）：画面静止或淡出，不得抛错。
- **窗口纯被动**：无边框、透明、可拖动、可置顶、固定 480×300，**不含任何交互控件**；`resizable: false`。
- **新增文案必须同时补 `res/lang/zh-CN.json`、`en-US.json`、`zh-TW.json` 三个文件**。
- **配置项键名扁平**，直接写在 `config.json` 顶层：`visualization.enabled`、`visualization.effect`。
- **提交信息用中文**，一件事一个 commit；提交前跑 `npx tsc --noEmit`。
- 别名要加两处：`config/webpack.renderer.config.ts` 的 `resolve.alias` **和** `tsconfig.json` 的 `paths`，漏一处 `tsc --noEmit` 就失败。
- 新代码不引入新的运行时依赖；`@types/node` 作为显式 devDependency 加入。

## Review Focus

以下失败模式 spec 隐含要求、但普通单测不会覆盖，每一条都已安排进对应任务的验证步骤：

1. **主窗口最小化/隐藏时可视化冻结** —— 用户把主窗口收进托盘正是想「只留可视化」，冻结等于功能没做。（Task 6）
2. **跨域直链下静默冻结** —— 用户看到的是一片死画面，无法区分「这个音源不支持」和「功能坏了」。（Task 12）
3. **可视化让播放器静音** —— 跨域场景误用 `createMediaElementSource` 会让整个播放器没声音，比没有可视化严重得多。（Task 4）
4. **换歌后残留上一首的频谱** —— 分析器没重绑，旧流继续输出数据。（Task 4）
5. **把播放器静音时可视化还在狂跳** —— 捕获的是音量前还是音量后，用户看到的必须和听到的一致。（Task 3）
6. **60fps 推送拖慢主界面** —— 播放流畅度是底线，视觉化的代价不能转嫁给用户。（Task 6）

---

## File Structure

**新建：**

| 文件 | 职责 |
| --- | --- |
| `src/types/visualization.d.ts` | 全局类型：`IVisualization.IAudioFrame` / `IThemeColors` / `IEffectSpec` |
| `src/renderer/core/visualization/analysis/log-bins.ts` | 纯函数：线性频域 bin → 对数分布 bin（取区间最大值） |
| `src/renderer/core/visualization/analysis/log-bins.test.ts` | 上述纯函数的单测 |
| `src/renderer/core/visualization/analysis/beat-detector.ts` | 纯逻辑：低频能量 → 节拍包络 + BPM 估计 |
| `src/renderer/core/visualization/analysis/beat-detector.test.ts` | 上述纯逻辑的单测 |
| `src/renderer/core/visualization/analyzer.ts` | 采集：captureStream → AnalyserNode，产出 `IAudioFrame` |
| `src/renderer/core/visualization/index.ts` | 主窗口侧入口：绑定元素事件、响应取帧请求、同步主题色 |
| `src/renderer/core/visualization/theme-colors.ts` | 读 CSS 变量 → `IThemeColors`；MutationObserver 感知主题变化 |
| `src/renderer/core/visualization/theme-colors.test.ts` | 颜色读取与默认值逻辑的单测 |
| `src/renderer-visualization/document/index.html` | 可视化窗口的 HTML 壳 |
| `src/renderer-visualization/document/index.tsx` | 挂载 React 根 |
| `src/renderer-visualization/document/bootstrap.ts` | 窗口启动：订阅 appState、订阅频谱帧 |
| `src/renderer-visualization/pages/index.tsx` | 窗口页面：canvas + 降级提示 |
| `src/renderer-visualization/core/types.ts` | 效果接口 `IVisualizationEffect` |
| `src/renderer-visualization/core/engine.ts` | canvas/DPR/尺寸、rAF 循环、效果分发与切换 |
| `src/renderer-visualization/core/engine.test.ts` | 引擎纯逻辑（效果切换、尺寸换算）的单测 |
| `src/renderer-visualization/core/effects/index.ts` | 效果注册表 |
| `src/renderer-visualization/core/effects/{bars,oscilloscope,spectrum,particle,geometry,fluid,battery,fireworks}.ts` | 8 个效果各一个文件 |
| `scripts/verify-visualization-capture.js` | Electron 脚本：验证三条音源路径下 captureStream 的行为 |
| `src/renderer/pages/main-page/views/setting-view/routers/Visualization/index.tsx` | 设置页「可视化」分区 |

**修改：**

| 文件 | 改动 |
| --- | --- |
| `package.json` | 加 `test` 脚本、`verify:capture` 脚本、`@types/node` devDependency |
| `tsconfig.json` | `paths` 加 `@renderer-visualization/*` |
| `config/webpack.renderer.config.ts` | `resolve.alias` 加 `@renderer-visualization` |
| `forge.config.ts` | 新增 entry point `visualization_window` |
| `src/main/window-manager/index.ts` | 新增可视化窗口的创建/关闭；加入 `getExtensionWindows()` 与 `getAllWindows()` |
| `src/types/main/window-manager.d.ts` | `IWindowNames` 加 `"visualization"`；`IWindowManager` 加两个方法 |
| `src/shared/message-bus/type.d.ts` | 加 `"requestFrame"` / `"visualizationFrame"` 消息类型与 `themeColors` 状态键 |
| `src/shared/message-bus/preload/main.ts` | 加 `pushVisualizationFrame()` 与 `"requestFrame"` 分支 |
| `src/shared/message-bus/preload/extension.ts` | 加 `requestFrame()` 与 `onVisualizationFrame()` |
| `src/shared/message-bus/renderer/extension.ts` | 暴露上述 API |
| `src/renderer/core/track-player/controller/audio-controller.ts` | 加 `get mediaElement()` 只读 getter |
| `src/types/app-config.d.ts` | 加 `visualization.enabled` / `visualization.effect` |
| `src/shared/app-config/default-app-config.ts` | 同上的默认值 |
| `src/shared/utils/main.ts` / `preload.ts` / `renderer.ts` | 加 `setVisualizationWindow(enabled)` |
| `src/renderer/components/MusicBar/widgets/Extra/index.tsx` | 加 `VisualizationBtn` |
| `src/renderer/components/SvgAsset/index.tsx` | 若用新图标则加图标名 |
| `res/lang/{zh-CN,en-US,zh-TW}.json` | 新增文案 |

---

## Task 1: 测试基建与对数频谱映射

**Files:**
- Modify: `package.json`（`scripts` 加 `test`；`devDependencies` 加 `"@types/node": "^20.5.9"`）
- Create: `src/renderer/core/visualization/analysis/log-bins.ts`
- Create: `src/renderer/core/visualization/analysis/log-bins.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  // src/renderer/core/visualization/analysis/log-bins.ts
  export interface ILogBinsOptions {
      sampleRate: number;   // AudioContext.sampleRate
      fftSize: number;      // AnalyserNode.fftSize
      fMin?: number;        // 默认 40
      fMax?: number;        // 默认 16000
  }
  export function mapToLogBins(
      data: Uint8Array,          // AnalyserNode.getByteFrequencyData 的原始 bin
      outputCount: number,       // 输出 bin 数（512）
      options: ILogBinsOptions,
  ): Uint8Array;
  ```

- [ ] **Step 1: 写失败的测试**

`src/renderer/core/visualization/analysis/log-bins.test.ts`：

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapToLogBins } from "./log-bins.ts";

const opts = { sampleRate: 48000, fftSize: 2048 };

test("全零输入映射后仍全零", () => {
    const out = mapToLogBins(new Uint8Array(1024), 512, opts);
    assert.equal(out.length, 512);
    assert.ok(out.every((v) => v === 0));
});

test("单个非零 bin 会落到对应的输出 bin", () => {
    const input = new Uint8Array(1024);
    input[0] = 200;
    const out = mapToLogBins(input, 512, opts);
    assert.equal(out[0], 200);
    assert.equal(out.slice(1).every((v) => v === 0), true);
});

test("输入递增时输出非递减", () => {
    const input = new Uint8Array(1024);
    for (let i = 0; i < input.length; i++) input[i] = i % 256;
    const out = mapToLogBins(input, 512, opts);
    for (let i = 1; i < out.length; i++) {
        assert.ok(out[i] >= out[i - 1], `第 ${i} 个输出 bin 下降了`);
    }
});

test("输出 bin 数固定为请求值", () => {
    assert.equal(mapToLogBins(new Uint8Array(1024), 64, opts).length, 64);
});
```

> 测试文件用 `node:test` + `node:assert/strict`，从 `./log-bins.ts` **带扩展名**相对导入（Node 原生类型剥离要求显式扩展名）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，报 `Cannot find module './log-bins.ts'`（文件还没建）。

- [ ] **Step 3: 实现 `mapToLogBins`**

在 `src/renderer/core/visualization/analysis/log-bins.ts` 中：

- `binHz = options.sampleRate / options.fftSize`；输入 bin `k` 的频率是 `k * binHz`。
- 输出 bin `i`（`i` 从 0 到 `outputCount - 1`）对应的中心频率：
  `f_i = fMin * Math.pow(fMax / fMin, i / (outputCount - 1))`。
- 输出 bin `i` 覆盖的输入区间：把 `f_i` 向下取整到输入 bin 起点 `lo_i`、向上到 `hi_i`，
  即 `lo_i = floor(f_i / binHz)`（并夹到 `[0, data.length - 1]`），
  `hi_i = floor(f_{i+1} / binHz)`（末位取 `data.length`）。
- 输出值 = `data[lo_i .. hi_i)` 的**最大值**（用最大值而不是平均值，避免高频能量被稀释掉）。
- `outputCount` 为 1 时避免除零，直接返回 `data[0]`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: 4 个用例全部 PASS。

- [ ] **Step 5: 类型检查与提交**

```bash
npx tsc --noEmit
git add package.json src/renderer/core/visualization/analysis/log-bins.ts src/renderer/core/visualization/analysis/log-bins.test.ts
git commit -m "新增对数频谱映射与 Node 原生测试基建"
```

> `package.json` 的 `test` 脚本：
> `"test": "node --test --no-warnings=MODULE_TYPELESS_PACKAGE_JSON \"src/**/*.test.ts\""`
> （`MODULE_TYPELESS_PACKAGE_JSON` 警告是因为项目 `package.json` 没有 `"type": "module"`——
> **不要**加 `"type": "module"`，那会破坏现有 webpack/forge 构建。）

---

## Task 2: 节拍检测与 BPM 估计

**Files:**
- Create: `src/renderer/core/visualization/analysis/beat-detector.ts`
- Create: `src/renderer/core/visualization/analysis/beat-detector.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  // src/renderer/core/visualization/analysis/beat-detector.ts
  export interface IBeatDetectorOptions {
      threshold?: number;    // 默认 1.35：瞬时能量超过滑动均值多少倍算一拍
      windowFrames?: number; // 默认 43（约 0.7s @60fps）
      minIntervalMs?: number;// 默认 200：两次拍点的最小间隔
      decayMs?: number;      // 默认 150：包络衰减时间常数
  }
  export interface IBeatResult {
      beat: number;  // 0..1 包络，刚触发时为 1，之后指数衰减
      bpm: number;   // 估算 BPM，没估出来时为 0
  }
  export class BeatDetector {
      constructor(options?: IBeatDetectorOptions);
      /** 送入一帧的低频能量（0..1）与时间戳，返回本帧的节拍信息 */
      push(lowFrequencyEnergy: number, nowMs: number): IBeatResult;
      reset(): void;
  }
  ```

- [ ] **Step 1: 写失败的测试**

`src/renderer/core/visualization/analysis/beat-detector.test.ts`：

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BeatDetector } from "./beat-detector.ts";

test("恒定输入不产生节拍", () => {
    const d = new BeatDetector();
    let maxBeat = 0;
    for (let i = 0; i < 200; i++) {
        maxBeat = Math.max(maxBeat, d.push(0.3, i * 16.67).beat);
    }
    assert.equal(maxBeat, 0);
    assert.equal(d.push(0.3, 3000).bpm, 0);
});

test("每 500ms 一个脉冲被判为 120 BPM", () => {
    const d = new BeatDetector();
    for (let i = 0; i < 600; i++) {
        const t = i * 16.67;
        const energy = i % 30 === 0 ? 0.9 : 0.2;   // 30 帧 ≈ 500ms
        d.push(energy, t);
    }
    const bpm = d.push(0.2, 600 * 16.67).bpm;
    assert.ok(Math.abs(bpm - 120) < 12, `期望 ~120 BPM，实际 ${bpm}`);
});

test("节拍包络在触发后衰减", () => {
    const d = new BeatDetector();
    for (let i = 0; i < 30; i++) d.push(0.2, i * 16.67);
    const hit = d.push(0.95, 30 * 16.67);
    assert.ok(hit.beat > 0.9, `触发时应接近 1，实际 ${hit.beat}`);
    const later = d.push(0.2, 30 * 16.67 + 500);
    assert.ok(later.beat < 0.1, `500ms 后应衰减到接近 0，实际 ${later.beat}`);
});

test("过于密集的脉冲不会重复触发", () => {
    const d = new BeatDetector();
    for (let i = 0; i < 30; i++) d.push(0.2, i * 16.67);
    d.push(0.95, 30 * 16.67);
    const second = d.push(0.95, 30 * 16.67 + 50);  // 距上一拍仅 50ms
    assert.ok(second.beat < 0.5, `50ms 内不应再次触发，实际 ${second.beat}`);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`Cannot find module './beat-detector.ts'`。

- [ ] **Step 3: 实现 `BeatDetector`**

`src/renderer/core/visualization/analysis/beat-detector.ts`：

- 维护最近 `windowFrames` 个 `lowFrequencyEnergy` 的滑动平均 `avg`（不足窗口长度时按已有样本平均）。
- 触发条件：`energy > avg * threshold` **且** `nowMs - lastBeatAt > minIntervalMs`。
  触发时：`beat = 1`，记录 `lastBeatAt`，把当前能量并入拍点间隔队列。
- 包络：每帧按 `beat *= Math.exp(-dt / decayMs)` 衰减（`dt` 为距上次调用的毫秒数）。
- BPM：拍点间隔队列保留最近 8 个，取**中位数**的倒数 `60000 / medianInterval`；
  队列少于 4 个时返回 0。
- `reset()` 清空滑动窗口、拍点间隔队列与包络。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: 全部 PASS（含 Task 1 的 4 个）。

- [ ] **Step 5: 类型检查与提交**

```bash
npx tsc --noEmit
git add src/renderer/core/visualization/analysis/beat-detector.ts src/renderer/core/visualization/analysis/beat-detector.test.ts
git commit -m "新增节拍检测与 BPM 估计"
```

---

## Task 3: 暴露 mediaElement 与 capture 行为验证脚本

**Files:**
- Modify: `src/renderer/core/track-player/controller/audio-controller.ts`（加 getter，约在 `get hasSource()` 之后）
- Create: `scripts/verify-visualization-capture.js`
- Modify: `package.json`（加 `verify:capture` 脚本）

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  // audio-controller.ts
  get mediaElement(): HTMLAudioElement;   // 只读暴露，绝不用于改动音频路径
  ```

- [ ] **Step 1: 写 capture 验证脚本**

`scripts/verify-visualization-capture.js`：Electron 主进程脚本，输出三种音源形式下
`captureStream()` 的行为，结论必须与 spec §5.1 一致：

- **blob URL**（`URL.createObjectURL` 一个 WAV）：`captureStream()` 成功，audio track 数 ≥ 1。
- **MSE**（`MediaSource` + `SourceBuffer("audio/webm;codecs=opus")`，用 `MediaRecorder` 造片段）：
  同上成功。
- **跨域 http URL**（本地起一个不带 CORS 头的 http server）：`captureStream()` 抛
  `SecurityError`，消息包含 `cross-origin`。

脚本要求：
- 用 `BrowserWindow({ show: false, webPreferences: { offscreen: true } })`；
- 生成 WAV 时**在渲染进程里**用 `OfflineAudioContext`（主进程没有这个 API），
  再 base64 传回主进程；
- 结尾 `app.exit(0)`，并加一个 40 秒的硬超时定时器，避免脚本挂死。

- [ ] **Step 2: 加 npm 脚本并运行**

在 `package.json` 的 `scripts` 里加：
`"verify:capture": "electron scripts/verify-visualization-capture.js"`

Run: `npm run verify:capture`
Expected: 输出三段结论——blob 成功、MSE 成功、跨域抛 `SecurityError`。
若 blob 或 MSE 失败，**停下来报告**，说明 spec §5.1 的前提不成立，后续任务的方案需要调整。

- [ ] **Step 3: 给 `audio-controller.ts` 加 getter**

在 `get hasSource()` 之后加：

```ts
    /**
     * 暴露音频元素给可视化分析用。
     * 只读——调用方不得改动 src / crossOrigin / volume，
     * 否则会影响播放。
     */
    get mediaElement() {
        return this.audio;
    }
```

- [ ] **Step 4: 类型检查与提交**

```bash
npx tsc --noEmit
git add src/renderer/core/track-player/controller/audio-controller.ts scripts/verify-visualization-capture.js package.json
git commit -m "暴露 audio 元素并新增 capture 行为验证脚本"
```

---

## Task 4: AudioAnalyzer —— 采集与组帧

**Files:**
- Create: `src/types/visualization.d.ts`
- Create: `src/renderer/core/visualization/analyzer.ts`
- Create: `src/renderer/core/visualization/index.ts`
- Modify: `src/renderer/document/bootstrap.ts`

**Interfaces:**
- Consumes: Task 1 的 `mapToLogBins`；Task 2 的 `BeatDetector`；Task 3 的 `get mediaElement()`
- Produces:
  ```ts
  // src/types/visualization.d.ts（全局类型，无需 import）
  declare namespace IVisualization {
      interface IAudioFrame {
          frequency: Uint8Array;  // 512 bin，0..255
          waveform: Uint8Array;   // 256 采样点，0..255
          level: number;          // 0..1 总体能量
          beat: number;           // 0..1 节拍包络
          bpm: number;
          playing: boolean;
          available: boolean;     // false = 此音源无法可视化
      }
      interface IThemeColors {
          primary: string;
          text: string;
          background: string;
      }
  }
  // src/renderer/core/visualization/analyzer.ts
  export class AudioAnalyzer {
      attach(mediaElement: HTMLMediaElement): void;
      detach(): void;
      readFrame(): IVisualization.IAudioFrame;
      get isAvailable(): boolean;
  }
  export const audioAnalyzer: AudioAnalyzer;   // 单例
  ```

- [ ] **Step 1: 定义全局类型**

`src/types/visualization.d.ts`：按上面的 `IVisualization` 命名空间写（照 `src/types/common.d.ts`
里 `declare namespace ICommon {...}` 的写法）。

- [ ] **Step 2: 实现 `AudioAnalyzer`**

`src/renderer/core/visualization/analyzer.ts`：

- `attach(mediaElement)`：
  - 先 `detach()` 旧绑定。
  - **策略 A（首选）**：调 `mediaElement.captureStream()`。
    - 若抛异常（跨域 `SecurityError`）→ 走 B。
    - 若 `stream.getAudioTracks().length === 0` → 走 B。
    - 成功则 `source = ctx.createMediaStreamSource(stream)`，`ctx` 是**模块级复用的**
      `AudioContext`（懒创建，`fftSize = 2048`、`smoothingTimeConstant = 0.75`），
      调用 `ctx.resume()`。
  - **策略 B（回退，仅同源 blob）**：`mediaElement.src.startsWith("blob:")` 为真时才尝试
    `ctx.createMediaElementSource(mediaElement)` → `analyser`，**并把 analyser `connect(ctx.destination)`**
    （不连就会静音）；此时分析数据从 analyser 读。
    非 blob src 直接判定不可用（跨域走这条路会静音整个播放器）。
  - 都不成 → `isAvailable = false`。
  - 记录 `analyser` 与 `sourceNode`，供 `detach()` 断开连接。
- `readFrame()`：
  - 不可用时返回 `{ frequency: new Uint8Array(512), waveform: new Uint8Array(256), level: 0, beat: 0, bpm: 0, playing: false, available: false }`。
  - 可用时：`analyser.getByteFrequencyData(raw)`（`raw` 长度 = `frequencyBinCount`）→
    `mapToLogBins(raw, 512, { sampleRate: ctx.sampleRate, fftSize: analyser.fftSize })`。
  - `analyser.getByteTimeDomainData(timeDomain)` → 取前 256 个采样点（128 字节域时按步长抽稀）。
  - `level` = 频域所有 bin 的平均值 / 255。
  - 低频能量 = 前 8 个 bin 的平均值 / 255 → 喂给 `BeatDetector.push(energy, now)`，
    得到 `beat` 与 `bpm`。
  - `playing` = `!mediaElement.paused`。
- `detach()`：断开 `sourceNode`/`analyser` 与 `ctx` 的连接；**不要 `ctx.close()`**（上下文是复用的）。

- [ ] **Step 3: 实现主窗口侧入口 `index.ts`**

`src/renderer/core/visualization/index.ts`：

- 拿到 `audio-controller` 的 `mediaElement`（通过 `track-player` 暴露的实例）。
- 监听元素的 `playing` 事件 → `audioAnalyzer.attach(element)`；
  监听元素的 `src` 变化（`src` 变化会让旧的 capture track 结束）→ 重新 `attach`。
  **不要**用 `PlayerEvents.MusicChanged` 做 attach 时机：它在 `setCurrentMusic()` 里发出，
  早于 `setTrack()` 给元素赋新 `src`，那一刻元素上还没有资源。
- 导出 `startVisualizationService()`，在 `src/renderer/document/bootstrap.ts` 里调用。

- [ ] **Step 4: 在 bootstrap 里挂上服务**

在 `src/renderer/document/bootstrap.ts` 的 `export default async function () {` 里，
在 `ServiceManager.setup()` 之后加一行调用 `startVisualizationService()`。

- [ ] **Step 5: 类型检查与提交**

```bash
npx tsc --noEmit
git add src/types/visualization.d.ts src/renderer/core/visualization/analyzer.ts src/renderer/core/visualization/index.ts src/renderer/document/bootstrap.ts
git commit -m "新增音频分析与主窗口侧可视化服务"
```

- [ ] **Step 6: 手动验证（Review Focus #3 / #4 / #5）**

用 `npm start` 起开发模式，播放一首歌，在 DevTools 里执行：

```js
// 应当在播放中返回 true
document.querySelector("audio")?.paused
```

并在主窗口 console 里检查 `audioAnalyzer.isAvailable` 与 `audioAnalyzer.readFrame().level`。

- **#4 换歌不残留**：换歌后 `readFrame().level` 应先归零再随新歌上升，
  不能残留上一首的频谱。
- **#5 音量语义**：把播放器音量调到 0，`readFrame().level` 应趋近 0
  （capture 捕获的是音量**之后**的信号，所见即所听）。
  若此时 level 仍很大，说明取数绕过了音量，用户会看到「静音了但还在狂跳」。
- **#3 没有静音**：若出现「`audio.paused === false` 但没声音」，
  说明误走了跨域回退路径 —— **立即停止**，检查 `src` 是否为 `blob:` 开头。

---

## Task 5: message-bus —— pull 帧协议

**Files:**
- Modify: `src/shared/message-bus/type.d.ts`
- Modify: `src/shared/message-bus/preload/main.ts`
- Modify: `src/shared/message-bus/preload/extension.ts`
- Modify: `src/shared/message-bus/renderer/extension.ts`

**Interfaces:**
- Consumes: Task 4 的 `IVisualization.IAudioFrame`
- Produces:
  ```ts
  // preload/main.ts 暴露给主窗口（contextBridge "@shared/message-bus/main"）
  pushVisualizationFrame(frame: IVisualization.IAudioFrame): void;

  // preload/extension.ts 暴露给扩展窗口（contextBridge "@shared/message-bus/extension"）
  requestFrame(): void;
  onVisualizationFrame(cb: (frame: IVisualization.IAudioFrame) => void): void;
  offVisualizationFrame(cb: (frame: IVisualization.IAudioFrame) => void): void;
  ```

- [ ] **Step 1: 扩展消息类型**

`src/shared/message-bus/type.d.ts`：

- `IPortMessage` 的 `type` 联合里加两个：`"requestFrame"` 与 `"visualizationFrame"`。
- `IAppState` 里加 `themeColors?: IVisualization.IThemeColors`。
- `ICommand` 里加 `SubscribeVisualization: void`（扩展窗口用它登记订阅）。

- [ ] **Step 2: 主窗口 preload 支持回帧**

`src/shared/message-bus/preload/main.ts`：

- 新增一个 `Set<number>` 记录订阅了频谱的扩展窗口 id。
- `handleMessage` 里：`type === "command" && payload.command === "SubscribeVisualization"` →
  把 `from` 加入订阅集合；`type === "subscribeAppState"` 分支保持原样。
- 新增 `type === "requestFrame"` 分支：**preload 在隔离世界，不能直接调主世界的函数**，
  用 `ipcRenderer.send("@shared/visualization/frame-request")` 把请求转给主世界。
- 新增 `pushVisualizationFrame(frame)`：遍历订阅集合，对每个订阅者
  `expPort.postMessage({ type: "visualizationFrame", payload: frame, timestamp: Date.now() })`。
- 在 `mod`（contextBridge 暴露对象）里加上 `pushVisualizationFrame`。

- [ ] **Step 3: 扩展窗口 preload 支持取帧与收帧**

`src/shared/message-bus/preload/extension.ts`：

- `extPort.onmessage` 里加分支：`data.type === "visualizationFrame"` →
  `ee.emit("visualizationFrame", data.payload)`。
- 加 `requestFrame()`：若已连接则 `extPort.postMessage({ type: "requestFrame" })`，
  否则缓存（复用现有的 `cachedMessages` 机制）。
- 加 `onVisualizationFrame(cb)` / `offVisualizationFrame(cb)`，用现有的 `ee` 派发。
- 在 `mod` 里暴露这三个方法。

- [ ] **Step 4: 扩展窗口 renderer 层暴露**

`src/shared/message-bus/renderer/extension.ts`：把 `requestFrame`、`onVisualizationFrame`、
`offVisualizationFrame` 加进导出的 `messageBus` 对象。

- [ ] **Step 5: 类型检查与提交**

```bash
npx tsc --noEmit
git add src/shared/message-bus/type.d.ts src/shared/message-bus/preload/main.ts src/shared/message-bus/preload/extension.ts src/shared/message-bus/renderer/extension.ts
git commit -m "message-bus 增加频谱帧的 pull 协议"
```

---

## Task 6: 主窗口帧服务与主题色同步

**Files:**
- Create: `src/renderer/core/visualization/theme-colors.ts`
- Create: `src/renderer/core/visualization/theme-colors.test.ts`
- Modify: `src/renderer/core/visualization/index.ts`

**Interfaces:**
- Consumes: Task 4 的 `audioAnalyzer`、`IVisualization.IAudioFrame`；Task 5 的 `pushVisualizationFrame`
- Produces:
  ```ts
  // src/renderer/core/visualization/theme-colors.ts
  export const defaultThemeColors: IVisualization.IThemeColors;
  export function parseThemeColors(raw: Record<string, string>): IVisualization.IThemeColors;
  export function observeThemeChanges(onChange: (colors: IVisualization.IThemeColors) => void): () => void;
  // src/renderer/core/visualization/index.ts
  export function startVisualizationService(): void;
  ```

- [ ] **Step 1: 写失败的主题色测试**

`src/renderer/core/visualization/theme-colors.test.ts`：

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseThemeColors, defaultThemeColors } from "./theme-colors.ts";

test("缺失的变量回落到默认色", () => {
    const c = parseThemeColors({});
    assert.equal(c.primary, defaultThemeColors.primary);
    assert.equal(c.text, defaultThemeColors.text);
    assert.equal(c.background, defaultThemeColors.background);
});

test("提供了就用提供的值", () => {
    const c = parseThemeColors({ "--primaryColor": "#f0a020", "--textColor": "#fff" });
    assert.equal(c.primary, "#f0a020");
    assert.equal(c.text, "#fff");
});

test("空字符串视为缺失", () => {
    const c = parseThemeColors({ "--primaryColor": "   " });
    assert.equal(c.primary, defaultThemeColors.primary);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`Cannot find module './theme-colors.ts'`。

- [ ] **Step 3: 实现主题色读取**

`src/renderer/core/visualization/theme-colors.ts`：

- `defaultThemeColors = { primary: "#f0a020", text: "#ffffff", background: "#232c36" }`。
- `parseThemeColors(raw)`：从 `raw` 里取 `--primaryColor` / `--textColor` / `--backgroundColor`，
  trim 后为空则用默认值。
- `observeThemeChanges(onChange)`：
  - 立刻调一次 `onChange(readThemeColors())`；
  - 用 `MutationObserver` 观察 `document.querySelector("#themepack-node")` 的
    `childList` 与 `characterData`（主题包切换时 preload 会重写它的 `innerHTML`）；
  - 回调里读 `getComputedStyle(document.documentElement).getPropertyValue("--primaryColor")` 等
    三个变量，trim 后交给 `parseThemeColors`，再 `onChange`；
  - 返回取消监听的函数。
  - 若找不到 `#themepack-node` 节点，不注册 observer（app 默认变量常驻，读一次就够）。

- [ ] **Step 4: 在服务里接上取帧与颜色**

`src/renderer/core/visualization/index.ts` 补上：

- `ipcRenderer.on("@shared/visualization/frame-request", () => { const frame = audioAnalyzer.readFrame(); messageBus.pushVisualizationFrame(frame); })`
  —— `ipcRenderer` 从 `@shared/utils/renderer` 或 electron 引入（按仓库既有写法）。
  这里的 `messageBus` 是 `@shared/message-bus/renderer/main` 的默认导出。
- `observeThemeChanges(colors => { messageBus.syncAppState({ themeColors: colors }); })`。

- [ ] **Step 5: 运行测试并提交**

```bash
npm test
npx tsc --noEmit
git add src/renderer/core/visualization/theme-colors.ts src/renderer/core/visualization/theme-colors.test.ts src/renderer/core/visualization/index.ts
git commit -m "主窗口提供频谱帧与主题色"
```

- [ ] **Step 6: 手动验证（Review Focus #1 / #6）**

`npm start`，播放音乐，在主窗口 DevTools 里确认帧服务已接上
（可视化窗口在 Task 7 之后才有，本任务阶段先用 console 确认）：

```js
// 手动触发一次取帧请求，应当拿到非空帧
window.require("@shared/message-bus/main")
```

- **#6 性能**：主窗口在播放 + 取帧的同时应保持流畅——用 DevTools 的 Performance 面板
  看主窗口的帧率；取帧不得让主界面掉帧（每帧只做一次 FFT + 一次 postMessage）。
- **#1 主窗口隐藏后仍能取到帧**：把主窗口最小化或隐藏，
  此时主窗口的 rAF 被节流，但**IPC 回调不受影响**——
  确认隐藏后仍能收到 frame-request 并回出非空帧（这是 pull 模型成立的前提）。

---

## Task 7: 可视化窗口 —— 主进程、entry 与接入点

**Files:**
- Modify: `forge.config.ts`
- Modify: `config/webpack.renderer.config.ts`
- Modify: `tsconfig.json`
- Modify: `src/main/window-manager/index.ts`
- Modify: `src/types/main/window-manager.d.ts`
- Create: `src/renderer-visualization/document/index.html`
- Create: `src/renderer-visualization/document/index.tsx`
- Create: `src/renderer-visualization/document/bootstrap.ts`
- Create: `src/renderer-visualization/pages/index.tsx`

**Interfaces:**
- Consumes: Task 5 的 `requestFrame` / `onVisualizationFrame` / `subscribeAppState`
- Produces:
  ```ts
  // src/types/main/window-manager.d.ts
  interface IWindowNames { /* ... */ "visualization": boolean; }
  interface IWindowManager {
      // ... 已有方法
      showVisualizationWindow(): void;
      closeVisualizationWindow(): void;
  }
  ```

- [ ] **Step 1: 注册 renderer entry**

`forge.config.ts` 的 `entryPoints` 数组里，在 `minimode_window` 之后加：

```ts
{
    html: "./src/renderer-visualization/document/index.html",
    js: "./src/renderer-visualization/document/index.tsx",
    name: "visualization_window",
    preload: {
        js: "./src/preload/extension.ts",
    },
},
```

`src/preload/extension.ts` 已包含 `common-preload`（含 app-config、window-drag）与
`message-bus/preload/extension`，**不需要新建 preload**。

- [ ] **Step 2: 加别名（两处，漏一处 tsc 就红）**

- `config/webpack.renderer.config.ts` 的 `resolve.alias` 加：
  `"@renderer-visualization": path.join(__dirname, "../src/renderer-visualization")`
- `tsconfig.json` 的 `paths` 加：
  `"@renderer-visualization/*": ["src/renderer-visualization/*"]`

- [ ] **Step 3: 主进程窗口类型**

`src/types/main/window-manager.d.ts`：

- `IWindowNames` 加 `"visualization": boolean;`
- `IWindowManager` 加 `showVisualizationWindow(): void;` 与 `closeVisualizationWindow(): void;`

- [ ] **Step 4: 创建窗口**

`src/main/window-manager/index.ts`，照 `createLyricWindow()` 的写法加 `createVisualizationWindow()`：

- `new BrowserWindow({ width: 480, height: 300, transparent: true, frame: false, alwaysOnTop: true, resizable: false, skipTaskbar: true, show: false, webPreferences: { preload: VISUALIZATION_WINDOW_PRELOAD_WEBPACK_ENTRY } })`
- 顶部加 `declare const VISUALIZATION_WINDOW_WEBPACK_ENTRY: string;` 与
  `declare const VISUALIZATION_WINDOW_PRELOAD_WEBPACK_ENTRY: string;`
- `WindowDrag.setWindowDraggable(visualizationWindow, {...})`（照歌词窗口的调用）。
- `ready-to-show` 时 `showInactive()`（不抢焦点）。
- 位置存 `AppConfig` 的 `private.visualizationWindowPosition`（**只存位置，不存尺寸**——
  窗口固定尺寸）。
- `showVisualizationWindow()`：不存在则创建，存在则 `show()`；
  `closeVisualizationWindow()`：存在则 `close()`。
- **窗口的 `close` 事件要回写 `AppConfig` 的 `visualization.enabled = false`**，
  否则配置与实际状态脱节。
- **把可视化窗口加入 `getExtensionWindows()`**（否则 message-bus 不会为它建 MessagePort，
  窗口会「打开了但没数据」）**和 `getAllWindows()`**（否则 AppConfig 的变更广播不到它，
  改了设置它不跟着变）。

- [ ] **Step 5: 窗口内的最小页面**

`src/renderer-visualization/document/index.html`：照 `src/renderer-lrc/document/index.html` 写，
`<div id="root"></div>`。

`src/renderer-visualization/document/index.tsx`：`ReactDOM.createRoot` 挂 `<VisualizationPage />`。

`src/renderer-visualization/document/bootstrap.ts`：

```ts
import AppConfig from "@shared/app-config/renderer";
import messageBus from "@shared/message-bus/renderer/extension";

export default async function () {
    await AppConfig.setup();
    messageBus.subscribeAppState(["playerState", "musicItem", "themeColors"]);
    messageBus.sendCommand("SyncAppState");
    messageBus.sendCommand("SubscribeVisualization");
}
```

> `subscribeAppState` 是**整体替换**订阅键集合，所以 `themeColors` 与 `musicItem` 必须在
> 同一次调用里一起订阅。

`src/renderer-visualization/pages/index.tsx`：先渲染一个占位——
`<div className="visualization-placeholder">可视化</div>`，Task 8 再换成 canvas。

- [ ] **Step 6: 类型检查与提交**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 类型检查与 lint 均无错。

> 窗口**实际打开**的验证放在 Task 11（那时开关按钮就位了）。
> 本任务只保证「构建产物里有这个 entry、类型都对、窗口能被创建」。

```bash
git add forge.config.ts config/webpack.renderer.config.ts tsconfig.json src/main/window-manager/index.ts src/types/main/window-manager.d.ts src/renderer-visualization/
git commit -m "新增可视化独立窗口"
```

---

## Task 8: 效果引擎与 bars / oscilloscope

**Files:**
- Create: `src/renderer-visualization/core/types.ts`
- Create: `src/renderer-visualization/core/engine.ts`
- Create: `src/renderer-visualization/core/engine.test.ts`
- Create: `src/renderer-visualization/core/effects/index.ts`
- Create: `src/renderer-visualization/core/effects/bars.ts`
- Create: `src/renderer-visualization/core/effects/oscilloscope.ts`
- Modify: `src/renderer-visualization/pages/index.tsx`

**Interfaces:**
- Consumes: Task 4 的 `IVisualization.IAudioFrame` / `IThemeColors`；Task 5 的 `requestFrame` / `onVisualizationFrame`
- Produces:
  ```ts
  // src/renderer-visualization/core/types.ts
  export interface IVisualizationEffect {
      id: string;
      nameKey: string;                     // i18n key
      init?(ctx: CanvasRenderingContext2D, size: { width: number; height: number }): void;
      render(
          ctx: CanvasRenderingContext2D,
          size: { width: number; height: number },
          frame: IVisualization.IAudioFrame,
          colors: IVisualization.IThemeColors,
      ): void;
      reset?(): void;
  }
  // src/renderer-visualization/core/engine.ts
  export function pickNextEffectId(currentId: string, mode: string, allIds: string[]): string;
  export function fitCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): void;
  // src/renderer-visualization/core/effects/index.ts
  export const effectRegistry: Record<string, () => IVisualizationEffect>;
  ```

- [ ] **Step 1: 写失败的引擎测试**

`src/renderer-visualization/core/engine.test.ts`：

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickNextEffectId } from "./engine.ts";

const ids = ["bars", "oscilloscope", "spectrum"];

test("锁定模式返回指定效果", () => {
    assert.equal(pickNextEffectId("bars", "bars", ids), "bars");
});

test("随机模式不会选到当前效果", () => {
    for (let i = 0; i < 20; i++) {
        const next = pickNextEffectId("bars", "random", ids);
        assert.notEqual(next, "bars");
        assert.ok(ids.includes(next));
    }
});

test("只有一个效果时随机模式返回它自己", () => {
    assert.equal(pickNextEffectId("bars", "random", ["bars"]), "bars");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`Cannot find module './engine.ts'`。

- [ ] **Step 3: 实现引擎**

`src/renderer-visualization/core/types.ts`：写上面的 `IVisualizationEffect`。

`src/renderer-visualization/core/engine.ts`：

- `fitCanvas(canvas, cssWidth, cssHeight)`：
  `dpr = window.devicePixelRatio || 1`；`canvas.width = max(1, floor(cssWidth * dpr))`、
  `canvas.height = max(1, floor(cssHeight * dpr))`；
  `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`。
- `pickNextEffectId(currentId, mode, allIds)`：`mode !== "random"` 返回 `mode`；
  否则从 `allIds` 里排除 `currentId` 后随机取一个；只剩一个时返回它。
- 引擎主体 `createEngine(canvas, getMode)`：
  - 维护 `currentEffect`（由 `effectRegistry[mode]` 或随机选出）。
  - `requestAnimationFrame` 循环：`clearRect` → `currentEffect.render(ctx, size, frame, colors)`。
  - `document.hidden` 时跳过绘制（但仍保持 rAF 循环）。
  - 收到帧时更新 `frame`；`colors` 变化时更新。
  - 切效果时调旧效果的 `reset?.()`，再 `init` 新效果。
  - 模式为 `"random"` 且 `musicItem` 变化时用 `pickNextEffectId` 换效果。

- [ ] **Step 4: 实现 bars 与 oscilloscope**

`src/renderer-visualization/core/effects/bars.ts`：

- 512 个 bin 画成柱子，但**显示时按窗口宽度抽样**（柱子数 = `floor(width / 6)`，
  最多 64 根），从 `frame.frequency` 里按比例取对应 bin。
- 柱高按 `bin / 255` 映射到高度，并做「上升快、回落慢」的包络（保留上一帧高度数组，
  上升系数 0.34、回落 0.09，与主题包里假频谱的观感一致）。
- 低频柱更高：用 `Math.pow(1 - i / (n - 1), 1.35) * 0.55 + 0.45` 作权重。
- 颜色用 `colors.primary` 派生渐变（顶部亮、底部透明）。
- `frame.beat` 触发时整体抬升。

`src/renderer-visualization/core/effects/oscilloscope.ts`：

- 直接把 `frame.waveform`（256 点）连成折线，横向铺满窗口。
- 线宽与辉光强度随 `frame.level` 变化；颜色用 `colors.primary`。
- `level` 为 0 时画一条居中的平线。

- [ ] **Step 5: 注册表与页面接线**

`src/renderer-visualization/core/effects/index.ts`：

```ts
import { IVisualizationEffect } from "../types.ts";
import { createBarsEffect } from "./bars.ts";
import { createOscilloscopeEffect } from "./oscilloscope.ts";

export const effectRegistry: Record<string, () => IVisualizationEffect> = {
    bars: createBarsEffect,
    oscilloscope: createOscilloscopeEffect,
};
```

（实现者把每个效果文件导出成 `createXxxEffect(): IVisualizationEffect` 工厂函数。）

`src/renderer-visualization/pages/index.tsx`：换成 canvas + 引擎接线：

- 用 `useAppConfig("visualization.effect")` 读模式；用 `useAppStatePartial("themeColors")`
  读颜色；用 `useAppStatePartial("musicItem")` 监听换歌。
- `useEffect` 里 `messageBus.onVisualizationFrame(setFrame)`、`messageBus.requestFrame()`
  （在 rAF 里每帧请求一次，不是只在开始时请求一次）。
- canvas 的 CSS 尺寸填满容器。

- [ ] **Step 6: 测试、类型检查、提交**

```bash
npm test
npx tsc --noEmit
git add src/renderer-visualization/core/ src/renderer-visualization/pages/index.tsx
git commit -m "新增可视化效果引擎与条形、示波器效果"
```

- [ ] **Step 7: 手动验证**

`npm start`，打开可视化窗口，播放音乐：应看到**随音乐起伏**的柱状图（不是固定动画）。
切到示波器应看到波形左右流动。暂停后画面静止但**不报错**。

再验证一次音量语义（Review Focus #5）：把播放器音量调到 0，
可视化应**跟着静止**（capture 是音量后的信号）；若仍在狂跳说明取数绕过了音量。

---

## Task 9: 魔幻组效果 —— spectrum / particle / geometry

**Files:**
- Create: `src/renderer-visualization/core/effects/spectrum.ts`
- Create: `src/renderer-visualization/core/effects/particle.ts`
- Create: `src/renderer-visualization/core/effects/geometry.ts`
- Modify: `src/renderer-visualization/core/effects/index.ts`

**Interfaces:**
- Consumes: Task 8 的 `IVisualizationEffect` 与注册表
- Produces: 注册表新增三个键 `"spectrum"` / `"particle"` / `"geometry"`

- [ ] **Step 1: 实现 `spectrum`（频谱山脊）**

- 把 `frame.frequency` 的 512 个 bin 连成一条平滑曲线（相邻点做线性插值补到像素宽度）。
- 填充曲线到窗口底部，顶部用 `colors.primary`、底部渐隐。
- `frame.beat` 触发时曲线整体上移一点并短暂加亮。

- [ ] **Step 2: 实现 `particle`（粒子）**

- 维护粒子数组（上限 300）：`{ x, y, vx, vy, life, hue }`。
- 每帧按 `frame.level` 决定发射概率（`level * 0.6`），从底部中央发射。
- 粒子速度与 `frame.level` 正相关；透明度随 `life` 衰减；用 `colors.primary` 的色相偏移
  （按 bin 能量在 ±60° 内偏移色相）着色。
- `frame.beat` 触发时额外爆发一批粒子。
- `reset()` 清空粒子数组。

- [ ] **Step 3: 实现 `geometry`（几何多边形）**

- 中心画 3 层多边形（边数 5 / 7 / 9），每层按 `frame.frequency` 的中频段能量控制旋转速度与缩放。
- `frame.beat` 触发时做一次「脉冲」：缩放冲高后回落（用指数衰减的偏移量）。
- 每层颜色由 `colors.primary` 按层深浅派生。

- [ ] **Step 4: 注册并验证**

在 `src/renderer-visualization/core/effects/index.ts` 注册三个新键。

```bash
npm test && npx tsc --noEmit
git add src/renderer-visualization/core/effects/
git commit -m "新增频谱山脊、粒子与几何效果"
```

手动验证：三个效果都应明显随音乐变化（粒子发射率随音量、几何随中频变形）。

---

## Task 10: 其他组效果 —— fluid / battery / fireworks

**Files:**
- Create: `src/renderer-visualization/core/effects/fluid.ts`
- Create: `src/renderer-visualization/core/effects/battery.ts`
- Create: `src/renderer-visualization/core/effects/fireworks.ts`
- Modify: `src/renderer-visualization/core/effects/index.ts`

**Interfaces:**
- Consumes: Task 8 的 `IVisualizationEffect` 与注册表
- Produces: 注册表新增三个键 `"fluid"` / `"battery"` / `"fireworks"`

- [ ] **Step 1: 实现 `battery`（电池）**

- 画一个竖直电池轮廓（圆角矩形 + 顶部触点）。
- 内部液面高度 = 电量（0..1），电量由能量**积分**得到：
  每帧 `charge = clamp(charge + (level - 0.02) * dt / 8, 0, 1)`（放电慢、充电快）。
- 液面用 `colors.primary`；电量低于 0.2 时改用红色。
- `frame.beat` 触发时电池轻微抖动（±1px 偏移，指数衰减）。

- [ ] **Step 2: 实现 `fireworks`（烟花）**

- 维护爆炸列表；`frame.beat` 触发一次爆炸（位置随机、颜色取 `colors.primary` 加色相偏移）。
- 每个爆炸 30~60 个粒子，按随机方向飞散并受「重力」下拉，透明度随寿命衰减。
- 粒子寿命 1~2 秒。

- [ ] **Step 3: 实现 `fluid`（流体涡旋）**

- 用一个低分辨率的标量场（例如 32×18 的网格）做涡旋流动：
  每帧按 `frame.level` 与 `frame.beat` 给场加旋度并做一次扩散。
- 渲染时按场的值映射到 `colors.primary` 的透明度，用 `fillRect` 画格子
  （分辨率低、格子大，视觉上就是流动的涡旋）。
- `reset()` 清空场。

- [ ] **Step 4: 注册并验证**

在 `src/renderer-visualization/core/effects/index.ts` 注册三个新键。

```bash
npm test && npx tsc --noEmit
git add src/renderer-visualization/core/effects/
git commit -m "新增电池、烟花与流体效果"
```

手动验证：电池随音乐充放电；烟花在鼓点炸开；流体随节奏翻涌。

---

## Task 11: 设置项、开关按钮与文案

**Files:**
- Modify: `src/types/app-config.d.ts`
- Modify: `src/shared/app-config/default-app-config.ts`
- Modify: `src/shared/utils/main.ts`
- Modify: `src/shared/utils/preload.ts`
- Modify: `src/shared/utils/renderer.ts`
- Modify: `src/renderer/components/MusicBar/widgets/Extra/index.tsx`
- Create: `src/renderer/pages/main-page/views/setting-view/routers/Visualization/index.tsx`
- Modify: `res/lang/zh-CN.json`、`en-US.json`、`zh-TW.json`

**Interfaces:**
- Consumes: Task 7 的 `showVisualizationWindow` / `closeVisualizationWindow`
- Produces:
  ```ts
  // app-config 新增扁平键
  "visualization.enabled": boolean;   // 默认 false
  "visualization.effect": string;     // 默认 "random"
  // @shared/utils 新增
  setVisualizationWindow(enabled: boolean): void;
  ```

- [ ] **Step 1: 加配置项**

- `src/types/app-config.d.ts` 的 `_IAppConfig` 里加：
  ```ts
  /** 可视化窗口是否开启 */
  "visualization.enabled": boolean;
  /** 可视化效果 id，或 "random" 表示每首歌随机切换 */
  "visualization.effect": string;
  ```
- `src/shared/app-config/default-app-config.ts` 加默认值：
  `"visualization.enabled": false,` 与 `"visualization.effect": "random",`

- [ ] **Step 2: 加窗口开关 IPC（走仓库既有约定）**

- `src/shared/utils/main.ts`：加
  `ipcMain.on("@shared/utils/set-visualization-window", (_evt, enabled: boolean) => { ... })`，
  内部调 `WindowManager.showVisualizationWindow()` / `closeVisualizationWindow()`，
  并同步写 `AppConfig` 的 `visualization.enabled`。
  （照该文件里已有的 `set-lyric-window` 写法，**不要**新造 `ipcMain.handle` 的 invoke 路径。）
- `src/shared/utils/preload.ts`：暴露 `setVisualizationWindow(enabled: boolean)`。
- `src/shared/utils/renderer.ts`：在 `appWindowUtil` 的类型里加上该方法并透传。

- [ ] **Step 3: MusicBar 开关按钮**

`src/renderer/components/MusicBar/widgets/Extra/index.tsx`，照 `LyricBtn` 加一个 `VisualizationBtn`：

- `const enabled = useAppConfig("visualization.enabled");`
- `onClick` 调 `appWindowUtil.setVisualizationWindow(!enabled)`
- `className={classNames({ "extra-btn": true, highlight: enabled })}`
- 图标用现成的 `"dashboard-speed"`（频谱/仪表盘意象）；
  若要专属图标，另建 `src/assets/icons/waveform-spectrum.svg` 并在
  `src/renderer/components/SvgAsset/index.tsx` 的 `SvgAssetIconNames` 联合类型里加名字。

- [ ] **Step 4: 设置页分区**

新建 `src/renderer/pages/main-page/views/setting-view/routers/Visualization/index.tsx`，
并在 `src/renderer/pages/main-page/views/setting-view/routers/index.ts` 注册。

内容：
- 效果选择：8 个效果 + 「随机轮换」的列表（单选）。
- 读 `useAppConfig("visualization.effect")`，改用 `AppConfig.setConfig` 写入。
- 效果名称用 i18n key `settings.visualization.effect.<id>`。

- [ ] **Step 5: 三语文案**

在三个 `res/lang/*.json` 里加：

```
"music_bar": { ... "visualization": "可视化" ... }
"settings": { "visualization": { "title": "可视化", "effect": { "random": "随机轮换", "bars": "条形频谱", "oscilloscope": "示波器", "spectrum": "频谱山脊", "particle": "粒子", "geometry": "几何", "fluid": "流体", "battery": "电池", "fireworks": "烟花" } } }
```

（`en-US.json` 与 `zh-TW.json` 同步加同样的键，值用对应语言。）

- [ ] **Step 6: 类型检查与提交**

```bash
npx tsc --noEmit
git add src/types/app-config.d.ts src/shared/app-config/default-app-config.ts src/shared/utils/ src/renderer/components/MusicBar/widgets/Extra/index.tsx src/renderer/pages/main-page/views/setting-view/routers/ res/lang/
git commit -m "新增可视化设置项、开关按钮与三语文案"
```

- [ ] **Step 7: 手动验证**

点击 MusicBar 的可视化按钮 → 窗口出现；再点 → 关闭且配置写回 `false`。
在设置页切换效果 → 可视化窗口立即换效果（这一步验证了窗口在 `getAllWindows()` 里）。

---

## Task 12: 跨域音源的降级提示

**Files:**
- Modify: `src/renderer-visualization/pages/index.tsx`
- Modify: `res/lang/zh-CN.json`、`en-US.json`、`zh-TW.json`

**Interfaces:**
- Consumes: Task 8 的 `IVisualization.IAudioFrame.available` 字段
- Produces: 无新接口

- [ ] **Step 1: 加文案**

三个语言文件里加：
`"settings": { "visualization": { "unavailable": "此音源无法可视化" } }`
（`en-US`：`"This source cannot be visualized"`）

- [ ] **Step 2: 渲染提示**

`src/renderer-visualization/pages/index.tsx`：

- 维护 `available` 状态：收到帧时看 `frame.available`。
- `available === false` 时，在 canvas 上方叠加一行提示文字
  （用 `t("settings.visualization.unavailable")`），**同时停止绘制效果**。
- `available === true` 时隐藏提示。
- 收到第一帧之前不显示提示（避免窗口刚打开时闪一下）。

- [ ] **Step 3: 类型检查与提交**

```bash
npx tsc --noEmit
git add src/renderer-visualization/pages/index.tsx res/lang/
git commit -m "跨域音源无法可视化时给出明确提示"
```

- [ ] **Step 4: 手动验证（Review Focus #2）**

用 `npm run verify:capture` 里那条跨域路径对应的真实音源（无 header 的公开直链）播放，
窗口应显示「此音源无法可视化」，**而不是**一片静止的画面。

---

## Task 13: 文档与收尾

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-15-visualization-design.md`（标注实现偏差）

**Interfaces:**
- Consumes: 全部前置任务
- Produces: 无

- [ ] **Step 1: 更新 `CLAUDE.md`**

在「架构总览」里补一节「可视化」：说明新增的 renderer entry、pull 帧协议、
`src/renderer/core/visualization/` 与 `src/renderer-visualization/` 的职责、
以及「视觉化的音频采集走 captureStream，绝不碰主播放器的音频路径」这条硬约束。

- [ ] **Step 2: 更新 `README.md`**

在「本地定制功能」小节补一条：可视化（独立窗口 + 8 种效果 + 跟随主题配色）。

- [ ] **Step 3: 记录实现偏差**

若实现过程中与 spec 有出入（参数取值、算法细节、文件名），
在 spec 末尾加一节「实现说明」记录偏差与原因。

- [ ] **Step 4: 全量校验**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: 测试全绿、类型检查无错、lint 无错。

- [ ] **Step 5: 提交**

```bash
git add CLAUDE.md README.md docs/
git commit -m "补充可视化功能的开发文档"
```

- [ ] **Step 6: 最终手动验收**

按 spec §10 的验证清单逐条走一遍（11 条），重点：
主窗口隐藏时可视化仍在动、跨域有提示、换歌不残留、播放器没有静音。

---

## 执行顺序与依赖

```
Task 1（对数映射）─┐
                   ├─→ Task 2（节拍）─┐
Task 3（capture）──┴─→ Task 4（采集）─┴─→ Task 6（帧服务）─┐
                                                        ├─→ Task 8（引擎+2效果）─┐
Task 5（帧协议）────────────────────────────────────────┘                        ├─→ Task 9（魔幻3个）
                                                                                ├─→ Task 10（其他3个）
Task 7（窗口）──────────────────────────────────────────────────────────────────┤
                                                                                ├─→ Task 11（设置UI）
                                                                                └─→ Task 12（降级提示）
                                                                                       └─→ Task 13（文档）
```

Task 1、2、3、5 之间可并行；Task 4 依赖 1/2/3；Task 6 依赖 4/5；
Task 7 可与 4/5 并行；Task 8 依赖 6/7。

**推荐执行方式**：subagent-driven（每个任务一个全新 subagent 实现 + 一个全新 reviewer 审查），
因为 Task 8–10 的 8 个效果彼此独立、但共用 Task 8 定下的引擎接口，接口一旦漂移就会全盘返工。
