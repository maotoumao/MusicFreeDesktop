# 方向键快捷键 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `Left`/`Right` 快退/快进 5 秒、`Up`/`Down` 切上一首/下一首，并接进现有可配置快捷键系统。

**Architecture:** 复用 `hotkeys-js` + `shortCut.shortcuts` 配置的既有快捷键链路：新增 `SeekBackward` / `SeekForward` 两个 `ICommand`，在 `bootstrap.ts` 里转成 `trackPlayer.seekTo()`；`Up`/`Down` 直接绑定到已有的 `skip-previous` / `skip-next`。目标位置的边界计算抽成纯函数以便 `node --test` 覆盖。

**Tech Stack:** Electron + React + TypeScript，`hotkeys-js` 3.13.7，`node --test` 单测。

**Spec:** `docs/superpowers/specs/2026-11-17-keyboard-shortcuts-design.md`

## Global Constraints

- 新增文案必须同时补 `res/lang/zh-CN.json`、`en-US.json`、`zh-TW.json` 三份。
- 全局快捷键一律留空（`global: null`）：方向键注册成全局键会抢走系统所有窗口的方向键。
- 打包版无热重载，改完需重新打包覆盖便携版后才生效；覆盖前必须关闭正在运行的 `MusicFree.exe`，`robocopy` 不加 `/MIR`。
- 一次性快退/快进步长固定为 **5 秒**。
- 不新增依赖。

## Review Focus

- 没有当前歌曲时按方向键：应当什么都不发生，不能抛异常。
- 曲目刚加载、`duration` 还是 `Infinity`/`NaN` 时快进：应按当前时间正常前进，不跳到 `Infinity`。
- 位置在 0 附近快退：应停在 0，不能变成负数（负数赋给 `audio.currentTime` 会抛错）。
- 在搜索框等输入框里按方向键：应只移动光标，不触发播放操作。
- 在设置页的快捷键录制框里按方向键：录制框要能正常记录，不被全局绑定的播放动作卡住。

---

### Task 1: 快进/快退目标位置计算

**Files:**
- Create: `src/renderer/core/track-player/seek.ts`
- Test: `src/renderer/core/track-player/seek.test.ts`

**Interfaces:**
- Produces: `getSeekTarget(currentTime: number, duration: number, delta: number): number`
  —— 返回夹在 `[0, duration]` 内的目标秒数；`duration` 非有限值时只夹下界。

- [ ] **Step 1: 写失败的测试**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getSeekTarget } from "./seek.ts";

test("正常前进 5 秒", () => {
    assert.equal(getSeekTarget(10, 100, 5), 15);
});

test("正常后退 5 秒", () => {
    assert.equal(getSeekTarget(10, 100, -5), 5);
});

test("从 0 附近快退停在 0，不出现负数", () => {
    assert.equal(getSeekTarget(2, 100, -5), 0);
});

test("不超过曲目时长", () => {
    assert.equal(getSeekTarget(98, 100, 5), 100);
});

test("时长未知时只夹下界", () => {
    assert.equal(getSeekTarget(10, Infinity, 5), 15);
    assert.equal(getSeekTarget(10, NaN, 5), 15);
    assert.equal(getSeekTarget(2, Infinity, -5), 0);
});

