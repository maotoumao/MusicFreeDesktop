import { ipcRendererOn, ipcRendererSend } from "@/common/ipc-util/renderer";
import trackPlayer from "../track-player";
import {
  PlayerState,
  RepeatMode,
  TrackPlayerEvent,
} from "../track-player/enum";
import trackPlayerEventsEmitter from "../track-player/event";
import rendererAppConfig from "@/common/app-config/renderer";

function getCurrentMusicData() {
  const currentMusic = trackPlayer.getCurrentMusic();
  const currentLyric = trackPlayer.getLyric();
  const currentPlayerState = trackPlayer.getPlayerState();
  const progress = trackPlayer.getProgress();
  const repeatMode = trackPlayer.getRepeatMode();
  return {
    music: currentMusic
      ? {
          platform: currentMusic.platform,
          title: currentMusic.title,
          artist: currentMusic.artist,
          id: currentMusic.id,
          album: currentMusic.album,
          artwork: currentMusic.artwork,
        }
      : null,
    lyric: currentLyric?.parser?.getLyric() ?? null,
    currentLyric: currentLyric?.currentLrc,
    playerState: currentPlayerState,
    progress,
    repeatMode,
  };
}

/** 时序 */
async function setupMessageManager() {
  const currentMusicData = getCurrentMusicData();
  /** 初始同步一次 */
  ipcRendererSend("sync-current-music", currentMusicData.music);
  ipcRendererSend("sync-current-playing-state", currentMusicData.playerState);
  ipcRendererSend("sync-current-repeat-mode", currentMusicData.repeatMode);

  // 扩展窗口挂载时同步消息
  //   window.mainPort.onMount((from) => {
  //     console.log("mount!!!!");
  //     window.mainPort.sendTo(from, {
  //       data: getCurrentMusicData(),
  //       type: "sync-all-data",
  //       timestamp: Date.now(),
  //     });
  //   });

  const cmdHandler = (data: any) => {
    const { cmd, payload } = data;
    if (cmd === "skip-next") {
      trackPlayer.skipToNext();
    } else if (cmd === "skip-prev") {
      trackPlayer.skipToPrev();
    } else if (cmd === "set-repeat-mode") {
      trackPlayer.setRepeatMode(payload as RepeatMode);
    } else if (cmd === "set-player-state") {
      if (payload === PlayerState.Playing) {
        trackPlayer.resumePlay();
      } else {
        trackPlayer.pause();
      }
    }
  };

  ipcRendererOn("player-cmd", cmdHandler);

  window.mainPort.on((message, from) => {
    console.log(`[Message from window${from}] `, message);
    const { data, type } = message ?? {};
    if (type === "cmd") {
      cmdHandler(data);
    } else if (type === "sync-all-data") {
      window.mainPort.sendTo(from, {
        data: getCurrentMusicData(),
        type: "sync-all-data",
        timestamp: Date.now(),
      });
    }
  });

  trackPlayerEventsEmitter.on(TrackPlayerEvent.MusicChanged, (currentMusic) => {
    // 同步主进程
    const simplifiedMusicItem = currentMusic
      ? {
          platform: currentMusic.platform,
          title: currentMusic.title,
          artist: currentMusic.artist,
          id: currentMusic.id,
          album: currentMusic.album,
          artwork: currentMusic.artwork,
        }
      : null;
    /** 同步主进程 */
    ipcRendererSend("sync-current-music", simplifiedMusicItem);
    /** 同步其他渲染窗口 */
    window.mainPort.broadcast({
      data: simplifiedMusicItem,
      type: "sync-current-music",
      timestamp: Date.now(),
    });
    window.mainPort.broadcast({
      data: {},
      type: "sync-current-lyric",
      timestamp: Date.now(),
    });
  });

  trackPlayerEventsEmitter.on(TrackPlayerEvent.StateChanged, (state) => {
    ipcRendererSend("sync-current-playing-state", state);
    window.mainPort.broadcast({
      data: state,
      type: "sync-current-playing-state",
      timestamp: Date.now(),
    });
  });

  trackPlayerEventsEmitter.on(TrackPlayerEvent.RepeatModeChanged, (mode) => {
    ipcRendererSend("sync-current-repeat-mode", mode);
    window.mainPort.broadcast({
      data: mode,
      type: "sync-current-repeat-mode",
      timestamp: Date.now(),
    });
  });

  trackPlayerEventsEmitter.on(TrackPlayerEvent.LyricChanged, (lyric) => {
    window.mainPort.broadcast({
      data: lyric?.getLyric() ?? null,
      type: "sync-lyric",
      timestamp: Date.now(),
    });
  });

  trackPlayerEventsEmitter.on(TrackPlayerEvent.CurrentLyricChanged, (lyric) => {
    if (window.globalData.platform === 'darwin' && rendererAppConfig.getAppConfigPath('lyric.enableStatusBarLyric')) {
      // 只有macos需要同步歌词，用来设置状态栏歌词
      ipcRendererSend('sync-current-lyric', lyric?.lrc?.lrc ?? '');
    }
    window.mainPort.broadcast({
      data: lyric,
      type: "sync-current-lyric",
      timestamp: Date.now(),
    });
  });

  // let lastSyncProgress = 0;
  // trackPlayerEventsEmitter.on(TrackPlayerEvent.ProgressChanged, (progress) => {
  //   const timeStamp = Date.now();
  //   // 100s同步一次
  //   if (timeStamp - lastSyncProgress > 100) {
  //     window.mainPort.broadcast({
  //       data: progress,
  //       type: "sync-progress",
  //       timestamp: Date.now(),
  //     });
  //     lastSyncProgress = timeStamp;
  //   }
  // });
}

const MessageManager = {
  setupMessageManager,
};

export default MessageManager;
