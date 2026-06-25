/**
 * shortCut — 主进程层
 *
 * 职责:
 *  1. 注册 / 注销系统级全局快捷键（globalShortcut）
 *  2. 监听 appConfig 变更，diff 并重新注册
 *  3. 维护注册状态，通过 IPC 向渲染进程推送
 *  4. 快捷键触发时，通过 appSync.sendCommand 派发指令
 */
import { globalShortcut, ipcMain } from 'electron';
import type { IAppConfigReader } from '@appTypes/infra/appConfig';
import type {
    IGlobalShortCutRegistration,
    IShortCutBinding,
    ShortCutAction,
} from '@appTypes/infra/shortCut';
import type { ICommandSender } from '@appTypes/infra/appSync';
import type { IWindowManager } from '@appTypes/main/windowManager';
import { IPC } from './common/constant';

class ShortCut {
    private windowManager!: IWindowManager;
    private appConfigReader!: IAppConfigReader;
    private appSync!: ICommandSender;
    private isSetup = false;

    /** 当前生效的全局快捷键注册结果 */
    private registrations: IGlobalShortCutRegistration[] = [];

    /** 当前全局快捷键是否启用 */
    private globalEnabled = false;

    public setup(deps: {
        windowManager: IWindowManager;
        appConfigReader: IAppConfigReader;
        appSync: ICommandSender;
    }) {
        if (this.isSetup) {
            return;
        }

        this.windowManager = deps.windowManager;
        this.appConfigReader = deps.appConfigReader;
        this.appSync = deps.appSync;

        // 初次注册全局快捷键
        this.applyGlobalShortCuts();

        // 监听配置变更
        this.appConfigReader.onConfigUpdated(this.handleConfigUpdated);

        // 渲染进程查询当前全局快捷键状态
        ipcMain.handle(IPC.GET_STATUS, () => {
            return this.registrations;
        });

        this.isSetup = true;
    }

    public dispose() {
        globalShortcut.unregisterAll();
        this.registrations = [];
    }

    // ─── 内部逻辑 ───

    private handleConfigUpdated = (patch: Record<string, unknown>) => {
        // 仅在快捷键相关配置变更时重新注册
        const relevantKeys: string[] = ['shortCut.enableGlobal', 'shortCut.shortcuts'];

        const hasRelevantChange = relevantKeys.some((key) => key in patch);
        if (hasRelevantChange) {
            this.applyGlobalShortCuts();
        }
    };

    /**
     * 根据当前 appConfig 重新注册全局快捷键。
     * 每次调用先全部注销再重新注册（diff 复杂度不高，简单全量刷新）。
     */
    private applyGlobalShortCuts() {
        // 先清空所有全局快捷键，再重新注册
        globalShortcut.unregisterAll();
        this.registrations = [];

        const enableGlobal = this.appConfigReader.getConfigByKey('shortCut.enableGlobal');
        this.globalEnabled = !!enableGlobal;

        if (!this.globalEnabled) {
            this.broadcastStatus();
            return;
        }

        const shortcutsMap = this.appConfigReader.getConfigByKey('shortCut.shortcuts');
        if (!shortcutsMap) {
            this.broadcastStatus();
            return;
        }

        const actions = Object.keys(shortcutsMap) as ShortCutAction[];

        for (const action of actions) {
            const binding: IShortCutBinding | undefined = shortcutsMap[action];
            if (!binding?.global?.length) {
                continue;
            }

            const accelerator = binding.global.join('+');
            if (!accelerator) {
                continue;
            }

            let registered = false;
            try {
                registered = globalShortcut.register(accelerator, () => {
                    this.appSync.sendCommand(action);
                });
            } catch {
                registered = false;
            }

            this.registrations.push({
                action,
                accelerator,
                registered,
            });
        }

        this.broadcastStatus();
    }

    /** 将注册状态推送到主窗口 */
    private broadcastStatus() {
        this.windowManager.sendTo('main', IPC.STATUS_CHANGED, this.registrations);
    }
}

const shortCut = new ShortCut();
export default shortCut;
