// src/renderer/core/track-player/controller/mpv-controller.ts
import { IAudioController } from "@/types/audio-controller";
import { CurrentTime, ErrorReason } from "@renderer/core/track-player/enum";
import { PlayerState } from "@/common/constant";
import ControllerBase from "./controller-base";
import logger from "@shared/logger/renderer";
import AppConfig from "@shared/app-config/renderer";
import { toast } from "react-toastify";

export default class MpvController extends ControllerBase implements IAudioController {
    private _playerState: PlayerState = PlayerState.None;
    public musicItem: IMusic.IMusicItem | null = null;
    private currentUrl: string | null = null;
    private internalVolume: number = Number(AppConfig.getConfig("private.lastVolume" as any)) || 1;
    private internalSpeed: number = Number(AppConfig.getConfig("private.lastSpeed" as any)) || 1;
    private isMpvFullyInitialized = false;
    private isMpvInitFailed = false;
    private lastReportedDuration: number = Infinity;
    private initializationPromise: Promise<void> | null = null;

    private readyPromise: Promise<void>;
    private readyResolve!: () => void;
    private readyReject!: (reason?: any) => void;

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
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
        this.setupEventListeners();
        this.initialize().catch(e => {
            logger.logError("MpvController: Background initialization failed in constructor", e);
        });
    }

    public async initialize(): Promise<void> {
        if (this.isMpvFullyInitialized) return Promise.resolve();
        if (this.isMpvInitFailed && AppConfig.getConfig("playMusic.backend") === "mpv") {
             return Promise.reject(new Error("MPV previously failed to initialize."));
        }
        if (this.initializationPromise) return this.initializationPromise;

        if (AppConfig.getConfig("playMusic.backend") !== "mpv") {
            this.isMpvInitFailed = true;
            const notSelectedError = new Error("MPV backend not selected.");
            this.readyReject(notSelectedError);
            return Promise.resolve();
        }

        if (!AppConfig.getConfig("playMusic.mpvPath")) {
            const errorMsg = "MPV 播放器路径未设置，请在 设置->播放 中配置。";
            if (this.playerState !== PlayerState.None && this.playerState !== PlayerState.Buffering) toast.warn(errorMsg);
            this.isMpvInitFailed = true;
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
            this.readyReject(new Error(errorMsg));
            return Promise.reject(new Error(errorMsg));
        }

        this.initializationPromise = new Promise(async (resolve, reject) => {
            let successTimeout: NodeJS.Timeout | null = null;
            let resolvedOrRejected = false;

            const successHandler = async () => {
                if (resolvedOrRejected) return;
                resolvedOrRejected = true;
                if(successTimeout) clearTimeout(successTimeout);

                this.isMpvFullyInitialized = true;
                this.isMpvInitFailed = false;
                logger.logInfo("MPV Controller: Initialized successfully (event).");
                try {
                    await this.applyInitialSettings();
                    this.readyResolve();
                    resolve();
                } catch (err) {
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

                this.isMpvFullyInitialized = false;
                this.isMpvInitFailed = true;
                const displayError = errorMsgFromMain || "MPV 初始化失败，请检查路径或尝试重启应用。";
                logger.logError("MpvController: Initialization failed (event)", new Error(displayError));
                this.playerState = PlayerState.None;
                this.onError?.(ErrorReason.EmptyResource, new Error(displayError));
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
                    failHandler("MPV 主进程初始化命令返回失败。");
                }
            } catch (e: any) {
                if (!resolvedOrRejected) {
                    failHandler(`MPV Controller: Invoking initialize IPC error: ${e.message}`);
                }
            }
        });

        try {
            await this.initializationPromise;
        } catch (e) {
            logger.logError("MpvController: this.initializationPromise was rejected", e);
        } finally {
            this.initializationPromise = null;
        }
        return this.readyPromise;
    }

    private async applyInitialSettings() {
        if (!this.isMpvFullyInitialized) return;
        try {
            await window.electron.mpvPlayer.setVolume(Math.max(0, Math.min(100, Math.round(this.internalVolume * 100))));
            await window.electron.mpvPlayer.setSpeed(this.internalSpeed);
        } catch (e) {
            logger.logError("MpvController: Error applying initial settings", e);
        }
    }


    private setupEventListeners() {
        window.electron.mpvPlayerListener.removeAllMpvListeners();

        interface MpvTimePositionEvent {
            time: number;
            duration: number;
        }

        window.electron.mpvPlayerListener.onTimePosition((data: MpvTimePositionEvent) => {
            const newDuration = (data.duration != null && data.duration > 0 && isFinite(data.duration)) ? data.duration : Infinity;
            // MpvController doesn't have lastKnownTime, it receives time directly
            // Only update if duration changed or time is valid and different enough (though time is pushed by main)
            if (newDuration !== this.lastReportedDuration || (data.time !== undefined)) {
                this.lastReportedDuration = newDuration;
                this.onProgressUpdate?.({ currentTime: data.time || 0, duration: this.lastReportedDuration });
            }
        });
        window.electron.mpvPlayerListener.onPaused(() => {
            this.playerState = PlayerState.Paused;
        });
        window.electron.mpvPlayerListener.onResumed(() => {
            this.playerState = PlayerState.Playing;
        });

        window.electron.mpvPlayerListener.onPlaybackEnded((data: { reason: string }) => {
            logger.logInfo(`MpvController: Received mpv-playback-ended, reason: ${data.reason}`);
            if (data.reason === "eof") {
                this.playerState = PlayerState.None;
                this.onEnded?.();
            } else if (data.reason === "stop") {
                this.playerState = PlayerState.None;
            }
        });

        window.electron.mpvPlayerListener.onStopped(() => {
            logger.logInfo("MpvController: Received mpv-stopped.");
            if (this.playerState !== PlayerState.None && this.playerState !== PlayerState.Paused ) {
                this.playerState = PlayerState.None;
            }
        });

        window.electron.mpvPlayerListener.onStarted(() => {
            logger.logInfo("MpvController: Received mpv-started event (new file loaded and playback begins).");
            if (this.trackLoadedAndStartedResolve) {
                this.trackLoadedAndStartedResolve();
                this.trackLoadedAndStartedPromise = null;
                this.trackLoadedAndStartedResolve = null;
            }
             window.electron.mpvPlayer.getDuration().then(duration => {
                this.lastReportedDuration = (duration != null && duration > 0 && isFinite(duration)) ? duration : Infinity;
                return window.electron.mpvPlayer.getCurrentTime();
            }).then(time => {
                this.onProgressUpdate?.({ currentTime: time || 0, duration: this.lastReportedDuration });
                if (this.playerState === PlayerState.Buffering) { // If we were buffering, now we are playing
                    this.playerState = PlayerState.Playing;
                }
            }).catch(err => {
                logger.logError("MpvController: Error fetching initial time/duration on started", err);
                this.onProgressUpdate?.({ currentTime: 0, duration: Infinity });
            });
        });


        window.electron.mpvPlayerListener.onError((errorMsg: string) => {
            logger.logError("MPV Playback Error from main:", new Error(errorMsg));
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
        });
    }

    async prepareTrack(musicItem: IMusic.IMusicItem) {
        try {
            await this.readyPromise;
        } catch (initError) {
            this.onError?.(ErrorReason.EmptyResource, initError as Error);
            this.playerState = PlayerState.None;
            return;
        }
        if (this.isMpvInitFailed || !this.isMpvFullyInitialized) {
             const errorMsg = "MPV 初始化失败或未就绪，无法准备轨道。";
             this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
             this.playerState = PlayerState.None;
             return;
        }

        this.musicItem = { ...musicItem };
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album,
            artwork: [{ src: musicItem.artwork || "" }],
        });
    }

    async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem) {
        try {
            await this.readyPromise;
        } catch (initError) {
            this.onError?.(ErrorReason.EmptyResource, initError as Error);
            this.playerState = PlayerState.None;
            return;
        }
        if (this.isMpvInitFailed || !this.isMpvFullyInitialized) {
             const errorMsg = "MPV 初始化失败或未就绪，无法设置音源。";
             this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
             this.playerState = PlayerState.None;
             return;
        }

        this.musicItem = { ...musicItem };
        this.currentUrl = trackSource.url;
        if (!this.currentUrl) {
            this.onError?.(ErrorReason.EmptyResource, new Error("Track source URL is empty."));
            this.playerState = PlayerState.None;
            return;
        }

        logger.logInfo("MPV Controller: Loading track - ", this.currentUrl);
        this.playerState = PlayerState.Buffering;
        this.trackLoadedAndStartedPromise = new Promise((resolve) => {
            this.trackLoadedAndStartedResolve = resolve;
        });
        try {
            await window.electron.mpvPlayer.load(this.currentUrl, this.musicItem);
        } catch (e: any) {
            logger.logError("MPV Controller: Error loading track", e);
            this.onError?.(ErrorReason.EmptyResource, e);
            this.playerState = PlayerState.None;
            if (this.trackLoadedAndStartedResolve) {
                this.trackLoadedAndStartedResolve();
                this.trackLoadedAndStartedPromise = null;
                this.trackLoadedAndStartedResolve = null;
            }
        }
    }

    async play() {
        try {
            await this.readyPromise;
        } catch (initError) {
            this.onError?.(ErrorReason.EmptyResource, initError as Error);
            this.playerState = PlayerState.None;
            return;
        }
        if (this.isMpvInitFailed || !this.isMpvFullyInitialized || !this.hasSource) {
            this.onError?.(ErrorReason.EmptyResource, new Error("MPV 未就绪或无音源可播。"));
            this.playerState = PlayerState.None;
            return;
        }
        if (this.trackLoadedAndStartedPromise) {
            logger.logInfo("MPV Controller: Play command waiting for track to be loaded and started.");
            await this.trackLoadedAndStartedPromise;
        }
        logger.logInfo(`MPV Controller: Play command for ${this.currentUrl || 'unknown source'}`);
        try {
            await window.electron.mpvPlayer.play();
        } catch (e: any) {
            logger.logError("MPV Controller: Error playing", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`播放命令失败: ${e.message}`));
        }
    }

    async pause() {
        try {
            await this.readyPromise;
        } catch (initError) { return; }
        if (this.isMpvInitFailed || !this.isMpvFullyInitialized) return;
        logger.logInfo("MPV Controller: Pause command");
        try {
            await window.electron.mpvPlayer.pause();
        } catch (e: any) {
            logger.logError("MPV Controller: Error pausing", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`暂停命令失败: ${e.message}`));
        }
    }

    async resume() {
        await this.play();
    }

    async seekTo(seconds: number) {
        try {
            await this.readyPromise;
        } catch (initError) { return; }
        if (this.isMpvInitFailed || !this.isMpvFullyInitialized || !this.hasSource) return;
        if (this.trackLoadedAndStartedPromise) {
            await this.trackLoadedAndStartedPromise;
        }
        logger.logInfo("MPV Controller: Seek to - ", seconds);
        try {
            await window.electron.mpvPlayer.seek(seconds);
        } catch (e: any) {
            logger.logError("MPV Controller: Error seeking", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`跳转命令失败: ${e.message}`));
        }
    }

    async setVolume(volume: number, internalCall = false) {
        this.internalVolume = volume;
        AppConfig.setConfig({"private.lastVolume": volume} as any);
        if (!internalCall) {
            try {
                await this.readyPromise;
            } catch (initError) { return; }
        }
        if (this.isMpvInitFailed || !this.isMpvFullyInitialized) return;
        const mpvVolume = Math.max(0, Math.min(100, Math.round(volume * 100)));
        logger.logInfo("MPV Controller: Set volume to - ", mpvVolume);
        try {
            await window.electron.mpvPlayer.setVolume(mpvVolume);
            this.onVolumeChange?.(volume);
        } catch (e: any) {
            logger.logError("MPV Controller: Error setting volume", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`音量设置失败: ${e.message}`));
        }
    }

    async setSpeed(speed: number, internalCall = false) {
        this.internalSpeed = speed;
        AppConfig.setConfig({"private.lastSpeed": speed} as any);
        if (!internalCall) {
            try {
                await this.readyPromise;
            } catch (initError) { return; }
        }
        if (this.isMpvInitFailed || !this.isMpvFullyInitialized) return;
        logger.logInfo("MPV Controller: Set speed to - ", speed);
        try {
            await window.electron.mpvPlayer.setSpeed(speed);
            this.onSpeedChange?.(speed);
        } catch (e: any) {
            logger.logError("MPV Controller: Error setting speed", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`倍速设置失败: ${e.message}`));
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
            await this.readyPromise;
            if (this.isMpvFullyInitialized && window.electron?.mpvPlayer) {
                await window.electron.mpvPlayer.stop();
            }
        } catch (e: any) {
            logger.logError("MPV Controller: Error stopping on reset (or MPV not ready)", e);
        }
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
    }

    async destroy() {
        logger.logInfo("MPV Controller: Destroying instance...");
        await this.reset();
        if (window.electron?.mpvPlayerListener) {
            window.electron.mpvPlayerListener.removeAllMpvListeners();
        }
        try {
            await this.readyPromise;
            if (this.isMpvFullyInitialized && window.electron?.mpvPlayer) {
                await window.electron.mpvPlayer.quit();
            }
        } catch (e: unknown) {
            logger.logError(
                "Error quitting MPV on destroy (or MPV not ready)",
                e instanceof Error ? e : new Error(typeof e === "string" ? e : String(e))
            );
        }
        this.isMpvFullyInitialized = false;
        this.isMpvInitFailed = true;
        this.readyPromise = new Promise((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });
    }

    async setLoop(isLoop: boolean): Promise<void> {
        logger.logInfo(`MPV Controller: setLoop called with ${isLoop}.`);
        try {
            await this.readyPromise;
        } catch (initError) { return; }
        if (this.isMpvInitFailed || !this.isMpvFullyInitialized) return;

        const loopValue = isLoop ? "inf" : "no";
        try {
            await window.electron.mpvPlayer.setProperty("loop-file", loopValue);
            logger.logInfo(`MPV loop-file set to ${loopValue}`);
        } catch (e: any) {
            logger.logError("MPV Controller: Error setting loop-file property", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`设置循环失败: ${e.message}`));
        }
    }


    async setSinkId(_deviceId: string): Promise<void> {
        logger.logInfo(`MPV Controller: setSinkId called. MPV typically requires '--audio-device' at startup.`);
        return Promise.resolve();
    }
}