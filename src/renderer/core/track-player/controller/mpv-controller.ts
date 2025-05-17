// src/renderer/core/track-player/controller/mpv-controller.ts
import { IAudioController } from "@/types/audio-controller";
import { ErrorReason as PlayerErrorReason } from "@renderer/core/track-player/enum"; // CurrentTime 已移除
import { PlayerState } from "@/common/constant";
import ControllerBase from "./controller-base";
import logger from "@shared/logger/renderer";
import AppConfig from "@shared/app-config/renderer";
// import { toast } from "react-toastify"; // 已移除

export default class MpvController extends ControllerBase implements IAudioController {
    private _playerState: PlayerState = PlayerState.None;
    public musicItem: IMusic.IMusicItem | null = null;
    private currentUrl: string | null = null;
    private internalVolume: number = Number(AppConfig.getConfig("private.lastVolume" as any)) || 1;
    private internalSpeed: number = Number(AppConfig.getConfig("private.lastSpeed" as any)) || 1;
    public isMpvInitialized = false;
    private lastReportedDuration: number = Infinity;
    private initializationPromise: Promise<void> | null = null;

    public readyPromise: Promise<void>;
    private readyResolve!: () => void;
    private readyReject!: (reason?: any) => void;
    private isReadyPromiseSettled = false;

    private lastReceivedTime: number = 0;

    get playerState() {
        return this._playerState;
    }
    set playerState(value: PlayerState) {
        if (this._playerState !== value) {
            const oldState = this._playerState;
            this._playerState = value;
            this.onPlayerStateChanged?.(value);
            if (value === PlayerState.Playing) {
                navigator.mediaSession.playbackState = "playing";
            } else if (value === PlayerState.Paused || value === PlayerState.None) {
                navigator.mediaSession.playbackState = "paused";
            }
            logger.logInfo(`MpvController: PlayerState changed from ${PlayerState[oldState]} to ${PlayerState[value]}`);
        }
    }

    get hasSource(): boolean {
        return !!this.currentUrl;
    }

    constructor() {
        super();
        this.readyPromise = new Promise((resolve, reject) => {
            this.readyResolve = () => { if (!this.isReadyPromiseSettled) { this.isReadyPromiseSettled = true; resolve(); } };
            this.readyReject = (reason) => { if (!this.isReadyPromiseSettled) { this.isReadyPromiseSettled = true; reject(reason); } };
        });
        this.setupEventListeners();
        this.initialize();

        window.electron.mpvPlayerListener.onVolumeChange((data: { volume: number }) => {
            logger.logInfo("MpvController: Received mpv-volumechange.", data.volume);
            this.onVolumeChange?.(data.volume);
          });
    }

    public async initialize(): Promise<void> {
         if (AppConfig.getConfig("playMusic.backend") !== "mpv") {
            const error = new Error("MPV backend not selected.");
            if(!this.isReadyPromiseSettled) this.readyReject(error);
            this.isMpvInitialized = false;
            return Promise.resolve();
        }
        if (this.isMpvInitialized) {
             logger.logInfo("MpvController: Already successfully initialized.");
             if(!this.isReadyPromiseSettled) this.readyResolve();
             return Promise.resolve();
        }
        if (this.initializationPromise) {
            logger.logInfo("MpvController: Initialization already in progress.");
            return this.initializationPromise;
        }

        if (!AppConfig.getConfig("playMusic.mpvPath")) {
            const errorMsg = "MPV 播放器路径未设置，请在 设置->播放 中配置。";
            logger.logError(errorMsg, new Error(errorMsg));
            this.isMpvInitialized = false;
            this.playerState = PlayerState.None;
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(errorMsg));
            if(!this.isReadyPromiseSettled) this.readyReject(new Error(errorMsg));
            return Promise.reject(new Error(errorMsg));
        }
        
