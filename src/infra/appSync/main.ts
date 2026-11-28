/**
 * appSync — 主进程层
 *
 * 职责：
 * - 为辅助窗口创建 MessagePort 对
 * - 维护 AppState 的部分副本（供主进程业务使用）
 * - 向主窗口发送 Command
 */
import type { IAppState, ICommand, IPortMessage } from '@appTypes/infra/appSync';
import type { IWindowManager, WindowType } from '@appTypes/main/windowManager';
import { MessageChannelMain, ipcMain } from 'electron';
import EventEmitter from 'eventemitter3';
import { IPC } from './common/constant';

class AppSync {
    private windowManager!: IWindowManager;
    private appState: Partial<IAppState> = {};
    private isSetup = false;

    private ee = new EventEmitter<{
        stateChanged: [Partial<IAppState>, Partial<IAppState>];
    }>();

    public setup(windowManager: IWindowManager) {
        if (this.isSetup) {
            return;
        }

        this.windowManager = windowManager;

        // 当辅助窗口创建时，自动建立 MessagePort 通道
        windowManager.on('create', ({ windowType }) => {
            if (windowType !== 'main') {
                this.createPortPair(windowType);
            }
        });

        // 辅助窗口关闭时，通知主窗口释放端口
        windowManager.on('close', ({ windowType }) => {
            if (windowType !== 'main') {
                this.windowManager.sendTo('main', IPC.UNMOUNT, {
                    windowType,
                });
            }
        });

        // 接收主窗口同步过来的状态
        ipcMain.on(IPC.SYNC_STATE, (_, data: Partial<IAppState>) => {
            this.appState = { ...this.appState, ...data };
            this.ee.emit('stateChanged', this.appState, data);
        });

        this.isSetup = true;
    }

    /** 向主窗口发送指令 */
    public sendCommand<K extends keyof ICommand>(command: K, data?: ICommand[K]) {
        const message: IPortMessage<'command'> = {
            type: 'command',
            payload: { command, data },
            timestamp: Date.now(),
        };
        this.windowManager.sendTo('main', IPC.COMMAND, message);
    }

    /** 获取当前缓存的状态副本 */
    public getAppState() {
        return this.appState;
    }

    /** 监听状态变化 */
    public onStateChange(cb: (state: Partial<IAppState>, changed: Partial<IAppState>) => void) {
        this.ee.on('stateChanged', cb);
    }

    /** 取消监听 */
    public offStateChange(cb: (state: Partial<IAppState>, changed: Partial<IAppState>) => void) {
        this.ee.off('stateChanged', cb);
    }

    /**
     * 为辅助窗口创建 MessagePort 通道
     * port1 → 主窗口, port2 → 辅助窗口
     */
    private createPortPair(windowType: WindowType) {
        const { port1, port2 } = new MessageChannelMain();

        // port1 发送给主窗口，附带辅助窗口类型标识
        this.windowManager.postMessageTo('main', IPC.PORT, { windowType }, [port1]);

        // port2 发送给辅助窗口
        this.windowManager.postMessageTo(windowType, IPC.PORT, null, [port2]);
    }
}

const appSync = new AppSync();
export default appSync;
