// src/main/mpv-manager.ts
import NodeMpvPlayer, { Status as MpvNodeStatus } from "node-mpv";
import { ipcMain, BrowserWindow, app } from "electron";
import AppConfig from "@shared/app-config/main";
import logger from "@shared/logger/main";
import { PlayerState } from "@/common/constant";
import fs from "fs";

class MpvManager {
    private mpv: NodeMpvPlayer | null = null;
    private mainWindow: BrowserWindow | null = null;
    private currentTrack: IMusic.IMusicItem | null = null;
    private lastKnownTime: number = 0;
    private lastKnownDuration: number = Infinity;
    private lastReportedDuration: number = Infinity;
    private lastKnownPlayerState: PlayerState = PlayerState.None;
    private retryTimeout: NodeJS.Timeout | null = null;
    private readonly MAX_RETRIES = 3;
    private retryCount = 0;
    private isQuitting = false;
    private isMpvFullyInitialized = false;
    private timeUpdateInterval: NodeJS.Timeout | null = null;

    constructor() {
        logger.logInfo("MpvManager MAIN: Constructor called.");
        this.handleIPC();
    }

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
        logger.logInfo("MpvManager MAIN: MainWindow set.");
    }

    private startTimeUpdateLoop() {
        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = setInterval(async () => {
            if (this.mpv && this.isMpvFullyInitialized) {
                try {
                    const time = await this.mpv.getProperty('time-pos');
                    const duration = await this.mpv.getProperty('duration');
                    this.sendToRenderer("mpv-timeposition", { time, duration });
                } catch (e) {
                  // 在循环中，静默处理获取属性的错误，避免过多日志
                }
            }
        }, 1000);
    }
    
    private stopTimeUpdateLoop() {
        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = null;
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
        const socketName = process.platform === "win32"
            ? `\\\\.\\pipe\\mpvsocket_${process.pid}_${Date.now()}`
            : `/tmp/mpvsocket_${process.pid}_${Date.now()}`;

        const options = {
            binary: binaryPath || undefined,
            socket: socketName,
            debug: !app.isPackaged,
            verbose: !app.isPackaged,
            audio_only: true,
            time_update: 1,
            additionalArgs: argsArray.filter(arg => arg.trim() !== "")
        };
        logger.logInfo("MpvManager MAIN: getMpvOptions generated:", options);
        return options;
    }

    public async initializeMpv(isManualTrigger = false): Promise<boolean> {
        logger.logInfo(`MpvManager MAIN: initializeMpv called. isManualTrigger: ${isManualTrigger}, current MPV instance: ${this.mpv ? 'exists' : 'null'}, fully initialized: ${this.isMpvFullyInitialized}`);
        if (this.mpv && this.isMpvFullyInitialized) {
            logger.logInfo("MpvManager MAIN: MPV already initialized and running.");
            if (isManualTrigger) this.sendToRenderer("mpv-init-success");
            return true;
        }
        if (this.mpv) {
             logger.logInfo("MpvManager MAIN: MPV instance exists but was not fully initialized. Quitting old instance.");
             await this.quitMpv();
        }
        this.isQuitting = false;
        this.isMpvFullyInitialized = false;

        const mpvOptions = this.getMpvOptions();
        logger.logInfo(`MpvManager MAIN: Initializing MPV. Binary: ${mpvOptions.binary || 'System PATH'}, Socket: ${mpvOptions.socket}, Args: [${mpvOptions.additionalArgs.join(', ')}]`);

        if (mpvOptions.binary) {
             try {
                await fs.promises.access(mpvOptions.binary, fs.constants.X_OK);
                logger.logInfo(`MpvManager MAIN: MPV binary at "${mpvOptions.binary}" is accessible.`);
            } catch (err: any) {
                const errorMsg = `MPV 路径 "${mpvOptions.binary}" 无效或不可执行. Error: ${err.message}`;
                logger.logError(`MpvManager MAIN: ${errorMsg}`, err);
                if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                    this.sendToRenderer("mpv-init-failed", errorMsg);
                }
                return false;
            }
        } else if (AppConfig.getConfig("playMusic.backend") === "mpv") {
            const errorMsg = "MPV 播放器路径未设置.";
            logger.logError(`MpvManager MAIN: ${errorMsg}`, new Error("MPV path not configured"));
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }

        try {
            logger.logInfo("MpvManager MAIN: Creating new NodeMpvPlayer instance.");
            this.mpv = new NodeMpvPlayer(
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
            logger.logInfo("MpvManager MAIN: NodeMpvPlayer instance created.");
        } catch (instantiationError: any) {
            const errorMsg = `MPV 实例化错误: ${instantiationError.message}`;
            logger.logError("MpvManager MAIN: Error during NodeMpvPlayer instantiation:", instantiationError);
            this.mpv = null;
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }

        if (typeof this.mpv.start !== 'function') {
            const errorMsg = "MpvAPI 实例无效或缺少 start 方法.";
            logger.logError("MpvManager MAIN: 'this.mpv.start' is NOT a function.", new Error(errorMsg));
            this.mpv = null;
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }

        try {
            this.setupMpvEventHandlers();
            logger.logInfo("MpvManager MAIN: Attempting to start MPV process...");
            await this.mpv.start();
            logger.logInfo("MpvManager MAIN: MPV process started successfully.");
            this.retryCount = 0;
            await this.observeProperties();
            this.isMpvFullyInitialized = true;
            this.startTimeUpdateLoop();
            this.sendToRenderer("mpv-init-success");
            logger.logInfo("MpvManager MAIN: MPV fully initialized and ready.");
            return true;
        } catch (startError: any) {
            const errorMsg = `MPV 启动或后续设置失败: ${startError.message}.`;
            logger.logError("MpvManager MAIN: Failed to start MPV or setup:", startError);
            if (this.mpv) {
                try { await this.mpv.quit(); } catch (qErr) { logger.logError("MpvManager MAIN: Error quitting MPV after start failure:", qErr); }
            }
            this.mpv = null;
            this.isMpvFullyInitialized = false;
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }
    }

    private async observeProperties() {
        if (!this.mpv) {
            logger.logInfo("MpvManager MAIN: observeProperties - MPV instance is null.");
            return;
        }
        try {
            logger.logInfo("MpvManager MAIN: Observing MPV properties...");
            await this.mpv.observeProperty('time-pos');
            await this.mpv.observeProperty('duration');
            await this.mpv.observeProperty('pause');
            await this.mpv.observeProperty('volume');
            await this.mpv.observeProperty('speed');
            await this.mpv.observeProperty('idle-active');
            await this.mpv.observeProperty('eof-reached');
            logger.logInfo("MpvManager MAIN: MPV properties observed successfully.");
        } catch (error: any) {
            logger.logError("MpvManager MAIN: Failed to observe MPV properties:", error);
            this.sendToRenderer("mpv-error", `观察MPV属性失败: ${error.message}`);
        }
    }

    private setupMpvEventHandlers() {
        if (!this.mpv) {
            logger.logInfo("MpvManager MAIN: setupMpvEventHandlers - MPV instance is null.");
            return;
        }
        this.mpv.removeAllListeners();
        logger.logInfo("MpvManager MAIN: Setting up MPV event handlers.");

        this.mpv.on("status", (status: MpvNodeStatus) => {
            if (!status || typeof status.property !== 'string') return;
            const { property: propertyName, value } = status;
            // logger.logInfo(`MpvManager MAIN: MPV STATUS RAW - ${propertyName} = ${JSON.stringify(value)}`);

            if (propertyName === 'time-pos' && typeof value === 'number' && isFinite(value)) {
                this.lastKnownTime = value;
                this.sendToRenderer("mpv-timeposition", { time: this.lastKnownTime, duration: this.lastReportedDuration === Infinity ? null : this.lastReportedDuration });
            } else if (propertyName === 'duration' && typeof value === 'number') {
                const newDuration = value > 0 && isFinite(value) ? value : Infinity;
                if (newDuration !== this.lastReportedDuration) {
                    this.lastReportedDuration = newDuration;
                }
                this.sendToRenderer("mpv-timeposition", { time: this.lastKnownTime, duration: this.lastReportedDuration === Infinity ? null : this.lastReportedDuration });
            } else if (propertyName === 'pause' && typeof value === 'boolean') {
                 const newState = value ? PlayerState.Paused : PlayerState.Playing;
                 this.lastKnownPlayerState = newState;
                 this.sendToRenderer(value ? "mpv-paused" : "mpv-resumed", { state: newState });
            } else if (propertyName === 'volume' && typeof value === 'number') {
                const newVolume = Math.max(0, Math.min(1, value / 100));
                this.sendToRenderer("mpv-volumechange", { volume: newVolume });
            } else if ((propertyName === 'speed' || propertyName === 'playback-speed') && typeof value === 'number') {
                this.sendToRenderer("mpv-speedchange", { speed: value });
            } else if (propertyName === 'eof-reached' && value === true) {
                logger.logInfo(`MpvManager MAIN: MPV property 'eof-reached' is true. Signaling playback ended.`);
                this.sendToRenderer("mpv-playback-ended", { reason: "eof" });
            } else if (propertyName === 'idle-active' && value === true) {
                logger.logInfo(`MpvManager MAIN: MPV property 'idle-active' is true.`);
                if (this.mpv && this.isMpvFullyInitialized) {
                    this.mpv.getProperty('eof-reached').then(isEof => {
                        if (isEof === true) {
                            logger.logInfo("MpvManager MAIN: 'idle-active' and 'eof-reached' both true. Confirmed playback ended.");
                        } else {
                             logger.logInfo(`MpvManager MAIN: 'idle-active' is true, but 'eof-reached' is ${isEof}.`);
                        }
                    }).catch(e => logger.logError("MpvManager MAIN: Error checking eof-reached on idle-active event", e as Error));
                } else {
                    logger.logInfo("MpvManager MAIN: MPV not fully initialized, skipping eof-reached check on idle-active.");
                }
            }
        });

        this.mpv.on("paused", () => {
            logger.logInfo("MpvManager MAIN: MPV direct event 'paused'.");
            if (this.lastKnownPlayerState !== PlayerState.Paused) {
                this.lastKnownPlayerState = PlayerState.Paused;
                this.sendToRenderer("mpv-paused", { state: PlayerState.Paused });
            }
        });

        this.mpv.on("resumed", () => {
            logger.logInfo("MpvManager MAIN: MPV direct event 'resumed'.");
            if (this.lastKnownPlayerState !== PlayerState.Playing) {
                this.lastKnownPlayerState = PlayerState.Playing;
                this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });
        
        this.mpv.on("stopped", async () => {
            if (this.isQuitting) { logger.logInfo("MpvManager MAIN: MPV 'stopped' ignored (quitting)."); return; }
            logger.logInfo("MpvManager MAIN: MPV direct event 'stopped'.");
            let isEof = false;
            let idleActive = false;

            if (this.mpv && this.isMpvFullyInitialized) {
                try { 
                    isEof = await this.mpv.getProperty('eof-reached') as boolean; 
                } catch(e){
                    logger.logError("MpvManager MAIN: Error getting 'eof-reached' on stopped event", e as Error);
                }
                try {
                    idleActive = await this.mpv.getProperty('idle-active') as boolean;
                } catch(e) {
                     logger.logError("MpvManager MAIN: Error getting 'idle-active' on stopped event", e as Error);
                }
            } else {
                 logger.logInfo("MpvManager MAIN: MPV not fully initialized, cannot get eof-reached/idle-active on stopped event.");
            }

            if (isEof || idleActive) {
                logger.logInfo(`MpvManager MAIN: 'stopped' event, isEof: ${isEof}, idleActive: ${idleActive}. Treating as playback ended.`);
                this.sendToRenderer("mpv-playback-ended", { reason: "eof" });
            } else {
                logger.logInfo("MpvManager MAIN: 'stopped' but not EOF or idle. Resetting state and sending mpv-stopped.");
                this.sendToRenderer("mpv-stopped", { state: PlayerState.None });
                this.lastKnownPlayerState = PlayerState.None;
                this.currentTrack = null; this.lastKnownTime = 0; this.lastReportedDuration = Infinity;
            }
        });

        this.mpv.on("started", () => {
            logger.logInfo("MpvManager MAIN: MPV direct event 'started'.");
             if (this.mpv && this.isMpvFullyInitialized) {
                this.mpv.getProperty("duration").then(duration => {
                    this.lastReportedDuration = (typeof duration === 'number' && duration > 0 && isFinite(duration)) ? duration : Infinity;
                    this.lastKnownTime = 0;
                    this.sendToRenderer("mpv-timeposition", { time: 0, duration: this.lastReportedDuration === Infinity ? null : this.lastReportedDuration });
                }).catch(err => {
                    logger.logError("MpvManager MAIN: Error getting duration on 'started'", err);
                    this.lastReportedDuration = Infinity;
                    this.sendToRenderer("mpv-timeposition", { time: 0, duration: null });
                });
            }
            if (this.lastKnownPlayerState !== PlayerState.Playing) {
                 this.lastKnownPlayerState = PlayerState.Playing;
                 this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });
        this.mpv.on("error", (error: Error) => {
            logger.logError("MpvManager MAIN: MPV 'error' event:", error);
            this.sendToRenderer("mpv-error", `MPV internal error: ${error.message}`);
        });
        this.mpv.on("crashed", async () => {
            if (this.isQuitting) { logger.logInfo("MpvManager MAIN: MPV 'crashed' ignored (quitting)."); return; }
            const crashMsg = `MPV 播放器意外退出。正在尝试重启...`;
            logger.logError(`MpvManager MAIN: ${crashMsg}`, new Error(`MPV Crashed`));
            this.sendToRenderer("mpv-error", crashMsg);
            const oldMpv = this.mpv; this.mpv = null; this.isMpvFullyInitialized = false;
            if (oldMpv) oldMpv.removeAllListeners();
            if (this.retryCount < this.MAX_RETRIES) {
              this.retryCount++; if(this.retryTimeout) clearTimeout(this.retryTimeout);
              this.retryTimeout = setTimeout(async (): Promise<void> => {
                  logger.logInfo(`MpvManager MAIN: Retrying MPV init (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
                  const success = await this.initializeMpv(true);
                  if (success && this.currentTrack && this.mpv) {
                    logger.logInfo(`MpvManager MAIN: Re-loading track after crash: ${this.currentTrack.title}`);
                    await this.load(this.currentTrack.url, 'replace');
                    if (this.lastKnownPlayerState === PlayerState.Playing) {
                       logger.logInfo("MpvManager MAIN: Resuming playback after crash.");
                       await this.mpv.play().catch(e => logger.logError("MpvManager MAIN: Error re-playing after crash:", e as Error));
                    }
                    if (this.lastKnownTime > 0) {
                       logger.logInfo(`MpvManager MAIN: Seeking to ${this.lastKnownTime}s after crash.`);
                       await this.mpv.seek(this.lastKnownTime, "absolute").catch(e => logger.logError("MpvManager MAIN: Error re-seeking after crash:", e as Error));
                    }
                  } else if (!success) {
                      logger.logError(`MpvManager MAIN: MPV re-init attempt ${this.retryCount} failed.`, new Error(`MPV re-init attempt ${this.retryCount} failed.`));
                  }
              }, 2000 * this.retryCount);
            } else {
              const finalErrorMsg = "MPV 播放器多次崩溃，已停止尝试重启.";
              logger.logError(`MpvManager MAIN: ${finalErrorMsg}`, new Error(finalErrorMsg));
              this.sendToRenderer("mpv-error", finalErrorMsg);
            }
        });
    }

    public async quitMpv() {
        logger.logInfo("MpvManager MAIN: quitMpv called.");
        this.isQuitting = true;
        if (this.retryTimeout) { clearTimeout(this.retryTimeout); this.retryTimeout = null; }
        if (this.mpv) {
            try {
                const running = this.mpv.isRunning();
                logger.logInfo(`MpvManager MAIN: MPV running state before quit: ${running}`);
                if (this.lastKnownPlayerState !== PlayerState.None && running) {
                     logger.logInfo("MpvManager MAIN: Stopping MPV before quit.");
                     await this.mpv.stop().catch(e => logger.logInfo("MpvManager MAIN: Error stopping MPV (ignorable):", e as Error));
                }
                logger.logInfo("MpvManager MAIN: Sending quit command to MPV.");
                await this.mpv.quit();
                logger.logInfo("MpvManager MAIN: MPV quit command sent.");
            } catch (error: any) {
                logger.logError("MpvManager MAIN: Error quitting MPV:", error);
            } finally {
                if (this.mpv) this.mpv.removeAllListeners();
                this.mpv = null; this.isMpvFullyInitialized = false;
                this.stopTimeUpdateLoop();
                logger.logInfo("MpvManager MAIN: MPV instance nulled and uninitialized.");
            }
        } else {
            logger.logInfo("MpvManager MAIN: quitMpv called but MPV instance was already null.");
        }
    }

    private sendToRenderer(channel: string, data?: any) {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents && !this.mainWindow.webContents.isDestroyed()) {
            // logger.logInfo(`MpvManager MAIN: Sending to renderer on channel "${channel}". Data: ${JSON.stringify(data)}`);
            this.mainWindow.webContents.send(channel, data);
        } else {
            // logger.logInfo(`MpvManager MAIN: Cannot send to renderer, mainWindow not available. Channel: ${channel}`);
        }
    }

    private async load(filePath: string, mode: 'replace' | 'append' | 'append-play' = 'replace') {
        logger.logInfo(`MpvManager MAIN: load called for "${filePath}", mode: "${mode}". MPV fully initialized: ${this.isMpvFullyInitialized}`);
        if (!this.mpv || !this.isMpvFullyInitialized) {
            logger.logInfo("MpvManager MAIN: MPV not initialized, attempting to initialize before load.");
            const success = await this.initializeMpv(true);
            if(!success || !this.mpv || !this.isMpvFullyInitialized) {
                 const errorMsg = "MPV 未初始化或初始化失败，无法加载文件。";
                 this.sendToRenderer("mpv-error", errorMsg);
                 logger.logError(`MpvManager MAIN: ${errorMsg}`, new Error(errorMsg));
                 return;
            }
        }
        try {
            const running = this.mpv.isRunning();
            if (!running) {
                logger.logInfo("MpvManager MAIN: MPV process not running, attempting to restart.");
                const reinitSuccess = await this.initializeMpv(true);
                if (!reinitSuccess || !this.mpv || !this.isMpvFullyInitialized) {
                    throw new Error("Failed to restart MPV for loading.");
                }
            }
            logger.logInfo(`MpvManager MAIN: Calling mpv.load with filePath: ${filePath}`);
            await this.mpv.load(filePath, mode);
            logger.logInfo(`MpvManager MAIN: MPV loaded: ${filePath}`);
            this.lastKnownTime = 0; this.lastReportedDuration = Infinity;
        } catch (error: any) {
            logger.logError(`MpvManager MAIN: MPV failed to load: ${filePath}`, error);
            this.sendToRenderer("mpv-error", `加载文件失败: ${error.message}`);
        }
    }

    private handleIPC() {
        logger.logInfo("MpvManager MAIN: Setting up IPC handlers.");
        ipcMain.handle("mpv-initialize", async () => {
            logger.logInfo("MpvManager MAIN: IPC 'mpv-initialize' received.");
            return await this.initializeMpv(true);
        });
        ipcMain.handle("mpv-load", async (_event, filePath: string, track: IMusic.IMusicItem) => {
            logger.logInfo(`MpvManager MAIN: IPC 'mpv-load' for "${filePath}", track: ${track.title}`);
            this.currentTrack = track; await this.load(filePath);
        });
        ipcMain.handle("mpv-play", async () => {
            logger.logInfo("MpvManager MAIN: IPC 'mpv-play' received.");
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (play)"); return; }
            try {
                await this.mpv.setProperty("pause", false);
            } catch (e: any) { logger.logError("MpvManager MAIN: mpv-play/resume error", e as Error); this.sendToRenderer("mpv-error", `播放/恢复失败: ${e.message}`);}
        });
        ipcMain.handle("mpv-pause", async () => {
            logger.logInfo("MpvManager MAIN: IPC 'mpv-pause' received.");
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (pause)"); return; }
            try { await this.mpv.setProperty("pause", true); }
            catch (e: any) { logger.logError("MpvManager MAIN: mpv-pause error", e as Error); this.sendToRenderer("mpv-error", `暂停失败: ${e.message}`);}
        });
        ipcMain.handle("mpv-resume", async () => {
            logger.logInfo("MpvManager MAIN: IPC 'mpv-resume' received.");
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (resume)"); return; }
             try { await this.mpv.resume(); }
             catch (e: any) { logger.logError("MpvManager MAIN: mpv-resume error", e); this.sendToRenderer("mpv-error", `恢复播放失败: ${e.message}`);}
        });
        ipcMain.handle("mpv-stop", async () => {
            logger.logInfo("MpvManager MAIN: IPC 'mpv-stop' received.");
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (stop)"); return; }
             try { await this.mpv.stop(); this.currentTrack = null; }
             catch (e: any) { logger.logError("MpvManager MAIN: mpv-stop error", e); this.sendToRenderer("mpv-error", `停止失败: ${e.message}`);}
        });
        ipcMain.handle("mpv-seek", async (_event, timeSeconds: number) => {
            logger.logInfo(`MpvManager MAIN: IPC 'mpv-seek' to ${timeSeconds}`);
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (seek)"); return; }
            try { await this.mpv.seek(timeSeconds, "absolute"); }
            catch (e: any) { logger.logError("MpvManager MAIN: mpv-seek error", e); this.sendToRenderer("mpv-error", `跳转失败: ${e.message}`);}
        });
        ipcMain.handle("mpv-set-volume", async (_event, volume: number) => {
            logger.logInfo(`MpvManager MAIN: IPC 'mpv-set-volume' to ${volume}`);
            if (!this.mpv || !this.isMpvFullyInitialized) {
                const errorMsg = "MPV未初始化 (setVolume)";
                this.sendToRenderer("mpv-error", errorMsg);
                throw new Error(errorMsg);
            }
            try {
                const mpvVol = Math.round(volume * 100);
                await this.mpv.volume(mpvVol);
                logger.logInfo(`MpvManager MAIN: Volume set to ${mpvVol} for MPV.`);
            } catch (e: any) {
                const errorMsg = `音量设置失败: ${e.message || '未知错误'}`;
                logger.logError("MpvManager MAIN: mpv-set-volume error", e as Error);
                this.sendToRenderer("mpv-error", errorMsg);
                throw new Error(errorMsg);
            }
        });
        ipcMain.handle("mpv-set-speed", async (_event, speed: number) => {
            logger.logInfo(`MpvManager MAIN: IPC 'mpv-set-speed' to ${speed}`);
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (setSpeed)"); return; }
            try { await this.mpv.speed(speed); }
            catch (e: any) { logger.logError("MpvManager MAIN: mpv-set-speed error", e); this.sendToRenderer("mpv-error", `倍速设置失败: ${e.message}`);}
        });
        ipcMain.handle("mpv-get-duration", async () => {
            logger.logInfo("MpvManager MAIN: IPC 'mpv-get-duration'.");
            if (!this.mpv || !this.isMpvFullyInitialized) return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            try {
                const duration = await this.mpv.getDuration();
                this.lastKnownDuration = (duration != null && duration > 0 && isFinite(duration)) ? duration : Infinity;
                this.lastReportedDuration = this.lastKnownDuration;
                logger.logInfo(`MpvManager MAIN: 'mpv-get-duration' returning ${this.lastKnownDuration}`);
                return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            } catch (e: any) { logger.logError("MpvManager MAIN: mpv-get-duration error", e); return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration; }
        });
        ipcMain.handle("mpv-get-current-time", async () => {
             logger.logInfo("MpvManager MAIN: IPC 'mpv-get-current-time'.");
             if (!this.mpv || !this.isMpvFullyInitialized) return this.lastKnownTime;
             try {
                const time = await this.mpv.getTimePosition();
                this.lastKnownTime = time ?? this.lastKnownTime;
                logger.logInfo(`MpvManager MAIN: 'mpv-get-current-time' returning ${this.lastKnownTime}`);
                return this.lastKnownTime;
             } catch(e: any) { logger.logError("MpvManager MAIN: mpv-get-current-time error", e); return this.lastKnownTime; }
        });
        ipcMain.handle("mpv-set-property", async (_event, property: string, value: any) => {
            logger.logInfo(`MpvManager MAIN: IPC 'mpv-set-property': ${property} = ${value}`);
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV 未初始化，无法设置属性。"); return; }
            try { await this.mpv.setProperty(property, value); logger.logInfo(`MpvManager MAIN: MPV property set: ${property} = ${value}`); }
            catch (error: any) { logger.logError(`MpvManager MAIN: MPV failed to set property ${property}:`, error); this.sendToRenderer("mpv-error", `设置属性 ${property} 失败: ${error.message}`); }
        });
        ipcMain.handle("mpv-quit", async () => {
            logger.logInfo("MpvManager MAIN: IPC 'mpv-quit' received.");
            await this.quitMpv();
        });
    }
}

export default new MpvManager();