        logger.logInfo("MpvController: Starting initialization...");
        this.isMpvInitialized = false;
        this.isReadyPromiseSettled = false;
        this.readyPromise = new Promise((resolve, reject) => {
            this.readyResolve = () => { if (!this.isReadyPromiseSettled) { this.isReadyPromiseSettled = true; resolve(); } };
            this.readyReject = (reason) => { if (!this.isReadyPromiseSettled) { this.isReadyPromiseSettled = true; reject(reason); } };
        });


        this.initializationPromise = new Promise(async (resolve, reject) => {
            let successTimeout: NodeJS.Timeout | null = null;
            let resolvedOrRejected = false;

            const successHandler = async () => {
                if (resolvedOrRejected) return;
                resolvedOrRejected = true;
                if(successTimeout) clearTimeout(successTimeout);
                this.isMpvInitialized = true;
                logger.logInfo("MPV Controller: Initialized successfully (event).");
                try {
                    await this.applyInitialSettings();
                    this.readyResolve();
                    resolve();
                } catch (err) {
                    this.isMpvInitialized = false;
                    this.readyReject(err);
                    reject(err);
                } finally {
                    cleanup();
                }
            };
            const failHandler = (errorMsgFromMain?: string) => {
                if (resolvedOrRejected) return;
                resolvedOrRejected = true;
                if(successTimeout) clearTimeout(successTimeout);
                this.isMpvInitialized = false;
                const displayError = errorMsgFromMain || "MPV 初始化失败，请检查路径或尝试重启应用。";
                logger.logError("MpvController: Initialization failed (event)", new Error(displayError));
                this.playerState = PlayerState.None;
                this.onError?.(PlayerErrorReason.EmptyResource, new Error(displayError));
                cleanup();
                this.readyReject(new Error(displayError));
                reject(new Error(displayError));
            };
            const cleanup = () => {
                window.electron.mpvPlayerListener.removeAllMpvListeners("mpv-init-success");
                window.electron.mpvPlayerListener.removeAllMpvListeners("mpv-init-failed");
            };

            window.electron.mpvPlayerListener.onInitSuccess(successHandler);
            window.electron.mpvPlayerListener.onInitFailed(failHandler); // errorMsg is now typed as string | undefined

            const timeoutDuration = 15000;
            successTimeout = setTimeout(() => {
                if (!resolvedOrRejected) {
                     failHandler("MPV 初始化超时。");
                }
            }, timeoutDuration);

            try {
                const mainProcessCmdSuccess = await window.electron.mpvPlayer.initialize();
                if (!mainProcessCmdSuccess && !resolvedOrRejected) { // If main process reports failure directly
                    failHandler("MPV 主进程初始化命令返回失败或未执行。");
                }
                // Otherwise, wait for onInitSuccess or onInitFailed event
            } catch (e: any) {
                if (!resolvedOrRejected) {
                    failHandler(`MpvController: Invoking initialize IPC error: ${e.message}`);
                }
            }
        });

