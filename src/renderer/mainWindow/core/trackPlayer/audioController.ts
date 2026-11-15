/**
 * AudioController — IAudioController 接口 + WebAudioController 实现
 *
 * 底层音频播放抽象，面向接口编程。
 * 当前实现：WebAudioController（HTMLAudioElement + HLS）
 * 未来扩展：MpvAudioController 等
 */
import EventEmitter from 'eventemitter3';
import Hls from 'hls.js';
import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
import { PlayerState, ErrorReason } from '@common/constant';
import requestForwarder from '@infra/requestForwarder/renderer';

// ─── 事件类型 ───

export interface IAudioControllerEvents {
    /** 播放状态变化 */
    stateChange: (state: PlayerState) => void;
    /** 播放进度更新 */
    timeUpdate: (progress: { currentTime: number; duration: number }) => void;
    /** 播放结束（携带结束瞬间的位置，供上层区分自然播完与流被截断） */
    ended: (info: { currentTime: number; duration: number }) => void;
    /** 播放错误 */
    error: (reason: ErrorReason, detail?: any) => void;
    /** 音量变化 */
    volumeChange: (volume: number) => void;
    /** 速度变化 */
    speedChange: (speed: number) => void;
}

// ─── 接口定义 ───

/** 音频控制器接口 — 所有实现必须遵守 */
export interface IAudioController extends EventEmitter<IAudioControllerEvents> {
    /** 预准备（设置 MediaSession metadata，清空旧音源） */
    prepareTrack(musicItem: IMusicItemSlim): void;
    /** 设置音源并可选自动播放 */
    setTrackSource(source: IPlugin.IMediaSourceResult, musicItem: IMusic.IMusicItem): void;
    play(): void;
    pause(): void;
    seekTo(seconds: number): void;
    reset(): void;
    destroy(): void;

    setVolume(volume: number): void;
    setSpeed(speed: number): void;
    setSinkId(deviceId: string): Promise<void>;

    readonly playerState: PlayerState;
    readonly hasSource: boolean;
}

// ─── WebAudioController 实现 ───

class WebAudioController extends EventEmitter<IAudioControllerEvents> implements IAudioController {
    private audio: HTMLAudioElement;
    private hls: Hls | null = null;
    private _playerState: PlayerState = PlayerState.None;
    private _sourceId = 0; // 音源版本：释放后旧异步结果不可再生效
    private _currentBlobUrl: string | null = null; // 追踪 blob URL 防止内存泄漏
    private _sourceAbortController: AbortController | null = null;
    private _playRequested = false;
    private _pendingSeek: number | null = null;

    get playerState(): PlayerState {
        return this._playerState;
    }

    get hasSource(): boolean {
        return !!this.audio.src && this.audio.src !== location.href && !this.audio.error;
    }

    constructor() {
        super();
        this.audio = new Audio();
        this.audio.preload = 'auto';
        this.audio.controls = false;
        this.bindEvents();
    }

