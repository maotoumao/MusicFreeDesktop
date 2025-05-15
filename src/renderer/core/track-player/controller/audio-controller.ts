// src/renderer/core/track-player/controller/audio-controller.ts
/**
 * 播放音乐
 */
import { encodeUrlHeaders } from "@/common/normalize-util";
import albumImg from "@/assets/imgs/album-cover.jpg";
import getUrlExt from "@/renderer/utils/get-url-ext";
import Hls, { Events as HlsEvents, HlsConfig } from "hls.js";
import { isSameMedia, getMediaPrimaryKey } from "@/common/media-util"; // 确保导入 getMediaPrimaryKey
import { PlayerState } from "@/common/constant";
import ServiceManager from "@shared/service-manager/renderer";
import ControllerBase from "@renderer/core/track-player/controller/controller-base";
import { ErrorReason } from "@renderer/core/track-player/enum";
import voidCallback from "@/common/void-callback";
import { IAudioController } from "@/types/audio-controller";
import { decodeAudioWithFFmpeg, clearDecodeCacheKey } from '@/renderer/utils/ffmpeg-decoder'; // 确保导入 decodeAudioWithFFmpeg 和 clearDecodeCacheKey
import { fsUtil } from "@shared/utils/renderer"; // 确保导入

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

  get hasSource() {
    return !!this.audio.src;
  }

  constructor() {
    super();
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.controls = false;

    this.audio.onplaying = () => {
      this.playerState = PlayerState.Playing;
      navigator.mediaSession.playbackState = "playing";
    }

    this.audio.onpause = () => {
      this.playerState = PlayerState.Paused;
      navigator.mediaSession.playbackState = "paused";
    }

    this.audio.onerror = (event) => {
      const currentSrc = this.audio.currentSrc;
      console.error(`[AudioController] HTMLAudioElement error for src: ${currentSrc}`, event);
      this.playerState = PlayerState.Paused; // 确保先设置状态
      navigator.mediaSession.playbackState = "paused";
      this.onError?.(ErrorReason.EmptyResource, event as any); // 直接调用 onError
    }

    this.audio.ontimeupdate = () => {
      this.onProgressUpdate?.({
        currentTime: this.audio.currentTime,
        duration: this.audio.duration,
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


  private isNativeSupported(url: string): boolean {
    const audio = document.createElement('audio'); // 使用临时 audio 元素
    if (!url) return false; // 增加 URL 有效性检查
    const ext = (url.split('.').pop()?.toLowerCase() || '').split('?')[0]; // 移除查询参数
    const mimeType = `audio/${ext}`;

    // 常见格式的快速检查
    if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'opus'].includes(ext)) {
        if (audio.canPlayType(mimeType) !== '') return true;
    }
    // 对于更复杂的 URL 或不常见的扩展名，依赖 canPlayType
    return audio.canPlayType(mimeType) !== '';
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
      this.audio.play().catch((e) => {
        console.error("HTMLAudioElement play() failed:", e);
        this.onError?.(ErrorReason.EmptyResource, e);
      });
    }
  }

  reset(): void {
    this.playerState = PlayerState.None;
    this.audio.src = "";
    this.audio.removeAttribute("src");

    if (this.musicItem) {
      const cacheKeyToClear = getMediaPrimaryKey(this.musicItem);
      clearDecodeCacheKey(cacheKeyToClear);
    }

    this.musicItem = null;
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

  setSinkId(deviceId: string): globalThis.Promise<void> {
    return (this.audio as any).setSinkId(deviceId);
  }

  setSpeed(speed: number): void {
    this.audio.defaultPlaybackRate = speed;
    this.audio.playbackRate = speed;
  }

  prepareTrack(musicItem: IMusic.IMusicItem) {
    this.musicItem = {...musicItem};

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

    this.playerState = PlayerState.None; // 重置状态
    this.audio.src = ""; // 清空旧源
    this.audio.removeAttribute("src");
    navigator.mediaSession.playbackState = "none";
  }

  async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): globalThis.Promise<void> {
    this.musicItem = {...musicItem};

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
    let headers: Record<string, any> | null = null;

    if (url) { // 确保url存在
        const urlObj = new URL(trackSource.url); // 现在可以安全地创建
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
    }


    if (!url) {
      this.onError(ErrorReason.EmptyResource, new Error("url is empty"));
      return;
    }

    const stableCacheKey = getMediaPrimaryKey(musicItem); // 生成稳定的缓存键

    // 尝试原生播放
    if (this.isNativeSupported(url)) {
        console.log(`[AudioController] 原生支持格式，直接播放: ${url}`);
        if (headers) { // 如果仍然有 headers (例如 Authorization)
            fetch(url, { method: "GET", headers })
                .then(async (res) => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    const blob = await res.blob();
                    if (isSameMedia(this.musicItem, musicItem)) { // 检查是否还是当前歌曲
                        this.audio.src = URL.createObjectURL(blob);
                    } else {
                        URL.revokeObjectURL(URL.createObjectURL(blob)); // 不是当前歌曲，释放资源
                    }
                }).catch(e => {
                    console.error(`[AudioController] 带 Headers Fetch 失败 for ${url}:`, e);
                    this.onError?.(ErrorReason.EmptyResource, e);
                });
        } else {
            this.audio.src = url;
        }
    } else if (getUrlExt(trackSource.url) === ".m3u8") {
      console.log(`[AudioController] M3U8 格式，使用 HLS.js 播放: ${url}`);
      if (Hls.isSupported()) {
        this.initHls();
        this.hls.loadSource(url);
      } else {
        console.error('[AudioController] HLS.js 不被支持');
        this.onError(ErrorReason.UnsupportedResource);
        return;
      }
    } else {
      // 非原生支持，尝试 FFmpeg 解码
      console.log(`[AudioController] 非原生支持格式，尝试 FFmpeg 解码: ${url}`);
      try {
        let inputData: string | Uint8Array = url;
        // 对本地文件特殊处理
        if (url.startsWith('file://')) {
            const filePath = decodeURIComponent(url.replace(/^file:\/\//, ''));
            console.log(`[AudioController] 本地文件路径: ${filePath}`);
            const fileContentBuffer = await fsUtil.readFile(filePath, null);
             if (!fileContentBuffer) {
                console.error(`[AudioController] 本地文件读取失败: ${filePath}`);
                this.onError?.(ErrorReason.EmptyResource, new Error(`Failed to read local file: ${filePath}`));
                return;
            }
            inputData = new Uint8Array(fileContentBuffer as ArrayBuffer);
            console.log(`[AudioController] 本地文件读取成功，大小: ${inputData.byteLength}`);
        }
        // 解码操作
        const pcmUrl = await decodeAudioWithFFmpeg(inputData, stableCacheKey);
        console.log(`[AudioController] FFmpeg 解码成功，PCM URL: ${pcmUrl}`);
        if (isSameMedia(this.musicItem, musicItem)) { // 再次检查
            this.audio.src = pcmUrl;
        } else {
            URL.revokeObjectURL(pcmUrl); // 不是当前歌曲，释放资源
        }
      } catch (error) {
        console.error('[AudioController] FFmpeg 解码失败:', error);
        this.onError?.(ErrorReason.UnsupportedResource, error);
        return;
      }
    }
  }

  setVolume(volume: number): void {
    this.audio.volume = volume;
  }
}

export default AudioController;