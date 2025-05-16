// src/preload/common-preload.ts
// import path from "path"; // 不再需要在这里导入
import "electron-log/preload";
import "@shared/i18n/preload";
import "@shared/global-context/preload";
import "@shared/themepack/preload";
import "@shared/app-config/preload";
import "@shared/utils/preload"; // 这个文件会暴露 @shared/utils

// contextBridge.exposeInMainWorld("path", path); // <--- 移除或注释掉这一行
// 如果 @shared/utils/preload.ts 内部也暴露了 path 给 window，也需要一并处理或移除，
// 因为现在渲染进程会直接 import path。
// 经过检查，@shared/utils/preload.ts 中并没有直接将 path 挂载到 window 全局，
// 而是将其封装在通过 contextBridge.exposeInMainWorld("@shared/utils", mod) 暴露的 mod 对象中。
// 这种封装是好的，但如果现在所有渲染进程都 nodeIntegration: true，那么 renderer.ts 中对
// window['@shared/utils'].path 的使用也可以改为直接 import path from 'path'。
// 为了简单起见，暂时保留 @shared/utils 的暴露方式，主要解决当前报错。