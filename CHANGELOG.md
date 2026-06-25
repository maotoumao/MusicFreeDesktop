# 更新日志 | Changelog

本项目的所有重要变更都会记录在此文件中。

All notable changes to this project will be documented in this file.

格式基于 [Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/)，并且本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## Unreleased

### 新增

- 下载设置新增「下载间隔」与「随机抖动」：可设置两次下载任务启动之间的最小间隔（秒），并在其基础上叠加随机浮动，默认关闭。
- 引入 Issue / PR 治理工作流：长期无活动且未被接受的 Issue 会被自动标记 `stale` 并关闭；PR 必须提交到 `dev` 分支并关联一个已被接受的 Issue。

### 修复

- 修复部分在线音源（WebDAV 等需附加请求头的插件音源）播放时，歌曲未播完就跳到下一首、长时间播放后卡死或无限跳歌的问题。

### Added

- Add "Download interval" and "Random jitter" download settings: configure the minimum interval (seconds) between starting two download tasks, with an optional random variation on top. Disabled by default.
- Add issue/PR governance workflows: inactive and unaccepted issues are automatically marked `stale` and closed; PRs must target the `dev` branch and link an accepted issue.

### Fixed

- Fix some streamed online sources (WebDAV and other plugin sources requiring custom request headers) skipping to the next track before finishing, and hanging or skipping endlessly after long playback sessions.

---

## 1.0.0-beta.4 - 2026-03-23 · 预发布 Pre-release

### 修复

- 修复无法播放本地音乐列表中的歌曲的问题。

### Fixed

- Fix songs in the local music list failing to play.

---

## 1.0.0-beta.3 - 2026-03-22 · 预发布 Pre-release

### 变更

- 本地音乐支持多选。

### 修复

- 修复环境变量保存后不显示的问题。
- 修复主窗口右上角关闭按钮功能异常的问题。
- 修复导入歌单功能异常的问题。
- 修复在输入框上右键不出现菜单的问题。

### Changed

- Support multi-selection for local music.

### Fixed

- Fix environment variables not showing after being saved.
- Fix the close button in the top-right corner of the main window not working correctly.
- Fix the playlist import feature not working correctly.
- Fix the context menu not appearing when right-clicking on input fields.

---

## 1.0.0-beta.2 - 2026-03-16 · 预发布 Pre-release

### 变更

- 统一本地音乐支持的文件扩展名。
- 调整应用界面的部分底色。

### 修复