    prepareTrack(musicItem: IMusicItemSlim): void {
        this.releaseSource();
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album ?? undefined,
            artwork: musicItem.artwork ? [{ src: musicItem.artwork }] : undefined,
        });
        this.setPlayerState(PlayerState.None);
    }

    setTrackSource(source: IPlugin.IMediaSourceResult, _musicItem: IMusic.IMusicItem): void {
        this.releaseSource();
        // 换源仍需让下一次 playing 发出状态变化，但不要用清理状态覆盖上层的 Buffering。
        this.setPlayerState(PlayerState.None, false);
        const sourceId = this._sourceId;

        // 从 URL 的 userinfo 部分提取 Basic Auth（如 http://user:pass@host/...）
        const { cleanUrl: url, authHeader } = this.extractBasicAuth(source.url!);
        let headers = this.buildHeaders(source);
        if (authHeader) {
            if (!headers) headers = {};
            headers['Authorization'] = authHeader;
        }

        // HLS 支持
        if (this.isHls(source.url!)) {
            if (Hls.isSupported()) {
                this.initHls();
                if (headers) {
                    // HLS 自定义 header 通过 xhrSetup
                    this.hls!.config.xhrSetup = (xhr: XMLHttpRequest) => {
                        for (const [key, value] of Object.entries(headers)) {
                            xhr.setRequestHeader(key, value);
                        }
                    };
                }
                this.hls!.loadSource(url);
            } else {
                this.emit('error', ErrorReason.UnsupportedResource);
            }
            return;
        }

        // 带 header 的非 HLS：通过代理服务器
        if (headers) {
            const proxyUrl = requestForwarder.buildProxyUrl(url, headers);
            if (proxyUrl !== url) {
                // 代理可用，直接设置代理 URL
                this.audio.src = proxyUrl;
                return;
            }
            // 代理不可用，降级到 fetch
            this._sourceAbortController = new AbortController();
            fetch(url, { method: 'GET', headers, signal: this._sourceAbortController.signal })
                .then((res) => {
                    if (!res.ok) throw new Error(`Media request failed: HTTP ${res.status}`);
                    return res.blob();
                })
                .then((blob) => {
                    // 竞态守卫：fetch 期间可能已切歌
                    if (this._sourceId !== sourceId) return;
                    this._currentBlobUrl = URL.createObjectURL(blob);
                    this.audio.src = this._currentBlobUrl;
                })
                .catch((err) => {
                    if (this._sourceId !== sourceId) return;
                    this._playRequested = false;
                    this.setPlayerState(PlayerState.Paused);
                    this.emit('error', ErrorReason.EmptyResource, err);
                })
                .finally(() => {
                    if (this._sourceId === sourceId) this._sourceAbortController = null;
                });
            return;
        }

        this.audio.src = url;
    }

    play(): void {
        this._playRequested = true;
        if (this.hasSource) {
            const sourceId = this._sourceId;
            this.audio.play().catch((err) => {
                // pause/load 会取消尚未完成的 play；只报告当前音源的实际失败。
                if (
                    this._sourceId !== sourceId ||
                    err.name === 'AbortError' ||
                    this.audio.error // 媒体错误由 onerror 统一报告，避免重复跳歌。
                ) {
                    return;
                }
                this._playRequested = false;
                this.setPlayerState(PlayerState.Paused);
                this.emit('error', ErrorReason.EmptyResource, err);
            });
        }
    }

    pause(): void {
        this._playRequested = false;
        this.audio.pause();
        // 无 src 的 fetch 等待期也必须结束 UI 的 Buffering；原生 pause 可能不会触发。
        if (this._playerState === PlayerState.Paused) {
            this.emit('stateChange', PlayerState.Paused);
        } else {
            this.setPlayerState(PlayerState.Paused);
        }
    }

    seekTo(seconds: number): void {
        if (!isFinite(seconds)) return;
        const target = Math.max(0, seconds);
        if (!this.hasSource || this.audio.readyState < HTMLMediaElement.HAVE_METADATA) {
            this._pendingSeek = target;
            return;
        }
        this._pendingSeek = null;
        this.audio.currentTime = Math.min(target, this.audio.duration || Infinity);
    }

    setVolume(volume: number): void {
        this.audio.volume = Math.max(0, Math.min(1, volume));
    }

    setSpeed(speed: number): void {
        this.audio.defaultPlaybackRate = speed;
        this.audio.playbackRate = speed;
    }

    setSinkId(deviceId: string): Promise<void> {
        return (this.audio as any).setSinkId(deviceId);
    }

    reset(): void {
        this.releaseSource();
        this.setPlayerState(PlayerState.None);
        navigator.mediaSession.metadata = null;
    }

    destroy(): void {
        this.reset();
        this.removeAllListeners();
    }

    // ─── Private Methods ───

    /** 切歌、换源和清空共用同一释放路径，先使旧异步结果失效。 */
    private releaseSource(): void {
        ++this._sourceId;
        this._sourceAbortController?.abort();
        this._sourceAbortController = null;
        this._playRequested = false;
        this._pendingSeek = null;
        this.destroyHls();
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.revokeBlobUrl();
    }

    private bindEvents(): void {
        this.audio.onloadedmetadata = () => {
            if (this._pendingSeek !== null) this.seekTo(this._pendingSeek);
        };

        this.audio.oncanplay = () => {
            // fetch/HLS 的音源异步挂载，保留之前的播放请求；恢复状态不自动播放。
            if (this._playRequested && this.audio.paused) this.play();
        };

        this.audio.onplaying = () => {
            if (!this.hasSource || this.audio.paused) return;
            this.setPlayerState(PlayerState.Playing);
        };

        this.audio.onpause = () => {
            if (!this.hasSource || !this.audio.paused) return;
            this.setPlayerState(PlayerState.Paused);
        };

        this.audio.onerror = (event) => {
            // hasSource 会排除失效源，此处检查原始 src 才能继续传播真实媒体错误。
            if (!this.audio.src || this.audio.src === location.href || !this.audio.error) return;
            this._playRequested = false;
            this.setPlayerState(PlayerState.Paused);
            this.emit('error', ErrorReason.EmptyResource, event);
        };

        this.audio.ontimeupdate = () => {
            if (!this.hasSource) return;
            this.emit('timeUpdate', {
                currentTime: this.audio.currentTime,
                duration: this.audio.duration,
            });
        };

        this.audio.onended = () => {
            if (!this.hasSource) return;
            this._playRequested = false;
            this.setPlayerState(PlayerState.Paused);
            this.emit('ended', {
                currentTime: this.audio.currentTime,
                duration: this.audio.duration,
            });
        };

        this.audio.onvolumechange = () => {
            this.emit('volumeChange', this.audio.volume);
        };

        this.audio.onratechange = () => {
            this.emit('speedChange', this.audio.playbackRate);
        };
    }

    private setPlayerState(state: PlayerState, notify = true): void {
        navigator.mediaSession.playbackState =
            state === PlayerState.Playing
                ? 'playing'
                : state === PlayerState.Paused
                  ? 'paused'
                  : 'none';
        if (this._playerState !== state) {
            this._playerState = state;
            if (notify) this.emit('stateChange', state);
        }
    }

    // ─── HLS ───

    private initHls(): void {
        const sourceId = this._sourceId;
        this.hls = new Hls();
        this.hls.attachMedia(this.audio);

        this.hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (data.fatal && this._sourceId === sourceId) {
                this._playRequested = false;
                this.setPlayerState(PlayerState.Paused);
                this.emit('error', ErrorReason.EmptyResource, data);
            }
        });
    }

    private destroyHls(): void {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
    }

    private isHls(url: string): boolean {
        try {
            const pathname = new URL(url).pathname;
            return pathname.endsWith('.m3u8');
        } catch {
            return url.includes('.m3u8');
        }
    }

    private revokeBlobUrl(): void {
        if (this._currentBlobUrl) {
            URL.revokeObjectURL(this._currentBlobUrl);
            this._currentBlobUrl = null;
        }
    }

    /** 从 URL 的 userinfo 部分提取 Basic Auth 凭证 */
    private extractBasicAuth(url: string): { cleanUrl: string; authHeader?: string } {
        try {
            const parsed = new URL(url);
            if (parsed.username) {
                const auth =
                    'Basic ' +
                    btoa(
                        decodeURIComponent(parsed.username) +
                            ':' +
                            decodeURIComponent(parsed.password),
                    );
                parsed.username = '';
                parsed.password = '';
                return { cleanUrl: parsed.href, authHeader: auth };
            }
        } catch {
            /* not a valid URL, skip */
        }
        return { cleanUrl: url };
    }

    private buildHeaders(source: IPlugin.IMediaSourceResult): Record<string, string> | null {
        const headers: Record<string, string> = {};
        if (source.headers) {
            Object.assign(headers, source.headers);
        }
        if (source.userAgent) {
            headers['User-Agent'] = source.userAgent;
        }
        return Object.keys(headers).length > 0 ? headers : null;
    }
}

// ─── 工厂模式 ───

export type AudioControllerFactory = () => IAudioController;

const controllerFactories: Record<string, AudioControllerFactory> = {
    'web-audio': () => new WebAudioController(),
    // 未来：
    // 'mpv': () => new MpvAudioController(),
};

export function createAudioController(type = 'web-audio'): IAudioController {
    const factory = controllerFactories[type];
    if (!factory) throw new Error(`Unknown audio controller: ${type}`);
    return factory();
}
