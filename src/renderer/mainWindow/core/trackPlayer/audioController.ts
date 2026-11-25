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
    /** 设置系统媒体信息（MediaSession metadata） */
    setMetadata(musicItem: IMusicItemSlim | IMusic.IMusicItem): void;
    /** 预准备（清空旧音源） */
    prepareTrack(): void;
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
    /** 有可用音源（已挂载或正在加载）；音源报错后为 false，需重新解析 */
    readonly hasSource: boolean;
    /** 用户是否要求播放：音源加载中时为排队的播放指令，否则为是否正在播放 */
    readonly isPlayRequested: boolean;
    /** 当前播放位置（秒）：音源加载中时为排队的定位，没有则为 0 */
    readonly position: number;
}

// ─── WebAudioController 实现 ───

class WebAudioController extends EventEmitter<IAudioControllerEvents> implements IAudioController {
    private audio: HTMLAudioElement;
    private hls: Hls | null = null;
    private _playerState: PlayerState = PlayerState.None;
    /** 每次释放音源自增，异步返回的旧音源据此丢弃 */
    private _sourceId = 0;
    private _currentBlobUrl: string | null = null; // 追踪 blob URL 防止内存泄漏
    /** 降级 fetch 进行中：音源已确定，尚未挂到 audio 上 */
    private _sourcePending = false;
    private _fetchAbort: AbortController | null = null;
    /** 音源挂载前收到的播放 / 定位指令，挂载后执行 */
    private _playWhenReady = false;
    private _seekWhenReady: number | null = null;
    /** 当前音源已报错，不可复用 */
    private _sourceFailed = false;

    get playerState(): PlayerState {
        return this._playerState;
    }

    get hasSource(): boolean {
        return !this._sourceFailed && (this._sourcePending || this.isAttached);
    }

    get isPlayRequested(): boolean {
        return this._sourcePending
            ? this._playWhenReady
            : this._playerState === PlayerState.Playing;
    }

    get position(): number {
        return this._sourcePending ? (this._seekWhenReady ?? 0) : this.audio.currentTime;
    }

    private get isAttached(): boolean {
        return !!this.audio.src && this.audio.src !== location.href;
    }

    constructor() {
        super();
        this.audio = new Audio();
        this.audio.preload = 'auto';
        this.audio.controls = false;
        this.bindEvents();
    }

    setMetadata(musicItem: IMusicItemSlim | IMusic.IMusicItem): void {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: musicItem.title,
            artist: musicItem.artist,
            album: musicItem.album ?? undefined,
            artwork: musicItem.artwork ? [{ src: musicItem.artwork }] : undefined,
        });
    }

    prepareTrack(): void {
        this.setPlayerState(PlayerState.None);
        this.releaseSource();
        navigator.mediaSession.playbackState = 'none';
    }

    setTrackSource(source: IPlugin.IMediaSourceResult, _musicItem: IMusic.IMusicItem): void {
        this.releaseSource();
        this.setPlayerState(PlayerState.None);
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
            this._sourcePending = true;
            this._fetchAbort = new AbortController();
            fetch(url, { method: 'GET', headers, signal: this._fetchAbort.signal })
                .then((res) => res.blob())
                .then((blob) => {
                    if (this._sourceId !== sourceId) return;
                    this._sourcePending = false;
                    this._fetchAbort = null;
                    this._currentBlobUrl = URL.createObjectURL(blob);
                    this.audio.src = this._currentBlobUrl;
                    if (this._seekWhenReady !== null) {
                        this.audio.currentTime = this._seekWhenReady;
                        this._seekWhenReady = null;
                    }
                    if (this._playWhenReady) {
                        this._playWhenReady = false;
                        this.audio.play().catch(() => {});
                    }
                })
                .catch((err) => {
                    if (this._sourceId !== sourceId) return;
                    this._sourcePending = false;
                    this._fetchAbort = null;
                    this.emit('error', ErrorReason.EmptyResource, err);
                });
            return;
        }

        this.audio.src = url;
    }

    play(): void {
        if (this._sourcePending) {
            this._playWhenReady = true;
        } else if (this.isAttached) {
            this.audio.play().catch(() => {});
        }
    }

    pause(): void {
        if (this._sourcePending) {
            this._playWhenReady = false;
        } else if (this.isAttached) {
            this.audio.pause();
        }
    }

    seekTo(seconds: number): void {
        if (!isFinite(seconds)) return;
        if (this._sourcePending) {
            this._seekWhenReady = seconds;
        } else if (this.isAttached) {
            this.audio.currentTime = Math.min(seconds, this.audio.duration || Infinity);
        }
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
        this.setPlayerState(PlayerState.None);
        this.releaseSource();
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
    }

    destroy(): void {
        this.reset();
        this.removeAllListeners();
    }

    // ─── Private Methods ───

    private bindEvents(): void {
        this.audio.onplaying = () => {
            this.setPlayerState(PlayerState.Playing);
            navigator.mediaSession.playbackState = 'playing';
        };

        this.audio.onpause = () => {
            this.setPlayerState(PlayerState.Paused);
            navigator.mediaSession.playbackState = 'paused';
        };

        this.audio.onerror = (event) => {
            this._sourceFailed = true;
            this.setPlayerState(PlayerState.Paused);
            this.emit('error', ErrorReason.EmptyResource, event);
        };

        this.audio.ontimeupdate = () => {
            this.emit('timeUpdate', {
                currentTime: this.audio.currentTime,
                duration: this.audio.duration,
            });
        };

        this.audio.onended = () => {
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

    /** 释放当前音源（中止进行中的 fetch，销毁 HLS，回收 Blob URL）并使其异步结果失效 */
    private releaseSource(): void {
        this._sourceId++;
        this._fetchAbort?.abort();
        this._fetchAbort = null;
        this._sourcePending = false;
        this._playWhenReady = false;
        this._seekWhenReady = null;
        this._sourceFailed = false;
        this.destroyHls();
        this.revokeBlobUrl();
        this.audio.src = '';
        this.audio.removeAttribute('src');
    }

    private setPlayerState(state: PlayerState): void {
        if (this._playerState !== state) {
            this._playerState = state;
            this.emit('stateChange', state);
        }
    }

    // ─── HLS ───

    private initHls(): void {
        this.destroyHls();
        this.hls = new Hls();
        this.hls.attachMedia(this.audio);

        this.hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (data.fatal) {
                this._sourceFailed = true;
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
