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
- 本地音乐列表会记住上次的排序方式，重新进入后保持。
- 桌面歌词支持显示翻译（歌曲有翻译时显示在原文下方），可在桌面歌词工具栏开关。
- 设置新增「开机自启」（Windows、macOS）：开机后自动启动并收起到系统托盘。
- 新增默认应用内快捷键：空格播放 / 暂停，Ctrl（macOS 为 Cmd）+ ← / → 切换上一首 / 下一首；只对从未修改过快捷键的用户生效，在输入框中，或用键盘（Tab）把焦点移到按钮等控件上时，空格仍交给控件。
- 插件管理新增「全部卸载」，一次卸载所有已安装插件（内置本地插件除外）。
- 无障碍：播放进度、音量、倍速支持键盘操作（Tab 聚焦后用方向键、PageUp / PageDown、Home / End 调节），读屏软件可朗读当前值。
- 歌词页（全屏播放）新增窗口最小化 / 最大化 / 关闭按钮。
- 下载设置新增「文件名格式」，可选「歌手 - 标题」「标题 - 歌手」「标题」「歌手 - 专辑 - 标题」。
- 把音频文件或文件夹拖进窗口即可插入播放队列并播放（此前拖入文件会让整个窗口变成浏览器播放页）。
- 支持从系统「打开方式」用 MusicFree 打开音频文件并直接播放（安装后出现在打开方式列表中，不会改变默认播放器）。
- 桌面歌词工具栏新增「水平居中」，一键把歌词窗口移到所在屏幕的水平中央（保持高度位置）。
- 桌面歌词新增「双行显示」：当前句与下一句交替显示在上下两行（可在桌面歌词工具栏开关）；单行模式下长歌词的滚动速度改为按实际时长计算。
- 本地音乐与已下载列表新增「音质」列：本地文件显示编码参数（如 FLAC 24bit/96kHz、MP3 320kbps），已下载歌曲显示下载音质；可在设置的「隐藏列」中关闭。升级后首次扫描会为已有本地歌曲补齐参数，不影响已修改过的标签。
- 本地歌曲右键菜单新增「歌曲信息」，查看标签、文件路径与大小、编码、码率、采样率、位深和声道。
- 新增 Linux ARM64 安装包（deb、rpm），可用于树莓派等 ARM 设备。

### 修复

