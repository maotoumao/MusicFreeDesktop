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
import { getGlobalContext } from "@shared/global-context/renderer";

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
    return !!this.audio.src && this.audio.src !== 'blob:null/undefined' && !this.audio.src.endsWith("null");
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
      console.error(`[AudioController] HTMLAudioElement error. Src: ${currentSrc || 'not set'}, Error:`, this.audio.error, event);
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


  private isNativeSupported(urlOrExt: string): boolean {
    const tempAudio = document.createElement('audio');
    if (!urlOrExt) return false;

    let ext = '';
    if (urlOrExt.includes('.')) {
        ext = (urlOrExt.split('.').pop()?.toLowerCase() || '').split('?')[0];
    } else {
        ext = urlOrExt.toLowerCase();
    }

    // 这些格式通常需要 FFmpeg
    const ffmpegRequiredFormats = ['wma', 'ape', 'dsf', 'dff', 'tak', 'm4a']; // 将 m4a 也加入强制 FFmpeg 的列表
    if (ffmpegRequiredFormats.includes(ext)) {
        console.log(`[AudioController] Format ${ext} explicitly configured to use FFmpeg.`);
        return false;
    }

    const mimeType = `audio/${ext}`;
    if (['mp3', 'wav', 'ogg', 'aac', 'opus', 'flac'].includes(ext)) { // aac 通常指 audio/aac 或 audio/mp4 (m4a的另一种方式)
        const canPlay = tempAudio.canPlayType(mimeType);
        console.log(`[AudioController] Native support check for common format ${mimeType}: ${canPlay}`);
        if (canPlay !== '') return true;
    }
    
    const canPlayDefault = tempAudio.canPlayType(mimeType);
    console.log(`[AudioController] Default native support check for ${mimeType}: ${canPlayDefault}`);
    return canPlayDefault !== '';
  }


  private initHls(config?: Partial<HlsConfig>) {
    if (this.hls) {
        this.hls.destroy();
    }
    this.hls = new Hls({
        debug: false,
        ...config
    });
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
      console.log(`[AudioController] Attempting to play valid source: ${this.audio.src.substring(0,100)}...`);
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.error("[AudioController] HTMLAudioElement play() failed:", e, "Current src:", this.audio.currentSrc);
          this.onError?.(ErrorReason.EmptyResource, e);
        });
      }
    } else {
        console.warn("[AudioController] Play called but no source is set. Current audio.src:", this.audio.src);
    }
  }

  reset(): void {
    console.log("[AudioController] Resetting audio controller.");
    this.playerState = PlayerState.None;
    if (this.audio.src && this.audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(this.audio.src);
        console.log("[AudioController] Revoked old Blob URL:", this.audio.src.substring(0,100));
    }
    this.audio.src = "";
    this.audio.removeAttribute("src");

    if (this.musicItem) {
      const cacheKeyToClear = getMediaPrimaryKey(this.musicItem);
      clearDecodeCacheKey(cacheKeyToClear);
      console.log(`[AudioController] Cleared FFmpeg cache for key: ${cacheKeyToClear}`);
    }

    this.musicItem = null;
    if (navigator.mediaSession) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
    }
    this.destroyHls();
  }

  seekTo(seconds: number): void {
    if (this.hasSource && isFinite(seconds) && !isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
      this.audio.currentTime = Math.min(seconds, this.audio.duration);
    } else if (this.hasSource && isFinite(seconds)) {
      this.audio.currentTime = seconds;
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
    this.reset(); 
    this.musicItem = {...musicItem};

    if (navigator.mediaSession) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: musicItem.title,
          artist: musicItem.artist,
          album: musicItem.album,
          artwork: musicItem.artwork ? [{ src: musicItem.artwork }] : [],
        });
        navigator.mediaSession.playbackState = "paused";
    }
    this.playerState = PlayerState.Paused;
  }

  async setTrackSource(trackSource: IMusic.IMusicSource, musicItem: IMusic.IMusicItem): globalThis.Promise<boolean> { // 返回 Promise<boolean>
    console.log(`[AudioController] setTrackSource START for: ${musicItem.title}`);
    
    if (!isSameMedia(this.musicItem, musicItem) || !this.hasSource || this.audio.src === "") {
        this.prepareTrack(musicItem);
    }

    let url = trackSource.url;
    let headers: Record<string, any> | null = null;

    if (url) { 
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
      console.error("[AudioController] URL is empty after processing for " + musicItem.title);
      this.onError(ErrorReason.EmptyResource, new Error("Processed URL is empty for " + musicItem.title));
      return false;
    }

    const stableCacheKey = getMediaPrimaryKey(musicItem);
    const sourceExt = getUrlExt(url) || musicItem.suffix || 'unknown';
    console.log(`[AudioController] Final URL: ${url.substring(0,100)}..., Extension: ${sourceExt}`);

    try {
        if (this.isNativeSupported(sourceExt)) {
            console.log(`[AudioController] Native support for: ${url.substring(0,100)}...`);
            if (headers) {
                await fetch(url, { method: "GET", headers }) // await fetch
                    .then(async (res) => {
                        if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url}`);
                        const blob = await res.blob();
                        if (isSameMedia(this.musicItem, musicItem)) { 
                            const blobUrl = URL.createObjectURL(blob);
                            console.log(`[AudioController] Setting audio.src (native, with headers) to Blob URL: ${blobUrl.substring(0,100)}`);
                            this.audio.src = blobUrl;
                        } else { 
                            console.warn("[AudioController] Song changed during fetch, revoking Blob URL.");
                            URL.revokeObjectURL(URL.createObjectURL(blob));
                        }
                    });
            } else {
                console.log(`[AudioController] Setting audio.src (native) to: ${url.substring(0,100)}`);
                this.audio.src = url;
            }
            return true;
        } else if (sourceExt === ".m3u8" || sourceExt === "m3u8") {
            console.log(`[AudioController] M3U8 format, using HLS.js: ${url.substring(0,100)}...`);
            if (Hls.isSupported()) {
                this.initHls();
                this.hls.loadSource(url);
                console.log(`[AudioController] HLS source loaded.`);
                return true;
            } else {
                console.error('[AudioController] HLS.js is not supported.');
                this.onError(ErrorReason.UnsupportedResource);
                return false;
            }
        } else {
            console.log(`[AudioController] FFmpeg decoding for: ${url.substring(0,100)}...`);
            this.playerState = PlayerState.Buffering;
            let inputData: string | Uint8Array = url;
            if (url.startsWith('file://')) {
                let filePath = decodeURIComponent(url.replace(/^file:\/\/\//, ''));
                if (getGlobalContext().platform === 'win32') {
                    filePath = filePath.replace(/\//g, '\\');
                    if (filePath.match(/^\\[a-zA-Z]:/)) {
                       filePath = filePath.substring(1);
                    }
                }
                console.log(`[AudioController] Local file path for FFmpeg: ${filePath}`);

                if (!(await fsUtil.isFile(filePath))) {
                     console.error(`[AudioController] Local file not found: ${filePath}`);
                     this.onError?.(ErrorReason.EmptyResource, new Error(`Local file not found: ${filePath}`));
                     return false;
                }
                const fileContentBuffer = await fsUtil.readFile(filePath, null);
                if (!fileContentBuffer || (fileContentBuffer as ArrayBuffer).byteLength === 0) {
                    console.error(`[AudioController] Failed to read local file or file is empty: ${filePath}`);
                    this.onError?.(ErrorReason.EmptyResource, new Error(`Failed to read local file or file is empty: ${filePath}`));
                    return false;
                }
                inputData = new Uint8Array(fileContentBuffer as ArrayBuffer);
            }
            
            const pcmUrl = await decodeAudioWithFFmpeg(inputData, stableCacheKey);
            console.log(`[AudioController] FFmpeg pcmUrl received: ${pcmUrl.substring(0,100)}...`);

            if (isSameMedia(this.musicItem, musicItem)) {
                console.log(`[AudioController] Setting audio.src (FFmpeg) to Blob URL: ${pcmUrl.substring(0,100)}...`);
                this.audio.src = pcmUrl;
                // this.playerState = PlayerState.Paused; // FFmpeg解码成功，可以认为已准备好，等待播放指令
                return true;
            } else {
                console.warn("[AudioController] Song changed during FFmpeg decoding, revoking new Blob URL.");
                URL.revokeObjectURL(pcmUrl);
                return false;
            }
        }
    } catch (error) {
        console.error('[AudioController] Error in setTrackSource for ' + musicItem.title + ':', error);
        this.playerState = PlayerState.Paused;
        this.onError?.(ErrorReason.UnsupportedResource, error);
        return false;
    }
  }

  setVolume(volume: number): void {
    this.audio.volume = volume;
  }
}

export default AudioController;