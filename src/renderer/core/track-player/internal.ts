/**
 * 播放音乐
 */
import { ErrorReason, PlayerState, TrackPlayerEvent } from "./enum";
import trackPlayerEventsEmitter from "./event";
import albumImg from "@/assets/imgs/album-cover.jpg";

class TrackPlayerInternal {
  private audioContext: AudioContext;
  private audio: HTMLAudioElement;
  private playerState: PlayerState;
  private currentMusic: IMusic.IMusicItem;

  constructor() {
    this.audioContext = new AudioContext();
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.controls = false;

    this.registerEvents();
  }

  private throwError(reason: ErrorReason) {
    trackPlayerEventsEmitter.emit(TrackPlayerEvent.Error, reason);
  }

  private setPlayerState(state: PlayerState) {
    this.playerState = state;
    trackPlayerEventsEmitter.emit(TrackPlayerEvent.StateChanged, state);
  }

  private hasSource() {
    return !!this.audio.src;
  }

  private registerEvents() {
    this.audio.onplaying = () => {
      this.setPlayerState(PlayerState.Playing);
      navigator.mediaSession.playbackState = "playing";
    };

    this.audio.onpause = () => {
      this.setPlayerState(PlayerState.Paused);
      navigator.mediaSession.playbackState = "paused";
    };

    this.audio.onerror = (event) => {
      console.log("Play Error:", event);
      this.setPlayerState(PlayerState.Paused);
      trackPlayerEventsEmitter.emit(TrackPlayerEvent.Error, event as any);
    };

    this.audio.ontimeupdate = () => {
      trackPlayerEventsEmitter.emit(TrackPlayerEvent.TimeUpdated, {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration, // 缓冲中是Infinity
      });
    };

    this.audio.onended = () => {
      trackPlayerEventsEmitter.emit(TrackPlayerEvent.PlayEnd);
    };
  }

  /** 设置音源 */
  setTrackSource(
    trackSource: IMusic.IMusicSource,
    musicItem: IMusic.IMusicItem
  ) {
    let url = trackSource.url;
    let formalizedKey: string;
    if (trackSource.headers || trackSource.userAgent) {
      const _setHeaders: Record<string, string> = {};
      const trackSourceHeaders = trackSource.headers ?? {};
      for (const key in trackSourceHeaders) {
        formalizedKey = key.toLowerCase();
        if (formalizedKey === "user-agent") {
          _setHeaders[formalizedKey] =
            trackSourceHeaders[formalizedKey] ?? trackSource.userAgent;
        } else {
          _setHeaders[formalizedKey] = trackSourceHeaders[formalizedKey];
        }
      }
      const encodedUrl = new URL(url);
      encodedUrl.searchParams.set(
        "_setHeaders",
        encodeURIComponent(JSON.stringify(_setHeaders))
      );
      url = encodedUrl.toString();
    }
    if (!url) {
      this.throwError(ErrorReason.EmptyResource);
      return;
    }
    this.currentMusic = musicItem;
    // 更新mediameta
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
    this.audio.src = url;
  }

  /** 暂停播放 */
  pause() {
    if (this.hasSource()) {
      this.audio.pause();
    }
  }

  /** 开始播放 */
  play() {
    if (this.hasSource()) {
      this.audio.play();
    }
  }

  /** 设置音量 */
  setVolume(volume: number) {
    this.audio.volume = volume;
  }

  /** 设置跳转 */
  seekTo(seconds: number) {
    if (this.hasSource() && isFinite(seconds)) {
      const duration = this.audio.duration;
      this.audio.currentTime = Math.min(
        seconds,
        isNaN(duration) ? Infinity : duration
      );
    }
  }

  /** 设置循环 */
  setLoop(isLoop: boolean) {
    this.audio.loop = isLoop;
  }

  /** 清空 */
  clear() {
    this.audio.src = null;
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  }
}

const trackPlayer = new TrackPlayerInternal();
export default trackPlayer;