- 修复部分在线音源（WebDAV 等需附加请求头的插件音源）播放时，歌曲未播完就跳到下一首、长时间播放后卡死或无限跳歌的问题。
- 修复 Windows 上本地媒体代理端口落在系统保留端口段（常见于装有 WSL2、Hyper-V 或 Docker 的机器）时无法启动，导致需附加请求头的音源播完不切歌、切歌后无声的问题。
- 修复切歌或停止播放后，上一首仍在加载的音源晚到时被挂到当前歌曲上，或误报播放错误导致跳歌的问题。
- 修复本地媒体代理不可用、改为直接下载音源时，切歌后一直不出声，以及续播、切换音质后进度回到开头的问题。
- 修复音源加载失败（或启动时恢复上次歌曲失败）后，再点播放没有任何反应、只能切歌或重启的问题。
- 修复无法恢复手机端新版（1.0 起）导出到文件或 WebDAV 的备份、提示「不支持的备份文件格式」的问题；恢复时会跳过手机上的本地歌曲。
- 修复扫描目录（或其子目录）暂时无法访问时（如移动硬盘未连接、网络盘断开、无权限），重新扫描会把该目录下的本地歌曲从库中全部删除的问题。
- 修复全局快捷键绑定方向键、空格、加号或多媒体音量 / 切歌键时始终注册失败的问题（已保存的绑定无需重新设置）。
- 修复「默认播放音质」设置不生效的问题：新歌曲改为按该设置请求音质，不再沿用上一首的实际音质，也不会在播放出错后被改回标准音质（重启后同样生效）。
- 修复插件在线更新因网络错误或下载内容无法解析而失败时，仍提示「已是最新版本」的问题。
- 修复下载的 FLAC 等无损或非 MP3 格式文件被保存为 .mp3 扩展名的问题：扩展名改为按文件内容识别。
- 修复歌曲加载期间再次点击播放会重复加载、播放片刻后从头开始，以及上一首加载失败的结果晚到时打断当前歌曲或在重试成功后仍被跳过的问题。
- 修复失败的下载任务点击重试后，进度条先显示失败前的旧进度和速度的问题。
- 修复本地歌曲（如 FLAC）内嵌带时间轴的歌词丢失时间轴、歌词页一直停在最后一句且不随播放滚动的问题。
- 修复部分本地 MP3 的 GB2312 编码标签（尤其是较短的歌名、歌手名）显示为乱码的问题。
- 修复 Windows 上主窗口收起到托盘后，从托盘进入迷你模式再返回主窗口时界面白屏的问题。
- 修复应用内快捷键绑定「+」键时失效的问题：Ctrl+Shift+「+」会在按下 Ctrl+Shift 时就误触发，Ctrl+小键盘「+」则从不触发；设置页也显示错乱。
- 修复切换音质过程中暂停后，新音源就绪时又自动播放的问题；本地媒体代理不可用、音源仍在下载时切换音质，不再丢失播放和定位。
- 修复播放队列中所有歌曲都无法播放时，「出错时跳过」会无限循环切歌的问题：现在连续 3 首失败后停止。
- 修复从播放队列播放本地歌曲（包括重启后继续播放）时，内嵌歌词不显示的问题。
- 修复 Apple 芯片 Mac 上下载的安装包提示「已损坏，无法打开」的问题（应用签名在打包过程中失效）。
- 修复 macOS 上 Cmd+Q 无法退出、Cmd+W / Cmd+M 无法关闭或最小化窗口的问题，应用菜单新增「窗口」菜单；Cmd+W 与各窗口的关闭按钮效果一致（主窗口按「关闭按钮行为」设置），窗口收起后点击 Dock 图标可重新打开主窗口。
- 修复系统媒体控件（Windows 媒体浮层、macOS 正在播放）在启动恢复上一首后没有歌曲信息、本地歌曲不显示封面的问题。
- 修复低分辨率或高缩放屏幕（如 1366×768、1080p 开 150% 缩放）上主窗口超出屏幕、底部播放栏显示不全的问题：最小高度从 760 降到 600，初始尺寸不超过屏幕可用区域。
- 修复同时下载多首同名歌曲（如文件名格式选「标题」）时，下载完成的文件互相覆盖的问题。
- 修复插件更新尚未完成时卸载该插件（或全部卸载），更新完成后插件又被装回的问题。
- 修复从文件夹导入本地歌单（或拖入大量本地歌曲）时，因每首歌的封面都随歌曲数据传递和保存，导致内存暴涨、界面卡顿的问题：本地歌曲的封面改为播放时读取，导入的歌单仍以第一首的封面作为默认封面。

### Added

- Add "Download interval" and "Random jitter" download settings: configure the minimum interval (seconds) between starting two download tasks, with an optional random variation on top. Disabled by default.
- Add issue/PR governance workflows: inactive and unaccepted issues are automatically marked `stale` and closed; PRs must target the `dev` branch and link an accepted issue.
- The local music list remembers its last sort order when you come back to it.
- Desktop lyrics can show the translation below the original line when available, toggled from the desktop lyric toolbar.
- Add "Launch at startup" (Windows, macOS): start automatically on sign-in and stay in the system tray.
- Add default in-app shortcuts: Space to play / pause, Ctrl (Cmd on macOS) + Left / Right for previous / next track; applies only if you have never changed your shortcuts, and Space still goes to an input you are typing in or to a button focused with the keyboard (Tab).
- Add "Uninstall all" to plugin management, removing every installed plugin except the built-in local plugin.
- Accessibility: playback progress, volume and speed can be adjusted from the keyboard (Tab to focus, then arrow keys, Page Up / Page Down, Home / End), and screen readers announce the current value.
- The lyrics page (fullscreen player) now has window minimize / maximize / close buttons.
- Add a "File name format" download setting: Artist - Title, Title - Artist, Title, or Artist - Album - Title.
- Drag audio files or folders into the window to add them to the queue and play (previously the whole window turned into a browser media page).
- Open audio files with MusicFree from the system "Open with" menu to play them directly (listed as an option without becoming the default player).
- Add "Center horizontally" to the desktop lyric toolbar to move the lyric window to the horizontal center of its screen, keeping its vertical position.
- Add a two-line desktop lyric mode showing the current and next lines on alternating rows (toggle in the desktop lyric toolbar); long lines in single-line mode now scroll according to the actual line duration.
- Add a Quality column to the local music and downloaded lists: local files show their encoding (e.g. FLAC 24bit/96kHz, MP3 320kbps) and downloads show the downloaded quality; it can be hidden in settings. The first scan after upgrading fills this in for existing local songs without touching tags you have edited.
- Add "Song info" to the local song context menu, showing tags, file path and size, codec, bitrate, sample rate, bit depth and channels.
- Add Linux ARM64 packages (deb, rpm) for ARM devices such as the Raspberry Pi.

