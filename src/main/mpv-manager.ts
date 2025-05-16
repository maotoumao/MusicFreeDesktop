// src/main/mpv-manager.ts
// 从导入中移除 ObserveProperty
import NodeMpvPlayer, { Status as MpvNodeStatus, EndFileEvent as MpvNodeEndFileEvent } from "node-mpv";
import { ipcMain, BrowserWindow, app } from "electron";
import AppConfig from "@shared/app-config/main";
import logger from "@shared/logger/main";
import { PlayerState } from "@/common/constant";
import fs from "fs"; // 保留，因为你在其他地方可能用到了 fs.promises.access

class MpvManager {
    private mpv: NodeMpvPlayer | null = null;
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

        return {
            binary: binaryPath || undefined,
            socket: process.platform === "win32" ? `\\\\.\\pipe\\mpvsocket_${process.pid}` : `/tmp/mpvsocket_${process.pid}_${Date.now()}`,
            debug: !app.isPackaged,
            verbose: !app.isPackaged,
            audio_only: true, 
            time_update: 1,
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
            await this.mpv.start();
            logger.logInfo("MPV started successfully via this.mpv.start().");
            this.retryCount = 0;

            await this.observeProperties(); // 在 start 之后观察属性
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
            // 调用 observeProperty 时只传递属性名
            await this.mpv.observeProperty('time-pos');
            await this.mpv.observeProperty('duration');
            await this.mpv.observeProperty('pause');
            await this.mpv.observeProperty('volume');
            await this.mpv.observeProperty('speed'); // 或者 'playback-speed'
            logger.logInfo("MPV properties observed successfully.");
        } catch (error: any) {
            logger.logError("Failed to observe MPV properties:", error);
             this.sendToRenderer("mpv-error", `观察MPV属性失败: ${error.message}`);
        }
    }

    private setupMpvEventHandlers() {
        if (!this.mpv) return;

        this.mpv.on("status", (status: MpvNodeStatus) => {
            if (!status || typeof status.property !== 'string') return;

            const propertyName = status.property;
            const value = status.value;

            if (propertyName === 'time-pos' && typeof value === 'number') {
                this.lastKnownTime = value;
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

        this.mpv.on("resumed", () => {
            logger.logInfo("MPV event: resumed");
             if (this.lastKnownPlayerState !== PlayerState.Playing) {
                this.lastKnownPlayerState = PlayerState.Playing;
                this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });

        this.mpv.on("timeposition", (seconds: number) => {
            this.lastKnownTime = seconds;
            this.sendToRenderer("mpv-timeposition", { time: seconds, duration: this.lastKnownDuration });
        });

        this.mpv.on("stopped", () => {
            logger.logInfo("MPV event: stopped");
            this.lastKnownPlayerState = PlayerState.None;
            this.sendToRenderer("mpv-stopped", { state: PlayerState.None });
        });

        this.mpv.on("started", () => {
            logger.logInfo("MPV event: started (playback started for a new file)");
             if (this.mpv) {
                this.mpv.getProperty("duration").then(duration => {
                    if (typeof duration === 'number' && duration > 0) {
                        this.lastKnownDuration = duration;
                    } else {
                        this.lastKnownDuration = Infinity;
                    }
                }).catch(err => {
                    logger.logError("Error getting duration on 'started' event:", err);
                    this.lastKnownDuration = Infinity;
                });
            }
        });
        
        this.mpv.on("error", (error: Error) => { 
            const errorMsg = `MPV error event: ${error.message}`;
            logger.logError("MPV error event:", error);
            this.sendToRenderer("mpv-error", errorMsg);
        });

        this.mpv.on("crashed", async () => { // exitCode 参数在 jeffvli 的 fork 的 index.d.ts 中没有，但原始的有
            if (this.isQuitting) return;
            // const crashMsg = `MPV 播放器意外退出 (退出码: ${exitCode})。正在尝试重启...`;
            const crashMsg = `MPV 播放器意外退出。正在尝试重启...`;
            logger.logError(crashMsg, new Error(`MPV Crashed`)); // 移除了 exitCode
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
                // 检查 isRunning 是否是方法
                const running = typeof this.mpv.isRunning === 'function' ? this.mpv.isRunning() : this.mpv.isRunning;
                if (this.lastKnownPlayerState !== PlayerState.None && running) {
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
            const running = typeof this.mpv.isRunning === 'function' ? this.mpv.isRunning() : this.mpv.isRunning;
            if (running === false) { 
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
                await this.mpv.resume(); // 使用 resume 方法恢复播放
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
                await this.mpv.speed(speed);
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
                const time = await this.mpv.getTimePosition();
                this.lastKnownTime = time;
                return time;
             } catch(e: any) {
                 logger.logError("mpv-get-current-time error", e);
                 return this.lastKnownTime;
             }
        });
         // 新增：允许直接设置MPV属性，用于如loop等
        ipcMain.handle("mpv-set-property", async (_event, property: string, value: any) => {
            if (!this.mpv) {
                this.sendToRenderer("mpv-error", "MPV 未初始化，无法设置属性。");
                return;
            }
            try {
                await this.mpv.setProperty(property, value);
                logger.logInfo(`MPV property set: ${property} = ${value}`);
            } catch (error: any) {
                logger.logError(`MPV failed to set property ${property}:`, error);
                this.sendToRenderer("mpv-error", `设置属性 ${property} 失败: ${error.message}`);
            }
        });
        ipcMain.handle("mpv-quit", async () => {
            await this.quitMpv();
        });
    }
}

export default new MpvManager();