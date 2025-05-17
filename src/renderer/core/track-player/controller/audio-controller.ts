// src/renderer/core/track-player/controller/audio-controller.ts
import { encodeUrlHeaders } from "@/common/normalize-util";
import albumImg from "@/assets/imgs/album-cover.jpg";
import getUrlExt from "@/renderer/utils/get-url-ext";
import Hls, { Events as HlsEvents, HlsConfig } from "hls.js";
import { isSameMedia } from "@/common/media-util";
import { PlayerState } from "@/common/constant";
import ServiceManager from "@shared/service-manager/renderer";
import ControllerBase from "@renderer/core/track-player/controller/controller-base";
import { ErrorReason, CurrentTime } from "@renderer/core/track-player/enum";
// import voidCallback from "@/common/void-callback"; // voidCallback 在此文件中未使用，可以移除
import { IAudioController } from "@/types/audio-controller";
import logger from "@shared/logger/renderer";
import { getGlobalContext } from "@shared/global-context/renderer";

class AudioController extends ControllerBase implements IAudioController {
    private audio: HTMLAudioElement;
    private hls: Hls | null = null;

    private _playerState: PlayerState = PlayerState.None;
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
            logger.logInfo(`AudioController: PlayerState changed from ${PlayerState[oldState]} to ${PlayerState[value]}`);
        }
    }

    public musicItem: IMusic.IMusicItem | null = null;

    get hasSource() {
        return !!this.audio.src && this.audio.src !== window.location.href;
    }

    constructor() {
        super();
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.controls = false;

        this.audio.onplaying = () => {
            this.playerState = PlayerState.Playing;
        };

        this.audio.onpause = () => {
            if (this.audio.ended) {
                this.playerState = PlayerState.None;
            } else if (this.playerState !== PlayerState.Buffering && this.playerState !== PlayerState.None) {
                this.playerState = PlayerState.Paused;
            }
        };

        this.audio.onerror = (event) => {
            let error: MediaError | null = null;
            // HTMLMediaElement 的 error 事件的 event 参数本身不是 Error 对象，而是 Event 对象
            // 真正的错误信息在 event.target.error (即 this.audio.error)
            if (this.audio.error) {
                error = this.audio.error;
            }
            logger.logError(
                "AudioController: HTMLAudioElement error",
                error instanceof Error // MediaError 不是 Error 的实例
                    ? error
                    : error // 如果是 MediaError
                        ? new Error(
                            `MediaError code ${error.code}: ${error.message || "Unknown media error"}`
                          )
                        : new Error("Unknown audio element error") // 如果 this.audio.error 也是 null
            );
            this.playerState = PlayerState.None;
            this.onError?.(ErrorReason.EmptyResource, error || new Error("Audio playback error"));
        };

        this.audio.ontimeupdate = () => {
            const duration = this.audio.duration;
            if (this.playerState === PlayerState.Playing || this.playerState === PlayerState.Buffering) {
                this.onProgressUpdate?.({
                    currentTime: this.audio.currentTime,
                    duration: duration > 0 && isFinite(duration) ? duration : Infinity,
                });
            }
        };

        this.audio.onended = () => {
            logger.logInfo("AudioController: Audio ended");
            this.playerState = PlayerState.None;
            this.onEnded?.();
        };

        this.audio.onvolumechange = () => {
            this.onVolumeChange?.(this.audio.volume);
        };

        this.audio.onratechange = () => {
            this.onSpeedChange?.(this.audio.playbackRate);
        };

        this.audio.onwaiting = () => {
            logger.logInfo("AudioController: Audio waiting (buffering)");
            if (this.playerState === PlayerState.Playing) {
                this.playerState = PlayerState.Buffering;
            }
        };

        this.audio.oncanplay = () => {
            logger.logInfo("AudioController: Audio can play");
            if (this.playerState === PlayerState.Buffering) {
                // 状态的恢复由 TrackPlayer 控制，这里仅记录日志
            }
        };

        const globalContext = getGlobalContext();
        // @ts-ignore
        if (globalContext && !globalContext.appVersion.includes("-")) { // 简易判断是否为开发环境
             // @ts-ignore
            window.ad_web = this.audio;
        }
    }

    private initHls(config?: Partial<HlsConfig>) {
        this.destroyHls();
        this.hls = new Hls({
            lowLatencyMode: false,
            // debug: !getGlobalContext()?.appVersion.includes("-"), // 仅在开发模式下开启 HLS debug
            ...config
        });
        this.hls.attachMedia(this.audio);
        this.hls.on(HlsEvents.ERROR, (event, data) => { // event 参数是字符串类型
            logger.logError("AudioController: HLS Error", new Error(JSON.stringify({event, data})));
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        logger.logInfo("HLS fatal network error encountered, attempting to recover by startLoad().");
                        this.hls?.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        logger.logInfo("HLS fatal media error encountered, attempting to recover by recoverMediaError().");
                        this.hls?.recoverMediaError();
                        break;
                    default:
                        logger.logError("HLS unrecoverable fatal error. Destroying HLS.", new Error(data.details));
                        this.destroyHls();
                        this.playerState = PlayerState.None;
                        this.onError?.(ErrorReason.EmptyResource, new Error(`HLS Error: ${data.details}`));
                        break;
                }
            }
        });
        logger.logInfo("AudioController: HLS instance initialized.");
    }

    private destroyHls() {
        if (this.hls) {
            this.hls.stopLoad();
            this.hls.detachMedia();
            this.hls.destroy();
            this.hls = null;
            logger.logInfo("AudioController: HLS instance destroyed.");
        }
    }

    public prepareTrack(musicItem: IMusic.IMusicItem): void {
        this.musicItem = { ...musicItem };
        if (navigator.mediaSession) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: musicItem.title,
                artist: musicItem.artist,
                album: musicItem.album,
                artwork: [{ src: musicItem.artwork || albumImg }],
            });
        }
        if (this.playerState !== PlayerState.None) {
             this.playerState = PlayerState.Buffering;
        }
    }

    public async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): Promise<void> {
        this.musicItem = { ...musicItem };

        let url = trackSource.url;
        if (!url) {
            this.onError?.(ErrorReason.EmptyResource, new Error("Track source URL is empty."));
            this.playerState = PlayerState.None;
            return; // async 函数返回 Promise.resolve(undefined)
        }

        const urlObj = new URL(url);
        let headers: Record<string, any> | null = null;

        if (trackSource.headers || trackSource.userAgent) {
            headers = { ...(trackSource.headers ?? {}) };
            if (trackSource.userAgent) {
                headers["user-agent"] = trackSource.userAgent;
            }
        }

        if (urlObj.username && urlObj.password) {
            const authHeader = `Basic ${btoa(
                `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(urlObj.password)}`
            )}`;
            urlObj.username = "";
            urlObj.password = "";
            headers = { ...(headers || {}), Authorization: authHeader };
            url = urlObj.toString();
        }

        if (headers) {
            const forwardedUrl = ServiceManager.RequestForwarderService.forwardRequest(url, "GET", headers);
            if (forwardedUrl) {
                url = forwardedUrl;
                headers = null; // Headers are handled by the forwarder
            } else if (!headers["Authorization"]) { // Only encode if not an Authorization header (fetch handles Auth)
                url = encodeUrlHeaders(url, headers as Record<string, string>);
                headers = null;
            }
        }

        logger.logInfo("AudioController: Setting track source - ", url);
        this.audio.pause();
        this.audio.removeAttribute("src"); // 清除旧的 src
        this.audio.load(); // 重新加载 audio 元素以应用新的 src
        this.destroyHls(); // 销毁任何现有的 HLS 实例

        if (getUrlExt(trackSource.url) === ".m3u8") {
            if (Hls.isSupported()) {
                this.initHls(); // 初始化 HLS
                if (this.hls) {
                    this.hls.loadSource(url); // 加载 HLS 源
                }
            } else {
                this.onError?.(ErrorReason.UnsupportedResource, new Error("HLS.js is not supported in this browser."));
                this.playerState = PlayerState.None;
                return;
            }
        } else if (headers) { // 如果仍然有 headers (例如 Authorization)，则使用 fetch
            try {
                const res = await fetch(url, { method: "GET", headers: headers as HeadersInit });
                if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`);
                const blob = await res.blob();
                if (isSameMedia(this.musicItem, musicItem)) { // 确保仍然是当前歌曲
                    this.audio.src = URL.createObjectURL(blob);
                } else {
                    URL.revokeObjectURL(URL.createObjectURL(blob)); // 如果歌曲已更改，释放 blob URL
                }
            } catch (e: any) {
                logger.logError("AudioController: Error fetching track with headers", e);
                this.onError?.(ErrorReason.EmptyResource, e);
                this.playerState = PlayerState.None;
                return;
            }
        } else {
            this.audio.src = url; // 直接设置 src
        }

        if (this.playerState !== PlayerState.None) { // 如果之前不是 None 状态
            this.playerState = PlayerState.Buffering; // 设置为缓冲中
        }
    }

    public pause(): void {
        if (this.hasSource && this.playerState !== PlayerState.Paused && this.playerState !== PlayerState.None) {
            this.audio.pause();
        }
    }

    public play(): void {
        if (this.hasSource) {
            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    logger.logError("AudioController: Error on play()", error);
                    if (this.playerState === PlayerState.Buffering || this.playerState === PlayerState.Playing) {
                        this.playerState = PlayerState.Paused;
                    }
                    this.onError?.(ErrorReason.EmptyResource, error);
                });
            }
        } else {
            logger.logInfo("AudioController: Play called but no source.");
        }
    }

    public reset(): void {
        logger.logInfo("AudioController: Resetting...");
        this.destroyHls();
        this.audio.pause();
        this.audio.removeAttribute("src");
        this.audio.load();
        this.musicItem = null;
        this.playerState = PlayerState.None;
        this.onProgressUpdate?.({ currentTime: 0, duration: Infinity });
        if (navigator.mediaSession) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = "none";
        }
    }

    public seekTo(seconds: number): void {
        if (this.hasSource && isFinite(seconds)) {
            const duration = this.audio.duration;
            if (duration > 0 && isFinite(duration)) {
                this.audio.currentTime = Math.max(0, Math.min(seconds, duration));
            } else {
                this.audio.currentTime = Math.max(0, seconds);
            }
        }
    }

    public setLoop(isLoop: boolean): void {
        this.audio.loop = isLoop;
    }

    public async setSinkId(deviceId: string): Promise<void> {
        if (typeof (this.audio as any).setSinkId === "function") {
            try {
                await (this.audio as any).setSinkId(deviceId);
                logger.logInfo("AudioController: Audio output device set to - ", deviceId);
            } catch (error: any) {
                logger.logError("AudioController: Error setting audio output device", error);
                throw error;
            }
        } else {
            const msg = "AudioController: setSinkId is not supported by this browser.";
            logger.logInfo(msg);
            return Promise.reject(new Error(msg));
        }
    }

    public setSpeed(speed: number): void {
        this.audio.playbackRate = speed;
    }

    public setVolume(volume: number): void {
        this.audio.volume = Math.max(0, Math.min(1, volume));
    }

    public destroy(): void {
        logger.logInfo("AudioController: Destroying instance...");
        this.reset();
    }
}

export default AudioController;