- 修复允许出现多个实例的问题，限制为单实例运行。
- 修复本地歌曲无法读取和显示内嵌歌词和封面的问题 ([#370](https://github.com/maotoumao/MusicFreeDesktop/issues/370))。
- 修复浅色模式下播放列表音乐作者颜色显示错误的问题 ([#371](https://github.com/maotoumao/MusicFreeDesktop/issues/371))。
- 修复托盘菜单显示及交互的相关问题 ([#369](https://github.com/maotoumao/MusicFreeDesktop/issues/369), [#372](https://github.com/maotoumao/MusicFreeDesktop/pull/372))。
- 修复执行数据迁移时，当前正在播放的歌曲会被清空的问题。

### Changed

- Unify the supported file extensions for local music.
- Adjust some background colors of the application interface.

### Fixed

- Fix multiple instances being allowed; the app is now restricted to a single instance.
- Fix local songs failing to read and display embedded lyrics and cover art ([#370](https://github.com/maotoumao/MusicFreeDesktop/issues/370)).
- Fix incorrect artist color in the playlist under light mode ([#371](https://github.com/maotoumao/MusicFreeDesktop/issues/371)).
- Fix tray menu display and interaction issues ([#369](https://github.com/maotoumao/MusicFreeDesktop/issues/369), [#372](https://github.com/maotoumao/MusicFreeDesktop/pull/372)).
- Fix the currently playing song being cleared during data migration.

---

## 1.0.0-beta.1 - 2026-03-15 · 预发布 Pre-release

### 变更

- 重写了整个软件。

### Changed

- Rewrite the entire application.

---

## 0.0.8 - 2025-10-26

### 修复

- 修复了一些可能导致白屏的问题。

### Fixed

- Fix several issues that could cause a blank/white screen.

---

## 0.0.7 - 2025-04-04

### 新增

- 开发者模式：连续点击托盘图标可打开开发者工具。

### 修复

- 修复退出应用时可能出现的进程残留的问题（感谢 [@dyfllll](https://github.com/dyfllll)）。
- 修复 Windows 控制中心无法控制暂停/播放状态的问题。
- 修复打开歌词窗口/迷你模式窗口歌词可能始终为空的问题。
- 修复配置出错时软件白屏的问题。
- 修复任务栏上的关闭按钮表现和设置中的选项不一致的问题。

### Added

- Developer mode: rapidly clicking the tray icon opens the developer tools.

### Fixed

- Fix possible lingering processes after quitting the app (thanks to [@dyfllll](https://github.com/dyfllll)).
- Fix the Windows control center being unable to control the pause/play state.
- Fix lyrics possibly always being empty when opening the lyrics window / mini-mode window.
- Fix a blank screen when the configuration is corrupted.
- Fix the taskbar close button behavior being inconsistent with the option in settings.

---

## 0.0.6 - 2024-12-25

### 新增

- 新增播放失败时不寻找其他音质版本的配置。
- 歌单内支持通过 Ctrl 键多选歌曲进行批量操作。
- 支持自定义主窗口大小。
- 支持自定义歌词窗口大小。
- 支持评论功能（需要插件支持）。

### 变更

- 大量代码重构。
- 调整播放详情页面的样式。

### 修复

- 修复歌单 ID 无法带特殊字符的问题。
- 修复音源太多时布局异常的问题。

### Added

- Add an option to skip searching for other audio-quality versions when playback fails.
- Support multi-selecting songs in a playlist via the Ctrl key for batch operations.
- Support customizing the main window size.
- Support customizing the lyrics window size.
- Support a comment feature (requires plugin support).

### Changed

- Extensive code refactoring.
- Adjust the styling of the playback detail page.

### Fixed

- Fix playlist IDs being unable to contain special characters.
- Fix layout glitches when there are too many music sources.

---

## 0.0.5 - 2024-06-25

### 修复

- 修复重启软件后歌单丢失的问题；如果未出现上述问题可忽略此版本更新。

### Fixed

- Fix playlists being lost after restarting the app; you may skip this update if you never encountered this issue.

---

## 0.0.4 - 2024-06-17

### 新增

- 播放列表支持拖拽排序。
- 支持多语言，本次支持简体中文、繁体中文、英文、西班牙语。
- 支持歌词翻译功能（需要插件实现 getLyric 方法）。
- 新增最近播放，默认保存最近播放的 500 首歌。
- 新增小窗模式。
- 新增音频设备移除时的行为设置，现在可以在拔掉耳机时停止播放。
- 新增单独的主题页，可在主题市场中直接使用主题；本地 .mftheme 主题可直接拖拽到播放器安装。

### 变更

- 本地音乐会尝试读取本地路径下的同名 .lrc 文件作为歌词，同时读取同名 -tr.lrc 文件作为翻译。

### 修复

- 修复部分情况下本地歌词无法读取的问题。
- 修复 Linux 托盘点击无效的问题。

### Added

- Support drag-and-drop reordering for the play queue.
- Support multiple languages: Simplified Chinese, Traditional Chinese, English, and Spanish in this release.
- Support lyric translation (requires the plugin to implement the `getLyric` method).
- Add recently played, keeping the last 500 played songs by default.
- Add a mini-window mode.
- Add behavior settings for audio device removal; playback can now stop when headphones are unplugged.
- Add a dedicated theme page where themes can be used directly from the theme market; local `.mftheme` themes can be installed by dragging them onto the player.

### Changed

- Local music now tries to read a sibling `.lrc` file as lyrics and a sibling `-tr.lrc` file as the translation.

### Fixed

- Fix local lyrics failing to load in some cases.
- Fix tray clicks not working on Linux.

---

## 0.0.3 - 2023-12-23

### 新增

- 插件支持拖拽排序，该排序会影响搜索结果、排行榜、热门歌单的展示顺序。
- 播放列表支持多选快捷键（Ctrl + A 全选、按住 Shift 批量选择）。
- 本地音乐新增搜索功能。
- 歌单内歌曲支持拖拽排序。
- 新增了一些插件设置，比如启动软件时自动更新插件。
- 新增缓存设置，可以在设置中清空软件缓存。
- 新增网络代理设置。
- 插件协议更新：新增支持「用户变量」。
- 插件协议更新：榜单列表支持分页。
- 歌单支持 WebDAV 备份；插件预置的 npm 包新增 webdav，配合 WebDAV 插件即可播放 WebDAV 源。

### 变更

- 排序/过滤后，点击歌单列表会播放排序/过滤后的歌曲，而非全部歌曲。
- 优化批量删除歌曲失败时的表现。
- 优化歌单内歌曲较多时的体验。
- 优化歌曲名称超长时右下角菜单的显示。
- 加载本地歌曲时会自动识别歌曲元信息的编码，减少出现乱码的可能性。
- 优化本地歌曲过多时的拖拽表现。
- 优化 Windows 7/8 部分按钮的表现。

### 修复

- 修复 macOS、Linux 本地歌曲无法播放的问题。
- 修复部分情况下无法右键打开下载文件夹的问题。
- 修复 macOS 输入框无法粘贴的问题。
- 修复部分情况下快捷键无法删除的问题。
- 重写了本地歌单逻辑，修复收藏歌单部分情况下无法点击的问题。

### Added

- Support drag-and-drop reordering for plugins, which affects the order of search results, charts, and popular playlists.
- Support multi-selection shortcuts in the play queue (Ctrl + A to select all, hold Shift for range selection).
- Add a search feature for local music.
- Support drag-and-drop reordering for songs within a playlist.
- Add several plugin settings, such as auto-updating plugins on startup.
- Add cache settings to clear the app cache from settings.
- Add network proxy settings.
- Plugin protocol update: add support for "user variables".
- Plugin protocol update: support pagination for chart lists.
- Support WebDAV backup for playlists; the `webdav` npm package is now bundled for plugins, enabling WebDAV sources together with a WebDAV plugin.

### Changed

- After sorting/filtering, clicking a playlist now plays the sorted/filtered songs instead of all songs.
- Improve behavior when batch song deletion fails.
- Improve the experience when a playlist contains many songs.
- Improve the display of the bottom-right menu for overly long song titles.
- Automatically detect the encoding of song metadata when loading local songs to reduce garbled text.
- Improve drag-and-drop behavior when there are many local songs.
- Improve the behavior of some buttons on Windows 7/8.

### Fixed

- Fix local songs failing to play on macOS and Linux.
- Fix the inability to right-click and open the download folder in some cases.
- Fix the inability to paste in input fields on macOS.
- Fix shortcuts failing to be deleted in some cases.
- Rewrite the local playlist logic, fixing the favorites playlist being unclickable in some cases.

---

## 0.0.2 - 2023-11-05

### 新增

- 支持播放 .m3u8 源。
- 打开播放列表时锚定到当前正在播放的歌曲。
- 新增搜索歌词功能，可在歌曲详情页右键点击「搜索歌词」唤起搜索弹窗。
- 重写了本地歌曲的导入机制，新增本地音乐视图（列表、作者、专辑、文件夹）。
- 新增支持隐藏歌曲列表的部分列。
- 新增快捷键：喜欢/不喜欢歌曲。
- 已下载的歌曲/本地歌曲支持右键打开。
- （Windows）新增缩略图配置，可选择在任务栏悬浮图标时展示原窗口或专辑封面。
- （Windows）新增任务栏播放控制按钮。
- （打包）新增 Windows 免安装版、Mac M1/M2 版、Linux 版。

### 变更

- 优化主题包安装机制：取消原本安装文件夹的机制，改为安装 .mftheme 或 .zip 文件，支持批量安装。
- 优化从热门歌单详情页返回时的表现。
- 优化歌曲详情页右键按钮的表现。
- 优化主窗口和歌词窗口的通信机制。
- 桌面版取消 -alpha 后缀，以正式版本号发布。

### 修复

- 修复作者页歌曲显示不全的问题。
- 修复包含特殊字符时下载失败的问题。
- （macOS）修复图标显示异常的问题。
- （Linux）修复无法最小化的问题。

### Added

- Support playing `.m3u8` sources.
- Anchor to the currently playing song when opening the play queue.
- Add a lyric search feature; right-click "Search Lyrics" on the song detail page to open the search dialog.
- Rewrite the local song import mechanism and add local music views (list, artist, album, folder).
- Support hiding some columns of the song list.
- Add shortcuts to like/unlike a song.
- Support right-click to open downloaded/local songs.
- (Windows) Add a thumbnail option to show either the original window or the album cover when hovering over the taskbar icon.
- (Windows) Add taskbar playback control buttons.
- (Packaging) Add Windows portable, Mac M1/M2, and Linux builds.

### Changed

- Improve the theme pack installation mechanism: replace the folder-based installation with installing `.mftheme` or `.zip` files, supporting batch installation.
- Improve the behavior when returning from a popular playlist detail page.
- Improve the behavior of the right-click buttons on the song detail page.
- Improve the communication mechanism between the main window and the lyrics window.
- Drop the `-alpha` suffix for the desktop app and release it under a formal version number.

### Fixed

- Fix songs not being fully displayed on the artist page.
- Fix download failures when names contain special characters.
- (macOS) Fix abnormal icon display.
- (Linux) Fix the inability to minimize.

---

## 0.0.0-alpha.0 - 2023-07-23 · 预发布 Pre-release

### 新增

- 首个公开测试版本。

### Added

- First public test release.
