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
    private lastKnownPlayerState: PlayerState = PlayerState.None;
    private retryTimeout: NodeJS.Timeout | null = null;
    private readonly MAX_RETRIES = 3;
    private retryCount = 0;
    private isQuitting = false;
    private isMpvFullyInitialized = false;


    constructor() {
        logger.logInfo("MpvManager Constructor: Imported 'node-mpv' module:", NodeMpvPlayer !== undefined);
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
            // time_update is an option for node-mpv's internal interval for 'timeposition' event
            // We primarily rely on 'status' event for time-pos for better sync.
            // However, node-mpv itself might use it. Default is 1.
            time_update: 1,
            additionalArgs: argsArray.filter(arg => arg.trim() !== "")
        };
    }

    public async initializeMpv(isManualTrigger = false): Promise<boolean> {
        if (this.mpv && this.isMpvFullyInitialized) {
            logger.logInfo("MpvManager: MPV already initialized and running.");
            if (isManualTrigger) this.sendToRenderer("mpv-init-success");
            return true;
        }
        if (this.mpv) { // Instance exists but not fully initialized (e.g., previous attempt failed)
             logger.logInfo("MpvManager: MPV instance exists but was not fully initialized. Quitting old instance before re-initializing.");
             await this.quitMpv(); // This will set this.mpv to null
        }
        this.isQuitting = false;
        this.isMpvFullyInitialized = false; // Reset status for a new attempt

        const mpvOptions = this.getMpvOptions();
        logger.logInfo(`MpvManager: Initializing MPV. Binary: ${mpvOptions.binary || 'System PATH'}, Args: [${mpvOptions.additionalArgs.join(', ')}]`);

        if (mpvOptions.binary) {
             try {
                await fs.promises.access(mpvOptions.binary, fs.constants.X_OK);
            } catch (err: any) {
                const errorMsg = `MPV 路径 "${mpvOptions.binary}" 无效或不可执行。错误: ${err.message}`;
                logger.logError(errorMsg, err);
                // Send error only if MPV is the selected backend or manually triggered
                if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                    this.sendToRenderer("mpv-init-failed", errorMsg);
                }
                return false;
            }
        } else if (AppConfig.getConfig("playMusic.backend") === "mpv") {
            const errorMsg = "MPV 播放器路径未设置，请在 设置->播放 中配置。";
            logger.logError(errorMsg, new Error("MPV path not configured"));
            this.sendToRenderer("mpv-init-failed", errorMsg); // Always send if MPV backend and no path
            return false;
        }

        try {
            logger.logInfo("MpvManager: About to call 'new NodeMpvPlayer()'.");
            this.mpv = new NodeMpvPlayer(
                { // Pass options to node-mpv constructor
                    binary: mpvOptions.binary,
                    socket: mpvOptions.socket,
                    debug: mpvOptions.debug,
                    verbose: mpvOptions.verbose,
                    audio_only: mpvOptions.audio_only,
                    time_update: mpvOptions.time_update, // Pass time_update
                },
                mpvOptions.additionalArgs
            );
            logger.logInfo("MpvManager: NodeMpvPlayer instance created.");
        } catch (instantiationError: any) {
            const errorMsg = `MPV 实例化错误: ${instantiationError.message}`;
            logger.logError("MpvManager: Error during 'new NodeMpvPlayer()' instantiation:", instantiationError);
            this.mpv = null; // Ensure mpv is null on failure
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }

        if (typeof this.mpv.start !== 'function') {
            const errorMsg = "MpvAPI 实例缺少 start 方法。";
            logger.logError("MpvManager: 'this.mpv.start' is NOT a function.", new Error(errorMsg));
            this.mpv = null;
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }

        try {
            this.setupMpvEventHandlers(); // Setup listeners before starting MPV
            logger.logInfo("MpvManager: Attempting to start MPV process...");
            await this.mpv.start(); // Start the MPV process
            logger.logInfo("MPV process started successfully.");
            this.retryCount = 0;

            await this.observeProperties(); // Observe properties after MPV is confirmed started
            this.isMpvFullyInitialized = true; // Mark as fully initialized
            this.sendToRenderer("mpv-init-success");
            return true;
        } catch (startError: any) {
            const errorMsg = `MPV 启动或后续设置失败: ${startError.message}.`;
            logger.logError("Failed to start MPV or setup:", startError);
            if (this.mpv) { // Attempt to clean up
                try { await this.mpv.quit(); } catch (qErr) { logger.logError("Error quitting MPV after start failure:", qErr); }
            }
            this.mpv = null;
            this.isMpvFullyInitialized = false;
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }
    }

    private async observeProperties() {
        if (!this.mpv) return;
        try {
            await this.mpv.observeProperty('time-pos');
            await this.mpv.observeProperty('duration');
            await this.mpv.observeProperty('pause');
            await this.mpv.observeProperty('volume');
            await this.mpv.observeProperty('speed');
            await this.mpv.observeProperty('playback-speed'); // For compatibility
            await this.mpv.observeProperty('idle-active');
            await this.mpv.observeProperty('eof-reached');
            logger.logInfo("MPV properties observed successfully.");
        } catch (error: any) {
            logger.logError("Failed to observe MPV properties:", error);
            this.sendToRenderer("mpv-error", `观察MPV属性失败: ${error.message}`);
        }
    }

    private setupMpvEventHandlers() {
        if (!this.mpv) return;
        this.mpv.removeAllListeners();

        this.mpv.on("status", (status: MpvNodeStatus) => {
            if (!status || typeof status.property !== 'string') {
                logger.logInfo("Received unexpected status format from node-mpv", status);
                return;
            }

            const propertyName = status.property;
            const value = status.value;

            if (propertyName === 'time-pos' && typeof value === 'number' && isFinite(value)) {
                this.lastKnownTime = value;
                this.sendToRenderer("mpv-timeposition", { time: this.lastKnownTime, duration: this.lastKnownDuration });
            } else if (propertyName === 'duration' && typeof value === 'number') {
                const newDuration = value > 0 && isFinite(value) ? value : Infinity;
                if (newDuration !== this.lastKnownDuration) {
                    this.lastKnownDuration = newDuration;
                    this.sendToRenderer("mpv-timeposition", { time: this.lastKnownTime, duration: this.lastKnownDuration });
                }
            } else if (propertyName === 'pause' && typeof value === 'boolean') {
                 const newState = value ? PlayerState.Paused : PlayerState.Playing;
                 // Only send if state actually changes to avoid redundant IPC messages
                 if (this.lastKnownPlayerState !== newState) {
                     this.lastKnownPlayerState = newState;
                     this.sendToRenderer(value ? "mpv-paused" : "mpv-resumed", { state: newState });
                 }
            } else if (propertyName === 'volume' && typeof value === 'number') {
                const newVolume = Math.max(0, Math.min(1, value / 100)); // Convert 0-100 to 0-1
                this.sendToRenderer("mpv-volumechange", { volume: newVolume });
            } else if ((propertyName === 'speed' || propertyName === 'playback-speed') && typeof value === 'number') {
                this.sendToRenderer("mpv-speedchange", { speed: value });
            } else if (propertyName === 'idle-active' && value === true) {
                logger.logInfo(`MPV property-change: idle-active is true.`);
                // Further checks for EOF are better handled by 'eof-reached' or 'stopped' event
            } else if (propertyName === 'eof-reached' && value === true) {
                logger.logInfo(`MPV property-change: eof-reached is true.`);
                this.sendToRenderer("mpv-playback-ended", { reason: "eof" });
            }
        });

        // Direct event listeners for more specific signals from node-mpv
        this.mpv.on("paused", () => {
            logger.logInfo("MPV direct event: paused");
            if (this.lastKnownPlayerState !== PlayerState.Paused) {
                this.lastKnownPlayerState = PlayerState.Paused;
                this.sendToRenderer("mpv-paused", { state: PlayerState.Paused });
            }
        });

        this.mpv.on("resumed", () => {
            logger.logInfo("MPV direct event: resumed");
            if (this.lastKnownPlayerState !== PlayerState.Playing) {
                this.lastKnownPlayerState = PlayerState.Playing;
                this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });

        this.mpv.on("stopped", async () => {
            if (this.isQuitting) return;
            logger.logInfo("MPV direct event: stopped");
            // This event means playback stopped for any reason (EOF, user, error).
            // Rely on eof-reached or idle-active for more specific EOF detection.
            // If it's not EOF, it's likely a stop command or an error.
            // We primarily send a generic stop; TrackPlayer can decide if it's EOF based on its state.
            this.sendToRenderer("mpv-stopped", { state: PlayerState.None });
            this.lastKnownPlayerState = PlayerState.None;
        });

        this.mpv.on("started", () => {
            logger.logInfo("MPV direct event: started (new file loaded)");
             if (this.mpv) {
                this.mpv.getProperty("duration").then(duration => {
                    this.lastKnownDuration = (typeof duration === 'number' && duration > 0 && isFinite(duration)) ? duration : Infinity;
                    this.lastKnownTime = 0;
                    this.sendToRenderer("mpv-timeposition", { time: 0, duration: this.lastKnownDuration });
                }).catch(err => {
                    logger.logError("Error getting duration on 'started' event:", err);
                    this.lastKnownDuration = Infinity;
                    this.sendToRenderer("mpv-timeposition", { time: 0, duration: this.lastKnownDuration });
                });
            }
            if (this.lastKnownPlayerState !== PlayerState.Playing) {
                 this.lastKnownPlayerState = PlayerState.Playing;
                 this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });
        
        this.mpv.on("error", (error: Error) => {
            const errorMsg = `MPV internal error: ${error.message}`;
            logger.logError("MPV 'error' event:", error);
            this.sendToRenderer("mpv-error", errorMsg);
        });

        this.mpv.on("crashed", async () => {
            if (this.isQuitting) return;
            const crashMsg = `MPV 播放器意外退出。正在尝试重启...`;
            logger.logError(crashMsg, new Error(`MPV Crashed`));
            this.sendToRenderer("mpv-error", crashMsg);

            const oldMpv = this.mpv;
            this.mpv = null;
            this.isMpvFullyInitialized = false;
            if (oldMpv) {
              oldMpv.removeAllListeners();
            }

            if (this.retryCount < this.MAX_RETRIES) {
              this.retryCount++;
              if(this.retryTimeout) clearTimeout(this.retryTimeout);
              this.retryTimeout = setTimeout(async (): Promise<void> => {
                  logger.logInfo(`Retrying MPV initialization (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
                  const success = await this.initializeMpv(true);
                  if (success && this.currentTrack && this.mpv) {
                    await this.load(this.currentTrack.url, 'replace');
                    if (this.lastKnownPlayerState === PlayerState.Playing) {
                       await this.mpv.play().catch((e) => logger.logError("Error re-playing after crash:", e as Error));
                    }
                    if (this.lastKnownTime > 0) {
                       await this.mpv.seek(this.lastKnownTime, "absolute").catch((e) => logger.logError("Error re-seeking after crash:", e as Error));
                    }
                  } else if (!success) {
                      logger.logError(`MPV re-initialization attempt ${this.retryCount} failed.`, new Error(`MPV re-initialization attempt ${this.retryCount} failed.`));
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
                const running = this.mpv.isRunning();
                if (this.lastKnownPlayerState !== PlayerState.None && running) {
                     await this.mpv.stop().catch((e) => logger.logInfo("Error stopping MPV before quit (ignorable):", e as Error));
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
                this.isMpvFullyInitialized = false;
            }
        }
    }

    private sendToRenderer(channel: string, data?: any) {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents && !this.mainWindow.webContents.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    private async load(filePath: string, mode: 'replace' | 'append' | 'append-play' = 'replace') {
        if (!this.mpv || !this.isMpvFullyInitialized) {
            const success = await this.initializeMpv(true);
            if(!success || !this.mpv || !this.isMpvFullyInitialized) {
                 const errorMsg = "MPV 未初始化或初始化失败，无法加载文件。";
                 this.sendToRenderer("mpv-error", errorMsg);
                 logger.logError(errorMsg, new Error("MPV not initialized for load"));
                 return;
            }
        }

        try {
            const running = this.mpv.isRunning();
            if (running === false) {
                logger.logInfo("MPV process was not running (isMpvFullyInitialized might be true if start succeeded but process died later), attempting to restart MPV before loading.");
                // Try to re-initialize which includes start
                const reinitSuccess = await this.initializeMpv(true);
                if (!reinitSuccess || !this.mpv || !this.isMpvFullyInitialized) {
                    throw new Error("Failed to restart MPV process for loading.");
                }
                // No need to call observeProperties again if initializeMpv handles it
            }
            await this.mpv.load(filePath, mode);
            logger.logInfo(`MPV loaded: ${filePath} with mode ${mode}`);
            this.lastKnownTime = 0;
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
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (play)"); return; }
            try {
                const isPaused = await this.mpv.getProperty('pause');
                if (isPaused) {
                    await this.mpv.resume();
                } else {
                     // If not paused, and we want to "play" (e.g., after stop or new load),
                    // the `load` command or `started` event should handle transitioning to play.
                    // If already playing, this might do nothing or restart, depending on MPV.
                    // To be safe, only call play if not already playing.
                    if(this.lastKnownPlayerState !== PlayerState.Playing){
                        await this.mpv.play();
                    }
                }
            } catch (e: any) { logger.logError("mpv-play/resume error", e); this.sendToRenderer("mpv-error", `播放/恢复失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-pause", async () => {
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (pause)"); return; }
            try {
                await this.mpv.pause();
            } catch (e: any) { logger.logError("mpv-pause error", e); this.sendToRenderer("mpv-error", `暂停失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-resume", async () => {
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (resume)"); return; }
             try {
                await this.mpv.resume();
            } catch (e: any) { logger.logError("mpv-resume error", e); this.sendToRenderer("mpv-error", `恢复播放失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-stop", async () => {
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (stop)"); return; }
             try {
                await this.mpv.stop();
                this.currentTrack = null;
            } catch (e: any) { logger.logError("mpv-stop error", e); this.sendToRenderer("mpv-error", `停止失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-seek", async (_event, timeSeconds: number) => {
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (seek)"); return; }
            try {
                await this.mpv.seek(timeSeconds, "absolute");
            } catch (e: any) { logger.logError("mpv-seek error", e); this.sendToRenderer("mpv-error", `跳转失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-set-volume", async (_event, volume: number) => { // volume is 0-1 from renderer
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (setVolume)"); return; }
            try {
                await this.mpv.volume(Math.round(volume * 100));
            } catch (e: any) { logger.logError("mpv-set-volume error", e); this.sendToRenderer("mpv-error", `音量设置失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-set-speed", async (_event, speed: number) => {
            if (!this.mpv || !this.isMpvFullyInitialized) { this.sendToRenderer("mpv-error", "MPV未初始化 (setSpeed)"); return; }
            try {
                await this.mpv.speed(speed);
            } catch (e: any) { logger.logError("mpv-set-speed error", e); this.sendToRenderer("mpv-error", `倍速设置失败: ${e.message}`);}
        });

        ipcMain.handle("mpv-get-duration", async () => {
            if (!this.mpv || !this.isMpvFullyInitialized) return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            try {
                const duration = await this.mpv.getDuration();
                this.lastKnownDuration = (duration != null && duration > 0 && isFinite(duration)) ? duration : Infinity;
                return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            } catch (e: any) {
                logger.logError("mpv-get-duration error", e);
                return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            }
        });

        ipcMain.handle("mpv-get-current-time", async () => {
             if (!this.mpv || !this.isMpvFullyInitialized) return this.lastKnownTime;
             try {
                const time = await this.mpv.getTimePosition();
                this.lastKnownTime = time ?? this.lastKnownTime;
                return this.lastKnownTime;
             } catch(e: any) {
                 logger.logError("mpv-get-current-time error", e);
                 return this.lastKnownTime;
             }
        });
        ipcMain.handle("mpv-set-property", async (_event, property: string, value: any) => {
            if (!this.mpv || !this.isMpvFullyInitialized) {
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