        try {
            await this.initializationPromise;
        } catch (e) {
            // Errors are handled by failHandler, this catch is for the promise rejection itself
            logger.logError("MpvController: this.initializationPromise was rejected during initialize()", e);
            this.isMpvInitialized = false; // Ensure state is correct
        } finally {
            this.initializationPromise = null; // Allow new initialization attempts
        }
        return this.readyPromise; // Return the readyPromise for awaiters
    }

    // 确保这里的返回类型是 Promise<void>
    public async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): Promise<void> {
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) {
            this.onError?.(PlayerErrorReason.EmptyResource, new Error("MPV未初始化 (setTrackSource)"));
            this.playerState = PlayerState.None;
            return; // async 函数隐式返回 Promise.resolve(undefined)
        }
        this.musicItem = { ...musicItem };
        this.currentUrl = trackSource.url;
        if (!this.currentUrl) {
            this.onError?.(PlayerErrorReason.EmptyResource, new Error("Track source URL is empty."));
            this.playerState = PlayerState.None;
            return;
        }
        logger.logInfo("MPV Controller: Loading track via IPC - ", this.currentUrl);
        this.playerState = PlayerState.Buffering;
        try {
            await window.electron.mpvPlayer.load(this.currentUrl, this.musicItem);
            // 'started' 事件应该处理后续的状态转换
        } catch (e: any) {
            logger.logError("MPV Controller: Error loading track via IPC", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`加载失败: ${e.message}`));
            this.playerState = PlayerState.None;
        }
    }

    private async applyInitialSettings() {
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) return;
        try {
            if (this.internalVolume !== 1) { // Apply only if not default
                await window.electron.mpvPlayer.setVolume(this.internalVolume);
            }
            if (this.internalSpeed !== 1) { // Apply only if not default
                await window.electron.mpvPlayer.setSpeed(this.internalSpeed);
            }
            logger.logInfo("MpvController: Initial MPV settings applied.");
        } catch (e) {
            logger.logError("MpvController: Error applying initial settings", e);
        }
    }


    private setupEventListeners() {
        window.electron.mpvPlayerListener.removeAllMpvListeners(); // Good practice to clear before re-registering

        interface MpvTimePositionEvent {
            time: number;
            duration: number | null; // Duration can be null
        }

        window.electron.mpvPlayerListener.onTimePosition((data: MpvTimePositionEvent) => {
            this.lastReceivedTime = data.time; // For debugging Bug 1
            logger.logInfo(`MpvController: onTimePosition - time: ${data.time}, duration: ${data.duration}`);
            
            // Update lastReportedDuration if a valid new duration is received
            if (data.duration !== null && data.duration > 0 && isFinite(data.duration)) {
                if (this.lastReportedDuration !== data.duration) {
                     this.lastReportedDuration = data.duration;
                }
            } else if (data.duration === null && this.lastReportedDuration !== Infinity) {
                // If MPV reports null duration (e.g. for streams), reflect that
                this.lastReportedDuration = Infinity;
            }
            // If data.time is null/undefined, default to 0.
            // Use the most recently known valid duration.
            this.onProgressUpdate?.({ currentTime: data.time ?? 0, duration: this.lastReportedDuration });
        });

        window.electron.mpvPlayerListener.onPaused((data) => { // data has { state: PlayerState }
            logger.logInfo("MpvController: Received mpv-paused.");
            this.playerState = PlayerState.Paused; // Directly use Paused state
        });

        window.electron.mpvPlayerListener.onResumed((data) => { // data has { state: PlayerState }
            logger.logInfo("MpvController: Received mpv-resumed.");
            this.playerState = PlayerState.Playing; // Directly use Playing state
        });

        window.electron.mpvPlayerListener.onPlaybackEnded((data: { reason: string }) => {
            logger.logInfo(`MpvController: Received mpv-playback-ended, reason: ${data.reason}`);
            if (data.reason === "eof") {
                 this.playerState = PlayerState.None; // Ensure state is None
                 this.onEnded?.();
            } else {
                // Handle other reasons if necessary, e.g. 'stop' might also mean calling onEnded or just setting state
                // For now, 'eof' is the primary trigger for onEnded()
            }
        });
        
        window.electron.mpvPlayerListener.onStopped((data) => { // data has { state: PlayerState }
            logger.logInfo("MpvController: Received mpv-stopped.");
            // This event implies MPV itself stopped, not necessarily end of file.
            // If it's not PlayerState.None already (e.g. from playback-ended), set it.
            if (this.playerState !== PlayerState.None) {
                this.playerState = PlayerState.None;
            }
        });

        window.electron.mpvPlayerListener.onStarted(() => { // data param might not be needed if state is set by resume
            logger.logInfo("MpvController: Received mpv-started.");
            // Fetch initial duration when a track starts
            if (this.isMpvInitialized && window.electron?.mpvPlayer) {
                window.electron.mpvPlayer.getDuration().then(duration => {
                    this.lastReportedDuration = (duration != null && duration > 0 && isFinite(duration)) ? duration : Infinity;
                    this.onProgressUpdate?.({ currentTime: 0, duration: this.lastReportedDuration });
                }).catch(err => {
                    logger.logError("MpvController: Error getting duration on onStarted", err);
                    this.lastReportedDuration = Infinity;
                    this.onProgressUpdate?.({ currentTime: 0, duration: Infinity });
                });
            }
            // Assume playback is starting or resuming
            if (this.playerState !== PlayerState.Playing && this.playerState !== PlayerState.Buffering) {
                this.playerState = PlayerState.Playing; // Or Buffering if appropriate, but Playing is common on start
            }
        });

        window.electron.mpvPlayerListener.onError((errorMsg: string) => {
            logger.logError("MpvController: Received mpv-error: " + errorMsg, new Error(errorMsg));
            this.playerState = PlayerState.None; // Typically, an error means playback stops
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(errorMsg));
        });

        // +++ Add these listeners +++
        window.electron.mpvPlayerListener.onVolumeChange((data: { volume: number }) => {
            logger.logInfo(`MpvController: Received mpv-volumechange IPC, new volume (0-1): ${data.volume}`);
            this.internalVolume = data.volume; // Store 0-1
            this.onVolumeChange?.(data.volume); // Notify TrackPlayer with 0-1
        });

        window.electron.mpvPlayerListener.onSpeedChange((data: { speed: number }) => {
            logger.logInfo(`MpvController: Received mpv-speedchange IPC, new speed: ${data.speed}`);
            this.internalSpeed = data.speed;
            this.onSpeedChange?.(data.speed);
        });
        // +++ End of additions +++

        window.electron.mpvPlayerListener.onInitFailed((errorMsg?: string) => {
            logger.logError("MpvController: Received mpv-init-failed.", new Error(errorMsg || "Unknown init error"));
            this.isMpvInitialized = false;
            this.playerState = PlayerState.None;
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(errorMsg || "MPV 初始化失败。"));
            if (!this.isReadyPromiseSettled) this.readyReject(new Error(errorMsg || "MPV init failed from event"));
        });

        window.electron.mpvPlayerListener.onInitSuccess(async () => {
            logger.logInfo("MpvController: Received mpv-init-success.");
            this.isMpvInitialized = true;
            await this.applyInitialSettings();
            if (!this.isReadyPromiseSettled) this.readyResolve();
        });
    }

    async play() {
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) {
            this.onError?.(PlayerErrorReason.EmptyResource, new Error("MPV未就绪 (play)"));
            this.playerState = PlayerState.None;
            return;
        }
        if (!this.hasSource) {
             this.onError?.(PlayerErrorReason.EmptyResource, new Error("无音源可播 (play)"));
             this.playerState = PlayerState.None;
            return;
        }
        logger.logInfo(`MPV Controller: Play command for ${this.currentUrl || 'unknown source'}`);
        try {
            // More robust: Tell MPV to unpause. If it's already playing, this is a NOP.
            // If it's stopped, this might not work as expected, `load` then `play` is better for new tracks.
            await window.electron.mpvPlayer.setProperty("pause", false);
            // This will trigger an onResumed or status change if MPV was paused.
        } catch (e: any) {
            logger.logError("MPV Controller: Error in play (setProperty pause false) logic", e as Error);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`播放命令失败: ${e.message}`));
        }
    }

    async pause() {
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) return;
        logger.logInfo("MPV Controller: Pause command");
        try {
            await window.electron.mpvPlayer.setProperty("pause", true);
            // This will trigger an onPaused or status change.
        } catch (e: any) {
            logger.logError("MPV Controller: Error pausing (setProperty pause true)", e as Error);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`暂停命令失败: ${e.message}`));
        }
    }

    async resume() {
        await this.play(); // resume logic is handled by play
    }

    async seekTo(seconds: number) {
        await this.readyPromise;
        if (!this.isMpvInitialized || !this.hasSource || !window.electron?.mpvPlayer) return;
        logger.logInfo("MPV Controller: Seek to - ", seconds);
        try {
            await window.electron.mpvPlayer.seek(seconds); // Default is absolute for node-mpv v2
        } catch (e: any) {
            logger.logError("MPV Controller: Error seeking", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`跳转命令失败: ${e.message}`));
        }
    }

    async setVolume(volume: number) { // volume is 0-1
        this.internalVolume = volume;
        AppConfig.setConfig({"private.lastVolume": volume} as any);
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) {
             logger.logError("MpvController: SetVolume - MPV not initialized or mpvPlayer API not available.", new Error("MPV not initialized or mpvPlayer API not available."));
             // Consider if an error should be thrown or reported here too
             return;
        }

        logger.logInfo("MPV Controller: Sending setVolume to main with value (0-1): ", volume);
        try {
            // Preload 'mpvPlayer.setVolume' expects 0-1, main process 'mpv-set-volume' handler will convert to 0-100
            await window.electron.mpvPlayer.setVolume(volume);
        } catch (e: any) {
            logger.logError("MpvController: Error setting volume via IPC", e as Error);
            // 这会触发 TrackPlayer 的 onError，然后可能导致跳歌
            // 考虑是否需要更特定的错误处理，而不是通用的播放错误
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`音量设置失败(IPC): ${e.message}`));
        }
    }

    async setSpeed(speed: number) {
        this.internalSpeed = speed;
        AppConfig.setConfig({"private.lastSpeed": speed} as any);
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) return;
        logger.logInfo("MPV Controller: Set speed to - ", speed);
        try {
            await window.electron.mpvPlayer.setSpeed(speed);
        } catch (e: any) {
            logger.logError("MPV Controller: Error setting speed", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`倍速设置失败: ${e.message}`));
        }
    }

    async reset() {
        logger.logInfo("MPV Controller: Reset");
        this.currentUrl = null;
        this.musicItem = null;
        this.playerState = PlayerState.None;
        this.lastReportedDuration = Infinity;
        this.onProgressUpdate?.({ currentTime: 0, duration: Infinity });
        try {
            if (this.isMpvInitialized && window.electron?.mpvPlayer) {
                await window.electron.mpvPlayer.stop();
            }
        } catch (e: any) {
            logger.logError("MPV Controller: Error stopping on reset", e);
        }
        if (navigator.mediaSession) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = "none";
        }
    }

    async destroy() {
        logger.logInfo("MPV Controller: Destroying instance...");
        await this.reset();
        if (window.electron?.mpvPlayerListener) {
            window.electron.mpvPlayerListener.removeAllMpvListeners();
        }
        try {
            if (this.isMpvInitialized && window.electron?.mpvPlayer) {
                await window.electron.mpvPlayer.quit();
                logger.logInfo("MPV Controller: MPV process quit command sent.");
            }
        } catch (e: unknown) { // Explicitly type e as unknown
            logger.logError("Error quitting MPV on destroy", e instanceof Error ? e : new Error(String(e)));
        }
        this.isMpvInitialized = false;
        this.isReadyPromiseSettled = false;
        this.readyPromise = new Promise((resolve, reject) => {
            this.readyResolve = () => { if (!this.isReadyPromiseSettled) { this.isReadyPromiseSettled = true; resolve(); } };
            this.readyReject = (reason) => { if (!this.isReadyPromiseSettled) { this.isReadyPromiseSettled = true; reject(reason); } };
        });
    }

    async setLoop(isLoop: boolean): Promise<void> {
        logger.logInfo(`MPV Controller: setLoop called with ${isLoop}.`);
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) return;

        const loopValue = isLoop ? "inf" : "no";
        try {
            await window.electron.mpvPlayer.setProperty("loop-file", loopValue);
            logger.logInfo(`MPV loop-file set to ${loopValue}`);
        } catch (e: any) {
            logger.logError("MPV Controller: Error setting loop-file property", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`设置循环失败: ${e.message}`));
        }
    }

    async setSinkId(_deviceId: string): Promise<void> {
        logger.logInfo(`MPV Controller: setSinkId called. This should be configured via MPV's '--audio-device' or 'audio-device' property.`);
        return Promise.resolve();
    }
}