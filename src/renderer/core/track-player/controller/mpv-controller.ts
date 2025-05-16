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
    private internalVolume: number = Number(AppConfig.getConfig("private.lastVolume" as any)) || 1; // 0-1, load from config or default
    private internalSpeed: number = Number(AppConfig.getConfig("private.lastSpeed" as any)) || 1;   // load from config or default
    private isMpvInitialized = false;
    private isMpvInitFailed = false;
    private lastReportedDuration: number = Infinity;

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
        this.initialize();
    }

    private async initialize() {
        if (AppConfig.getConfig("playMusic.backend") !== "mpv") {
            return;
        }
        if (!AppConfig.getConfig("playMusic.mpvPath")) {
             const errorMsg = "MPV 播放器路径未设置，请在 设置->播放 中配置。";
             toast.warn(errorMsg);
             this.isMpvInitFailed = true;
             this.playerState = PlayerState.None;
             this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
             return;
        }

        try {
            const success = await window.electron.mpvPlayer.initialize();
            if (success) {
                this.isMpvInitialized = true;
                this.isMpvInitFailed = false;
                logger.logInfo("MPV Controller: Initialized successfully via main process.");
                this.setupEventListeners();
                await this.setVolume(this.internalVolume);
                await this.setSpeed(this.internalSpeed);
            } else {
                // Error message should be handled by onInitFailed
                // this.isMpvInitFailed = true; // This will be set by onInitFailed
                // this.playerState = PlayerState.None;
                // this.onError?.(ErrorReason.EmptyResource, new Error("MPV initialization failed in main process"));
            }
        } catch (e: any) {
            const errorMsg = `MPV Controller: Initialization invoke error: ${e.message}`;
            logger.logError(errorMsg, e);
            this.isMpvInitFailed = true;
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
        }
    }


    private setupEventListeners() {
        window.electron.mpvPlayerListener.removeAllMpvListeners();

        interface MpvTimePositionEvent {
            time: number;
            duration: number; // Can be null or 0 if unknown
        }

        window.electron.mpvPlayerListener.onTimePosition((data: MpvTimePositionEvent) => {
            this.lastReportedDuration = (data.duration != null && data.duration > 0 && isFinite(data.duration)) ? data.duration : Infinity;
            this.onProgressUpdate?.({ currentTime: data.time, duration: this.lastReportedDuration });
        });
        window.electron.mpvPlayerListener.onPaused(() => {
            this.playerState = PlayerState.Paused;
        });
        window.electron.mpvPlayerListener.onResumed(() => {
            this.playerState = PlayerState.Playing;
        });
        window.electron.mpvPlayerListener.onStopped(() => { // MPV stopped (e.g. user stop, not end of file)
            this.playerState = PlayerState.None;
            // Do not nullify currentUrl here, TrackPlayer handles track changes
        });
        interface MpvPlaybackEndedEvent {
            reason: "eof" | "stop" | string; // 'stop' can also mean user stopped
        }

        window.electron.mpvPlayerListener.onPlaybackEnded((data: MpvPlaybackEndedEvent) => {
            logger.logInfo(`MpvController: PlaybackEnded event, reason: ${data.reason}`);
            if (data.reason === "eof") { // End of file
                this.playerState = PlayerState.None;
                // this.currentUrl = null; // TrackPlayer should handle this
                this.onEnded?.();
            } else if (data.reason === "stop") { // Explicit stop
                this.playerState = PlayerState.None;
            }
            // Other reasons might indicate errors or specific MPV behavior
        });

        window.electron.mpvPlayerListener.onError((errorMsg: string) => { // errorMsg is string
            logger.logError("MPV Playback Error from main:", new Error(errorMsg));
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
        });
        window.electron.mpvPlayerListener.onInitFailed((errorMsgFromMain?: string) => {
            this.isMpvInitialized = false;
            this.isMpvInitFailed = true;
            const displayError = errorMsgFromMain || "MPV 初始化失败，请检查路径或尝试重启应用。";
            toast.error(displayError);
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.EmptyResource, new Error(displayError));
        });
        window.electron.mpvPlayerListener.onInitSuccess(() => {
            this.isMpvInitialized = true;
            this.isMpvInitFailed = false;
            // toast.success("MPV 初始化成功。"); // Consider if this toast is too frequent
        });
    }

    async prepareTrack(musicItem: IMusic.IMusicItem) {
        if (this.isMpvInitFailed) {
             const errorMsg = "MPV 初始化失败，无法准备轨道。";
             this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
             this.playerState = PlayerState.None;
             return;
        }
        if (!this.isMpvInitialized && AppConfig.getConfig("playMusic.backend") === "mpv") {
            await this.initialize(); // Attempt to re-initialize if needed
            if (!this.isMpvInitialized) { // Check again after attempt
                 const errorMsg = "MPV 仍未初始化，无法准备轨道。";
                 this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
                 this.playerState = PlayerState.None;
                return;
            }
        }

        this.musicItem = { ...musicItem };
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album,
            artwork: [{ src: musicItem.artwork || "" }], // Ensure artwork is not null
        });
        if (this.playerState !== PlayerState.None) { // Only set to buffering if not already None
            this.playerState = PlayerState.Buffering;
        }
    }

    async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem) {
        if (this.isMpvInitFailed) {
             const errorMsg = "MPV 初始化失败，无法设置音源。";
             this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
             this.playerState = PlayerState.None;
             return;
        }
         if (!this.isMpvInitialized && AppConfig.getConfig("playMusic.backend") === "mpv") {
            await this.initialize();
             if (!this.isMpvInitialized) {
                 const errorMsg = "MPV 仍未初始化，无法设置音源。";
                 this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
                 this.playerState = PlayerState.None;
                 return;
             }
        }

        this.musicItem = { ...musicItem }; // Ensure musicItem is always updated
        this.currentUrl = trackSource.url;
        if (!this.currentUrl) {
            this.onError?.(ErrorReason.EmptyResource, new Error("Track source URL is empty."));
            this.playerState = PlayerState.None;
            return;
        }

        logger.logInfo("MPV Controller: Loading track - ", this.currentUrl);
        try {
            await window.electron.mpvPlayer.load(this.currentUrl, this.musicItem);
            // Duration might not be available immediately after load,
            // it's better to get it from 'started' or 'statuschange' events.
            this.lastReportedDuration = Infinity;
        } catch (e: any) {
            logger.logError("MPV Controller: Error loading track", e);
            this.onError?.(ErrorReason.EmptyResource, e);
            this.playerState = PlayerState.None;
        }
    }

    async play() {
        if (this.isMpvInitFailed) {
            this.onError?.(ErrorReason.EmptyResource, new Error("MPV 初始化失败，无法播放。"));
            this.playerState = PlayerState.None;
            return;
        }
        if (!this.isMpvInitialized || !this.hasSource) {
            this.onError?.(ErrorReason.EmptyResource, new Error("MPV 未就绪或无音源可播。"));
            this.playerState = PlayerState.None; // Ensure state reflects inability to play
            return;
        }
        logger.logInfo("MPV Controller: Play command");
        try {
            await window.electron.mpvPlayer.play();
        } catch (e: any) {
            logger.logError("MPV Controller: Error playing", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`播放命令失败: ${e.message}`));
        }
    }

    async pause() {
        if (this.isMpvInitFailed || !this.isMpvInitialized) return;
        logger.logInfo("MPV Controller: Pause command");
        try {
            await window.electron.mpvPlayer.pause();
        } catch (e: any) {
            logger.logError("MPV Controller: Error pausing", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`暂停命令失败: ${e.message}`));
        }
    }

    async seekTo(seconds: number) {
        if (this.isMpvInitFailed || !this.isMpvInitialized || !this.hasSource) return;
        logger.logInfo("MPV Controller: Seek to - ", seconds);
        try {
            await window.electron.mpvPlayer.seek(seconds);
        } catch (e: any) {
            logger.logError("MPV Controller: Error seeking", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`跳转命令失败: ${e.message}`));
        }
    }

    async setVolume(volume: number) { // volume is 0-1
        this.internalVolume = volume;
        AppConfig.setConfig({"private.lastVolume": volume} as any); // Save volume
        if (this.isMpvInitFailed || !this.isMpvInitialized) return;
        const mpvVolume = Math.max(0, Math.min(100, Math.round(volume * 100))); // MPV uses 0-100
        logger.logInfo("MPV Controller: Set volume to - ", mpvVolume);
        try {
            await window.electron.mpvPlayer.setVolume(mpvVolume);
            this.onVolumeChange?.(volume); // Notify TrackPlayer of the change
        } catch (e: any) {
            logger.logError("MPV Controller: Error setting volume", e);
            this.onError?.(ErrorReason.EmptyResource, new Error(`音量设置失败: ${e.message}`));
        }
    }

    async setSpeed(speed: number) {
        this.internalSpeed = speed;
        AppConfig.setConfig({"private.lastSpeed": speed} as any); // Save speed
        if (this.isMpvInitFailed || !this.isMpvInitialized) return;
        logger.logInfo("MPV Controller: Set speed to - ", speed);
        try {
            await window.electron.mpvPlayer.setSpeed(speed);
            this.onSpeedChange?.(speed); // Notify TrackPlayer
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
        if (this.isMpvInitialized && window.electron?.mpvPlayer) { // Check if mpvPlayer exists
            try {
                await window.electron.mpvPlayer.stop();
            } catch (e: any) {
                logger.logError("MPV Controller: Error stopping on reset", e);
            }
        }
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
    }

    destroy() {
        logger.logInfo("MPV Controller: Destroying instance...");
        this.reset();
        if (window.electron?.mpvPlayerListener) { // Check if listener exists
            window.electron.mpvPlayerListener.removeAllMpvListeners();
        }
        if (this.isMpvInitialized && window.electron?.mpvPlayer) {
             window.electron.mpvPlayer.quit().catch((e: unknown) => {
                logger.logError(
                    "Error quitting MPV on destroy",
                    e instanceof Error ? e : new Error(typeof e === "string" ? e : String(e))
                );
            });
        }
        this.isMpvInitialized = false;
        this.isMpvInitFailed = false;
    }

    setLoop(isLoop: boolean): void {
        logger.logInfo(`MPV Controller: setLoop called with ${isLoop}.`);
        // The setProperty method does not exist on mpvPlayer; implement this in the main process and expose it if needed.
        // For now, log a warning or handle as a no-op.
        logger.logInfo("MPV Controller: setLoop is not implemented because setProperty is unavailable on mpvPlayer.");
    }

    async setSinkId(_deviceId: string): Promise<void> { // Parameter is not used currently
        logger.logInfo(`MPV Controller: setSinkId called. MPV typically requires '--audio-device' at startup.`);
        // MPV audio device is usually set via command-line arg, not dynamically like web audio.
        // If dynamic switching is needed, it would require more complex MPV commands.
        return Promise.resolve();
    }
}