# 底栏空白处点击定位当前歌曲设计

日期：2026-11-17
状态：已与用户确认

## 目标

点底部播放栏控制块里的空白处，跳到**当前播放歌曲**所在的歌单，并把那首歌滚到眼前、选中。

非目标：不改动播放队列面板里已有的定位入口；不新增设置项；不做“定位到播放队列”。

## 现状（为什么这么做）

- 这套定位逻辑已经有了：`src/renderer/core/music-locate/index.ts` 提供
  `requestLocateMusic(musicItem, sheetId)` + `useLocateTarget()`，`MusicList` 订阅后滚动并选中。
- 查找与跳转写在 `Panel/templates/PlayList/index.tsx` 的 `locateMusicInSheet` 里：
  先在本地歌单里找包含该曲目的歌单（多个时取 `timeStampSymbol` 最近的），
  跳到 `/main/musicsheet/local/<sheetId>`；找不到再看最近播放（`/main/recently_play`）；
  都没有就 `toast.info` 提示。
- 底栏 `MusicBar` 结构：`Slider`（顶部进度条）/ `MusicInfo`（左）/ `Controller`（中）/ `Extra`（右）。
  `Controller` 是 `flex: 1` 且三个按钮居中，两侧有大片空白，现在点击无反应。

## 方案

**采用：把查找逻辑抽成 hook，两个入口共用。**

备选一是直接在 `Controller` 里复制一份查找代码——重复且以后改规则要改两处；
备选二是把这段逻辑放进 `music-locate/index.ts` 的普通函数——它要用 `useNavigate` /
`useTranslation`，放 hook 里最省事。两条都不如抽 hook。

### 改动

1. 新建 `src/renderer/core/music-locate/use-locate-music-in-sheet.ts`：
   导出 `useLocateMusicInSheet(): (musicItem: IMusic.IMusicItem) => void`，
   内容就是现有 `locateMusicInSheet` 的查找 + `navigate` + toast，**不含** `hidePanel()`
   （关不关面板由调用方决定）。
2. `PlayList/index.tsx` 改用它，保留自己的 `hidePanel()` 调用。
3. `Controller/index.tsx`：
   - `const locate = useLocateMusicInSheet();`
   - 容器 `onClick`：只有 `e.target === e.currentTarget` 且当前有歌时才定位；
   - 悬停提示：容器挂 `title`，同时给播放按钮补上自己的 `title`
     （`music_bar.play` / `music_bar.pause` 已存在），上一首/下一首本来就有标题，
     所以只有空白处会显示「定位到当前歌曲所在的歌单」；
   - CSS：容器 `cursor: pointer`。
4. 三语文案：`music_bar.locate_music_in_sheet` = 「定位到当前歌曲所在的歌单」/
   "Locate in playlist" / 「定位到目前歌曲所在的歌單」。

## 取舍与已知限制

- 找不到歌单时沿用 `panel.play_list_locate_not_found` 的提示文案，不新造。
- 定位会离开当前页面（和队列面板里的行为一致），是否关闭已打开的弹窗不做特殊处理。
- 没有正在播放的歌时点击无反应。
- 打包版无热重载，需重新打包覆盖便携版。

## 追加（2026-11-18）：定位时收起歌词详情与 MV 覆盖层

歌词详情页（`musicDetailShownStore`）和 MV 播放器（`mvPlayerStore`）都是全屏/窗口覆盖层，
z-index 低于播放条，所以定位点击能触发，但跳转后覆盖层仍盖在歌单页前面。

修复：`useLocateMusicInSheet` 在两个成功分支（找到歌单 / 找到最近播放）里先调用
`closeCoveringLayers()` —— MV 打开时 `hideMVPlayer()`，并 `musicDetailShownStore.setValue(false)`，
再 `navigate`。找不到歌单（只弹提示）时不关闭任何界面。

侧边栏联动：`MySheets` 订阅 `useLocateTarget`，定位到本地歌单时自动展开「我的歌单」折叠区
（Headless UI v1 的 `Disclosure` 不支持受控 `open`，已改为自管理状态）并把目标项
`scrollIntoView({ block: "nearest" })`；`ListItem` 为此改成 `forwardRef`。
