/**
 * requestForwarder — 主进程层
 *
 * 使用 Electron UtilityProcess 管理代理服务器的生命周期：
 * - fork 子进程运行 HTTP 代理
 * - 监控子进程健康，异常退出时指数退避自动重启
 * - 生成访问令牌并下发给 worker，worker 只接受携带该令牌的请求
 * - 通过 IPC 向渲染进程提供连接信息（端口 + 令牌）查询和变更通知
 */

import path from 'path';
import crypto from 'crypto';
import { app, ipcMain, utilityProcess } from 'electron';
import type { IWindowManager } from '@appTypes/main/windowManager';
import type {
    IMainMessage,
    IRequestForwarderInfo,
    IWorkerMessage,
} from '@appTypes/infra/requestForwarder';
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

    /**
     * 访问令牌：每次应用启动生成一次，worker 重启时沿用，
     * 使已发出的代理 URL（如正在播放的音频 seek 时的 Range 请求）在重启后依旧有效。
     */
    private readonly token = crypto.randomBytes(32).toString('hex');

    /** worker 脚本路径（与主进程 bundle 同目录） */
    private get workerPath(): string {
        return path.resolve(__dirname, 'requestForwarderWorker.js');
    }

    /**
     * 初始化模块
     * @param windowManager 可选，提供后支持连接信息变更广播
     */
    public setup(windowManager?: IWindowManager): void {
        if (this.isSetup) return;

        this.windowManager = windowManager ?? null;

        // 注册 IPC：渲染进程查询连接信息
        ipcMain.handle(IPC.GET_INFO, () => {
            return this.getInfo();
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

    /** 获取当前连接信息，代理未就绪时为 null */
    public getInfo(): IRequestForwarderInfo | null {
        return this.port === null ? null : { port: this.port, token: this.token };
    }

    /** 向 worker 发送代理配置更新 */
    public updateWorkerProxy(proxyUrl: string | null): void {
        this.lastProxyUrl = proxyUrl;
        this.postToWorker({ type: 'update-proxy', proxyUrl });
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
            this.postToWorker({ type: 'shutdown' });

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

        // 进程启动后下发令牌，worker 收到后才开始监听
        const worker = this.worker;
        worker.once('spawn', () => {
            if (this.worker === worker) {
                this.postToWorker({ type: 'init', token: this.token });
            }
        });

        // 接收 worker 消息
        this.worker.on('message', (message: IWorkerMessage) => {
            switch (message.type) {
                case 'ready': {
                    this.port = message.port;
                    this.restartCount = 0; // 成功启动，重置重试计数

                    console.log(`[RequestForwarder] Proxy server ready on port ${this.port}`);

                    // worker（重）启动后通知渲染进程：退出时已广播过 null，此处需恢复
                    this.broadcastInfoChanged();

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
                // 通知渲染进程代理暂不可用，期间降级为直接请求
                this.broadcastInfoChanged();
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

    /** 向当前 worker 发送消息，worker 不存在或已退出时静默忽略 */
    private postToWorker(message: IMainMessage): void {
        try {
            this.worker?.postMessage(message);
        } catch {
            // worker 可能未就绪或已经退出
        }
    }

    /** 广播连接信息变更到所有渲染进程 */
    private broadcastInfoChanged(): void {
        try {
            this.windowManager?.broadcast(IPC.INFO_CHANGED, this.getInfo());
        } catch {
            // windowManager 可能尚未就绪
        }
    }
}

const requestForwarder = new RequestForwarder();
export default requestForwarder;
