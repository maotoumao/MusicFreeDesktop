/**
 * globalContext — 主进程层
 *
 * 职责：
 * - 初始化全局上下文（版本号、路径、平台信息）
 * - 通过 IPC 向渲染进程同步提供全局数据
 */
import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { IPC } from './common/constant';

/**
 * 安全获取系统特殊目录，捕获可能的平台异常。
 * 某些 Linux 发行版未配置 XDG 目录时 app.getPath 会抛出。
 */
function safeGetPath(name: Parameters<typeof app.getPath>[0]): string | null {
    try {
        return app.getPath(name);
    } catch {
        return null;
    }
}

/**
 * 按优先级解析默认下载路径：
 *   1. 系统下载目录
 *   2. 系统音乐目录
 *   3. 应用数据目录下的 downloads（兜底，不存在则自动创建）
 */
function resolveDefaultDownloadPath(userDataPath: string): string {
    const candidates = [safeGetPath('downloads'), safeGetPath('music')];

    for (const dir of candidates) {
        if (dir && fs.existsSync(dir)) {
            return dir;
        }
    }

    // 兜底：应用数据目录下自建 downloads
    const fallback = path.resolve(userDataPath, 'downloads');
    try {
        if (!fs.existsSync(fallback)) {
            fs.mkdirSync(fallback, { recursive: true });
        }
        return fallback;
    } catch {
        return userDataPath;
    }
}

export function setupGlobalContext() {
    const userDataPath = safeGetPath('userData') ?? app.getAppPath();

    const sysVersionMajor = parseInt(process.getSystemVersion().split('.')[0], 10);
    const isWin10OrAbove =
        process.platform === 'win32' && !isNaN(sysVersionMajor) && sysVersionMajor >= 10;

    globalThis.globalContext = {
        appVersion: app.getVersion(),
        appPath: {
            defaultDownloadPath: resolveDefaultDownloadPath(userDataPath),
            temp: safeGetPath('temp') ?? path.resolve(userDataPath, 'temp'),
            userData: userDataPath,
            res: app.isPackaged
                ? path.resolve(process.resourcesPath, 'res')
                : path.resolve(__dirname, '../../res'),
        },
        platform: process.platform,
        isWin10OrAbove,
    };

    ipcMain.on(IPC.GET_GLOBAL_DATA, (evt) => {
        evt.returnValue = globalThis.globalContext;
    });
}
