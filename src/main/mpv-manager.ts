// src/main/mpv-manager.ts
import MpvAPI, { ObserveProperty, Status as MpvNodeStatus, EndFileEvent as MpvNodeEndFileEvent } from "node-mpv"; // 修改别名以避免与可能存在的全局类型冲突
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
                inQuotes = !inQuotes;
                if (!inQuotes && currentArg) {
                    argsArray.push(currentArg);
                    currentArg = "";
                }
            } else if (char === ' ' && !inQuotes) {
                if (currentArg) {
                    argsArray.push(currentArg);
                    currentArg = "";
                }
            } else {
                currentArg += char;
            }
        }
        if (currentArg) {
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
                logger.logError(`MPV binary at ${mpvOptions.binary} is not executable or does not exist.`, err);
                this.sendToRenderer("mpv-error", `MPV 路径 "${mpvOptions.binary}" 无效或不可执行。`);
                if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                    this.mainWindow?.webContents.send("mpv-init-failed");
                }
                return false;
            }
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
            logger.logError("Failed to initialize MPV:", error);
            this.sendToRenderer("mpv-error", `MPV 初始化失败: ${error.message}`);
            this.mpv = null;
             if(isManualTrigger || AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.mainWindow?.webContents.send("mpv-init-failed");
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
        }
    }

    private setupMpvEventHandlers() {
        if (!this.mpv) return;

        this.mpv.on("statuschange", (status: MpvNodeStatus) => { // 使用导入的 MpvNodeStatus 类型
            if (status && typeof status['time-pos'] === 'number') {
                this.lastKnownTime = status['time-pos'];
            }
            if (status && typeof status.duration === 'number' && status.duration > 0) {
                this.lastKnownDuration = status.duration;
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
        });

        this.mpv.on("endfile", (event: MpvNodeEndFileEvent) => { // 使用导入的 MpvNodeEndFileEvent 类型
            logger.logInfo("MPV endfile event:", event);
            if (event.reason === "eof" || event.reason === "stop") {
             this.lastKnownPlayerState = PlayerState.None;
             this.currentTrack = null;
             this.sendToRenderer("mpv-playback-ended", { reason: event.reason });
            } else if (event.reason === "error") {
            logger.logError("MPV playback error (endfile event)", new Error(`MPV endfile event error: ${JSON.stringify(event)}`));
            this.sendToRenderer("mpv-error", "播放时发生错误。");
            }
        });

        this.mpv.on("error", (error: Error) => {
            logger.logError("MPV error:", error);
            this.sendToRenderer("mpv-error", error.toString());
        });

        this.mpv.on("crashed", async (exitCode: number) => {
            if (this.isQuitting) return;
            logger.logError(`MPV crashed with exit code: ${exitCode}. Attempting to restart.`, new Error(`MPV Crashed - Exit code: ${exitCode}`));
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
              logger.logError("MPV crashed too many times, giving up.", new Error("MPV crashed too many times"));
              this.sendToRenderer("mpv-error", "MPV 播放器多次崩溃，无法重启。");
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
            if (this.mpv.isRunning === false) {
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
            if (!this.mpv) return;
            try {
                await this.mpv.play();
            } catch (e: any) { logger.logError("mpv-play error", e); }
        });

        ipcMain.handle("mpv-pause", async () => {
            if (!this.mpv) return;
            try {
                await this.mpv.pause();
            } catch (e: any) { logger.logError("mpv-pause error", e); }
        });

        ipcMain.handle("mpv-resume", async () => {
            if (!this.mpv) return;
             try {
                await this.mpv.play();
            } catch (e: any) { logger.logError("mpv-resume error", e); }
        });

        ipcMain.handle("mpv-stop", async () => {
            if (!this.mpv) return;
             try {
                await this.mpv.stop();
                this.currentTrack = null;
            } catch (e: any) { logger.logError("mpv-stop error", e); }
        });

        ipcMain.handle("mpv-seek", async (_event, timeSeconds: number) => {
            if (!this.mpv) return;
            try {
                await this.mpv.seek(timeSeconds, "absolute");
            } catch (e: any) { logger.logError("mpv-seek error", e); }
        });

        ipcMain.handle("mpv-set-volume", async (_event, volume: number) => {
            if (!this.mpv) return;
            try {
                await this.mpv.volume(volume);
            } catch (e: any) { logger.logError("mpv-set-volume error", e); }
        });

        ipcMain.handle("mpv-set-speed", async (_event, speed: number) => {
            if (!this.mpv) return;
            try {
                await this.mpv.setProperty("speed", speed);
            } catch (e: any) { logger.logError("mpv-set-speed error", e); }
        });

        ipcMain.handle("mpv-get-duration", async () => {
            if (!this.mpv) return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            try {
                const duration = await this.mpv.getDuration();
                this.lastKnownDuration = duration != null && duration > 0 ? duration : Infinity;
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

        AppConfig.onConfigUpdated(async (patch) => {
            if (patch["playMusic.mpvPath"] !== undefined || patch["playMusic.mpvArgs"] !== undefined) {
                 logger.logInfo("MPV path or args changed, re-initializing MPV.");
                 const success = await this.initializeMpv(true);
                 if (success && this.currentTrack && this.mpv) {
                     await this.load(this.currentTrack.url, 'replace');
                     if (this.lastKnownPlayerState === PlayerState.Playing) {
                         await this.mpv.play().catch((e: unknown) => logger.logError("Error re-playing after config change:", e as Error));
                     }
                     if (this.lastKnownTime > 0) {
                         await this.mpv.seek(this.lastKnownTime, "absolute").catch((e: unknown) => logger.logError("Error re-seeking after config change:", e as Error));
                     }
                 }
            }
        });
    }
}

export default new MpvManager();