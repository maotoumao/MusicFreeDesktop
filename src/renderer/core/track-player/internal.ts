/**
 * 播放音乐
 */
import { encodeUrlHeaders } from "@/common/normalize-util";
import { ErrorReason, PlayerState, TrackPlayerEvent } from "./enum";
import trackPlayerEventsEmitter from "./event";
import albumImg from "@/assets/imgs/album-cover.jpg";
import getUrlExt from "@/renderer/utils/get-url-ext";
import Hls from "hls.js";

class TrackPlayerInternal {
  private audioContext: AudioContext;
  private audio: HTMLAudioElement;
  private hls: Hls;
  private playerState: PlayerState;
  private currentMusic: IMusic.IMusicItem;

  constructor() {
    this.audioContext = new AudioContext();
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.controls = false;
    this.hls = new Hls();
    this.hls.attachMedia(this.audio);
    // @ts-ignore
    this.hls.on("hlsError", () => {
      this.throwError(ErrorReason.EmptyResource);
    });

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
      trackPlayerEventsEmitter.emit(TrackPlayerEvent.ProgressChanged, {
        currentTime: this.audio.currentTime,
        duration: this.audio.duration, // 缓冲中是Infinity
      });
    };

    this.audio.onended = () => {
      trackPlayerEventsEmitter.emit(TrackPlayerEvent.PlayEnd);
    };

    this.audio.onvolumechange = (evt) => {
      trackPlayerEventsEmitter.emit(
        TrackPlayerEvent.VolumeChanged,
        this.audio.volume
      );
    };

    this.audio.onratechange = () => {
      trackPlayerEventsEmitter.emit(
        TrackPlayerEvent.SpeedChanged,
        this.audio.playbackRate
      );
    };
  }

  /** 设置音源 */
  setTrackSource(
    trackSource: IMusic.IMusicSource,
    musicItem: IMusic.IMusicItem
  ) {
    let url = trackSource.url;
    if (trackSource.headers || trackSource.userAgent) {
      const trackSourceHeaders = trackSource.headers ?? {};
      if (trackSource.userAgent) {
        trackSourceHeaders["user-agent"] = trackSource.userAgent;
      }

      url = encodeUrlHeaders(url, trackSourceHeaders);
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
    // 拓展播放功能
    if (getUrlExt(url) === ".m3u8" && Hls.isSupported()) {
      this.hls.loadSource(url);
    } else {
      const urlObj = new URL(trackSource.url);
      if (urlObj.username && urlObj.password) {
        // TODO: 这部分逻辑需要抽离出来 特殊逻辑
        const mediaSource = new MediaSource();
        this.audio.src = URL.createObjectURL(mediaSource);
        mediaSource.addEventListener("sourceopen", () => {
          const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");

          const authHeader = `Basic ${btoa(
            `${decodeURIComponent(urlObj.username)}:${decodeURIComponent(
              urlObj.password
            )}`
          )}`;
          urlObj.username = "";
          urlObj.password = "";
          fetch(urlObj.toString(), {
            method: "GET",
            headers: {
              ...trackSource.headers,
              Authorization: authHeader,
            },
          })
            .then((res) => res.arrayBuffer())
            .then((buf) => {
              sourceBuffer.addEventListener("updateend", () => {
                mediaSource.endOfStream();
              })
              sourceBuffer.appendBuffer(buf);

            });
        });

      } else {
        this.audio.src = url;
      }
    }
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
      this.audio.play().catch((e) => {
        // 播放失败会自动被onerror监控到
        // trackPlayerEventsEmitter.emit(TrackPlayerEvent.Error, e);
      });
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
    this.setPlayerState(PlayerState.Paused);
    this.audio.src = "";
    this.audio.removeAttribute("src");
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  }

  /** 设置倍速 */
  setSpeed(speed: number) {
    this.audio.defaultPlaybackRate = speed;
    this.audio.playbackRate = speed;
  }

  /** 设置设备 */
  async setSinkId(deviceId: string) {
    return (this.audio as any).setSinkId(deviceId);
  }
}

const trackPlayer = new TrackPlayerInternal();
export default trackPlayer;
