/**
 * 播放音乐
 */
import { encodeUrlHeaders } from "@/common/normalize-util";
import albumImg from "@/assets/imgs/album-cover.jpg";
import getUrlExt from "@/renderer/utils/get-url-ext";
import Hls, { Events as HlsEvents, HlsConfig } from "hls.js";
import { isSameMedia } from "@/common/media-util";
import { PlayerState } from "@/common/constant";
import ServiceManager from "@shared/service-manager/renderer";
import ControllerBase from "@renderer/core/track-player/controller/controller-base";
import { ErrorReason } from "@renderer/core/track-player/enum";
import Dexie from "dexie";
import voidCallback from "@/common/void-callback";
import { IAudioController } from "@/types/audio-controller";
import Promise = Dexie.Promise;


class AudioController extends ControllerBase implements IAudioController {
    private audio: HTMLAudioElement;
    private hls: Hls;

    private _playerState: PlayerState = PlayerState.None;
    get playerState() {
        return this._playerState;
    }
    set playerState(value: PlayerState) {
        if (this._playerState !== value) {
            this.onPlayerStateChanged?.(value);
        }
        this._playerState = value;

    }

    public musicItem: IMusic.IMusicItem | null = null;

    /** 实际用于播放的地址，供声音识别复用 */
    public resolvedSourceUrl: string | null = null;

    /**
     * 切源后要跳转到的位置。
     * 刚换地址时音频元数据还没加载好，直接设 currentTime 会被忽略，
     * 这里先记下来，等 loadedmetadata 再跳
     */
    private pendingSeek: number | null = null;

    /**
     * 全局音量（用户偏好里的那个）。
     * audio.volume 是最终值 = 全局音量 × 本地增益，
     * 拆成两个因子，唱卡拉OK 时才好在不污染用户偏好的前提下单独调人声
     */
    private userVolume = 1;

    /** 本地增益：唱卡拉OK 的人声推子，1 表示不调整 */
    private localGain = 1;

    get hasSource() {
        return !!this.audio.src;
    }

    /**
     * 暴露音频元素给可视化分析用。
     * 只读——调用方不得改动 src / crossOrigin / volume，
     * 否则会影响播放。
     */
    get mediaElement() {
        return this.audio;
    }

    constructor() {
        super();
        this.audio = new Audio();
        this.audio.preload = "auto";
        this.audio.controls = false;

        ////// events
        this.audio.onplaying = () => {
            this.playerState = PlayerState.Playing;
            navigator.mediaSession.playbackState = "playing";
        };

        this.audio.onpause = () => {
            this.playerState = PlayerState.Paused;
            navigator.mediaSession.playbackState = "paused";
        };

        this.audio.onerror = (event) => {
            this.playerState = PlayerState.Paused;
            navigator.mediaSession.playbackState = "paused";
            this.onError?.(ErrorReason.EmptyResource, event as any);
        };

        this.audio.ontimeupdate = () => {
            this.onProgressUpdate?.({
                currentTime: this.audio.currentTime,
                duration: this.audio.duration, // 缓冲中是Infinity
            });
        };

        // this.audio.onseeking = () => {
        //     this.playerState = PlayerState.Buffering;
        // }
        //
        // this.audio.onseeked = () => {
        //     this.playerState = PlayerState.Playing;
        // }

        this.audio.onended = () => {
            this.playerState = PlayerState.Paused;
            this.onEnded?.();
        };

        // 刚换完音源时元数据才到货，这时候补上之前记下的跳转
        this.audio.onloadedmetadata = () => {
            this.applyPendingSeek();
        };

        this.audio.onvolumechange = () => {
            // 只有当音量被外部改掉时才当成全局音量变化。
            // 我们自己算出来的最终音量会被忽略，免得把混音增益写进用户偏好
            const expected = this.getEffectiveVolume();
            if (Math.abs(this.audio.volume - expected) < 0.001) {
                return;
            }
            this.userVolume = this.audio.volume;
            this.onVolumeChange?.(this.userVolume);
        };

        this.audio.onratechange = () => {
            this.onSpeedChange?.(this.audio.playbackRate);
        };


        // @ts-ignore  isDev
        window.ad = this.audio;
    }

    private initHls(config?: Partial<HlsConfig>) {
        if (!this.hls) {
            this.hls = new Hls(config);
            this.hls.attachMedia(this.audio);
            this.hls.on(HlsEvents.ERROR, (evt, error) => {
                this.onError(ErrorReason.EmptyResource, error);
            });
        }
    }

    private destroyHls() {
        if (this.hls) {
            this.hls.detachMedia();
            this.hls.off(HlsEvents.ERROR);
            this.hls.destroy();
            this.hls = null;
        }
    }

    destroy(): void {
        this.destroyHls();
        this.reset();
    }

    pause(): void {
        if (this.hasSource) {
            this.audio.pause();
        }
    }

