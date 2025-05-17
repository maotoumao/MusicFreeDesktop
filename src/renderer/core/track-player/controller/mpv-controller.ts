// src/renderer/core/track-player/controller/mpv-controller.ts
import { IAudioController } from "@/types/audio-controller";
import { ErrorReason as PlayerErrorReason } from "@renderer/core/track-player/enum";
import { PlayerState } from "@/common/constant";
import ControllerBase from "./controller-base";
import logger from "@shared/logger/renderer";
import AppConfig from "@shared/app-config/renderer";

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
    private hasTriggeredOnEnded: boolean = false;

    private trackLoadedAndStartedPromise: Promise<void> | null = null;
    private trackLoadedAndStartedResolve: (() => void) | null = null;


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
            window.electron.mpvPlayerListener.onInitFailed(failHandler);

            const timeoutDuration = 15000;
            successTimeout = setTimeout(() => {
                if (!resolvedOrRejected) {
                     failHandler("MPV 初始化超时。");
                }
            }, timeoutDuration);

            try {
                const mainProcessCmdSuccess = await window.electron.mpvPlayer.initialize();
                if (!mainProcessCmdSuccess && !resolvedOrRejected) {
                    failHandler("MPV 主进程初始化命令返回失败或未执行。");
                }
            } catch (e: any) {
                if (!resolvedOrRejected) {
                    failHandler(`MpvController: Invoking initialize IPC error: ${e.message}`);
                }
            }
        });

        try {
            await this.initializationPromise;
        } catch (e) {
            logger.logError("MpvController: this.initializationPromise was rejected during initialize()", e);
            this.isMpvInitialized = false;
        } finally {
            this.initializationPromise = null;
        }
        return this.readyPromise;
    }

    public async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): Promise<void> {
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) {
            this.onError?.(PlayerErrorReason.EmptyResource, new Error("MPV未初始化 (setTrackSource)"));
            this.playerState = PlayerState.None;
            return;
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
        this.hasTriggeredOnEnded = false;
        this.lastReportedDuration = Infinity;
        this.lastReceivedTime = 0;

        this.trackLoadedAndStartedPromise = new Promise((resolve) => {
            this.trackLoadedAndStartedResolve = resolve;
        });

        try {
            await window.electron.mpvPlayer.load(this.currentUrl, this.musicItem);
        } catch (e: any) {
            logger.logError("MPV Controller: Error during IPC mpvPlayer.load()", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`加载命令失败: ${e.message || String(e)}`));
            this.playerState = PlayerState.None;
            if (this.trackLoadedAndStartedResolve) {
                this.trackLoadedAndStartedResolve();
                this.trackLoadedAndStartedPromise = null;
                this.trackLoadedAndStartedResolve = null;
            }
        }
    }

    private async applyInitialSettings() {
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) return;
        try {
            if (this.internalVolume !== 1) {
                await window.electron.mpvPlayer.setVolume(this.internalVolume);
            }
            if (this.internalSpeed !== 1) {
                await window.electron.mpvPlayer.setSpeed(this.internalSpeed);
            }
            logger.logInfo("MpvController: Initial MPV settings applied.");
        } catch (e) {
            logger.logError("MpvController: Error applying initial settings", e);
        }
    }


    private setupEventListeners() {
        window.electron.mpvPlayerListener.removeAllMpvListeners();

        interface MpvTimePositionEvent {
            time: number;
            duration: number | null;
        }

        window.electron.mpvPlayerListener.onTimePosition((data: MpvTimePositionEvent) => {
            this.lastReceivedTime = data.time ?? 0;

            if (data.duration !== null && data.duration > 0 && isFinite(data.duration)) {
                if (this.lastReportedDuration !== data.duration) {
                     this.lastReportedDuration = data.duration;
                }
            } else if (data.duration === null && this.lastReportedDuration !== Infinity) {
                this.lastReportedDuration = Infinity;
            }
            this.onProgressUpdate?.({ currentTime: this.lastReceivedTime, duration: this.lastReportedDuration });


            if (
                this.lastReportedDuration !== Infinity &&
                this.lastReceivedTime >= this.lastReportedDuration - 0.5 && // 提前0.5秒判断，避免精度问题
                (this.playerState === PlayerState.Playing || this.playerState === PlayerState.Buffering) &&
                !this.hasTriggeredOnEnded
            ) {
                logger.logInfo(`MpvController: Triggering onEnded by progress. Time: ${this.lastReceivedTime}, Duration: ${this.lastReportedDuration}`);
                this.hasTriggeredOnEnded = true;
                this.onEnded?.();
            }
        });

        window.electron.mpvPlayerListener.onPaused((data) => {
            logger.logInfo("MpvController: Received mpv-paused.");
            this.playerState = PlayerState.Paused;
        });

        window.electron.mpvPlayerListener.onResumed((data) => {
            logger.logInfo("MpvController: Received mpv-resumed.");
            this.playerState = PlayerState.Playing;
            this.hasTriggeredOnEnded = false; // 重新播放或跳转后，重置结束标记
        });

        window.electron.mpvPlayerListener.onPlaybackEnded((data: { reason: string }) => {
            logger.logInfo(`MpvController: Received mpv-playback-ended, reason: ${data.reason}`);
            if (this.hasTriggeredOnEnded) {
                logger.logInfo("MpvController: mpv-playback-ended received, but onEnded already triggered. Ignoring.");
                return;
            }
            // 主要依赖 "eof" reason
            if (data.reason === "eof" || data.reason === "eof-idle") {
                 if (this.playerState === PlayerState.Playing || this.playerState === PlayerState.Buffering || this.playerState === PlayerState.Paused) {
                    logger.logInfo(`MpvController: mpv-playback-ended reason "${data.reason}" triggering onEnded.`);
                    this.hasTriggeredOnEnded = true;
                    this.onEnded?.();
                 } else {
                    logger.logInfo(`MpvController: mpv-playback-ended (${data.reason}) received but player was not in an active/paused state. Current state: ${PlayerState[this.playerState]}. Ignoring.`);
                 }
            } else if (data.reason === "stopped-event") {
                logger.logInfo(`MpvController: mpv-playback-ended with reason "stopped-event". This might indicate an issue if EOF was expected. Current player state: ${PlayerState[this.playerState]}`);
                // 如果是 stopped-event，并且状态不是 None (意味着不是用户主动停止或错误停止)，也可能需要触发 onEnded
                // 但要小心，这可能与 mpv-stopped 事件冲突。优先由 'eof' 处理。
                // 为保险起见，如果状态仍然是播放/缓冲/暂停，也触发 onEnded
                if (this.playerState === PlayerState.Playing || this.playerState === PlayerState.Buffering || this.playerState === PlayerState.Paused) {
                    this.hasTriggeredOnEnded = true;
                    this.onEnded?.();
                } else {
                     this.playerState = PlayerState.None;
                }
            }
        });

        window.electron.mpvPlayerListener.onStopped((data) => {
            logger.logInfo("MpvController: Received mpv-stopped event.");
            if (this.hasTriggeredOnEnded) {
                logger.logInfo("MpvController: mpv-stopped received, but onEnded already triggered. Ensuring state is None.");
            } else {
                logger.logInfo("MpvController: mpv-stopped received, onEnded not triggered. This is an explicit stop/error. Setting state to None.");
            }
            if (this.playerState !== PlayerState.None) {
                this.playerState = PlayerState.None;
            }
            if (this.trackLoadedAndStartedResolve) {
                logger.logInfo("MpvController: Resolving trackLoadedAndStartedPromise due to mpv-stopped.");
                this.trackLoadedAndStartedResolve();
                this.trackLoadedAndStartedPromise = null;
                this.trackLoadedAndStartedResolve = null;
            }
        });


        window.electron.mpvPlayerListener.onStarted(() => {
            logger.logInfo("MpvController: Received mpv-started.");
            this.hasTriggeredOnEnded = false;
            this.lastReportedDuration = Infinity;
            this.lastReceivedTime = 0;

            if (this.trackLoadedAndStartedResolve) {
                this.trackLoadedAndStartedResolve();
                this.trackLoadedAndStartedPromise = null;
                this.trackLoadedAndStartedResolve = null;
            }

            if (this.isMpvInitialized && window.electron?.mpvPlayer) {
                window.electron.mpvPlayer.getDuration().then(duration => {
                    const validDuration = (duration != null && duration > 0 && isFinite(duration)) ? duration : null;
                    this.lastReportedDuration = validDuration ?? Infinity;
                    this.onProgressUpdate?.({ currentTime: 0, duration: this.lastReportedDuration });
                }).catch(err => {
                    logger.logError("MpvController: Error getting duration on onStarted", err);
                    this.lastReportedDuration = Infinity;
                    this.onProgressUpdate?.({ currentTime: 0, duration: Infinity });
                });
            }
            if (this.playerState !== PlayerState.Playing && this.playerState !== PlayerState.Buffering) {
                this.playerState = PlayerState.Playing;
            }
        });

        window.electron.mpvPlayerListener.onError((errorMsg: string) => {
            logger.logError("MpvController: Received mpv-error: " + errorMsg, new Error(errorMsg));
            this.playerState = PlayerState.None;
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(errorMsg));
            if (this.trackLoadedAndStartedResolve) {
                this.trackLoadedAndStartedResolve();
                this.trackLoadedAndStartedPromise = null;
                this.trackLoadedAndStartedResolve = null;
            }
        });

        window.electron.mpvPlayerListener.onVolumeChange((data: { volume: number }) => {
            this.internalVolume = data.volume;
            this.onVolumeChange?.(data.volume);
        });

        window.electron.mpvPlayerListener.onSpeedChange((data: { speed: number }) => {
            this.internalSpeed = data.speed;
            this.onSpeedChange?.(data.speed);
        });

        window.electron.mpvPlayerListener.onInitFailed((errorMsg?: string) => {
            logger.logError("MpvController: Received mpv-init-failed.", new Error(errorMsg || "Unknown init error"));
            this.isMpvInitialized = false;
            this.playerState = PlayerState.None;
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(errorMsg || "MPV 初始化失败。"));
            if (!this.isReadyPromiseSettled) this.readyReject(new Error(errorMsg || "MPV init failed from event"));
            if (this.trackLoadedAndStartedResolve) {
                this.trackLoadedAndStartedResolve();
                this.trackLoadedAndStartedPromise = null;
                this.trackLoadedAndStartedResolve = null;
            }
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

        if (this.trackLoadedAndStartedPromise) {
            logger.logInfo("MpvController: Waiting for track to be loaded and started before playing...");
            await this.trackLoadedAndStartedPromise;
        }

        logger.logInfo(`MPV Controller: Play command for ${this.currentUrl || 'unknown source'}`);
        this.hasTriggeredOnEnded = false;
        try {
            if (this.playerState !== PlayerState.Playing) {
                await window.electron.mpvPlayer.play();
            } else {
                logger.logInfo("MpvController: Play called but already in Playing state. Ignoring.");
            }
        } catch (e: any) {
            logger.logError("MPV Controller: Error in play logic", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`播放命令失败: ${e.message || String(e)}`));
        }
    }

    async pause() {
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) return;
        logger.logInfo("MPV Controller: Pause command");
        try {
            await window.electron.mpvPlayer.pause();
        } catch (e: any) {
            logger.logError("MPV Controller: Error pausing", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`暂停命令失败: ${e.message || String(e)}`));
        }
    }

    async resume() {
        await this.play();
    }

    async seekTo(seconds: number) {
        await this.readyPromise;
        if (!this.isMpvInitialized || !this.hasSource || !window.electron?.mpvPlayer) return;
        logger.logInfo("MPV Controller: Seek to - ", seconds);
        this.hasTriggeredOnEnded = false; // Seeking resets the end trigger
        try {
            await window.electron.mpvPlayer.seek(seconds);
        } catch (e: any) {
            logger.logError("MPV Controller: Error seeking", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`跳转命令失败: ${e.message || String(e)}`));
        }
    }

    async setVolume(volume: number) {
        this.internalVolume = volume;
        AppConfig.setConfig({"private.lastVolume": volume} as any);
        await this.readyPromise;
        if (!this.isMpvInitialized || !window.electron?.mpvPlayer) {
             logger.logError("MpvController: SetVolume - MPV not initialized.", new Error("MPV not initialized."));
             return;
        }
        try {
            await window.electron.mpvPlayer.setVolume(volume);
        } catch (e: any) {
            logger.logError("MpvController: Error setting volume via IPC", e);
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`音量设置失败(IPC): ${e.message || String(e)}`));
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
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`倍速设置失败: ${e.message || String(e)}`));
        }
    }

    async reset() {
        logger.logInfo("MPV Controller: Reset");
        this.currentUrl = null;
        this.musicItem = null;
        this.playerState = PlayerState.None;
        this.lastReportedDuration = Infinity;
        this.hasTriggeredOnEnded = false;
        if (this.trackLoadedAndStartedResolve) {
            this.trackLoadedAndStartedResolve();
            this.trackLoadedAndStartedPromise = null;
            this.trackLoadedAndStartedResolve = null;
        }
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
        } catch (e: unknown) {
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
            this.onError?.(PlayerErrorReason.EmptyResource, new Error(`设置循环失败: ${e.message || String(e)}`));
        }
    }

    async setSinkId(_deviceId: string): Promise<void> {
        logger.logInfo(`MPV Controller: setSinkId called. This should be configured via MPV's '--audio-device' or 'audio-device' property.`);
        return Promise.resolve();
    }
}