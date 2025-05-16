// src/main/mpv-manager.ts
import MpvAPI, { ObserveProperty, Status as MpvNodeStatus, EndFileEvent as MpvNodeEndFileEvent } from "node-mpv";
import { ipcMain, BrowserWindow, app } from "electron";
import AppConfig from "@shared/app-config/main";
import logger from "@shared/logger/main";
import { PlayerState } from "@/common/constant";
import fs from "fs";

class MpvManager {
    private mpv: MpvAPI | null = null;
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
        this.handleIPC();
    }

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    private getMpvOptions() {
        const binaryPath = AppConfig.getConfig("playMusic.mpvPath");
        const additionalArgsRaw = AppConfig.getConfig("playMusic.mpvArgs") || "";
        const argsArray: string[] = [];
        let inQuotes = false;
        let currentArg = "";
        for (let i = 0; i < additionalArgsRaw.length; i++) {
            const char = additionalArgsRaw[i];
            if (char === '"') {
                if (inQuotes) { // End of a quoted argument
                    if (currentArg) argsArray.push(currentArg);
                    currentArg = "";
                }
                inQuotes = !inQuotes;
            } else if (char === ' ' && !inQuotes) {
                if (currentArg) {
                    argsArray.push(currentArg);
                    currentArg = "";
                }
            } else {
                currentArg += char;
            }
        }
        if (currentArg) { // Add the last argument
            argsArray.push(currentArg);
        }

        return {
            binary: binaryPath || undefined,
            socket: process.platform === "win32" ? `\\\\.\\pipe\\mpvsocket_${process.pid}` : `/tmp/mpvsocket_${process.pid}_${Date.now()}`,
            debug: !app.isPackaged,
            verbose: !app.isPackaged,
            audio_only: true,
            time_update: 1,
            observeAllProperties: false,
            additionalArgs: argsArray.filter(arg => arg.trim() !== "")
        };
    }

    public async initializeMpv(isManualTrigger = false): Promise<boolean> {
        if (this.mpv) {
            await this.quitMpv();
        }
        this.isQuitting = false;

        const mpvOptions = this.getMpvOptions();
        logger.logInfo("Initializing MPV with options:", mpvOptions);

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
        } else if (AppConfig.getConfig("playMusic.backend") === "mpv") { // Only fail if MPV is the selected backend and path is not set
            const errorMsg = "MPV 播放器路径未设置，请在 设置->播放 中配置。";
            logger.logError(errorMsg, new Error("MPV path not configured"));
            this.sendToRenderer("mpv-error", errorMsg);
            if(isManualTrigger) { // Only send init-failed if manually triggered or explicitly set
                this.mainWindow?.webContents.send("mpv-init-failed", errorMsg);
            }
            return false;
        }


        try {
            this.mpv = new MpvAPI(
                {
                    binary: mpvOptions.binary,
                    socket: mpvOptions.socket,
                    debug: mpvOptions.debug,
                    verbose: mpvOptions.verbose,
                    audio_only: mpvOptions.audio_only,
                    time_update: mpvOptions.time_update,
                    observeAllProperties: mpvOptions.observeAllProperties,
                },
                mpvOptions.additionalArgs
            );
            this.setupMpvEventHandlers();
            await this.mpv.start();
            logger.logInfo("MPV started successfully.");
            this.retryCount = 0;

            await this.observeProperties();
             if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.mainWindow?.webContents.send("mpv-init-success");
            }
            return true;
        } catch (error: any) {
            const errorMsg = `MPV 初始化失败: ${error.message}. 请检查MPV附加参数是否正确。`;
            logger.logError("Failed to initialize MPV:", error);
            this.sendToRenderer("mpv-error", errorMsg);
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
            await this.mpv.observeProperty('time-pos', ObserveProperty.TIME);
            await this.mpv.observeProperty('duration', ObserveProperty.TIME);
            await this.mpv.observeProperty('pause', ObserveProperty.BOOLEAN);
            await this.mpv.observeProperty('volume', ObserveProperty.NUMBER);
            await this.mpv.observeProperty('playback-speed', ObserveProperty.NUMBER);
        } catch (error: any) {
            logger.logError("Failed to observe MPV properties:", error);
             this.sendToRenderer("mpv-error", `观察MPV属性失败: ${error.message}`);
        }
    }

    private setupMpvEventHandlers() {
        if (!this.mpv) return;

        this.mpv.on("statuschange", (status: MpvNodeStatus) => {
            if (status && typeof status['time-pos'] === 'number') {
                this.lastKnownTime = status['time-pos'];
            }
            if (status && typeof status.duration === 'number' && status.duration > 0) {
                this.lastKnownDuration = status.duration;
            } else if (status && typeof status.duration === 'number' && status.duration <= 0 && this.lastKnownDuration !== Infinity) {
                // Sometimes MPV reports 0 or negative duration initially for streams
                this.lastKnownDuration = Infinity;
            }
            this.sendToRenderer("mpv-statuschange", { time: this.lastKnownTime, duration: this.lastKnownDuration });

            if (status && typeof status.pause === 'boolean') {
                 const newState = status.pause ? PlayerState.Paused : PlayerState.Playing;
                 if (this.lastKnownPlayerState !== newState) {
                     this.lastKnownPlayerState = newState;
                     this.sendToRenderer(status.pause ? "mpv-paused" : "mpv-resumed", { state: this.lastKnownPlayerState });
                 }
            }
            if (status && typeof status.volume === 'number') {
                this.sendToRenderer("mpv-volumechange", { volume: status.volume / 100 });
            }
            if (status && (typeof status.speed === 'number' || typeof status['playback-speed'] === 'number')) {
                this.sendToRenderer("mpv-speedchange", { speed: status.speed ?? status['playback-speed'] });
            }
        });

        this.mpv.on("paused", () => {
            logger.logInfo("MPV paused");
            if (this.lastKnownPlayerState !== PlayerState.Paused) {
                this.lastKnownPlayerState = PlayerState.Paused;
                this.sendToRenderer("mpv-paused", { state: PlayerState.Paused });
            }
        });

        this.mpv.on("resumed", () => {
            logger.logInfo("MPV resumed");
             if (this.lastKnownPlayerState !== PlayerState.Playing) {
                this.lastKnownPlayerState = PlayerState.Playing;
                this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });

        this.mpv.on("timeposition", (seconds: number) => {
            this.lastKnownTime = seconds;
            // Duration might still be unknown here, use last known good duration
            this.sendToRenderer("mpv-timeposition", { time: seconds, duration: this.lastKnownDuration });
        });

        this.mpv.on("stopped", () => {
            logger.logInfo("MPV stopped");
            this.lastKnownPlayerState = PlayerState.None;
            this.currentTrack = null;
            this.sendToRenderer("mpv-stopped", { state: PlayerState.None });
        });

        this.mpv.on("started", () => {
            logger.logInfo("MPV playback started");
             // Try to get duration once playback starts
            if (this.mpv) {
                this.mpv.getProperty("duration").then(duration => {
                    if (typeof duration === 'number' && duration > 0) {
                        this.lastKnownDuration = duration;
                    } else {
                        this.lastKnownDuration = Infinity;
                    }
                }).catch(err => {
                    logger.logError("Error getting duration on started event:", err);
                    this.lastKnownDuration = Infinity;
                });
            }
        });

        this.mpv.on("endfile", (event: MpvNodeEndFileEvent) => {
            logger.logInfo("MPV endfile event:", event);
            if (event.reason === "eof" || event.reason === "stop") {
             this.lastKnownPlayerState = PlayerState.None;
             this.currentTrack = null;
             this.sendToRenderer("mpv-playback-ended", { reason: event.reason });
            } else if (event.reason === "error") {
            const errorMsg = `MPV播放错误 (事件: endfile, 错误码: ${event.error || '未知'})`;
            logger.logError(errorMsg, new Error(`MPV endfile event error: ${JSON.stringify(event)}`));
            this.sendToRenderer("mpv-error", errorMsg);
            }
        });

        this.mpv.on("error", (error: Error) => { // error is already an Error object
            const errorMsg = `MPV错误: ${error.message}`;
            logger.logError("MPV error:", error);
            this.sendToRenderer("mpv-error", errorMsg);
        });

        this.mpv.on("crashed", async (exitCode: number) => {
            if (this.isQuitting) return;
            const crashMsg = `MPV 播放器意外退出 (退出码: ${exitCode})。正在尝试重启...`;
            logger.logError(crashMsg, new Error(`MPV Crashed - Exit code: ${exitCode}`));
            this.sendToRenderer("mpv-error", crashMsg); // Notify renderer about the crash

            const oldMpv: MpvAPI | null = this.mpv;
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
                if (this.lastKnownPlayerState !== PlayerState.None && this.mpv.isRunning) {
                     await this.mpv.stop().catch((e: unknown) => logger.logInfo("Error stopping MPV before quit (ignorable):", e as Error));
                }
                await this.mpv.quit();
                logger.logInfo("MPV quit successfully.");
            } catch (error: any) {
                logger.logError("Error quitting MPV:", error);
            } finally {
                if (this.mpv) { // Ensure mpv listeners are cleared even if quit fails
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
        if (!this.mpv) { // Double check after potential re-init
            logger.logError("MPV instance is still null after attempted initialization in load().", new Error("MPV not initialized"));
            this.sendToRenderer("mpv-error", "MPV 实例丢失，无法加载文件。");
            return;
        }
        try {
            if (this.mpv.isRunning === false) { // Check if MPV process itself is running
                logger.logInfo("MPV process was not running, attempting to start it before loading.");
                await this.mpv.start();
                await this.observeProperties(); // Re-observe properties if MPV was restarted
            }
            await this.mpv.load(filePath, mode);
            logger.logInfo(`MPV loaded: ${filePath} with mode ${mode}`);
            this.lastKnownTime = 0;
            this.lastKnownDuration = Infinity; // Reset duration as it might change
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

        ipcMain.handle("mpv-resume", async () => { // MPV resume is just play
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
             try {
                await this.mpv.play();
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

        ipcMain.handle("mpv-set-volume", async (_event, volume: number) => { // volume is 0-100 for mpv via node-mpv
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
            try {
                await this.mpv.volume(volume);
            } catch (e: any) { logger.logError("mpv-set-volume error", e); this.sendToRenderer("mpv-error", `音量设置失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-set-speed", async (_event, speed: number) => {
            if (!this.mpv) { this.sendToRenderer("mpv-error", "MPV未初始化"); return; }
            try {
                await this.mpv.setProperty("speed", speed);
            } catch (e: any) { logger.logError("mpv-set-speed error", e); this.sendToRenderer("mpv-error", `倍速设置失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-get-duration", async () => {
            if (!this.mpv) return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            try {
                const duration = await this.mpv.getDuration(); // Can be null
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

        ipcMain.handle("mpv-quit", async () => {
            await this.quitMpv();
        });

        // No need for AppConfig.onConfigUpdated here for mpvPath/Args,
        // as it's handled in main/index.ts which calls initializeMpv.
    }
}

export default new MpvManager();