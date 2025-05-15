// src/renderer/core/track-player/controller/audio-controller.ts
/**
 * 播放音乐
 */
import { encodeUrlHeaders } from "@/common/normalize-util";
import albumImg from "@/assets/imgs/album-cover.jpg";
import getUrlExt from "@/renderer/utils/get-url-ext";
import Hls, { Events as HlsEvents, HlsConfig } from "hls.js";
import { isSameMedia, getMediaPrimaryKey } from "@/common/media-util";
import { PlayerState } from "@/common/constant";
import ServiceManager from "@shared/service-manager/renderer";
import ControllerBase from "@renderer/core/track-player/controller/controller-base";
import { ErrorReason } from "@renderer/core/track-player/enum";
import { IAudioController } from "@/types/audio-controller";
import { decodeAudioWithFFmpeg, clearDecodeCacheKey } from '@/renderer/utils/ffmpeg-decoder';
import { fsUtil } from "@shared/utils/renderer";

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
    return !!this.audio.src && this.audio.src !== 'blob:null/undefined'; // 防止无效的blob url
  }

  constructor() {
    super();
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.controls = false;

    this.audio.onplaying = () => {
      this.playerState = PlayerState.Playing;
      if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
    }

    this.audio.onpause = () => {
      this.playerState = PlayerState.Paused;
      if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
    }

    this.audio.onerror = (event) => {
      const currentSrc = this.audio.currentSrc;
      console.error(`[AudioController] HTMLAudioElement error for src: ${currentSrc}`, event, this.audio.error);
      // 只有在尝试播放后出错才调用onError
      if (this._playerState !== PlayerState.None && this._playerState !== PlayerState.Paused) {
        this.onError?.(ErrorReason.EmptyResource, this.audio.error || event);
      }
      this.playerState = PlayerState.Paused;
      if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
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
    // @ts-ignore
    window.ad = this.audio;
  }


  private isNativeSupported(url: string): boolean {
    const tempAudio = document.createElement('audio');
    if (!url) return false;
    const ext = (url.split('.').pop()?.toLowerCase() || '').split('?')[0];

    // 明确需要 FFmpeg 处理的格式
    if (['wma', 'ape'].includes(ext)) {
        return false;
    }

    const mimeType = `audio/${ext}`;
    // 对于常见的、通常浏览器支持良好的格式，优先尝试原生
    if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'opus', 'flac'].includes(ext)) {
        if (tempAudio.canPlayType(mimeType) !== '') return true;
    }
    // 其他或未知格式，默认也尝试原生，如果原生失败再看是否走FFmpeg
    return tempAudio.canPlayType(mimeType) !== '';
  }


  private initHls(config?: Partial<HlsConfig>) {
    if (this.hls) {
        this.hls.destroy();
    }
    this.hls = new Hls(config);
    this.hls.attachMedia(this.audio);
    this.hls.on(HlsEvents.ERROR, (evt, errorData) => {
      console.error('[AudioController] HLS.js Error:', errorData);
      this.onError(ErrorReason.EmptyResource, errorData);
    })
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
      console.log(`[AudioController] Attempting to play: ${this.audio.src}`);
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.error("[AudioController] HTMLAudioElement play() failed:", e);
          this.onError?.(ErrorReason.EmptyResource, e);
        });
      }
    } else {
        console.warn("[AudioController] Play called but no source is set.");
    }
  }

  reset(): void {
    console.log("[AudioController] Resetting audio controller.");
    this.playerState = PlayerState.None;
    if (this.audio.src && this.audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.audio.src); // 清理旧的 Blob URL
    }
    this.audio.src = "";
    this.audio.removeAttribute("src");

    if (this.musicItem) {
      const cacheKeyToClear = getMediaPrimaryKey(this.musicItem);
      clearDecodeCacheKey(cacheKeyToClear);
      console.log(`[AudioController] Cleared FFmpeg cache for: ${cacheKeyToClear}`);
    }

    this.musicItem = null;
    if (navigator.mediaSession) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
    }
    this.destroyHls(); // 确保 HLS 实例也被清理
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
    if (typeof (this.audio as any).setSinkId === 'function') {
        return (this.audio as any).setSinkId(deviceId);
    }
    return Promise.reject("setSinkId not supported");
  }

  setSpeed(speed: number): void {
    this.audio.defaultPlaybackRate = speed;
    this.audio.playbackRate = speed;
  }

  prepareTrack(musicItem: IMusic.IMusicItem) {
    console.log(`[AudioController] Preparing track: ${musicItem.title}`);
    this.reset(); // 重置状态，包括清理旧的 Blob URL
    this.musicItem = {...musicItem};

    if (navigator.mediaSession) {
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
        navigator.mediaSession.playbackState = "paused"; // 初始设为 paused
    }
    this.playerState = PlayerState.Paused; // 准备好后是暂停状态
  }

  async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): globalThis.Promise<void> {
    console.log(`[AudioController] Setting track source for: ${musicItem.title}, URL: ${trackSource.url}`);
    // 确保在设置新源之前调用 prepareTrack 或 reset
    if (!isSameMedia(this.musicItem, musicItem) || !this.hasSource) {
        this.prepareTrack(musicItem);
    }

    let url = trackSource.url;
    let headers: Record<string, any> | null = null;

    if (url) { // 处理 headers 和认证
        const urlObj = new URL(trackSource.url);
        if (trackSource.headers || trackSource.userAgent) {
            headers = {...(trackSource.headers ?? {})};
            if (trackSource.userAgent) { headers["user-agent"] = trackSource.userAgent; }
        }
        if (urlObj.username && urlObj.password) {
            const authHeader = `Basic ${btoa(`${decodeURIComponent(urlObj.username)}:${decodeURIComponent(urlObj.password)}`)}`;
            urlObj.username = ""; urlObj.password = "";
            headers = {...(headers || {}), Authorization: authHeader };
            url = urlObj.toString();
        }
        if (headers) {
            const forwardedUrl = ServiceManager.RequestForwarderService.forwardRequest(url, "GET", headers);
            if (forwardedUrl) { url = forwardedUrl; headers = null; }
            else if (!headers["Authorization"]) { url = encodeUrlHeaders(url, headers); headers = null; }
        }
    }

    if (!url) {
      console.error("[AudioController] URL is empty after processing.");
      this.onError(ErrorReason.EmptyResource, new Error("Processed URL is empty"));
      return;
    }

    const stableCacheKey = getMediaPrimaryKey(musicItem);

    if (this.isNativeSupported(url)) {
        console.log(`[AudioController] Native support for: ${url}`);
        if (headers) {
            fetch(url, { method: "GET", headers })
                .then(async (res) => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url}`);
                    const blob = await res.blob();
                    if (isSameMedia(this.musicItem, musicItem)) { this.audio.src = URL.createObjectURL(blob); }
                    else { URL.revokeObjectURL(URL.createObjectURL(blob)); }
                }).catch(e => {
                    console.error(`[AudioController] Fetch with headers failed for ${url}:`, e);
                    this.onError?.(ErrorReason.EmptyResource, e);
                });
        } else {
            this.audio.src = url;
        }
    } else if (getUrlExt(trackSource.url) === ".m3u8") {
      console.log(`[AudioController] M3U8 format, using HLS.js: ${url}`);
      if (Hls.isSupported()) {
        this.initHls();
        this.hls.loadSource(url);
      } else {
        console.error('[AudioController] HLS.js is not supported.');
        this.onError(ErrorReason.UnsupportedResource);
      }
    } else {
      console.log(`[AudioController] Not natively supported, attempting FFmpeg decoding for: ${url}`);
      try {
        let inputData: string | Uint8Array = url;
        if (url.startsWith('file://')) {
            let filePath = decodeURIComponent(url.replace(/^file:\/\/\//, '').replace(/\//g, '\\')); // 简单 Windows 路径转换
            if (process.platform !== 'win32') {
                 filePath = decodeURIComponent(url.replace(/^file:\/\//, ''));
            }
            console.log(`[AudioController] Local file path: ${filePath}`);
            if (!(await fsUtil.isFile(filePath))) {
                 console.error(`[AudioController] Local file not found: ${filePath}`);
                 this.onError?.(ErrorReason.EmptyResource, new Error(`Local file not found: ${filePath}`));
                 return;
            }
            const fileContentBuffer = await fsUtil.readFile(filePath, null);
            if (!fileContentBuffer || (fileContentBuffer as ArrayBuffer).byteLength === 0) {
                console.error(`[AudioController] Failed to read local file or file is empty: ${filePath}`);
                this.onError?.(ErrorReason.EmptyResource, new Error(`Failed to read local file or file is empty: ${filePath}`));
                return;
            }
            inputData = new Uint8Array(fileContentBuffer as ArrayBuffer);
            console.log(`[AudioController] Local file read successfully, size: ${inputData.byteLength}`);
        }
        const pcmUrl = await decodeAudioWithFFmpeg(inputData, stableCacheKey);
        console.log(`[AudioController] FFmpeg decoding successful, PCM URL (first 100 chars): ${pcmUrl.substring(0,100)}...`);
        if (isSameMedia(this.musicItem, musicItem)) {
            this.audio.src = pcmUrl;
        } else {
            URL.revokeObjectURL(pcmUrl); // Not the current song, release the object URL
        }
      } catch (error) {
        console.error('[AudioController] FFmpeg decoding failed:', error);
        this.onError?.(ErrorReason.UnsupportedResource, error);
      }
    }
  }

  setVolume(volume: number): void {
    this.audio.volume = volume;
  }
}

export default AudioController;