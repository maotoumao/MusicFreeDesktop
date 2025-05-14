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
// import Promise = Dexie.Promise; // 保持注释或使用 globalThis.Promise
import { FFmpeg } from '@ffmpeg/ffmpeg'; // 使用 { FFmpeg } 导入

// FFmpeg 解码相关属性
const ffmpeg = new FFmpeg(); // 使用 new FFmpeg() 创建实例
let isFfmpegLoaded = false;
const decodeCache = new Map<string, string>();

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
      this.playerState = PlayerState.Paused;
      navigator.mediaSession.playbackState = "paused";
      this.onError?.(ErrorReason.EmptyResource, event as any);
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

  // FFmpeg 解码方法
  private async decodeAudioWithFFmpeg(url: string): globalThis.Promise<string> {
    if (decodeCache.has(url)) return decodeCache.get(url)!;

    // 按需加载 FFmpeg
    if (!isFfmpegLoaded) {
      await ffmpeg.load({ // 配置在 load 方法中传入
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js',
      });
      isFfmpegLoaded = true;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');

      const arrayBuffer = await response.arrayBuffer();
      const fileName = 'input' + (url.split('.').pop() || '.unknown');

      ffmpeg.FS('writeFile', fileName, new Uint8Array(arrayBuffer));
      await ffmpeg.run('-i', fileName, '-f', 'wav', 'output.wav');

      const data = ffmpeg.FS('readFile', 'output.wav');
      const pcmBlob = new Blob([data.buffer], { type: 'audio/wav' });
      const pcmUrl = URL.createObjectURL(pcmBlob);

      decodeCache.set(url, pcmUrl);
      return pcmUrl;
    } catch (error) {
      console.error('FFmpeg 解码失败:', error);
      throw error;
    }
  }

  // 判断浏览器是否原生支持该格式
  private isNativeSupported(url: string): boolean {
    const audio = new Audio();
    const ext = url.split('.').pop()?.toLowerCase() || '';
    return ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext) ||
           audio.canPlayType(`audio/${ext}`) !== '';
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

    this.playerState = PlayerState.None;
    this.audio.src = "";
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

    if (getUrlExt(trackSource.url) === ".m3u8") {
      if (Hls.isSupported()) {
        this.initHls();
        this.hls.loadSource(url);
      } else {
        this.onError(ErrorReason.UnsupportedResource);
        return;
      }
    } else {
      try {
        const pcmUrl = await this.decodeAudioWithFFmpeg(url);
        this.audio.src = pcmUrl;
      } catch (error) {
        if (this.isNativeSupported(url)) {
          if (headers) {
            fetch(url, {
                method: "GET",
                headers: {
                    ...headers,
                },
            })
            .then(async (res) => {
                const blob = await res.blob();
                if (isSameMedia(this.musicItem, musicItem)) {
                    this.audio.src = URL.createObjectURL(blob);
                }
            }).catch(e => {
                console.error('Fetch with headers failed:', e);
                this.onError?.(ErrorReason.EmptyResource, e);
            });
          } else {
             this.audio.src = url;
          }
        } else {
          console.error('无法播放该格式:', error);
          this.onError?.(ErrorReason.EmptyResource, error);
          return;
        }
      }
    }
  }

  setVolume(volume: number): void {
    this.audio.volume = volume;
  }
}

export default AudioController;