test("当前时间非有限值时按 0 处理", () => {
    assert.equal(getSeekTarget(NaN, 100, 5), 5);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- --test-name-pattern="快" ` 或直接 `node --test --no-warnings=MODULE_TYPELESS_PACKAGE_JSON src/renderer/core/track-player/seek.test.ts`
Expected: FAIL，报找不到模块 `./seek.ts`。

- [ ] **Step 3: 实现 `getSeekTarget`**

在 `src/renderer/core/track-player/seek.ts` 中实现：先把 `currentTime` 归一到有限数值（否则取 0），再算 `currentTime + delta`，下界夹 0，上界在 `duration` 为有限非负数时夹 `duration`、否则不夹。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test --no-warnings=MODULE_TYPELESS_PACKAGE_JSON src/renderer/core/track-player/seek.test.ts`
Expected: 6 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/core/track-player/seek.ts src/renderer/core/track-player/seek.test.ts
git commit -m "feat: add seek target helper with boundary clamping"
```

---

### Task 2: 新增 SeekForward / SeekBackward 命令

**Files:**
- Modify: `src/shared/message-bus/type.d.ts:17-49`（`ICommand`）
- Modify: `src/renderer/document/bootstrap.ts:149-199`（`setupCommandAndEvents`）

**Interfaces:**
- Consumes: `getSeekTarget(currentTime, duration, delta)` from Task 1。
- Produces: 命令 `SeekForward` / `SeekBackward`（`ICommand` 中类型为 `void`），可供快捷键系统 `messageBus.sendCommand` 调用。

- [ ] **Step 1: 在 `ICommand` 中加两个命令**

```ts
  /** 快退 5 秒 */
  SeekBackward: void;
  /** 快进 5 秒 */
  SeekForward: void;
```

- [ ] **Step 2: 在 `setupCommandAndEvents` 中注册处理**

在 `SkipToPrevious` 的注册旁边加一个 `seekBy(delta: number)` 局部函数：没有 `trackPlayer.currentMusic` 时直接返回；否则取 `trackPlayer.progress` 的 `currentTime` / `duration`，调 `trackPlayer.seekTo(getSeekTarget(...))`。两个命令分别以 `-5` / `5` 调用它。文件顶部补 `import { getSeekTarget } from "@renderer/core/track-player/seek";`。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（exit 0）。

- [ ] **Step 4: 提交**

```bash
git add src/shared/message-bus/type.d.ts src/renderer/document/bootstrap.ts
git commit -m "feat: add SeekForward/SeekBackward commands"
```

---

### Task 3: 绑定方向键并补齐文案

**Files:**
- Modify: `src/types/app-config.d.ts:59-72`
- Modify: `src/common/constant.ts:87-110`
- Modify: `src/shared/app-config/default-app-config.ts:30-38`
- Modify: `res/lang/zh-CN.json` / `en-US.json` / `zh-TW.json`（`settings.short_cut` 下）

**Interfaces:**
- Consumes: Task 2 的 `SeekForward` / `SeekBackward` 命令名。
- Produces: `shortCutKeys` 里新增两项 `"seek-backward"` / `"seek-forward"`；设置页快捷键表格自动多出两行。

- [ ] **Step 1: 扩展 `shortCut.shortcuts` 联合类型**

在 `src/types/app-config.d.ts` 的联合类型里加 `| "seek-backward" | "seek-forward"`，并把外层的 `Record<`
改成 `Partial<Record<`（配置里只会出现用户用到的键，`Record` 要求全集会让默认配置写不全）。
已有的 `shortCuts?.[it]?.local`、`shortCuts[key] || {}` 都已是可选访问，不需要跟着改。

- [ ] **Step 2: 扩展常量**

`shortCutKeys` 数组加 `"seek-backward"`、`"seek-forward"`（放在 `"skip-previous"` 之后）；`shortCutKeysCommands` 加
`"seek-backward": "SeekBackward"`、`"seek-forward": "SeekForward"`。

- [ ] **Step 3: 补默认键位**

在 `default-app-config.ts` 的 `_defaultAppConfig` 里，`"shortCut.enableGlobal": false` 之后加：

```ts
    "shortCut.shortcuts": {
        "skip-previous": { local: ["Up"], global: null },
        "skip-next": { local: ["Down"], global: null },
        "seek-backward": { local: ["Left"], global: null },
        "seek-forward": { local: ["Right"], global: null },
    },
```

- [ ] **Step 4: 三语文案**

`settings.short_cut` 下补两条，参考既有风格：

| 文件 | seek-backward | seek-forward |
| --- | --- | --- |
| zh-CN | 快退 5 秒 | 快进 5 秒 |
| en-US | Seek Backward 5s | Seek Forward 5s |
| zh-TW | 快退 5 秒 | 快進 5 秒 |

- [ ] **Step 5: 类型检查 + 单测**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 无输出；`npm test` 全绿。

- [ ] **Step 6: 提交**

```bash
git add src/types/app-config.d.ts src/common/constant.ts src/shared/app-config/default-app-config.ts res/lang/zh-CN.json res/lang/en-US.json res/lang/zh-TW.json
git commit -m "feat: bind arrow keys to seek and track switching"
```

---

### Task 4: 打包部署与实机验证

**Files:**
- 无源码改动；产物覆盖到 `D:\work\OneDrive\Desktop\projects\MusicFree`。

**Interfaces:**
- Consumes: Task 1-3 的全部改动。

- [ ] **Step 1: 确认 `MusicFree.exe` 已退出**

用任务管理器或 `Get-Process MusicFree` 确认没有运行实例；有则先关闭。

- [ ] **Step 2: 打包**

Run: `npm run package`
Expected: exit 0，生成 `out\MusicFree-win32-x64`。

- [ ] **Step 3: 覆盖便携版**

Run: `robocopy out\MusicFree-win32-x64 "D:\work\OneDrive\Desktop\projects\MusicFree" /E /R:1 /W:1 /NFL /NDL`
Expected: 复制完成；`portable\userData` 原样保留（绝不能加 `/MIR`）。

- [ ] **Step 4: 实机验证**

启动 `MusicFree.exe`，播放一首歌后逐项确认：

- `Right` 前进 5 秒、`Left` 后退 5 秒，进度条同步。
- 从 0 附近按 `Left` 停在 0；临近结尾按 `Right` 停在结尾，不报错。
- `Up` / `Down` 切歌；队列为空时按方向键无异常。
- 在搜索框里按方向键只移动光标。
- 设置 → 快捷键 里能看到两行新条目，可改键、可清空。
