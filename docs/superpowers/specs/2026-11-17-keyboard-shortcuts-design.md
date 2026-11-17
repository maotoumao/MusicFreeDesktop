# 方向键快捷键设计（快退/快进、上一首/下一首）

日期：2026-11-17
状态：已与用户确认

## 目标

键盘方向键控制播放：

- `Left` / `Right`：快退 / 快进 5 秒
- `Up` / `Down`：上一首 / 下一首

非目标：不做长按连击加速、不做方向键调音量、不注册全局快捷键。

## 现状（为什么这么做）

- 应用已有可配置快捷键系统：`src/common/constant.ts` 的 `shortCutKeys` /
  `shortCutKeysCommands`、`src/shared/short-cut/*`（`hotkeys-js`）、设置页
  `setting-view/routers/ShortCut`。默认配置 `default-app-config.ts` 里
  `shortCut.shortcuts` 一条键位都没绑，所以开箱即用是「无快捷键」。
- 「上一首/下一首」已有动作 `skip-previous` / `skip-next`，只缺默认键位。
- 没有「快进/快退」这个动作，需要新增。
- 全仓库没有其它地方占用方向键；`hotkeys.filter` 默认跳过 INPUT/TEXTAREA/SELECT，
  搜索框里打字不受影响。

## 方案

**采用：接入现有快捷键系统。** 备选方案是在 `bootstrap.ts` 里硬编码
`keydown` 监听——约 20 行，但不可配置、不在设置页露出、绕开
`shortCut.enableLocal` 总开关，与本项目既有机制不一致，弃用。

## 改动

1. `src/types/app-config.d.ts`：`shortCut.shortcuts` 联合类型加
   `"seek-backward" | "seek-forward"`。
2. `src/shared/message-bus/type.d.ts`：`ICommand` 加 `SeekBackward` / `SeekForward`。
3. `src/common/constant.ts`：`shortCutKeys` 加两个键；`shortCutKeysCommands`
   映射到新命令。
4. `src/renderer/document/bootstrap.ts`：`setupCommandAndEvents` 里注册两个命令处理，
   以 `trackPlayer.progress.currentTime ± 5` 为目标位置，夹在 `[0, duration]`，
   无当前歌曲时直接返回。
5. `src/shared/app-config/default-app-config.ts`：补
   `shortCut.shortcuts` 默认值——`Left`/`Right` → seek-backward/seek-forward，
   `Up`/`Down` → skip-previous/skip-next。`global` 一律 `null`。
6. `res/lang/zh-CN.json`、`en-US.json`、`zh-TW.json`：`settings.short_cut` 下补
   `seek-backward` / `seek-forward`。

## 取舍与已知限制

- `loadConfig` 是浅合并：若用户 config.json 里已存在 `shortCut.shortcuts` 对象，
  新的默认键位不会生效（本机便携版的 config.json 里没有该键，不受影响）。
  用户之后在设置页改任一快捷键时，会把合并后的完整对象写回文件，默认值随之固化。
- 快捷键录制输入框里按方向键时，录制和播放动作可能同时触发（既有机制的通病，
  所有已绑定快捷键都一样），不专门处理。
- 打包版无热重载，需重新打包并覆盖便携版后生效。
- 未做单元测试；验证靠 `npx tsc --noEmit` + 实机按键。
