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
import { createFFmpeg } from '@ffmpeg/ffmpeg'; // 移除了未使用的 fetchFile

// FFmpeg 解码相关属性
const ffmpeg = createFFmpeg({
  log: false,
  corePath: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js'
});
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
  private async decodeAudioWithFFmpeg(url: string): Promise<string> {
    if (decodeCache.has(url)) return decodeCache.get(url)!;

    // 按需加载 FFmpeg
    if (!isFfmpegLoaded) {
      await ffmpeg.load();
      isFfmpegLoaded = true;
    }

    try {
      // 获取音频文件元数据
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');

      const arrayBuffer = await response.arrayBuffer();
      // const blob = new Blob([arrayBuffer], { // fetchFile 应该可以直接处理 ArrayBuffer
      //   type: response.headers.get('content-type') || 'application/octet-stream'
      // });
      const fileName = 'input' + (url.split('.').pop() || '.unknown'); // 确保文件名有扩展名

      // 写入虚拟文件系统
      ffmpeg.FS('writeFile', fileName, new Uint8Array(arrayBuffer));
      
      // 转码为 WAV 格式
      await ffmpeg.run('-i', fileName, '-f', 'wav', 'output.wav'); // -f wav 指定输出格式

      // 生成播放 URL
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
    // 简单判断常见的原生支持格式，更完善的判断可以使用 audio.canPlayType
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

  setSinkId(deviceId: string): Promise<void> {
    return (this.audio as any).setSinkId(deviceId);
  }

  setSpeed(speed: number): void {
    this.audio.defaultPlaybackRate = speed;
    this.audio.playbackRate = speed;
  }

  prepareTrack(musicItem: IMusic.IMusicItem) {
    this.musicItem = {...musicItem};

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

  async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): void {
    this.musicItem = {...musicItem};

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
      headers = {...(trackSource.headers ?? {})};
      if (trackSource.userAgent) {
        headers["user-agent"] = trackSource.userAgent;
      }
    }

    // 2.2 convert auth header
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

    // 3. set real source
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
        // 优先尝试 FFmpeg 解码
        const pcmUrl = await this.decodeAudioWithFFmpeg(url);
        this.audio.src = pcmUrl;
      } catch (error) {
        // FFmpeg 解码失败，尝试原生播放
        if (this.isNativeSupported(url)) {
          if (headers) { // 如果 FFmpeg 解码失败，且存在 headers，仍需 fetch + blob
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
