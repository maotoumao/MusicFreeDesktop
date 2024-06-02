import { TrackPlayerSyncType } from "@/common/constant";
import trackPlayer from "../track-player";
import { PlayerState, TrackPlayerEvent } from "../track-player/enum";
import { getAppConfigPath } from "@/shared/app-config/renderer";
import { getGlobalContext } from "@/shared/global-context/renderer";
import MessageHub from "@/shared/message-hub/renderer";
import throttle from "lodash.throttle";
import { ipcRendererSend } from "@/shared/ipc/renderer";

const broadcast = MessageHub.broadcast;

export function setupCommandHandler<T extends keyof ICommon.ICommand>() {
  MessageHub.on("data", (raw) => {
    const cmd: T = raw?.cmd;
    const data: ICommon.ICommand[T] = raw?.data;

    switch (cmd) {
      case "SkipToNext":
        trackPlayer.skipToNext();
        break;
      case "SkipToPrevious":
        trackPlayer.skipToPrev();
        break;
      case "SetRepeatMode":
        trackPlayer.setRepeatMode(data);
        break;
      case "SetPlayerState":
        data === PlayerState.Playing
          ? trackPlayer.resumePlay()
          : trackPlayer.pause();
        break;
    }
  });
}

function getCurrentPlayerData() {
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

export function setupPlayerSyncHandler() {
  const currentState = getCurrentPlayerData();
  broadcast({
    type: TrackPlayerSyncType.SyncPlayerState,
    data: currentState,
  });
  ipcRendererSend("sync-current-music", currentState.music);
  ipcRendererSend("sync-current-lyric", currentState.currentLyric?.lrc?.lrc);
  ipcRendererSend("sync-current-repeat-mode", currentState.repeatMode);
  ipcRendererSend("sync-current-playing-state", currentState.playerState);

  MessageHub.on("ready", (extId) => {
    const currentState = getCurrentPlayerData();

    MessageHub.sendToExtension(extId, {
      type: TrackPlayerSyncType.SyncPlayerState,
      data: currentState,
    });
  });

  trackPlayer.on(TrackPlayerEvent.MusicChanged, (currentMusic) => {
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

    broadcast({
      type: TrackPlayerSyncType.MusicChanged,
      data: simplifiedMusicItem,
    });

    ipcRendererSend("sync-current-music", simplifiedMusicItem);
  });

  trackPlayer.on(TrackPlayerEvent.StateChanged, (state) => {
    broadcast({
      type: TrackPlayerSyncType.PlayerStateChanged,
      data: state,
    });
    ipcRendererSend("sync-current-playing-state", state);
  });

  trackPlayer.on(TrackPlayerEvent.RepeatModeChanged, (mode) => {
    broadcast({
      type: TrackPlayerSyncType.RepeatModeChanged,
      data: mode,
    });
    ipcRendererSend("sync-current-repeat-mode", mode);
  });

  trackPlayer.on(TrackPlayerEvent.LyricChanged, (lyric) => {
    broadcast({
      type: TrackPlayerSyncType.LyricChanged,
      data: lyric?.getLyric(),
    });
  });

  trackPlayer.on(TrackPlayerEvent.CurrentLyricChanged, (lyric) => {
    const { platform } = getGlobalContext();

    broadcast({
      type: TrackPlayerSyncType.CurrentLyricChanged,
      data: lyric ?? "",
    });

    if (
      platform === "darwin" &&
      getAppConfigPath("lyric.enableStatusBarLyric")
    ) {
      ipcRendererSend("sync-current-lyric", lyric?.lrc?.lrc);
    }
  });

  const progressChangedHandler = throttle((currentTime) => {
    broadcast({
      type: TrackPlayerSyncType.ProgressChanged,
      data: currentTime,
    });
  }, 1000);

  trackPlayer.on(TrackPlayerEvent.ProgressChanged, progressChangedHandler);
}
