// src/main/mpv-manager.ts
import NodeMpvPlayer from "node-mpv";
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
    private lastKnownDuration: number | null = null;
    private lastKnownPlayerState: PlayerState = PlayerState.None;
    private retryTimeout: NodeJS.Timeout | null = null;
    private readonly MAX_RETRIES = 3;
    private retryCount = 0;
    private volatileIsQuitting = false;
    private isMpvProcessStarted = false;
    private isIpcResponsive = false;
    private arePropertiesObserved = false;
    private isMpvReadyForPolling = false;

    private timeUpdateInterval: NodeJS.Timeout | null = null;
    private timeUpdateErrorCount = 0;
    private readonly MAX_TIME_UPDATE_ERRORS = 8;

    private lastKnownEofReached: boolean = false;

    constructor() {
        logger.logInfo("MpvManager MAIN: Constructor called.");
        this.handleIPC();
    }

    public setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    private async probeMpv(): Promise<boolean> {
        if (!this.mpv || !this.mpv.isRunning()) {
            logger.logInfo("MpvManager MAIN: ProbeMpv - MPV not running or instance is null.");
            return false;
        }
        try {
            await this.mpv.getProperty('mpv-version');
            logger.logInfo("MpvManager MAIN: ProbeMpv - Success.");
            this.isIpcResponsive = true;
            return true;
        } catch (e) {
            logger.logInfo("MpvManager MAIN: ProbeMpv - Failed.", e);
            this.isIpcResponsive = false;
            return false;
        }
    }

    public signalTrackLoadedAndPollingSafe() {
        if (this.mpv && this.mpv.isRunning() && this.isIpcResponsive && this.arePropertiesObserved) {
            logger.logInfo("MpvManager MAIN: Received signal that track is loaded, MPV is now considered ready for polling.");
            this.isMpvReadyForPolling = true;
            this.stopTimeUpdateLoop();
            this.startTimeUpdateLoop();
        } else {
            logger.logInfo("MpvManager MAIN: signalTrackLoadedAndPollingSafe called, but MPV not in a state to start polling.", {
                isRunning: this.mpv?.isRunning(),
                isIpcResponsive: this.isIpcResponsive,
                arePropertiesObserved: this.arePropertiesObserved
            });
            this.isMpvReadyForPolling = false;
            this.stopTimeUpdateLoop();
        }
    }


    private startTimeUpdateLoop() {
        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
        this.timeUpdateErrorCount = 0;

        if (!this.isMpvReadyForPolling) {
            logger.logInfo("MpvManager MAIN: startTimeUpdateLoop called, but MPV not ready for polling. Loop not started.");
            return;
        }
        logger.logInfo("MpvManager MAIN: Attempting to start time update loop.");

        this.timeUpdateInterval = setInterval(async () => {
            if (this.mpv && this.mpv.isRunning() && this.isMpvReadyForPolling && !this.volatileIsQuitting) {
                if (this.timeUpdateErrorCount >= this.MAX_TIME_UPDATE_ERRORS) {
                    logger.logInfo("MpvManager MAIN: Pausing time updates due to repeated errors. MPV IPC might be unstable.");
                    this.stopTimeUpdateLoop();
                    this.isMpvReadyForPolling = false;
                    this.sendToRenderer("mpv-error", "MPV连接不稳定，暂停时间同步");
                    return;
                }
                try {
                    const time = await this.mpv.getProperty('time-pos');
                    const duration = await this.mpv.getProperty('duration');

                    if (typeof time === 'number' && isFinite(time)) {
                        this.lastKnownTime = time;
                    }
                    if (duration !== null && typeof duration === 'number' && duration > 0 && isFinite(duration)) {
                        this.lastKnownDuration = duration;
                    } else {
                        this.lastKnownDuration = null;
                    }

                    this.sendToRenderer("mpv-timeposition", {
                        time: this.lastKnownTime,
                        duration: this.lastKnownDuration
                    });
                    this.timeUpdateErrorCount = 0;
                } catch (e) {
                  this.timeUpdateErrorCount++;
                  logger.logInfo(`MpvManager MAIN: Error in timeUpdateLoop getProperty (attempt ${this.timeUpdateErrorCount}/${this.MAX_TIME_UPDATE_ERRORS}): ${(e as Error).message}`, e);
                }
            } else {
                logger.logInfo("MpvManager MAIN: Stopping timeUpdateLoop as MPV is not ready/running or polling flag is false.");
                this.stopTimeUpdateLoop();
            }
        }, 1000);
        logger.logInfo("MpvManager MAIN: Time update loop has been set up.");
    }


    private stopTimeUpdateLoop() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
            logger.logInfo("MpvManager MAIN: Time update loop stopped.");
        }
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

        return {
            binary: binaryPath || undefined,
            socket: socketName,
            debug: !app.isPackaged,
            verbose: !app.isPackaged,
            audio_only: true,
            additionalArgs: argsArray.filter(arg => arg.trim() !== "" && !arg.startsWith('--input-ipc-server'))
        };
    }

    private async observeProperties(): Promise<boolean> {
        if (!this.mpv) {
            logger.logInfo("MpvManager MAIN: observeProperties called but mpv is null.");
            return false;
        }
        try {
            await this.mpv.observeProperty('pause');
            await this.mpv.observeProperty('volume');
            await this.mpv.observeProperty('speed');
            await this.mpv.observeProperty('eof-reached'); // 监听这个属性来更可靠地检测播放结束
            logger.logInfo("MpvManager MAIN: Essential MPV properties observed.");
            this.arePropertiesObserved = true;
            return true;
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.logError("MpvManager MAIN: Failed to observe MPV properties:", err);
            this.arePropertiesObserved = false;
            return false;
        }
    }

    public async initializeMpv(isManualTrigger = false): Promise<boolean> {
        this.volatileIsQuitting = false;
        logger.logInfo(`MpvManager MAIN: initializeMpv START. Manual: ${isManualTrigger}, MPV obj: ${this.mpv ? 'exists' : 'null'}, PollingReady: ${this.isMpvReadyForPolling}`);

        if (this.mpv) {
             logger.logInfo("MpvManager MAIN: Existing MPV instance found. Quitting it.");
             await this.quitMpv(); // Ensure quitMpv correctly resets flags
        }
        // Reset all state flags before starting a new instance
        this.volatileIsQuitting = false;
        this.isMpvProcessStarted = false;
        this.isIpcResponsive = false;
        this.arePropertiesObserved = false;
        this.isMpvReadyForPolling = false;
        this.stopTimeUpdateLoop(); // Stop any existing loops

        logger.logInfo("MpvManager MAIN: Proceeding with new MPV initialization.");

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
            // Only fail if MPV is the selected backend and path is not set
            const errorMsg = "MPV 播放器路径未设置.";
            logger.logError(`MpvManager MAIN: ${errorMsg}`, new Error(errorMsg));
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }


        try {
            this.mpv = new NodeMpvPlayer(mpvOptions, mpvOptions.additionalArgs);
            logger.logInfo("MpvManager MAIN: NodeMpvPlayer instance created.");
        } catch (instantiationError: any) {
            const error = instantiationError instanceof Error ? instantiationError : new Error(String(instantiationError));
            const errorMsg = `MPV 实例化错误: ${error.message}.`;
            logger.logError("MpvManager MAIN: Critical error during MPV instantiation:", error);
            this.mpv = null; // Ensure mpv is null on failure
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }

        this.setupMpvEventHandlers();

        try {
            await this.mpv.start();
            this.isMpvProcessStarted = true;
            logger.logInfo("MpvManager MAIN: MPV process mpv.start() command completed.");

            if (!await this.probeMpv()) {
                throw new Error("MPV started but IPC is not responsive after start.");
            }
            logger.logInfo("MpvManager MAIN: MPV IPC is responsive after start.");

            if (!await this.observeProperties()) {
                throw new Error("Failed to observe essential MPV properties after start.");
            }

            this.retryCount = 0;
            this.sendToRenderer("mpv-init-success");
            logger.logInfo("MpvManager MAIN: MPV basic initialization successful. Waiting for track load to enable polling.");
            return true;
        } catch (startOrSetupError: any) {
            const error = startOrSetupError instanceof Error ? startOrSetupError : new Error(String(startOrSetupError));
            const errorMsg = `MPV 启动或设置失败: ${error.message}.`;
            logger.logError("MpvManager MAIN: Critical error during MPV start or setup:", error);

            const tempMpv = this.mpv; // Store current mpv instance to quit it
            this.mpv = null; // Nullify the instance first
            this.isMpvProcessStarted = false; this.isIpcResponsive = false; this.arePropertiesObserved = false; this.isMpvReadyForPolling = false;
            this.stopTimeUpdateLoop(); // Ensure loop is stopped
            if (tempMpv) try { await tempMpv.quit(); } catch (qErr) { logger.logError("MpvManager MAIN: Error quitting MPV after failed start/setup", qErr); }
            this.sendToRenderer("mpv-init-failed", errorMsg);
            return false;
        }
    }

    public async quitMpv() {
        if (this.volatileIsQuitting && !this.mpv) { // Already quitting or no instance
            logger.logInfo("MpvManager MAIN: quitMpv called but already quitting or no instance.");
            return;
        }
        logger.logInfo("MpvManager MAIN: quitMpv called.");
        this.volatileIsQuitting = true; // Set flag immediately
        this.stopTimeUpdateLoop();

        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        this.retryTimeout = null;

        const mpvInstanceToQuit = this.mpv;
        this.mpv = null; // Nullify the reference
        // Reset all state flags
        this.isMpvProcessStarted = false;
        this.isIpcResponsive = false;
        this.arePropertiesObserved = false;
        this.isMpvReadyForPolling = false;

        this.lastKnownPlayerState = PlayerState.None;
        this.currentTrack = null;
        this.lastKnownTime = 0;
        this.lastKnownDuration = null;
        this.lastKnownEofReached = false;


        if (mpvInstanceToQuit) {
            try {
                mpvInstanceToQuit.removeAllListeners(); // Clean up listeners
                await mpvInstanceToQuit.quit();
                logger.logInfo("MpvManager MAIN: MPV quit command completed.");
            } catch (error: any) {
                logger.logError("MpvManager MAIN: Error during MPV quit command", error);
            }
        } else {
            logger.logInfo("MpvManager MAIN: quitMpv called but no MPV instance to quit.");
        }
        // Do not reset volatileIsQuitting here, it's reset at the start of initializeMpv
    }

    private setupMpvEventHandlers() {
        if (!this.mpv) return;
        this.mpv.removeAllListeners(); // Clear existing listeners before adding new ones

        this.mpv.on("started", () => {
            if (this.volatileIsQuitting || !this.mpv) return;
            logger.logInfo("MpvManager MAIN: MPV event 'started' (new file loaded/playing).");
            this.lastKnownEofReached = false;
            this.lastKnownTime = 0;
            this.lastKnownDuration = null;

            this.signalTrackLoadedAndPollingSafe();

            if (this.mpv && this.isMpvReadyForPolling) {
                this.mpv.getProperty("duration").then(duration => {
                    if (this.volatileIsQuitting || !this.mpv) return;
                    this.lastKnownDuration = (typeof duration === 'number' && duration > 0 && isFinite(duration)) ? duration : null;
                    this.sendToRenderer("mpv-timeposition", { time: 0, duration: this.lastKnownDuration });
                }).catch(err => {
                    logger.logError("MpvManager MAIN: Error getting duration on 'started' event", err);
                });
            }
             if (this.lastKnownPlayerState !== PlayerState.Playing) {
                 this.lastKnownPlayerState = PlayerState.Playing;
                 this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing }); // Send resumed as playback has (re)started
             }
        });

        this.mpv.on("status", (status: any) => {
            if (this.volatileIsQuitting || !this.mpv || !this.isMpvReadyForPolling) return;
            if (!status || typeof status.property !== 'string') return;
            const { property: propertyName, value } = status;

            if (propertyName === 'pause' && typeof value === 'boolean') {
                 const newState = value ? PlayerState.Paused : PlayerState.Playing;
                 if (this.lastKnownPlayerState !== newState) {
                    this.lastKnownPlayerState = newState;
                    this.sendToRenderer(value ? "mpv-paused" : "mpv-resumed", { state: newState });
                 }
            } else if (propertyName === 'volume' && typeof value === 'number') {
                const newVolume = Math.max(0, Math.min(1, value / 100)); // Assuming MPV volume is 0-100
                this.sendToRenderer("mpv-volumechange", { volume: newVolume });
            } else if ((propertyName === 'speed' || propertyName === 'playback-speed') && typeof value === 'number') {
                this.sendToRenderer("mpv-speedchange", { speed: value });
            } else if (propertyName === 'eof-reached') {
                const newEofState = !!value; // Convert to boolean
                if (this.lastKnownEofReached !== newEofState) {
                    this.lastKnownEofReached = newEofState;
                    logger.logInfo(`MpvManager MAIN: eof-reached changed to ${this.lastKnownEofReached}`);
                    if (this.lastKnownEofReached) {
                        // This is a more reliable end-of-file indicator
                        this.sendToRenderer("mpv-playback-ended", { reason: "eof" });
                        this.lastKnownPlayerState = PlayerState.None;
                        this.currentTrack = null;
                        this.lastKnownTime = 0;
                        this.lastKnownDuration = null;
                        this.isMpvReadyForPolling = false; // Stop polling after EOF
                        this.stopTimeUpdateLoop();
                    }
                }
            }
        });

        this.mpv.on("paused", () => {
            if (this.volatileIsQuitting || !this.mpv || !this.isMpvReadyForPolling) return;
            if (this.lastKnownPlayerState !== PlayerState.Paused) {
                this.lastKnownPlayerState = PlayerState.Paused;
                this.sendToRenderer("mpv-paused", { state: PlayerState.Paused });
            }
        });

        this.mpv.on("resumed", () => {
            if (this.volatileIsQuitting || !this.mpv || !this.isMpvReadyForPolling) return;
            if (this.lastKnownPlayerState !== PlayerState.Playing) {
                this.lastKnownPlayerState = PlayerState.Playing;
                this.sendToRenderer("mpv-resumed", { state: PlayerState.Playing });
            }
        });

        this.mpv.on("playback-finished", (eventData: { reason: string }) => {
            if (this.volatileIsQuitting || !this.mpv || !this.isMpvReadyForPolling) {
                logger.logInfo("MpvManager MAIN: MPV 'playback-finished' ignored (volatileIsQuitting or not ready).");
                return;
            }
            logger.logInfo(`MpvManager MAIN: MPV event 'playback-finished' (reason: ${eventData.reason}).`);
            // 'playback-finished' from node-mpv is usually due to 'end-file' event from MPV.
            // We rely on 'eof-reached' property change for a more robust EOF detection.
            // However, if we get this and eof-reached wasn't true, it might be a stop or error.
            if (eventData.reason === 'eof') {
                // This confirms EOF, though eof-reached property should also cover it.
                if (!this.lastKnownEofReached) { // If eof-reached hadn't been set yet
                    this.lastKnownEofReached = true;
                    this.sendToRenderer("mpv-playback-ended", { reason: "eof" });
                    this.lastKnownPlayerState = PlayerState.None;
                    this.currentTrack = null;
                    this.lastKnownTime = 0;
                    this.lastKnownDuration = null;
                    this.isMpvReadyForPolling = false;
                    this.stopTimeUpdateLoop();
                }
            } else {
                // For other reasons like 'stop' or 'error', treat as a general stop.
                logger.logInfo(`MpvManager MAIN: 'playback-finished' with non-EOF reason '${eventData.reason}'. Treating as stop.`);
                if (this.lastKnownPlayerState !== PlayerState.None) {
                    this.lastKnownPlayerState = PlayerState.None;
                    this.sendToRenderer("mpv-stopped", { state: PlayerState.None, reason: eventData.reason });
                }
                 // Reset relevant state as playback has effectively stopped
                this.currentTrack = null;
                this.lastKnownTime = 0;
                this.lastKnownDuration = null;
                this.isMpvReadyForPolling = false;
                this.stopTimeUpdateLoop();
            }
        });


        this.mpv.on("stopped", async (data?: { reason?: string, error?: string | number }) => {
            if (this.volatileIsQuitting || !this.mpv ) return;
            logger.logInfo("MpvManager MAIN: MPV direct event 'stopped'.", data);

            if (this.lastKnownEofReached) {
                logger.logInfo("MpvManager MAIN: 'stopped' event received after EOF. Ensuring state is None.");
            } else {
                logger.logInfo("MpvManager MAIN: 'stopped' event received, EOF not handled. Player stopped or errored.");
            }
            // Always ensure state is None on a 'stopped' event unless it was a clean EOF handled by 'eof-reached'
            if (this.lastKnownPlayerState !== PlayerState.None) {
                this.lastKnownPlayerState = PlayerState.None;
                if (!this.lastKnownEofReached) { // Only send 'mpv-stopped' if not already handled by 'eof-reached'
                    this.sendToRenderer("mpv-stopped", { state: PlayerState.None, reason: data?.reason || "stopped_event" });
                }
            }
            this.currentTrack = null;
            this.lastKnownTime = 0;
            this.lastKnownDuration = null;
            this.isMpvReadyForPolling = false;
            this.stopTimeUpdateLoop();
        });


        this.mpv.on("error", (error: any) => {
            if (this.volatileIsQuitting || !this.mpv) return;
            const err = error instanceof Error ? error : new Error(String(error));
            logger.logError("MpvManager MAIN: MPV 'error' event:", err);
            this.sendToRenderer("mpv-error", `MPV internal error: ${err.message}`);
            this.lastKnownPlayerState = PlayerState.None; // Assume error means playback stopped
            this.isMpvReadyForPolling = false; // Stop polling on error
            this.stopTimeUpdateLoop();
        });

        this.mpv.on("crashed", async () => {
            if (this.volatileIsQuitting || !this.mpv) { // Added !this.mpv check
                logger.logInfo("MpvManager MAIN: MPV 'crashed' ignored (volatileIsQuitting or mpv is null).");
                return;
            }
            const crashMsg = `MPV 播放器意外退出。正在尝试重启...`;
            logger.logError(`MpvManager MAIN: ${crashMsg}`, new Error(`MPV Crashed`));
            this.sendToRenderer("mpv-error", crashMsg);

            const oldMpv = this.mpv; // Keep a reference to the crashed instance
            this.mpv = null; // Nullify the main instance variable
            // Reset all state flags
            this.isMpvProcessStarted = false; this.isIpcResponsive = false; this.arePropertiesObserved = false; this.isMpvReadyForPolling = false;
            this.stopTimeUpdateLoop(); // Stop polling
            if (oldMpv) oldMpv.removeAllListeners(); // Remove listeners from the crashed instance

            if (this.retryCount < this.MAX_RETRIES) {
              this.retryCount++; if(this.retryTimeout) clearTimeout(this.retryTimeout);
              this.retryTimeout = setTimeout(async (): Promise<void> => {
                  if (this.volatileIsQuitting) return; // Check again before retrying
                  logger.logInfo(`MpvManager MAIN: Retrying MPV init (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
                  const success = await this.initializeMpv(true); // Re-initialize
                  if (success && this.currentTrack && this.mpv) { // Check this.mpv after re-init
                    logger.logInfo(`MpvManager MAIN: MPV re-initialized after crash. Informing renderer to restore track: ${this.currentTrack.title}`);
                    this.sendToRenderer("mpv-reinitialized-after-crash", {
                        track: this.currentTrack,
                        time: this.lastKnownTime,
                        wasPlaying: this.lastKnownPlayerState === PlayerState.Playing
                    });
                  } else if (!success) {
                    logger.logError("MpvManager MAIN: Failed to re-initialize MPV after crash.", new Error("MPV re-initialization failed"));
                      // Potentially send a more permanent failure message to renderer
                  }
              }, 2000 * this.retryCount);
            } else {
                logger.logError("MpvManager MAIN: Failed to re-initialize MPV after crash.", new Error("MPV re-initialization failed"));
              this.sendToRenderer("mpv-init-failed", "MPV多次崩溃后无法恢复，请检查MPV安装或配置。");
            }
        });
    }

    private async load(filePath: string, track: IMusic.IMusicItem, mode: 'replace' | 'append' | 'append-play' = 'replace') {
        if (this.volatileIsQuitting) { logger.logInfo("MpvManager MAIN: Load called but volatileIsQuitting is true."); return; }
        if (!this.mpv || !this.isMpvProcessStarted || !this.isIpcResponsive || !this.arePropertiesObserved) {
            logger.logInfo("MpvManager MAIN: MPV not fully initialized during load, attempting to initialize first.");
            const success = await this.initializeMpv(true);
            if (this.volatileIsQuitting) { logger.logInfo("MpvManager MAIN: Load aborted after re-init due to volatileIsQuitting."); return; }
            if(!success || !this.mpv || !this.isMpvProcessStarted || !this.isIpcResponsive || !this.arePropertiesObserved) { // Check this.mpv again
                 const errorMsg = "MPV 未能成功初始化，无法加载文件。";
                 this.sendToRenderer("mpv-error", errorMsg);
                 logger.logError(`MpvManager MAIN: ${errorMsg}`, new Error(errorMsg));
                 return;
            }
        }
        try {
            this.currentTrack = track;
            this.lastKnownTime = 0;
            this.lastKnownDuration = null;
            this.lastKnownEofReached = false;
            this.isMpvReadyForPolling = false; // Will be set true by 'started' event handler via signal
            this.stopTimeUpdateLoop();

            await this.mpv.load(filePath, mode);
            logger.logInfo(`MpvManager MAIN: Load command sent for ${filePath}`);
        } catch (error: any) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.logError(`MpvManager MAIN: Error during MPV load for ${filePath}`, err);
            this.sendToRenderer("mpv-error", `加载文件失败: ${err.message}`);
            // Consider how to handle load failures, e.g., reset state or attempt next track
            this.isMpvReadyForPolling = false;
            this.stopTimeUpdateLoop();
        }
    }

    private sendToRenderer(channel: string, data?: any) {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents && !this.mainWindow.webContents.isDestroyed()) {
            try {
                this.mainWindow.webContents.send(channel, data);
            } catch (e) {
                logger.logError(`MpvManager MAIN: Error sending IPC to renderer on channel ${channel}`, e as Error);
            }
        }
    }

    private handleIPC() {
        const makeSafeHandler = (channelName: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>) => {
            return async (event: IpcMainInvokeEvent, ...args: any[]) => {
                if (this.volatileIsQuitting && channelName !== 'mpv-quit') {
                     return Promise.reject(new Error("MPV is shutting down."));
                }
                // 对于非 initialize 和 quit 命令，严格检查 MPV 是否就绪
                if (!['mpv-initialize', 'mpv-quit'].includes(channelName)) {
                    // 移除自动重新初始化逻辑
                    if (!this.mpv || !this.mpv.isRunning() || !this.isIpcResponsive || !this.arePropertiesObserved) {
                        const statusString = `MPV not ready. isRunning=${this.mpv ? this.mpv.isRunning() : 'null'}, isIpcResponsive=${this.isIpcResponsive}, arePropertiesObserved=${this.arePropertiesObserved}`;
                        logger.logInfo(`MpvManager MAIN: IPC call ${channelName} when MPV not fully ready. Rejecting. Status: ${statusString}`);
                        return Promise.reject(new Error(`MPV not ready. ${statusString}`));
                    }

                    if (['mpv-get-duration', 'mpv-get-current-time', 'mpv-play', 'mpv-pause', 'mpv-resume', 'mpv-seek', 'mpv-set-volume', 'mpv-set-speed'].includes(channelName) && !this.isMpvReadyForPolling && channelName !== 'mpv-stop') {
                        // Allow 'mpv-stop' even if not polling ready.
                        // For other polling-dependent commands, if not ready for polling, it might indicate an issue or stale data.
                        // Depending on the command, you might return stale data or reject.
                        // For now, we proceed but log a warning.
                        logger.logInfo(`MpvManager MAIN: IPC call ${channelName} while MPV not ready for polling. Result might be stale or command might not behave as expected.`);
                    }
                }
                try {
                    return await handler(event, ...args);
                } catch (e: any) {
                    logger.logError(`MpvManager MAIN: Error in IPC handler for ${channelName}`, e);
                    throw e; // Re-throw to ensure the promise is rejected for the renderer
                }
            };
        };

        ipcMain.handle("mpv-initialize", makeSafeHandler("mpv-initialize", async () => {
            return await this.initializeMpv(true);
        }));
        ipcMain.handle("mpv-load", makeSafeHandler("mpv-load", async (_event, filePath: string, track: IMusic.IMusicItem) => {
            await this.load(filePath, track);
        }));
        ipcMain.handle("mpv-play", makeSafeHandler("mpv-play", async () => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (play)"));}
            await this.mpv.play();
        }));
        ipcMain.handle("mpv-pause", makeSafeHandler("mpv-pause", async () => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (pause)"));}
            await this.mpv.pause();
        }));
        ipcMain.handle("mpv-resume", makeSafeHandler("mpv-resume", async () => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (resume)"));}
             await this.mpv.resume();
        }));
        ipcMain.handle("mpv-stop", makeSafeHandler("mpv-stop", async () => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (stop)"));}
             await this.mpv.stop();
             // Ensure state is fully reset on explicit stop
             this.currentTrack = null;
             this.lastKnownTime = 0;
             this.lastKnownDuration = null;
             this.lastKnownPlayerState = PlayerState.None;
             this.isMpvReadyForPolling = false;
             this.stopTimeUpdateLoop();
             this.lastKnownEofReached = false; // Reset EOF flag on stop
        }));
        ipcMain.handle("mpv-seek", makeSafeHandler("mpv-seek", async (_event, timeSeconds: number) => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (seek)"));}
            await this.mpv.seek(timeSeconds, "absolute");
            this.lastKnownEofReached = false; // Seeking implies we are no longer at EOF
        }));
        ipcMain.handle("mpv-set-volume", makeSafeHandler("mpv-set-volume", async (_event, volume: number) => { // volume is 0-1 from renderer
            if (!this.mpv) { throw new Error("MPV实例不存在 (setVolume)"); }
            const mpvVol = Math.round(volume * 100); // Convert to 0-100 for mpv
            await this.mpv.volume(mpvVol);
        }));
        ipcMain.handle("mpv-set-speed", makeSafeHandler("mpv-set-speed", async (_event, speed: number) => {
            if (!this.mpv) { return Promise.reject(new Error("MPV实例不存在 (setSpeed)"));}
            await this.mpv.speed(speed);
        }));
        ipcMain.handle("mpv-get-duration", makeSafeHandler("mpv-get-duration", async () => {
            if (!this.mpv || !this.mpv.isRunning() || !this.isMpvReadyForPolling) {
                logger.logInfo("MpvManager MAIN: get-duration returning stale value as MPV not fully ready for polling.");
                return this.lastKnownDuration;
            }
            try {
                const duration = await this.mpv.getDuration();
                this.lastKnownDuration = (duration != null && duration > 0 && isFinite(duration)) ? duration : null;
            } catch (e) {
                logger.logInfo("MpvManager MAIN: Error in get-duration IPC: " + (e as Error).message);
                if (this.lastKnownDuration === undefined) this.lastKnownDuration = null; // Ensure it's null not undefined
            }
            return this.lastKnownDuration;
        }));
        ipcMain.handle("mpv-get-current-time", makeSafeHandler("mpv-get-current-time", async () => {
             if (!this.mpv || !this.mpv.isRunning() || !this.isMpvReadyForPolling) {
                logger.logInfo("MpvManager MAIN: get-current-time returning stale value as MPV not fully ready for polling.");
                return this.lastKnownTime;
             }
             try {
                const time = await this.mpv.getTimePosition();
                this.lastKnownTime = (typeof time === 'number' && isFinite(time)) ? time : this.lastKnownTime;
             } catch(e) {
                logger.logInfo("MpvManager MAIN: Error in get-current-time IPC: " + (e as Error).message);
             }
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

        // Use ipcMain.on for one-way messages from renderer
        ipcMain.on("mpv-signal-track-loaded", (event, ...args) => {
            // Wrap the handler logic if it needs to be async or use makeSafeHandler pattern
            // For a simple synchronous signal, direct handling is fine.
            // However, to keep patterns consistent or if it might become async:
            const handler = async () => {
                logger.logInfo("MpvManager MAIN: Received mpv-signal-track-loaded from renderer.");
                this.signalTrackLoadedAndPollingSafe();
            };
            makeSafeHandler("mpv-signal-track-loaded", handler)(event, ...args)
                .catch(err => logger.logError("Error in mpv-signal-track-loaded handler", err));
        });
    }
}

export default new MpvManager();