### Fixed

- Fix some streamed online sources (WebDAV and other plugin sources requiring custom request headers) skipping to the next track before finishing, and hanging or skipping endlessly after long playback sessions.
- Fix the local media proxy failing to start on Windows when its port falls in a system-reserved range (common with WSL2, Hyper-V or Docker), which left sources requiring custom headers stuck after a track ended or silent after skipping.
- Fix a previous track's still-loading source being attached to the current track after skipping or stopping, or reporting a spurious playback error that skipped the track.
- Fix tracks staying silent after skipping, and resume or quality switching restarting from the beginning, when the local media proxy is unavailable and sources are downloaded directly.
- Fix pressing play doing nothing after a source failed to load (or the last track failed to restore at startup), which previously required skipping or restarting.
- Fix backups exported by the mobile app (1.0 and later) to a file or WebDAV failing to restore with "Unsupported backup file format"; local songs from the phone are skipped.
- Fix rescanning removing every local song under a scan folder (or subfolder) that was temporarily inaccessible, such as a disconnected external or network drive or a permission error.
- Fix global shortcuts bound to arrow keys, Space, Plus, or media volume / track keys always failing to register (existing bindings work without re-recording).
- Fix the "Default playback quality" setting being ignored: new tracks now request that quality instead of inheriting the previous track's actual quality, and a playback error no longer resets it to standard (also after restart).
- Fix a plugin update that failed because of a network error or unparsable download still reporting "already up to date".
- Fix downloaded FLAC and other non-MP3 files being saved with an .mp3 extension: the extension is now detected from the file content.
- Fix pressing play while a track is loading reloading it and restarting playback, and a previous track's late load failure interrupting the current track or skipping a successfully retried one.
- Fix a retried failed download briefly showing the progress and speed from before it failed.
- Fix timed lyrics embedded in local files (such as FLAC) losing their timestamps, which left the lyric view stuck on the last line instead of following playback.
- Fix GB2312-encoded tags in some local MP3 files (especially short titles and artist names) showing as garbled text.
- Fix the main window turning blank on Windows when entering mini mode from the tray after the window was closed to the tray, then returning to it.
- Fix in-app shortcuts bound to the "+" key: Ctrl+Shift+"+" fired as soon as Ctrl+Shift was pressed, Ctrl+numpad "+" never fired, and the settings page displayed them incorrectly.
- Fix playback resuming by itself after pausing during a quality switch, and switching quality while a source is still downloading (local media proxy unavailable) no longer drops playback and the seek position.
- Fix "skip on error" cycling through the queue endlessly when every track fails to play; playback now stops after 3 consecutive failures.
- Fix embedded lyrics not showing for local songs played from the play queue, including after a restart.
- Fix downloaded builds on Apple silicon Macs reporting "is damaged and can't be opened" (the app signature was invalidated during packaging).
- Fix Cmd+Q not quitting and Cmd+W / Cmd+M not closing or minimizing the window on macOS; the app menu now has a Window menu. Cmd+W does what each window's own close button does (the main window follows the close button setting), and clicking the Dock icon brings the main window back after it was hidden.
- Fix the system media controls (Windows media overlay, macOS Now Playing) showing no track info after restoring the last track at startup, and no cover for local songs.
- Fix the main window extending past the screen and cutting off the player bar on low-resolution or high-scaling displays (e.g. 1366×768, 1080p at 150%): the minimum height drops from 760 to 600 and the initial size stays within the available screen area.
- Fix songs with the same name (for example with the Title file name format) overwriting each other when their downloads finish at the same time.
- Fix a plugin coming back after being uninstalled (alone or with Uninstall all) while its update was still downloading.
- Fix memory spikes and freezes when importing a local folder as a playlist (or dropping many local songs) caused by every song carrying its embedded cover; local covers are now read when the song plays, and imported playlists still use the first song's cover.

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
