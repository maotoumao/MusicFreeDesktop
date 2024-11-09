import {TrackPlayerSyncType, PlayerState} from "@/common/constant";
import trackPlayer from "../track-player";
import {getGlobalContext} from "@/shared/global-context/renderer";
import MessageHub from "@/shared/message-hub/renderer";
import throttle from "lodash.throttle";
import AppConfig from "@shared/app-config/renderer";
import appState from "@shared/app-state/renderer";
import {PlayerEvents} from "@renderer/core/track-player/enum";

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
                    ? trackPlayer.resume()
                    : trackPlayer.pause();
                break;
            case "PlayMusic": {
                trackPlayer.playMusic(data);
            }
        }
    });
}

function getCurrentPlayerData() {
    const currentMusic = trackPlayer.currentMusic;
    const currentLyric = trackPlayer.lyric;
    const currentPlayerState = trackPlayer.playerState;
    const progress = trackPlayer.progress;
    const repeatMode = trackPlayer.repeatMode;
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
        lyric: currentLyric?.parser?.getLyricItems() ?? null,
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

    appState.syncCurrentPlayerState(currentState.playerState);
    appState.syncCurrentLyric(currentState.currentLyric?.lrc);
    appState.syncCurrentMusic(currentState.music);
    appState.syncCurrentRepeatMode(currentState.repeatMode);


    MessageHub.on("ready", (extId) => {
        const currentState = getCurrentPlayerData();

        MessageHub.sendToExtension(extId, {
            type: TrackPlayerSyncType.SyncPlayerState,
            data: currentState,
        });
    });

    trackPlayer.on(PlayerEvents.MusicChanged, (currentMusic) => {
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

        appState.syncCurrentMusic(simplifiedMusicItem);
    });

    trackPlayer.on(PlayerEvents.StateChanged, (state) => {
        broadcast({
            type: TrackPlayerSyncType.PlayerStateChanged,
            data: state,
        });
        appState.syncCurrentPlayerState(state);
    });

    trackPlayer.on(PlayerEvents.RepeatModeChanged, (mode) => {
        broadcast({
            type: TrackPlayerSyncType.RepeatModeChanged,
            data: mode,
        });

        appState.syncCurrentRepeatMode(mode);
    });

    trackPlayer.on(PlayerEvents.LyricChanged, (lyric) => {
        broadcast({
            type: TrackPlayerSyncType.LyricChanged,
            data: lyric?.getLyricItems(),
        });
    });

    trackPlayer.on(PlayerEvents.CurrentLyricChanged, (lyric) => {
        const {platform} = getGlobalContext();

        broadcast({
            type: TrackPlayerSyncType.CurrentLyricChanged,
            data: lyric ?? null,
        });

        if (
            platform === "darwin" &&
            AppConfig.getConfig("lyric.enableStatusBarLyric")
        ) {
            appState.syncCurrentLyric(lyric?.lrc);
        }
    });

    const progressChangedHandler = throttle((currentTime) => {
        broadcast({
            type: TrackPlayerSyncType.ProgressChanged,
            data: currentTime,
        });
    }, 1000);

    trackPlayer.on(PlayerEvents.ProgressChanged, progressChangedHandler);
}
