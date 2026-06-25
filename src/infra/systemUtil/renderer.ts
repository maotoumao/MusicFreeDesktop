/**
 * systemUtil — 渲染进程层
 *
 * 提供类型安全的系统操作 API，按子域名空间分组：
 *   - systemUtil.app   — 应用生命周期
 *   - systemUtil.window — 窗口控制
 *   - systemUtil.shell  — 系统 Shell 操作
 *   - systemUtil.dialog — 原生对话框
 */
import type { IUpdateInfo } from '@appTypes/infra/systemUtil';
import { CONTEXT_BRIDGE_KEY } from './common/constant';

// ─── Preload Bridge ───

interface IMod {
    app: {
        exitApp(): void;
        getCacheSize(): Promise<number>;
        clearCache(): void;
        checkUpdate(): Promise<IUpdateInfo>;
    };
    window: {
        minimizeWindow(skipTaskBar?: boolean): void;
        showMainWindow(): void;
        toggleMaximize(): void;
        toggleVisible(): void;
        ignoreMouseEvent(ignore: boolean): void;
        enterMinimode(): void;
        exitMinimode(): void;
        toggleMinimode(): void;
    };
    shell: {
        openExternal(url: string): void;
        openPath(path: string): void;
        showItemInFolder(path: string): Promise<boolean>;
    };
    dialog: {
        showOpenDialog(
            options: Electron.OpenDialogOptions,
        ): Promise<Electron.OpenDialogReturnValue>;
        showSaveDialog(
            options: Electron.SaveDialogOptions,
        ): Promise<Electron.SaveDialogReturnValue>;
    };
}

const mod = window[CONTEXT_BRIDGE_KEY as any] as unknown as IMod;

// ─── 模块实现 ───

class SystemUtilRenderer {
    // ─── App ───

    /** 退出应用 */
    public exitApp(): void {
        mod.app.exitApp();
    }

    /** 获取当前缓存大小（字节） */
    public getCacheSize(): Promise<number> {
        return mod.app.getCacheSize();
    }

    /** 清除浏览器缓存 */
    public clearCache(): void {
        mod.app.clearCache();
    }

    /** 检查应用更新 */
    public checkUpdate(): Promise<IUpdateInfo> {
        return mod.app.checkUpdate();
    }

    // ─── Window ───

    /** 最小化当前窗口 */
    public minimizeWindow(skipTaskBar?: boolean): void {
        mod.window.minimizeWindow(skipTaskBar);
    }

    /** 显示主窗口 */
    public showMainWindow(): void {
        mod.window.showMainWindow();
    }

    /** 切换主窗口最大化状态 */
    public toggleMaximize(): void {
        mod.window.toggleMaximize();
    }

    /** 切换主窗口可见性 */
    public toggleVisible(): void {
        mod.window.toggleVisible();
    }

    /** 忽略鼠标事件（穿透点击） */
    public ignoreMouseEvent(ignore: boolean): void {
        mod.window.ignoreMouseEvent(ignore);
    }

    /** 进入迷你模式 */
    public enterMinimode(): void {
        mod.window.enterMinimode();
    }

    /** 退出迷你模式 */
    public exitMinimode(): void {
        mod.window.exitMinimode();
    }

    /** 切换迷你模式 */
    public toggleMinimode(): void {
        mod.window.toggleMinimode();
    }

    // ─── Shell ───

    /** 在默认浏览器中打开 URL */
    public openExternal(url: string): void {
        mod.shell.openExternal(url);
    }

    /** 用系统默认程序打开路径 */
    public openPath(path: string): void {
        mod.shell.openPath(path);
    }

    /** 在文件管理器中定位文件 */
    public showItemInFolder(path: string): Promise<boolean> {
        return mod.shell.showItemInFolder(path);
    }

    // ─── Dialog ───

    /** 显示文件打开对话框 */
    public showOpenDialog(
        options: Electron.OpenDialogOptions,
    ): Promise<Electron.OpenDialogReturnValue> {
        return mod.dialog.showOpenDialog(options);
    }

    /** 显示文件保存对话框 */
    public showSaveDialog(
        options: Electron.SaveDialogOptions,
    ): Promise<Electron.SaveDialogReturnValue> {
        return mod.dialog.showSaveDialog(options);
    }
}

const systemUtil = new SystemUtilRenderer();
export default systemUtil;
