/**
 * themepack — 主进程层
 *
 * 职责：仅负责跨窗口广播“主题已切换”事件。
 * 所有文件 I/O 和 DOM 操作在 preload 层完成。
 */
import { ipcMain } from 'electron';
import type { IWindowManager } from '@appTypes/main/windowManager';
import { IPC } from './common/constant';

class ThemePack {
    private isSetup = false;

    public setup(windowManager: IWindowManager) {
        if (this.isSetup) return;

        // 主窗口切换主题后通知 main，main 将事件广播到所有窗口
        ipcMain.on(IPC.THEME_SWITCHED, () => {
            windowManager.broadcast(IPC.THEME_SWITCHED);
        });

        this.isSetup = true;
    }
}

const themePack = new ThemePack();
export default themePack;
