// src/main/mpv-manager.ts
import NodeMpvPlayer, { ObserveProperty, Status as MpvNodeStatus, EndFileEvent as MpvNodeEndFileEvent } from "node-mpv"; // 修改导入名称以更清晰
import { ipcMain, BrowserWindow, app } from "electron";
import AppConfig from "@shared/app-config/main";
import logger from "@shared/logger/main";
import { PlayerState } from "@/common/constant";
import fs from "fs";

class MpvManager {
    private mpv: NodeMpvPlayer | null = null; // 使用修改后的导入名称
    private mainWindow: BrowserWindow | null = null;
    private currentTrack: IMusic.IMusicItem | null = null;
    private lastKnownTime: number = 0;
    private lastKnownDuration: number = Infinity;
    private lastKnownPlayerState: PlayerState = PlayerState.None;
    private retryTimeout: NodeJS.Timeout | null = null;
    private readonly MAX_RETRIES = 3;
    private retryCount = 0;
    private isQuitting = false;


    constructor() {
        // 立即打印导入的模块，确认其类型
        logger.logInfo("MpvManager Constructor: Imported 'node-mpv' module:", NodeMpvPlayer);
        logger.logInfo("MpvManager Constructor: Type of imported 'node-mpv':", typeof NodeMpvPlayer);
        this.handleIPC();
    }

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    private getMpvOptions() {
        const binaryPath = AppConfig.getConfig("playMusic.mpvPath");
        const additionalArgsRaw = AppConfig.getConfig("playMusic.mpvArgs") || "";
        
        const argsArray: string[] = [];
        if (additionalArgsRaw.trim()) {
            const regex = /"([^"]*)"|'([^']*)'|([^\s"']+)/g;
            let match;
            while ((match = regex.exec(additionalArgsRaw)) !== null) {
                if (match[1]) argsArray.push(match[1]); 
                else if (match[2]) argsArray.push(match[2]); 
                else argsArray.push(match[0]); 
            }
        }

        // 从 node-mpv 的 readme 中移除 observeAllProperties，因为它不是标准选项
        return {
            binary: binaryPath || undefined,
            socket: process.platform === "win32" ? `\\\\.\\pipe\\mpvsocket_${process.pid}` : `/tmp/mpvsocket_${process.pid}_${Date.now()}`,
            debug: !app.isPackaged,
            verbose: !app.isPackaged,
            audio_only: true, 
            time_update: 1,
            // observeAllProperties: false, // 移除此非标准选项
            additionalArgs: argsArray.filter(arg => arg.trim() !== "")
        };
    }

    public async initializeMpv(isManualTrigger = false): Promise<boolean> {
        if (this.mpv) {
            await this.quitMpv();
        }
        this.isQuitting = false;

        const mpvOptions = this.getMpvOptions();
        logger.logInfo(`MpvManager: Initializing MPV. Binary: ${mpvOptions.binary || 'System PATH'}, Args: [${mpvOptions.additionalArgs.join(', ')}]`);


        if (mpvOptions.binary) {
             try {
                await fs.promises.access(mpvOptions.binary, fs.constants.X_OK);
            } catch (err: any) {
                const errorMsg = `MPV 路径 "${mpvOptions.binary}" 无效或不可执行。错误: ${err.message}`;
                logger.logError(errorMsg, err);
                this.sendToRenderer("mpv-error", errorMsg);
                if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                    this.mainWindow?.webContents.send("mpv-init-failed", errorMsg);
                }
                return false;
            }
        } else if (AppConfig.getConfig("playMusic.backend") === "mpv") { 
            const errorMsg = "MPV 播放器路径未设置，请在 设置->播放 中配置。";
            logger.logError(errorMsg, new Error("MPV path not configured"));
            this.sendToRenderer("mpv-error", errorMsg);
            if(isManualTrigger) { 
                this.mainWindow?.webContents.send("mpv-init-failed", errorMsg);
            }
            return false;
        }

        let mpvInstanceAttempt: NodeMpvPlayer | null = null;
        try {
            logger.logInfo("MpvManager: About to call 'new NodeMpvPlayer()'.");
            // 构造函数选项中移除了 observeAllProperties
            mpvInstanceAttempt = new NodeMpvPlayer(
                { 
                    binary: mpvOptions.binary,
                    socket: mpvOptions.socket,
                    debug: mpvOptions.debug, 
                    verbose: mpvOptions.verbose, 
                    audio_only: mpvOptions.audio_only,
                    time_update: mpvOptions.time_update,
                },
                mpvOptions.additionalArgs 
            );
            this.mpv = mpvInstanceAttempt;
            logger.logInfo("MpvManager: NodeMpvPlayer instance potentially created.");

        } catch (instantiationError: any) {
            const errorMsg = `MPV 实例化错误: ${instantiationError.message}`;
            logger.logError("MpvManager: Error during 'new NodeMpvPlayer()' instantiation:", instantiationError);
            this.mpv = null;
            if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.mainWindow?.webContents.send("mpv-init-failed", errorMsg);
            }
            return false;
        }

        if (!this.mpv) {
             const errorMsg = "MPV 实例化后 this.mpv 仍为 null。";
             logger.logError("MpvManager: this.mpv is null after instantiation attempt.", new Error(errorMsg));
             if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.mainWindow?.webContents.send("mpv-init-failed", errorMsg);
            }
             return false;
        }

        logger.logInfo("MpvManager: Checking 'start' method on this.mpv...");
        if (typeof this.mpv.start === 'function') {
            logger.logInfo("MpvManager: 'this.mpv.start' IS a function.");
        } else {
            const errorMsg = "MpvAPI 实例缺少 start 方法或 this.mpv 不是有效实例。";
            logger.logError("MpvManager: 'this.mpv.start' is NOT a function after successful-looking instantiation.", new Error(errorMsg), { mpvInstanceKeys: Object.keys(this.mpv) });
            this.mpv = null; 
            if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.mainWindow?.webContents.send("mpv-init-failed", errorMsg);
            }
            return false; 
        }
        
        try {
            this.setupMpvEventHandlers();
            logger.logInfo("MpvManager: Attempting to start MPV process via this.mpv.start()...");
            await this.mpv.start(); // 现在这里应该不会报 this.mpv.start is not a function
            logger.logInfo("MPV started successfully via this.mpv.start().");
            this.retryCount = 0;

            await this.observeProperties();
             if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.mainWindow?.webContents.send("mpv-init-success");
            }
            return true;
        } catch (startError: any) {
            const errorMsg = `MPV 启动或后续设置失败: ${startError.message}.`;
            logger.logError("Failed to start MPV or setup after instantiation:", startError); 
            if (startError.code) logger.logError("MPV startError Code:", startError.code);
            if (startError.signal) logger.logError("MPV startError Signal:", startError.signal);
            if (startError.stack) logger.logError("MPV startError Stack:", startError.stack);
            this.sendToRenderer("mpv-error", errorMsg);
            
            // 尝试安全地退出MPV，即使它可能没有完全启动
            if (this.mpv) {
                try {
                    await this.mpv.quit();
                } catch (quitError: any) {
                    logger.logError("Error quitting MPV after start failure:", quitError);
                }
            }
            this.mpv = null;

            if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.mainWindow?.webContents.send("mpv-init-failed", errorMsg);
            }
            return false;
        }
    }

    private async observeProperties() {
        if (!this.mpv) return;
        try {
            await this.mpv.observeProperty('time-pos', ObserveProperty.TIME); // node-mpv 内部使用数字 ID，但对外暴露属性名
            await this.mpv.observeProperty('duration', ObserveProperty.TIME);
            await this.mpv.observeProperty('pause', ObserveProperty.BOOLEAN);
            await this.mpv.observeProperty('volume', ObserveProperty.NUMBER);
            await this.mpv.observeProperty('playback-speed', ObserveProperty.NUMBER); // 'speed' 也是一个有效的MPV属性
        } catch (error: any) {
            logger.logError("Failed to observe MPV properties:", error);
             this.sendToRenderer("mpv-error", `观察MPV属性失败: ${error.message}`);
        }
    }

    private setupMpvEventHandlers() {
        if (!this.mpv) return;

        // node-mpv v2 使用 'status' 事件，而不是 'statuschange'
        // 并且它为每个变化的属性单独触发
        this.mpv.on("status", (status: MpvNodeStatus) => { // status 是一个对象 { property: string, value: any }
            if (!status || typeof status.property !== 'string') return;

            const propertyName = status.property;
            const value = status.value;

            if (propertyName === 'time-pos' && typeof value === 'number') {
                this.lastKnownTime = value;
                // 避免在 duration 未知时发送不准确的 statuschange
                if (this.lastKnownDuration !== Infinity) {
                     this.sendToRenderer("mpv-statuschange", { time: this.lastKnownTime, duration: this.lastKnownDuration });
                }
            } else if (propertyName === 'duration' && typeof value === 'number') {
                this.lastKnownDuration = value > 0 ? value : Infinity;
                 this.sendToRenderer("mpv-statuschange", { time: this.lastKnownTime, duration: this.lastKnownDuration });
            } else if (propertyName === 'pause' && typeof value === 'boolean') {
                 const newState = value ? PlayerState.Paused : PlayerState.Playing;
                 if (this.lastKnownPlayerState !== newState) {
                     this.lastKnownPlayerState = newState;
                     // node-mpv v2 直接有 paused 和 resumed 事件
                 }
            } else if (propertyName === 'volume' && typeof value === 'number') {
                this.sendToRenderer("mpv-volumechange", { volume: value / 100 });
            } else if ((propertyName === 'speed' || propertyName === 'playback-speed') && typeof value === 'number') {
                this.sendToRenderer("mpv-speedchange", { speed: value });
            }
        });


        this.mpv.on("paused", () => {
            logger.logInfo("MPV event: paused");
            if (this.lastKnownPlayerState !== PlayerState.Paused) {
                this.lastKnownPlayerState = PlayerState.Paused;
                this.sendToRenderer("mpv-paused", { state: PlayerState.Paused });
            }
        });

        this.mpv.on("resumed", () => { // node-mpv v2 使用 'resumed'
            logger.logInfo("MPV event: resumed");
             if (this.lastKnownPlayerState !== PlayerState.Playing) {
                this.lastKnownPlayerState = PlayerState.Playing;
                this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });

        this.mpv.on("timeposition", (seconds: number) => { // node-mpv v2 有这个事件
            this.lastKnownTime = seconds;
            this.sendToRenderer("mpv-timeposition", { time: seconds, duration: this.lastKnownDuration });
        });

        this.mpv.on("stopped", () => { // node-mpv v2 有这个事件
            logger.logInfo("MPV event: stopped");
            this.lastKnownPlayerState = PlayerState.None;
            // currentTrack 的管理由 TrackPlayer 负责，这里不应直接修改
            this.sendToRenderer("mpv-stopped", { state: PlayerState.None });
        });

        this.mpv.on("started", () => { // node-mpv v2 有这个事件
            logger.logInfo("MPV event: started (playback started for a new file)");
             if (this.mpv) { // 确保 mpv 实例存在
                this.mpv.getProperty("duration").then(duration => {
                    if (typeof duration === 'number' && duration > 0) {
                        this.lastKnownDuration = duration;
                    } else {
                        this.lastKnownDuration = Infinity;
                    }
                }).catch(err => {
                    logger.logError("Error getting duration on 'started' event:", err);
                    this.lastKnownDuration = Infinity; // 保持默认值
                });
            }
        });
        
        // node-mpv v2 readme 中没有明确的 endfile 事件，但可能有类似的或通过 status/stopped 间接处理
        // 如果 TrackPlayer 依赖此事件，需要确认 node-mpv v2 如何通知文件结束
        // 假设 node-mpv v2 会在文件自然播放结束时触发 'stopped' 或 'paused' (如果 idle=yes)
        // 对于错误导致的文件结束，应该由 'crashed' 或 'error' 事件处理

        this.mpv.on("error", (error: Error) => { 
            const errorMsg = `MPV error event: ${error.message}`;
            logger.logError("MPV error event:", error);
            this.sendToRenderer("mpv-error", errorMsg);
        });

        this.mpv.on("crashed", async (exitCode: number) => {
            if (this.isQuitting) return;
            const crashMsg = `MPV 播放器意外退出 (退出码: ${exitCode})。正在尝试重启...`;
            logger.logError(crashMsg, new Error(`MPV Crashed - Exit code: ${exitCode}`));
            this.sendToRenderer("mpv-error", crashMsg); 

            const oldMpv: NodeMpvPlayer | null = this.mpv;
            this.mpv = null;
            if (oldMpv) {
              oldMpv.removeAllListeners();
            }

            if (this.retryCount < this.MAX_RETRIES) {
              this.retryCount++;
              if(this.retryTimeout) clearTimeout(this.retryTimeout);
              this.retryTimeout = setTimeout(async (): Promise<void> => {
                  logger.logInfo(`Retrying MPV initialization (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
                  const success: boolean = await this.initializeMpv(true);
                  if (success && this.currentTrack && this.mpv) {
                    await this.load(this.currentTrack.url, 'replace');
                    if (this.lastKnownPlayerState === PlayerState.Playing) {
                       await this.mpv.play().catch((e: unknown) => logger.logError("Error re-playing after crash:", e as Error));
                    }
                    if (this.lastKnownTime > 0) {
                       await this.mpv.seek(this.lastKnownTime, "absolute").catch((e: unknown) => logger.logError("Error re-seeking after crash:", e as Error));
                    }
                  }
              }, 2000 * this.retryCount);
            } else {
              const finalErrorMsg = "MPV 播放器多次崩溃，已停止尝试重启。请检查MPV路径、参数或媒体文件。";
              logger.logError(finalErrorMsg, new Error("MPV crashed too many times"));
              this.sendToRenderer("mpv-error", finalErrorMsg);
            }
        });
    }

    public async quitMpv() {
        this.isQuitting = true;
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
        if (this.mpv) {
            try {
                // node-mpv v2 的 isRunning 是一个方法
                if (this.lastKnownPlayerState !== PlayerState.None && this.mpv.isRunning) {
                     await this.mpv.stop().catch((e: unknown) => logger.logInfo("Error stopping MPV before quit (ignorable):", e as Error));
                }
                await this.mpv.quit();
                logger.logInfo("MPV quit successfully.");
            } catch (error: any) {
                logger.logError("Error quitting MPV:", error);
            } finally {
                if (this.mpv) { 
                    this.mpv.removeAllListeners();
                }
                this.mpv = null;
            }
        }
    }

    private sendToRenderer(channel: string, data?: any) {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents && !this.mainWindow.webContents.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    private async load(filePath: string, mode: 'replace' | 'append' | 'append-play' = 'replace') {
        if (!this.mpv) {
            const success = await this.initializeMpv(true);
            if(!success) {
                 this.sendToRenderer("mpv-error", "MPV 未初始化，无法加载文件。");
                 return;
            }
        }
        if (!this.mpv) { 
            logger.logError("MPV instance is still null after attempted initialization in load().", new Error("MPV not initialized"));
            this.sendToRenderer("mpv-error", "MPV 实例丢失，无法加载文件。");
            return;
        }
        try {
            // node-mpv v2 的 isRunning 是一个方法
            if (this.mpv.isRunning === false) { 
                logger.logInfo("MPV process was not running, attempting to start it before loading.");
                await this.mpv.start();
                await this.observeProperties(); 
            }
            await this.mpv.load(filePath, mode);
            logger.logInfo(`MPV loaded: ${filePath} with mode ${mode}`);
            this.lastKnownTime = 0;
            this.lastKnownDuration = Infinity; 
        } catch (error: any) {
            logger.logError(`MPV failed to load: ${filePath}`, error);
            this.sendToRenderer("mpv-error", `加载文件失败: ${error.message}`);
        }
    }

    private handleIPC() {
        ipcMain.handle("mpv-initialize", async () => {
            return await this.initializeMpv(true);
        });

        ipcMain.handle("mpv-load", async (_event, filePath: string, track: IMusic.IMusicItem) => {
            this.currentTrack = track;
            await this.load(filePath);
        });

        ipcMain.handle("mpv-play", async () => {
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
            try {
                await this.mpv.play();
            } catch (e: any) { logger.logError("mpv-play error", e); this.sendToRenderer("mpv-error", `播放失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-pause", async () => {
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
            try {
                await this.mpv.pause();
            } catch (e: any) { logger.logError("mpv-pause error", e); this.sendToRenderer("mpv-error", `暂停失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-resume", async () => { 
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
             try {
                await this.mpv.play(); // 使用 play 方法恢复播放
            } catch (e: any) { logger.logError("mpv-resume error", e); this.sendToRenderer("mpv-error", `恢复播放失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-stop", async () => {
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
             try {
                await this.mpv.stop();
                this.currentTrack = null;
            } catch (e: any) { logger.logError("mpv-stop error", e); this.sendToRenderer("mpv-error", `停止失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-seek", async (_event, timeSeconds: number) => {
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
            try {
                await this.mpv.seek(timeSeconds, "absolute");
            } catch (e: any) { logger.logError("mpv-seek error", e); this.sendToRenderer("mpv-error", `跳转失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-set-volume", async (_event, volume: number) => { // volume 0-100 for mpv
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
            try {
                await this.mpv.volume(volume);
            } catch (e: any) { logger.logError("mpv-set-volume error", e); this.sendToRenderer("mpv-error", `音量设置失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-set-speed", async (_event, speed: number) => {
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
            try {
                await this.mpv.setProperty("speed", speed); // 使用 setProperty 设置播放速度
            } catch (e: any) { logger.logError("mpv-set-speed error", e); this.sendToRenderer("mpv-error", `倍速设置失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-get-duration", async () => {
            if (!this.mpv) return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            try {
                const duration = await this.mpv.getDuration(); 
                this.lastKnownDuration = (duration != null && duration > 0) ? duration : Infinity;
                return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            } catch (e: any) {
                logger.logError("mpv-get-duration error", e);
                return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            }
        });

        ipcMain.handle("mpv-get-current-time", async () => {
             if (!this.mpv) return this.lastKnownTime;
             try {
                const time = await this.mpv.getTimePosition(); // node-mpv v2 有 getTimePosition 方法
                this.lastKnownTime = time;
                return time;
             } catch(e: any) {
                 logger.logError("mpv-get-current-time error", e);
                 return this.lastKnownTime;
             }
        });

        ipcMain.handle("mpv-quit", async () => {
            await this.quitMpv();
        });
    }
}

export default new MpvManager();