/**
 * requestForwarder — 主进程层
 *
 * 使用 Electron UtilityProcess 管理代理服务器的生命周期：
 * - fork 子进程运行 HTTP 代理
 * - 监控子进程健康，异常退出时指数退避自动重启
 * - 通过 IPC 向渲染进程提供端口查询和端口变更通知
 */

import path from 'path';
import { app, ipcMain, utilityProcess } from 'electron';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type { IWorkerMessage } from '@appTypes/infra/requestForwarder';
import { IPC } from './common/constant';

const MAX_RESTART_COUNT = 5;
const BACKOFF_BASE_MS = 1000;

class RequestForwarder {
    private windowManager: IWindowManager | null = null;
    private worker: Electron.UtilityProcess | null = null;
    private port: number | null = null;
    private isSetup = false;
    private disposed = false;
    private restartCount = 0;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;
    private lastProxyUrl: string | null = null;

    /** worker 脚本路径（与主进程 bundle 同目录） */
    private get workerPath(): string {
        return path.resolve(__dirname, 'requestForwarderWorker.js');
    }

    /**
     * 初始化模块
     * @param windowManager 可选，提供后支持端口变更广播
     */
    public setup(windowManager?: IWindowManager): void {
        if (this.isSetup) return;

        this.windowManager = windowManager ?? null;

        // 注册 IPC：渲染进程查询端口
        ipcMain.handle(IPC.GET_PORT, () => {
            return this.port;
        });

        // 启动 worker：utilityProcess 需要 app ready 后才能 fork
        if (app.isReady()) {
            this.spawnWorker();
        } else {
            app.once('ready', () => {
                this.spawnWorker();
            });
        }

        this.isSetup = true;
    }

    /** 设置 windowManager（延迟注入） */
    public setWindowManager(windowManager: IWindowManager): void {
        this.windowManager = windowManager;
    }

    /** 获取当前代理服务器端口 */
    public getPort(): number | null {
        return this.port;
    }

    /** 向 worker 发送代理配置更新 */
    public updateWorkerProxy(proxyUrl: string | null): void {
        this.lastProxyUrl = proxyUrl;
        if (this.worker) {
            try {
                this.worker.postMessage({ type: 'update-proxy', proxyUrl });
            } catch {
                // worker 可能未就绪
            }
        }
    }

    /** 关闭模块，停止 worker */
    public dispose(): void {
        this.disposed = true;

        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        if (this.worker) {
            // 优雅关闭：先发 shutdown 消息
            try {
                this.worker.postMessage({ type: 'shutdown' });
            } catch {
                // worker 可能已经退出
            }

            // 等待 3 秒后强制 kill
            const killTimer = setTimeout(() => {
                try {
                    this.worker?.kill();
                } catch {
                    // ignore
                }
            }, 3000);

            this.worker.once('exit', () => {
                clearTimeout(killTimer);
            });

            this.worker = null;
        }

        this.port = null;
    }

    /** fork 子进程运行代理服务器 */
    private spawnWorker(): void {
        if (this.disposed) return;

        try {
            this.worker = utilityProcess.fork(this.workerPath);
        } catch (err) {
            console.error('[RequestForwarder] Failed to fork worker:', err);
            this.scheduleRestart();
            return;
        }

        // 接收 worker 消息
        this.worker.on('message', (message: IWorkerMessage) => {
            switch (message.type) {
                case 'ready': {
                    const oldPort = this.port;
                    this.port = message.port;
                    this.restartCount = 0; // 成功启动，重置重试计数

                    console.log(`[RequestForwarder] Proxy server ready on port ${this.port}`);

                    // 端口变化时广播通知渲染进程
                    if (oldPort !== null && oldPort !== this.port) {
                        this.broadcastPortChanged();
                    }

                    // 重新发送代理配置（worker 重启后需要恢复）
                    if (this.lastProxyUrl !== null) {
                        this.updateWorkerProxy(this.lastProxyUrl);
                    }
                    break;
                }
                case 'error': {
                    console.error('[RequestForwarder] Worker reported error:', message.error);
                    break;
                }
            }
        });

        // 监听 worker 退出
        this.worker.on('exit', (code) => {
            console.warn(`[RequestForwarder] Worker exited with code ${code}`);
            this.worker = null;
            this.port = null;

            if (!this.disposed) {
                this.scheduleRestart();
            }
        });
    }

    /** 指数退避调度重启 */
    private scheduleRestart(): void {
        if (this.disposed) return;

        if (this.restartCount >= MAX_RESTART_COUNT) {
            console.error(
                `[RequestForwarder] Max restart attempts (${MAX_RESTART_COUNT}) reached, giving up`,
            );
            return;
        }

        const delay = BACKOFF_BASE_MS * Math.pow(2, this.restartCount);
        this.restartCount++;

        console.log(
            `[RequestForwarder] Scheduling restart in ${delay}ms (attempt ${this.restartCount}/${MAX_RESTART_COUNT})`,
        );

        this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            this.spawnWorker();
        }, delay);
    }

    /** 广播端口变更到所有渲染进程 */
    private broadcastPortChanged(): void {
        try {
            this.windowManager?.broadcast(IPC.PORT_CHANGED, this.port);
        } catch {
            // windowManager 可能尚未就绪
        }
    }
}

const requestForwarder = new RequestForwarder();
export default requestForwarder;