    play(): void {
        if (this.hasSource) {
            this.audio.play().catch(voidCallback);
        }
    }

    reset(): void {
        this.playerState = PlayerState.None;
        this.audio.src = "";
        this.audio.removeAttribute("src");
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
    }

    seekTo(seconds: number): void {
        this.pendingSeek = seconds;
        this.applyPendingSeek();
    }

    /** 元数据就绪后补上之前记下的跳转 */
    private applyPendingSeek() {
        if (this.pendingSeek === null) {
            return;
        }
        if (!this.hasSource || !isFinite(this.pendingSeek)) {
            return;
        }
        const duration = this.audio.duration;
        if (isNaN(duration)) {
            // 元数据还没加载好，等 loadedmetadata
            return;
        }
        this.audio.currentTime = Math.min(this.pendingSeek, duration);
        this.pendingSeek = null;
    }

    setLoop(isLoop: boolean): void {
        this.audio.loop = isLoop;
    }

    setSinkId(deviceId: string): Promise<void> {
        return (this.audio as any).setSinkId(deviceId);
    }

    setSpeed(speed: number): void {
        this.audio.defaultPlaybackRate = speed;
        this.audio.playbackRate = speed;
    }

    prepareTrack(musicItem: IMusic.IMusicItem) {
        this.musicItem = { ...musicItem };

        // 1. update metadata
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album,
            artwork: [
                {
                    src: musicItem.artwork ?? albumImg,
                },
            ],
        });

        // 2. reset track
        this.playerState = PlayerState.None;
        this.audio.src = "";
        this.audio.removeAttribute("src");
        navigator.mediaSession.playbackState = "none";
    }

    setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): void {
        this.musicItem = { ...musicItem };

        // 1. update metadata
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album,
            artwork: [
                {
                    src: musicItem.artwork ?? albumImg,
                },
            ],
        });


        // 2. convert url and headers
        let url = trackSource.url;
        const urlObj = new URL(trackSource.url);
        let headers: Record<string, any> | null = null;

        // 2.1 convert user agent
        if (trackSource.headers || trackSource.userAgent) {
            headers = { ...(trackSource.headers ?? {}) };
            if (trackSource.userAgent) {
                headers["user-agent"] = trackSource.userAgent;
            }
        }

        // 2.2 convert auth header
        if (urlObj.username && urlObj.password) {
            const authHeader = `Basic ${btoa(
                `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(
                    urlObj.password,
                )}`,
            )}`;
            urlObj.username = "";
            urlObj.password = "";
            headers = {
                ...(headers || {}),
                Authorization: authHeader,
            };
            url = urlObj.toString();
        }

        // 2.3 hack url with headers
        if (headers) {
            const forwardedUrl = ServiceManager.RequestForwarderService.forwardRequest(url, "GET", headers);
            if (forwardedUrl) {
                url = forwardedUrl;
                headers = null;
            } else if (!headers["Authorization"]) {
                url = encodeUrlHeaders(url, headers);
                headers = null;
            }
        }

        if (!url) {
            this.onError(ErrorReason.EmptyResource, new Error("url is empty"));
            return;
        }

        // 记录实际使用的地址，供声音识别直接抓取音频
        this.resolvedSourceUrl = url;

        // 3. set real source
        if (getUrlExt(trackSource.url) === ".m3u8") {
            if (Hls.isSupported()) {
                this.initHls();
                this.hls.loadSource(url);
            } else {
                this.onError(ErrorReason.UnsupportedResource);
                return;
            }
        } else if (headers) {
            fetch(url, {
                method: "GET",
                headers: {
                    ...trackSource.headers,
                },
            })
                .then(async (res) => {
                    const blob = await res.blob();
                    if (isSameMedia(this.musicItem, musicItem)) {
                        this.audio.src = URL.createObjectURL(blob);
                    }
                });
        } else {
            this.audio.src = url;
        }
    }

    setVolume(volume: number): void {
        this.userVolume = Math.min(1, Math.max(0, Number(volume) || 0));
        this.applyEffectiveVolume();
        // 主动上报，避免 volumechange 事件因为音量没变而不触发
        this.onVolumeChange?.(this.userVolume);
    }

    /**
     * 本地增益（唱卡拉OK 的人声推子）。
     * 不写用户偏好，只影响当前这次播放
     */
    setLocalGain(gain: number): void {
        this.localGain = Math.min(1, Math.max(0, Number(gain) || 0));
        this.applyEffectiveVolume();
    }

    /** 全局音量 × 本地增益 */
    private getEffectiveVolume(): number {
        return Math.min(1, Math.max(0, this.userVolume * this.localGain));
    }

    private applyEffectiveVolume(): void {
        const volume = this.getEffectiveVolume();
        if (Math.abs(this.audio.volume - volume) < 0.001) {
            return;
        }
        this.audio.volume = volume;
    }
}

export default AudioController;
