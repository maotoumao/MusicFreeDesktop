// 可视化窗口专用的精简 preload
//
// 与通用的 extension preload 的区别：不含 themepack / utils / window-resize /
// electron-log 这些需要 Node 文件系统或更多能力的模块。
// 这个窗口只需要「配置 + i18n + 频谱帧通道 + 拖拽」几样，
// 因此可以跑在 sandbox: true 的渲染进程里（比主窗口和歌词窗口更严格）。
import "@shared/global-context/preload";
import "@shared/i18n/preload";
import "@shared/app-config/preload";
import "@shared/message-bus/preload/extension";
import "@shared/window-drag/preload";
