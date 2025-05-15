/**
 * 播放音乐
 */
import {encodeUrlHeaders} from "@/common/normalize-util";
import albumImg from "@/assets/imgs/album-cover.jpg";
import getUrlExt from "@/renderer/utils/get-url-ext";
import Hls, {Events as HlsEvents, HlsConfig} from "hls.js";
import {isSameMedia} from "@/common/media-util";
import {PlayerState, localPluginName, browserSupportedAudioExtensions} from "@/common/constant"; // 引入 browserSupportedAudioExtensions
import ServiceManager from "@shared/service-manager/renderer";
import ControllerBase from "@renderer/core/track-player/controller/controller-base";
import {ErrorReason} from "@renderer/core/track-player/enum";
import Dexie from "dexie";
import voidCallback from "@/common/void-callback";
import {IAudioController} from "@/types/audio-controller";
import ffmpegService from "@/renderer/core/ffmpeg"; // 引入 FFmpegService
import logger from "@/shared/logger/renderer"; // 引入 logger

import Promise = Dexie.Promise;


class AudioController extends ControllerBase implements IAudioController {
    private audio: HTMLAudioElement;
    private hls: Hls;
    private currentBlobUrl: string | null = null; // 用于释放之前的 Blob URL

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

    get hasSource() {
        return !!this.audio.src;
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
        }

        this.audio.onpause = () => {
            this.playerState = PlayerState.Paused;
            navigator.mediaSession.playbackState = "paused";
        }

        this.audio.onerror = (event) => {
            // 进一步判断错误类型
            const audioError = this.audio.error;
            let reason = ErrorReason.EmptyResource; // 默认
            let message = "Audio playback error";
            if (audioError) {
                message = `Code: ${audioError.code}, Message: ${audioError.message}`;
                switch (audioError.code) {
                    case MediaError.MEDIA_ERR_ABORTED: // 1
                        // 用户中止
                        return; // 通常不需要作为错误处理
                    case MediaError.MEDIA_ERR_NETWORK: // 2
                        reason = ErrorReason.EmptyResource; // 或特定网络错误
                        message = "Network error during audio playback.";
                        break;
                    case MediaError.MEDIA_ERR_DECODE: // 3
                        reason = ErrorReason.UnsupportedResource; // 或特定解码错误
                        message = "Error decoding audio.";
                        break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: // 4
                        reason = ErrorReason.UnsupportedResource;
                        message = "Audio source not supported.";
                        break;
                }
            }
            logger.logError(`Audio error for ${this.musicItem?.title}`, new Error(message), event);
            this.playerState = PlayerState.Paused;
            navigator.mediaSession.playbackState = "paused";
            this.onError?.(reason, event as any);
        }

        this.audio.ontimeupdate = () => {
            this.onProgressUpdate?.({
                currentTime: this.audio.currentTime,
                duration: this.audio.duration, // 缓冲中是Infinity
            });
        }

        this.audio.onended = () => {
            this.playerState = PlayerState.Paused;
            this.onEnded?.();
        }

        this.audio.onvolumechange = () => {
            this.onVolumeChange?.(this.audio.volume);
        }

        this.audio.onratechange = () => {
            this.onSpeedChange?.(this.audio.playbackRate);
        }

