// src/main/mpv-manager.ts
import NodeMpvPlayer, { Status as MpvNodeStatus } from "node-mpv";
import { ipcMain, BrowserWindow, app, IpcMainInvokeEvent } from "electron";
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
    private volatileIsQuitting = false;
    private isMpvFullyInitialized = false;
    private timeUpdateInterval: NodeJS.Timeout | null = null;

    private lastKnownEofReached: boolean = false;
    private lastKnownIdleActive: boolean = false;

    constructor() {
        logger.logInfo("MpvManager MAIN: Constructor called.");
        this.handleIPC();
    }

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    private startTimeUpdateLoop() {
        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = setInterval(async () => {
            if (this.mpv && this.isMpvFullyInitialized && !this.volatileIsQuitting) {
                try {
                    const time = await this.mpv.getProperty('time-pos');
                    const duration = await this.mpv.getProperty('duration');
                    this.sendToRenderer("mpv-timeposition", { time, duration });
                } catch (e) {
                  // Silently handle
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
            // Filter out --input-ipc-server if user accidentally adds it
            additionalArgs: argsArray.filter(arg => arg.trim() !== "" && !arg.startsWith('--input-ipc-server'))
        };
        return options;
    }

    private async observeProperties() {
        if (!this.mpv) {
            return;
        }
        try {
            await this.mpv.observeProperty('time-pos');
            await this.mpv.observeProperty('duration');
            await this.mpv.observeProperty('pause');
            await this.mpv.observeProperty('volume');
            await this.mpv.observeProperty('speed');
            await this.mpv.observeProperty('idle-active');
            await this.mpv.observeProperty('eof-reached');
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.logError("MpvManager MAIN: Failed to observe MPV properties:", err);
            throw new Error(`Failed to observe MPV properties: ${err.message}`);
        }
    }

    public async initializeMpv(isManualTrigger = false): Promise<boolean> {
        this.volatileIsQuitting = false;
        logger.logInfo(`MpvManager MAIN: initializeMpv START. Manual: ${isManualTrigger}, MPV obj (before quit): ${this.mpv ? 'exists' : 'null'}, Initialized: ${this.isMpvFullyInitialized}, volatileIsQuitting (now false): ${this.volatileIsQuitting}`);

        if (this.mpv) {
             logger.logInfo("MpvManager MAIN: Existing MPV instance found. Quitting it before new initialization.");
             await this.quitMpv();
        }
        this.volatileIsQuitting = false;
        this.isMpvFullyInitialized = false;

        logger.logInfo("MpvManager MAIN: Proceeding with new MPV initialization after ensuring cleanup.");

        const mpvOptions = this.getMpvOptions();

        if (mpvOptions.binary) {
             try {
                await fs.promises.access(mpvOptions.binary, fs.constants.X_OK);
            } catch (err: any) {
                const errorMsg = `MPV 路径 "${mpvOptions.binary}" 无效或不可执行. Error: ${err.message}`;
                logger.logError(`MpvManager MAIN: ${errorMsg}`, err);
                this.sendToRenderer("mpv-init-failed", errorMsg);
                return false;
            }
        } else if (AppConfig.getConfig("playMusic.backend") === "mpv") {
            const errorMsg = "MPV 播放器路径未设置 (MPV is selected backend, but path is not set).";
            logger.logError(`MpvManager MAIN: ${errorMsg}`, new Error("MPV path not configured for MPV backend"));
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
                },
                 mpvOptions.additionalArgs
            );
            logger.logInfo("MpvManager MAIN: NodeMpvPlayer instance created.");
        } catch (instantiationError: any) {
            const err = instantiationError instanceof Error ? instantiationError : new Error(String(instantiationError));
            const errorMsg = `MPV 实例化错误: ${err.message}`;
            logger.logError("MpvManager MAIN: Error during NodeMpvPlayer instantiation:", err);
            this.mpv = null;
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }

        if (!this.mpv || typeof this.mpv.start !== 'function') {
            const errorMsg = "MpvAPI 实例无效或缺少 start 方法 (this.mpv.start is not a function).";
            logger.logError("MpvManager MAIN: 'this.mpv.start' is NOT a function.", new Error(errorMsg));
            this.mpv = null;
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }

        try {
            this.setupMpvEventHandlers();
            logger.logInfo("MpvManager MAIN: Attempting to start MPV process using mpv.start()...");
            await this.mpv.start();
            logger.logInfo("MpvManager MAIN: MPV process mpv.start() command completed.");

            await this.observeProperties();

            this.isMpvFullyInitialized = true;
            this.retryCount = 0;
            this.startTimeUpdateLoop();
            this.sendToRenderer("mpv-init-success");
            logger.logInfo("MpvManager MAIN: MPV fully initialized and ready.");
            return true;
        } catch (startOrSetupError: any) {
            const error = startOrSetupError instanceof Error ? startOrSetupError : new Error(String(startOrSetupError));
            const errorMsg = `MPV 启动或属性观察失败: ${error.message}.`;
            logger.logError("MpvManager MAIN: Critical error during MPV start or setup:", error);

            const tempMpv = this.mpv;
            this.mpv = null;
            this.isMpvFullyInitialized = false;

            if (tempMpv) {
                try {
                    if (tempMpv.isRunning()) {
                        await tempMpv.quit();
                    }
                } catch (qErr: any) {
                    logger.logError("MpvManager MAIN: Error quitting MPV after critical failure:", qErr instanceof Error ? qErr : new Error(String(qErr)));
                }
            }
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }
    }

    public async quitMpv() {
        if (this.volatileIsQuitting && !this.mpv) {
            return;
        }
        logger.logInfo("MpvManager MAIN: quitMpv called.");
        this.volatileIsQuitting = true;

        this.stopTimeUpdateLoop();

        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        const mpvInstanceToQuit = this.mpv;
        this.mpv = null;
        this.isMpvFullyInitialized = false;
        this.lastKnownPlayerState = PlayerState.None;
        this.currentTrack = null;
        this.lastKnownTime = 0;
        this.lastReportedDuration = Infinity;
        this.lastKnownEofReached = false;
        this.lastKnownIdleActive = false;

        if (mpvInstanceToQuit) {
            try {
                mpvInstanceToQuit.removeAllListeners();
                if (mpvInstanceToQuit.isRunning()) {
                    await mpvInstanceToQuit.stop().catch(e => logger.logInfo("MpvManager MAIN: Error stopping MPV during quitMpv (ignorable):", e instanceof Error ? e.message : String(e)));
                    await mpvInstanceToQuit.quit();
                    logger.logInfo("MpvManager MAIN: MPV quit command completed (in quitMpv).");
                } else {
                    logger.logInfo("MpvManager MAIN: MPV was not running when quitMpv called, attempting quit anyway.");
                    await mpvInstanceToQuit.quit().catch(e => logger.logError("MpvManager MAIN: Error quitting non-running MPV (ignorable in quitMpv):", e instanceof Error ? e : new Error(String(e))));
                }
            } catch (error: any) {
                logger.logError("MpvManager MAIN: Error during MPV quit process:", error instanceof Error ? error : new Error(String(error)));
            }
        } else {
            logger.logInfo("MpvManager MAIN: quitMpv called but MPV instance was already effectively null or previously cleaned.");
        }
        this.volatileIsQuitting = false;
    }

    private setupMpvEventHandlers() {
        if (!this.mpv) {
            logger.logError("MpvManager MAIN: setupMpvEventHandlers called but this.mpv is null.", new Error("this.mpv is null in setupMpvEventHandlers"));
            return;
        }
        this.mpv.removeAllListeners();

        this.mpv.on("status", (status: MpvNodeStatus) => {
            if (this.volatileIsQuitting || !this.mpv) return;
            if (!status || typeof status.property !== 'string') return;
            const { property: propertyName, value } = status;

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
            } else if (propertyName === 'eof-reached') {
                this.lastKnownEofReached = !!value;
            } else if (propertyName === 'idle-active') {
                this.lastKnownIdleActive = !!value;
            }
        });

        this.mpv.on("paused", () => {
            if (this.volatileIsQuitting || !this.mpv) return;
            if (this.lastKnownPlayerState !== PlayerState.Paused) {
                this.lastKnownPlayerState = PlayerState.Paused;
                this.sendToRenderer("mpv-paused", { state: PlayerState.Paused });
            }
        });

        this.mpv.on("resumed", () => {
            if (this.volatileIsQuitting || !this.mpv) return;
            if (this.lastKnownPlayerState !== PlayerState.Playing) {
                this.lastKnownPlayerState = PlayerState.Playing;
                this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });

        // *** 主播放结束事件处理 ***
        this.mpv.on("playback-finished", async (eventData: { reason: string }) => {
            if (this.volatileIsQuitting || !this.mpv) {
                logger.logInfo("MpvManager MAIN: MPV 'playback-finished' ignored (quitting or no instance).");
                return;
            }
            if (eventData.reason === 'eof') {
                logger.logInfo("MpvManager MAIN: MPV event 'playback-finished' (reason: eof). Signaling playback ended.");
                this.sendToRenderer("mpv-playback-ended", { reason: "eof" });

                // 状态重置逻辑
                this.lastKnownPlayerState = PlayerState.None;
                this.currentTrack = null;
                this.lastKnownTime = 0;
                this.lastReportedDuration = Infinity;
                this.lastKnownEofReached = false; // 确保重置
                this.lastKnownIdleActive = false; // 确保重置
            }
        });

        this.mpv.on("stopped", async () => {
            if (this.volatileIsQuitting || !this.mpv) {
                 logger.logInfo("MpvManager MAIN: MPV 'stopped' ignored (quitting or no instance).");
                 return;
            }
            logger.logInfo("MpvManager MAIN: MPV direct event 'stopped'. This is now treated as an explicit stop or error, not EOF.");

            // 如果不是由 playback-finished (eof) 触发的停止，那么这可能是用户操作或错误
            // 仍然需要通知渲染进程播放已停止，以便UI可以更新
            // 检查 this.lastKnownEofReached 确保不是因为eof刚刚触发了playback-finished
            if (!this.lastKnownEofReached) {
                this.sendToRenderer("mpv-stopped", { state: PlayerState.None });
            }

            // 状态重置逻辑（如果适用，但要小心不要覆盖 playback-finished 后的状态）
            if (this.lastKnownPlayerState !== PlayerState.None) {
                this.lastKnownPlayerState = PlayerState.None;
            }
            // currentTrack 等的重置应该由 playback-finished 或显式停止命令处理
            // 如果是显式stop，这里也可以重置
            // this.currentTrack = null;
            // this.lastKnownTime = 0;
            // this.lastReportedDuration = Infinity;
            // this.lastKnownEofReached = false; // 确保重置
            // this.lastKnownIdleActive = false; // 确保重置
        });

        this.mpv.on("started", () => {
            if (this.volatileIsQuitting || !this.mpv) return;
             if (this.mpv && this.isMpvFullyInitialized) {
                this.mpv.getProperty("duration").then(duration => {
                    if (this.volatileIsQuitting || !this.mpv) return;
                    this.lastReportedDuration = (typeof duration === 'number' && duration > 0 && isFinite(duration)) ? duration : Infinity;
                    this.lastKnownTime = 0;
                    this.sendToRenderer("mpv-timeposition", { time: 0, duration: this.lastReportedDuration === Infinity ? null : this.lastReportedDuration });
                }).catch(err => {
                    if (this.volatileIsQuitting || !this.mpv) return;
                    logger.logError("MpvManager MAIN: Error getting duration on 'started'", err instanceof Error ? err : new Error(String(err)));
                    this.lastReportedDuration = Infinity;
                    this.sendToRenderer("mpv-timeposition", { time: 0, duration: null });
                });
            }
            if (this.lastKnownPlayerState !== PlayerState.Playing) {
                 this.lastKnownPlayerState = PlayerState.Playing;
                 this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
            this.lastKnownEofReached = false;
            this.lastKnownIdleActive = false;
        });
        this.mpv.on("error", (error: any) => {
            if (this.volatileIsQuitting || !this.mpv) return;
            const err = error instanceof Error ? error : new Error(String(error));
            logger.logError("MpvManager MAIN: MPV 'error' event:", err);
            this.sendToRenderer("mpv-error", `MPV internal error: ${err.message}`);
        });
        this.mpv.on("crashed", async () => {
            if (this.volatileIsQuitting || !this.mpv) {
                logger.logInfo("MpvManager MAIN: MPV 'crashed' ignored (quitting or no instance).");
                return;
            }
            const crashMsg = `MPV 播放器意外退出。正在尝试重启...`;
            logger.logError(`MpvManager MAIN: ${crashMsg}`, new Error(`MPV Crashed`));
            this.sendToRenderer("mpv-error", crashMsg);

            const oldMpv = this.mpv;
            this.mpv = null;
            this.isMpvFullyInitialized = false;
            if (oldMpv) oldMpv.removeAllListeners();

            if (this.retryCount < this.MAX_RETRIES) {
              this.retryCount++; if(this.retryTimeout) clearTimeout(this.retryTimeout);
              this.retryTimeout = setTimeout(async (): Promise<void> => {
                  if (this.volatileIsQuitting) return;
                  logger.logInfo(`MpvManager MAIN: Retrying MPV init (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
                  const success = await this.initializeMpv(true);
                  if (success && this.currentTrack && this.mpv) {
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

    private async load(filePath: string, mode: 'replace' | 'append' | 'append-play' = 'replace') {
        if (this.volatileIsQuitting) {
            logger.logInfo(`MpvManager MAIN: Load call for "${filePath}" ignored, currently quitting.`);
            return;
        }
        if (!this.mpv || !this.isMpvFullyInitialized) {
            logger.logInfo("MpvManager MAIN: MPV not initialized during load, attempting to initialize first.");
            const success = await this.initializeMpv(true);
            if (this.volatileIsQuitting) {
                 logger.logInfo(`MpvManager MAIN: Load call for "${filePath}" aborted after initializeMpv, quitting.`);
                 return;
            }
            if(!success || !this.mpv || !this.isMpvFullyInitialized) {
                 const errorMsg = "MPV 未能成功初始化，无法加载文件。";
                 this.sendToRenderer("mpv-error", errorMsg);
                 logger.logError(`MpvManager MAIN: ${errorMsg}`, new Error(errorMsg));
                 return;
            }
        }
        try {
            if (!this.mpv || !this.mpv.isRunning()) {
                logger.logInfo("MpvManager MAIN: MPV process not running at load time, attempting to restart.");
                const reinitSuccess = await this.initializeMpv(true);
                 if (this.volatileIsQuitting) {
                     logger.logInfo(`MpvManager MAIN: Load call for "${filePath}" aborted after re-initializeMpv, quitting.`);
                     return;
                 }
                if (!reinitSuccess || !this.mpv || !this.isMpvFullyInitialized) {
                    throw new Error("Failed to restart MPV for loading.");
                }
            }
            await this.mpv.load(filePath, mode);
            this.lastKnownTime = 0; this.lastReportedDuration = Infinity;
            this.lastKnownEofReached = false; this.lastKnownIdleActive = false;
        } catch (error: any) {
            logger.logError(`MpvManager MAIN: MPV failed to load: ${filePath}`, error instanceof Error ? error : new Error(String(error)));
            this.sendToRenderer("mpv-error", `加载文件失败: ${error.message}`);
        }
    }
    private sendToRenderer(channel: string, data?: any) {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents && !this.mainWindow.webContents.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }

    private handleIPC() {
        const makeSafeHandler = (channelName: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>) => {
            return async (event: IpcMainInvokeEvent, ...args: any[]) => {
                if (this.volatileIsQuitting && channelName !== 'mpv-quit') {
                     logger.logInfo(`MpvManager MAIN: IPC call ${channelName} ignored due to quitting state.`);
                     return Promise.reject(new Error("MPV is shutting down."));
                }
                 if ((!this.mpv || !this.isMpvFullyInitialized) && channelName !== 'mpv-initialize' && channelName !== 'mpv-quit') {
                    logger.logInfo(`MpvManager MAIN: IPC call ${channelName} ignored, MPV not ready or instance is null.`);
                    this.sendToRenderer("mpv-error", "MPV 未就绪或实例为空");
                    return Promise.reject(new Error("MPV not ready or instance is null."));
                }
                try {
                    return await handler(event, ...args);
                } catch (e: any) {
                    const error = e instanceof Error ? e : new Error(String(e));
                    logger.logError(`MpvManager MAIN: Error in IPC handler for ${channelName}:`, error);
                    this.sendToRenderer("mpv-error", `处理命令 ${channelName} 失败: ${error.message}`);
                    throw error;
                }
            };
        };

        ipcMain.handle("mpv-initialize", makeSafeHandler("mpv-initialize", async () => {
            return await this.initializeMpv(true);
        }));
        ipcMain.handle("mpv-load", makeSafeHandler("mpv-load", async (_event, filePath: string, track: IMusic.IMusicItem) => {
            this.currentTrack = track;
            await this.load(filePath);
        }));
        ipcMain.handle("mpv-play", makeSafeHandler("mpv-play", async () => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (play)"));}
            await this.mpv.setProperty("pause", false);
        }));
        ipcMain.handle("mpv-pause", makeSafeHandler("mpv-pause", async () => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (pause)"));}
            await this.mpv.setProperty("pause", true);
        }));
        ipcMain.handle("mpv-resume", makeSafeHandler("mpv-resume", async () => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (resume)"));}
             await this.mpv.resume();
        }));
        ipcMain.handle("mpv-stop", makeSafeHandler("mpv-stop", async () => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (stop)"));}
             await this.mpv.stop(); this.currentTrack = null;
        }));
        ipcMain.handle("mpv-seek", makeSafeHandler("mpv-seek", async (_event, timeSeconds: number) => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (seek)"));}
            await this.mpv.seek(timeSeconds, "absolute");
        }));
        ipcMain.handle("mpv-set-volume", makeSafeHandler("mpv-set-volume", async (_event, volume: number) => {
            if (!this.mpv) { throw new Error("MPV实例不存在 (setVolume)"); }
            const mpvVol = Math.round(volume * 100);
            await this.mpv.volume(mpvVol);
        }));
        ipcMain.handle("mpv-set-speed", makeSafeHandler("mpv-set-speed", async (_event, speed: number) => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (setSpeed)"));}
            await this.mpv.speed(speed);
        }));
        ipcMain.handle("mpv-get-duration", makeSafeHandler("mpv-get-duration", async () => {
            if (!this.mpv) return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
            const duration = await this.mpv.getDuration();
            this.lastKnownDuration = (duration != null && duration > 0 && isFinite(duration)) ? duration : Infinity;
            this.lastReportedDuration = this.lastKnownDuration;
            return this.lastKnownDuration === Infinity ? null : this.lastKnownDuration;
        }));
        ipcMain.handle("mpv-get-current-time", makeSafeHandler("mpv-get-current-time", async () => {
             if (!this.mpv) return this.lastKnownTime;
             const time = await this.mpv.getTimePosition();
             this.lastKnownTime = time ?? this.lastKnownTime;
             return this.lastKnownTime;
        }));
        ipcMain.handle("mpv-set-property", makeSafeHandler("mpv-set-property", async (_event, property: string, value: any) => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (set-property)"));}
            await this.mpv.setProperty(property, value);
        }));
        ipcMain.handle("mpv-quit", makeSafeHandler("mpv-quit", async () => {
            logger.logInfo("MpvManager MAIN: IPC 'mpv-quit' received.");
            await this.quitMpv();
        }));
    }
}

export default new MpvManager();
