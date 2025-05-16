// src/renderer/core/track-player/controller/mpv-controller.ts
import { IAudioController } from "@/types/audio-controller";
import { CurrentTime, ErrorReason } from "@renderer/core/track-player/enum";
import { PlayerState } from "@/common/constant";
import ControllerBase from "./controller-base";
import logger from "@shared/logger/renderer";
import AppConfig from "@shared/app-config/renderer";
import { toast } from "react-toastify"; // 用于用户提示

export default class MpvController extends ControllerBase implements IAudioController {
    private _playerState: PlayerState = PlayerState.None;
    public musicItem: IMusic.IMusicItem | null = null;
    private currentUrl: string | null = null;
    private internalVolume: number = 1; // 0-1
    private internalSpeed: number = 1;
    private isMpvInitialized = false;
    private isMpvInitFailed = false;
    private lastReportedDuration: number = Infinity;

    get playerState() {
        return this._playerState;
    }
    set playerState(value: PlayerState) {
        if (this._playerState !== value) {
            this._playerState = value;
            this.onPlayerStateChanged?.(value);
            if (value === PlayerState.Playing) {
                navigator.mediaSession.playbackState = "playing";
            } else if (value === PlayerState.Paused || value === PlayerState.None) {
                navigator.mediaSession.playbackState = "paused";
            }
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
             toast.warn("MPV 播放器路径未设置，请在设置中配置。");
             this.isMpvInitFailed = true;
             this.playerState = PlayerState.None;
             this.onError?.(ErrorReason.EmptyResource, new Error("MPV path not set"));
             return;
        }

        try {
            const success = await window.electron.mpvPlayer.initialize();
            if (success) {
                this.isMpvInitialized = true;
                this.isMpvInitFailed = false;
                logger.logInfo("MPV Controller: Initialized successfully via main process.");
                this.setupEventListeners();
                // 初始化后同步一次音量和速度
                await this.setVolume(this.internalVolume); // 设为 await
                await this.setSpeed(this.internalSpeed); // 设为 await
            } else {
                this.isMpvInitFailed = true;
                this.playerState = PlayerState.None;
                this.onError?.(ErrorReason.EmptyResource, new Error("MPV initialization failed in main process"));
            }
        } catch (e: any) {
            logger.logError("MPV Controller: Initialization invoke error", e);
            this.isMpvInitFailed = true;
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.EmptyResource, e);
        }
    }


    private setupEventListeners() {
        window.electron.mpvPlayerListener.removeAllMpvListeners();

        interface MpvTimePositionEvent {
            time: number;
            duration: number;
        }

        window.electron.mpvPlayerListener.onTimePosition((data: MpvTimePositionEvent) => {
            this.lastReportedDuration = (data.duration > 0 && isFinite(data.duration)) ? data.duration : Infinity;
            this.onProgressUpdate?.({ currentTime: data.time, duration: this.lastReportedDuration });
        });
        window.electron.mpvPlayerListener.onPaused(() => {
            this.playerState = PlayerState.Paused;
        });
        window.electron.mpvPlayerListener.onResumed(() => {
            this.playerState = PlayerState.Playing;
        });
        window.electron.mpvPlayerListener.onStopped(() => {
            this.playerState = PlayerState.None;
        });
        interface MpvPlaybackEndedEvent {
            reason: "eof" | "stop" | string;
        }

        window.electron.mpvPlayerListener.onPlaybackEnded((data: MpvPlaybackEndedEvent) => {
            if (data.reason === "eof") {
            this.playerState = PlayerState.None;
            this.currentUrl = null;
            this.onEnded?.();
            } else if (data.reason === "stop") {
            this.playerState = PlayerState.None;
            this.currentUrl = null;
            }
        });
        interface MpvErrorEvent { // 这个接口可以考虑移到 preload 的类型定义中，或者共享类型文件中
            errorMsg: string;
        }

        window.electron.mpvPlayerListener.onError((errorMsg: MpvErrorEvent["errorMsg"]) => { // 明确参数类型
            logger.logError("MPV Playback Error from main:", new Error(errorMsg));
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.EmptyResource, new Error(errorMsg));
        });
        window.electron.mpvPlayerListener.onInitFailed(() => {
            this.isMpvInitialized = false;
            this.isMpvInitFailed = true;
            toast.error("MPV 初始化失败，请检查路径或尝试重启应用。");
        });
        window.electron.mpvPlayerListener.onInitSuccess(() => {
            this.isMpvInitialized = true;
            this.isMpvInitFailed = false;
            toast.success("MPV 初始化成功。");
        });
    }

    async prepareTrack(musicItem: IMusic.IMusicItem) {
        if (this.isMpvInitFailed) {
             this.onError?.(ErrorReason.EmptyResource, new Error("MPV not initialized or init failed"));
             return;
        }
        if (!this.isMpvInitialized && AppConfig.getConfig("playMusic.backend") === "mpv") {
            await this.initialize();
            if (!this.isMpvInitialized) return;
        }

        this.musicItem = { ...musicItem };
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album,
            artwork: [{ src: musicItem.artwork || "" }],
        });
        this.playerState = PlayerState.Buffering;
    }

    async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem) {
        if (this.isMpvInitFailed) {
             this.onError?.(ErrorReason.EmptyResource, new Error("MPV not initialized or init failed"));
             return;
        }
         if (!this.isMpvInitialized && AppConfig.getConfig("playMusic.backend") === "mpv") {
            await this.initialize();
            if (!this.isMpvInitialized) return;
        }

        this.musicItem = { ...musicItem };
        this.currentUrl = trackSource.url;
        if (!this.currentUrl) {
            this.onError?.(ErrorReason.EmptyResource, new Error("Track source URL is empty."));
            this.playerState = PlayerState.None;
            return;
        }

        logger.logInfo("MPV Controller: Loading track - ", this.currentUrl);
        try {
            await window.electron.mpvPlayer.load(this.currentUrl, this.musicItem);
        } catch (e: any) {
            logger.logError("MPV Controller: Error loading track", e);
            this.onError?.(ErrorReason.EmptyResource, e);
            this.playerState = PlayerState.None;
        }
    }

    async play() {
        if (this.isMpvInitFailed || !this.isMpvInitialized || !this.hasSource) {
            this.onError?.(ErrorReason.EmptyResource, new Error("MPV not ready or no source to play."));
            return;
        }
        logger.logInfo("MPV Controller: Play command");
        try {
            await window.electron.mpvPlayer.play();
        } catch (e: any) {
            logger.logError("MPV Controller: Error playing", e);
        }
    }

    async pause() {
        if (this.isMpvInitFailed || !this.isMpvInitialized) return;
        logger.logInfo("MPV Controller: Pause command");
        try {
            await window.electron.mpvPlayer.pause();
        } catch (e: any) {
            logger.logError("MPV Controller: Error pausing", e);
        }
    }

    async seekTo(seconds: number) {
        if (this.isMpvInitFailed || !this.isMpvInitialized || !this.hasSource) return;
        logger.logInfo("MPV Controller: Seek to - ", seconds);
        try {
            await window.electron.mpvPlayer.seek(seconds);
        } catch (e: any) {
            logger.logError("MPV Controller: Error seeking", e);
        }
    }

    async setVolume(volume: number) {
        this.internalVolume = volume;
        if (this.isMpvInitFailed || !this.isMpvInitialized) return;
        logger.logInfo("MPV Controller: Set volume to - ", volume * 100);
        try {
            await window.electron.mpvPlayer.setVolume(Math.round(volume * 100));
        } catch (e: any) {
            logger.logError("MPV Controller: Error setting volume", e);
        }
    }

    async setSpeed(speed: number) {
        this.internalSpeed = speed;
        if (this.isMpvInitFailed || !this.isMpvInitialized) return;
        logger.logInfo("MPV Controller: Set speed to - ", speed);
        try {
            await window.electron.mpvPlayer.setSpeed(speed);
        } catch (e: any) {
            logger.logError("MPV Controller: Error setting speed", e);
        }
    }

    async reset() {
        logger.logInfo("MPV Controller: Reset");
        this.currentUrl = null;
        this.musicItem = null;
        this.playerState = PlayerState.None;
        this.lastReportedDuration = Infinity;
        this.onProgressUpdate?.({ currentTime: 0, duration: Infinity });
        if (this.isMpvInitialized) {
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
        logger.logInfo("MPV Controller: Destroy");
        this.reset();
        window.electron.mpvPlayerListener.removeAllMpvListeners();
        if (this.isMpvInitialized) {
             window.electron.mpvPlayer.quit().catch((e: unknown) => {
                logger.logError(
                    "Error quitting MPV on destroy",
                    e instanceof Error ? e : new Error(typeof e === "string" ? e : String(e)) // 更安全的错误处理
                );
            });
        }
        this.isMpvInitialized = false;
        this.isMpvInitFailed = false;
    }

    setLoop(isLoop: boolean): void {
        logger.logInfo(`MPV Controller: setLoop called with ${isLoop}. This might require main process IPC to mpv setProperty.`);
         if (this.isMpvInitialized) {
            // 示例：假设主进程 mpv-manager.ts 实现了 setProperty('loop-file', 'yes'/'no')
            // window.electron.mpvPlayer.setProperty("loop-file", isLoop ? "inf" : "no")
            //   .catch(e => logger.logError("Error setting loop-file property via IPC", e));
        }
    }

    async setSinkId(deviceId: string): Promise<void> {
        logger.logInfo(`MPV Controller: setSinkId called with ${deviceId}. This typically needs to be a startup option for MPV ('--audio-device').`);
        return Promise.resolve();
    }
}