        // @ts-ignore  isDev
        window.ad = this.audio;
    }

    private isNativelySupported(musicItem: IMusic.IMusicItem, mediaSourceUrl?: string): boolean {
        const urlToTest = mediaSourceUrl || musicItem.url;
        if (!urlToTest) return false; // 没有 URL 无法判断

        const extension = getUrlExt(urlToTest)?.toLowerCase();
        if (!extension) return false; // 没有扩展名也难以判断

        // 检查是否在明确支持的列表中
        if (browserSupportedAudioExtensions.includes(extension)) {
            // 对于明确支持的扩展名，可以进一步用 canPlayType 确认
            const audio = document.createElement('audio');
            let mimeType = '';
            switch (extension) {
                case '.mp3': mimeType = 'audio/mpeg'; break;
                case '.wav': mimeType = 'audio/wav'; break;
                case '.ogg': mimeType = 'audio/ogg'; break;
                case '.aac': mimeType = 'audio/aac'; break;
                case '.m4a': mimeType = 'audio/mp4'; break;
                case '.flac': mimeType = 'audio/flac'; break;
                default: return true; // 如果在列表中但没有对应MIME，暂时认为支持
            }
            if (mimeType) {
                const supportLevel = audio.canPlayType(mimeType);
                return supportLevel === 'probably' || supportLevel === 'maybe';
            }
        }
        return false; // 不在已知支持列表中的，默认需要 FFmpeg
    }


    private initHls(config?: Partial<HlsConfig>) {
        if (!this.hls) {
            this.hls = new Hls(config);
            this.hls.attachMedia(this.audio);
            this.hls.on(HlsEvents.ERROR, (evt, error) => {
                this.onError(ErrorReason.EmptyResource, error);
            })
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
            this.audio.pause()
        }
    }

    play(): void {
        if (this.hasSource) {
            this.audio.play().catch(err => {
                logger.logError(`Error playing audio: ${this.musicItem?.title}`, err);
                this.onError?.(ErrorReason.EmptyResource, err); // 或者更具体的错误类型
            });
        }
    }

    reset(): void {
        this.playerState = PlayerState.None;
        this.audio.src = "";
        this.audio.removeAttribute("src");
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
    }

    seekTo(seconds: number): void {
        if (this.hasSource && isFinite(seconds)) {
            const duration = this.audio.duration;
            this.audio.currentTime = Math.min(
                seconds,
                isNaN(duration) ? Infinity : duration
            );
        }
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
        this.musicItem = {...musicItem};
        this.reset(); // 重置时会 revoke 上一个 blobUrl

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
        this.playerState = PlayerState.None; // 明确设置状态
    }

    setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): void {
        this.musicItem = {...musicItem};
        this.reset(); // 重置时会 revoke 上一个 blobUrl

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

        let url = trackSource.url;
        const urlObj = new URL(trackSource.url);
        let headers: Record<string, any> | null = null;

        if (trackSource.headers || trackSource.userAgent) {
            headers = {...(trackSource.headers ?? {})};
            if (trackSource.userAgent) {
                headers["user-agent"] = trackSource.userAgent;
            }
        }

        if (urlObj.username && urlObj.password) {
            const authHeader = `Basic ${btoa(
                `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(
                    urlObj.password
                )}`
            )}`;
            urlObj.username = "";
            urlObj.password = "";
            headers = {
                ...(headers || {}),
                Authorization: authHeader,
            }
            url = urlObj.toString();
        }
        
        const nativelySupported = this.isNativelySupported(musicItem, url);

        if (headers && nativelySupported) { // 对于原生支持的格式，如果需要自定义header，尝试通过service转发
            const forwardedUrl = ServiceManager.RequestForwarderService.forwardRequest(url, "GET", headers);
            if (forwardedUrl) {
                url = forwardedUrl;
                headers = null; // 已转发，清除headers
            } else if (!headers["Authorization"] && !url.startsWith("file://")) { // file协议或有Auth的不能编码header
                url = encodeUrlHeaders(url, headers);
                headers = null;
            }
        }


        if (!url) {
            this.onError(ErrorReason.EmptyResource, new Error("url is empty"));
            return;
        }

        if (nativelySupported) {
            logger.logInfo(`[Player] Natively supported: ${musicItem.title} - ${url}`);
            if (getUrlExt(trackSource.url) === ".m3u8") {
                if (Hls.isSupported()) {
                    this.initHls();
                    this.hls.loadSource(url);
                } else {
                    this.onError(ErrorReason.UnsupportedResource);
                    return;
                }
            } else if (headers) { // 对于需要自定义 header 且无法通过 service 转发的（例如一些本地代理场景）
                fetch(url, { method: "GET", headers })
                    .then(async (res) => {
                        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                        const blob = await res.blob();
                        if (isSameMedia(this.musicItem, musicItem)) {
                            this.currentBlobUrl = URL.createObjectURL(blob);
                            this.audio.src = this.currentBlobUrl;
                        }
                    }).catch(err => {
                        logger.logError(`[Player] Error fetching with custom headers: ${musicItem.title}`, err);
                        this.onError(ErrorReason.EmptyResource, err);
                    });
            }
             else {
                this.audio.src = url;
            }
        } else {
            logger.logInfo(`[Player] Needs transcoding: ${musicItem.title} - ${url}`);
            this.playerState = PlayerState.Buffering;
            this.onPlayerStateChanged?.(this.playerState);

            let inputFileSource: string | File | Blob | Uint8Array = url;
            const inputFileName = musicItem.title || window.path.basename(url); // 提供一个文件名给ffmpeg

            if (musicItem.platform === localPluginName && musicItem.$$localPath) {
                 inputFileSource = musicItem.$$localPath;
            } else if (musicItem.platform === localPluginName && musicItem.url?.startsWith('file:')) {
                 inputFileSource = musicItem.url;
            }
            // 对于其他插件提供的远程 URL，ffmpegService 内部会尝试 fetch

            ffmpegService.transcodeToWav(inputFileSource, inputFileName)
                .then(blob => {
                    if (blob && this.isCurrentMusic(musicItem)) {
                        this.currentBlobUrl = URL.createObjectURL(blob);
                        this.audio.src = this.currentBlobUrl;
                        logger.logInfo(`[Player] Transcoding successful, playing: ${musicItem.title}`);
                    } else if (this.isCurrentMusic(musicItem)) {
                        logger.logError(`[Player] FFmpeg transcoding failed or was cancelled for: ${musicItem.title}`, new Error("Transcoding returned null blob"));
                        this.onError?.(ErrorReason.EmptyResource, new Error("FFmpeg transcoding failed or was cancelled."));
                    }
                })
                .catch(error => {
                     if (this.isCurrentMusic(musicItem)) {
                        logger.logError(`[Player] FFmpeg transcoding error for: ${musicItem.title}`, error);
                        this.onError?.(ErrorReason.UnsupportedResource, error); // 改为UnsupportedResource更合适
                     }
                });
        }
    }

    setVolume(volume: number): void {
        this.audio.volume = volume;
    }

    /**
     * 判断当前 musicItem 是否为传入的 musicItem
     */
    private isCurrentMusic(musicItem: IMusic.IMusicItem): boolean {
        if (!this.musicItem || !musicItem) return false;
        return this.musicItem.id === musicItem.id && this.musicItem.platform === musicItem.platform;
    }
}

export default AudioController;