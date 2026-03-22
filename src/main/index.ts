import './core/polyfills';
import { setupGlobalContext } from '@infra/globalContext/main';
import requestForwarder from '@infra/requestForwarder/main';
import appConfig from '@infra/appConfig/main';
import shortCut from '@infra/shortCut/main';
import pluginManager from '@infra/pluginManager/main';
import { app, BrowserWindow } from 'electron';
import windowManager from '@main/core/windowManager';
import type { IWindowManager } from '@appTypes/main/windowManager';
import appSync from '@infra/appSync/main';
import i18n from '@infra/i18n/main';
import themePack from '@infra/themepack/main';
import systemUtil from '@infra/systemUtil/main';
import logger from '@infra/logger/main';
import database from '@infra/database/main';
import musicSheet from '@infra/musicSheet/main';
import mediaMeta from '@infra/mediaMeta/main';
import downloadManager from '@infra/downloadManager/main';
import localMusic from '@infra/localMusic/main';
import backup from '@infra/backup/main';
import appTray from '@main/core/appTray';
import appThumbar from '@main/core/appThumbar';
import proxyManager from '@main/core/proxyManager';
import { handleDeepLink } from '@main/core/deepLink';
import localPluginDefine from './core/builtinPlugins/localPlugin';
import windowDrag from '@infra/windowDrag/main';
import { LOCAL_PLUGIN_HASH } from '@common/constant';
import fs from 'fs';
import path from 'path';

// ─── Phase 0: Portable 模式检测（仅 Windows） ───
// 若 exe 同级目录下存在 portable/ 文件夹，则将 appData/userData 重定向至该目录，
// 实现免安装便携运行，所有用户数据随 exe 移动。
if (process.platform === 'win32') {
    try {
        const portablePath = path.resolve(app.getPath('exe'), '..', 'portable');
        if (fs.statSync(portablePath).isDirectory()) {
            app.setPath('appData', path.resolve(portablePath, 'appData'));
            app.setPath('userData', path.resolve(portablePath, 'userData'));
        }
    } catch {
        // portable 目录不存在，使用正常模式
    }
}

// ─── Phase 0.5: Chromium 启动参数 & GPU 降级 ───

// 禁用 GPU 沙箱，兼容无显卡/驱动异常的机器（不影响性能）
app.commandLine.appendSwitch('disable-gpu-sandbox');

// GPU 崩溃自动降级：上次运行若 GPU 崩溃，本次禁用硬件加速
const gpuCrashFlagPath = path.join(app.getPath('userData'), '.gpu-crash-flag');
try {
    if (fs.existsSync(gpuCrashFlagPath)) {
        app.disableHardwareAcceleration();
        fs.unlinkSync(gpuCrashFlagPath);
    }
} catch {
    // 标记文件读取/删除失败，忽略
}

// 监听 GPU 进程异常退出，写入标记供下次启动降级
app.on('child-process-gone', (_event, details) => {
    if (details.type === 'GPU' && details.reason !== 'clean-exit') {
        try {
            fs.writeFileSync(gpuCrashFlagPath, String(Date.now()));
        } catch {
            // 写入失败，忽略
        }
    }
});

// ─── 单实例锁 ───
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

// ─── Phase 1: 同步初始化（不依赖 app.isReady） ───

setupGlobalContext();
requestForwarder.setup();

// ─── Phase 2: app ready 后按依赖顺序初始化全部 infra ───

/**
 * 按依赖顺序初始化所有 infra 模块。
 *
 * 初始化顺序:
 *   globalContext → requestForwarder → appConfig → appSync → i18n → shortCut
 */
async function bootstrapInfra(windowManager: IWindowManager) {
    await logger.setup();
    await appConfig.setup(windowManager);
    await i18n.setup(appConfig);
    appSync.setup(windowManager);
    shortCut.setup({
        windowManager,
        appConfigReader: appConfig,
        appSync,
    });
    themePack.setup(windowManager);
    systemUtil.setup(windowManager);
    windowDrag.setup();
    await appTray.setup(windowManager);
    appThumbar.setup(windowManager);
    await proxyManager.setup({
        appConfig,
        updateWorkerProxy: (proxyUrl) => requestForwarder.updateWorkerProxy(proxyUrl),
    });

    database.setup();
    musicSheet.setup({ db: database, windowManager });
    mediaMeta.setup({ db: database, windowManager });

    const mediaMetaProvider = mediaMeta.getProvider();
    const musicItemProvider = musicSheet.getMusicItemProvider();

    pluginManager.setup({
        appConfigReader: appConfig,
        mediaMeta: mediaMetaProvider,
        musicItemProvider,
        windowManager,
    });

    downloadManager.setup({
        db: database,
        appConfig,
        windowManager,
        pluginManager,
        mediaMeta: mediaMetaProvider,
        downloadedSheet: musicSheet.getDownloadedSheetProvider(),
        musicItemProvider,
    });

    localMusic.setup({
        db: database,
        windowManager,
        appConfig,
        mediaMeta: mediaMetaProvider,
    });

    backup.setup({
        windowManager,
        appConfig,
        backupProvider: musicSheet.getBackupProvider(),
    });

    // 注册内建插件
    pluginManager.registerBuiltinPlugin(localPluginDefine, LOCAL_PLUGIN_HASH);
}

/** 根据持久化配置恢复窗口状态 */
function restoreWindowState() {
    if (appConfig.getConfigByKey('lyric.enableDesktopLyric')) {
        windowManager.showWindow('lyric');
    }
}

app.on('ready', async () => {
    await bootstrapInfra(windowManager);
    windowManager.showWindow('main');
    restoreWindowState();

    // 处理启动时传入的 deep link（Windows: 命令行参数）
    const launchUrl = process.argv.find((arg) => arg.startsWith('musicfree:'));
    if (launchUrl) {
        handleDeepLink(launchUrl);
    }
});

// 处理 macOS 上通过 open-url 事件传入的 deep link
app.on('open-url', (_event, url) => {
    handleDeepLink(url);
});

// 处理 Windows/Linux 上二次启动传入的 deep link
app.on('second-instance', (_event, argv) => {
    if (windowManager.isWindowExist('main')) {
        windowManager.showWindow('main');
    }

    const url = argv.find((arg) => arg.startsWith('musicfree:'));
    if (url) {
        handleDeepLink(url);
    }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

let isCleaningUp = false;
app.on('will-quit', async (event) => {
    if (isCleaningUp) return;

    // 阻止默认退出，等异步清理完成后再退出
    event.preventDefault();
    isCleaningUp = true;

    appTray.dispose();
    musicSheet.dispose();
    downloadManager.dispose();
    requestForwarder.dispose();
    shortCut.dispose();
    pluginManager.dispose();
    await logger.dispose();
    database.dispose(); // 最后关闭 DB

    // 使用 app.exit() 直接退出，不再触发 will-quit 事件
    app.exit(0);
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.showWindow('main');
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
