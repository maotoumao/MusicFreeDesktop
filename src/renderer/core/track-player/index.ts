// src/renderer/core/track-player/index.ts
import {CurrentTime, ICurrentLyric, PlayerEvents, ErrorReason as PlayerErrorReason } from "./enum";
import shuffle from "lodash.shuffle";
import {
    addSortProperty,
    getInternalData,
    getQualityOrder,
    isSameMedia,
    sortByTimestampAndIndex,
} from "@/common/media-util";
import {PlayerState, RepeatMode, sortIndexSymbol, timeStampSymbol} from "@/common/constant";
import LyricParser, {IParsedLrcItem} from "@/renderer/utils/lyric-parser";
import {
    getUserPreference,
    getUserPreferenceIDB,
    setUserPreferenceIDB,
    removeUserPreference,
    setUserPreference,
} from "@/renderer/utils/user-perference";
import AppConfig from "@shared/app-config/renderer";
import {createIndexMap, IIndexMap} from "@/common/index-map";
import _trackPlayerStore from "./store";
import EventEmitter from "eventemitter3";
import {IAudioController} from "@/types/audio-controller";
import AudioController from "@renderer/core/track-player/controller/audio-controller";
import MpvController from "@renderer/core/track-player/controller/mpv-controller";
import logger from "@shared/logger/renderer";
import voidCallback from "@/common/void-callback";
import {delay} from "@/common/time-util";
import {getLinkedLyric} from "@renderer/core/link-lyric";
import {fsUtil}from "@shared/utils/renderer";
import PluginManager from "@shared/plugin-manager/renderer";

const {
    musicQueueStore,
    currentMusicStore,
    currentLyricStore,
    repeatModeStore,
    progressStore,
    playerStateStore,
    currentVolumeStore,
    currentSpeedStore,
    currentQualityStore,
    resetProgress
} = _trackPlayerStore;


interface InternalPlayerEvents {
    [PlayerEvents.RepeatModeChanged]: (repeatMode: RepeatMode) => void;
    [PlayerEvents.MusicChanged]: (musicItem: IMusic.IMusicItem | null) => void;
    [PlayerEvents.LyricChanged]: (parser: LyricParser | null) => void;
    [PlayerEvents.CurrentLyricChanged]: (lyric: IParsedLrcItem | null) => void;
    [PlayerEvents.Error]: (errorMusicItem: IMusic.IMusicItem | null, reason: Error) => void;
    [PlayerEvents.ProgressChanged]: (progress: CurrentTime) => void;
    [PlayerEvents.StateChanged]: (state: PlayerState) => void;
    [PlayerEvents.VolumeChanged]: (volume: number) => void;
    [PlayerEvents.SpeedChanged]: (speed: number) => void;
}

interface IPlayOptions {
    refreshSource?: boolean;
    restartOnSameMedia?: boolean;
    seekTo?: number;
    quality?: IMusic.IQualityKey;
}

interface ITrackOptions {
    seekTo?: number;
    autoPlay?: boolean;
}

class TrackPlayer {
    get currentMusic() {
        return currentMusicStore.getValue();
    }

    get currentMusicBasicInfo() {
        const currentMusic = this.currentMusic;
        if (!currentMusic) {
            return null;
        }
        return {
            platform: currentMusic.platform,
            title: currentMusic.title,
            artist: currentMusic.artist,
            id: currentMusic.id,
            album: currentMusic.album,
            artwork: currentMusic.artwork,
        } as IMusic.IMusicItem
    }

    get progress() {
        return progressStore.getValue();
    }

    get playerState() {
        return playerStateStore.getValue();
    }

    get repeatMode() {
        return repeatModeStore.getValue();
    }

    get currentQuality() {
        return currentQualityStore.getValue();
    }

    get speed() {
        return currentSpeedStore.getValue();
    }

    get volume() {
        return currentVolumeStore.getValue();
    }

    get lyric() {
        return currentLyricStore.getValue();
    }

    get musicQueue() {
        return musicQueueStore.getValue();
    }

    get isEmpty() {
        return this.musicQueue.length <= 0;
    }

    private indexMap: IIndexMap;
    private currentIndex = -1;
    private audioController: IAudioController | null = null;
    private ee: EventEmitter<InternalPlayerEvents>;
    public isReady = false;
    private isMpvInitFailed = false;

    constructor() {
        this.indexMap = createIndexMap();
        this.ee = new EventEmitter();
    }

    public on<E extends keyof InternalPlayerEvents>(event: E, listener: InternalPlayerEvents[E]): void {
        this.ee.on(event, listener as any);
    }

    public off<E extends keyof InternalPlayerEvents>(event: E, listener: InternalPlayerEvents[E]): void {
        this.ee.off(event, listener as any);
    }


    private async initializeAudioBackend(previousState?: { music: IMusic.IMusicItem | null, time: number, isPlaying: boolean }) {
        const backendType = AppConfig.getConfig("playMusic.backend");
        logger.logInfo(`TrackPlayer: Initializing audio backend - ${backendType}`);
        this.isMpvInitFailed = false;

        if (this.audioController) {
            await this.audioController.destroy?.();
            this.audioController = null;
        }

        if (backendType === "mpv") {
            this.audioController = new MpvController();
        } else {
            this.audioController = new AudioController();
        }
        this.setupAudioControllerEvents();

        if (typeof this.audioController.initialize === 'function') {
            try {
                await this.audioController.initialize();
                logger.logInfo(`TrackPlayer: Audio controller (${backendType}) initialized successfully.`);
                if (backendType === 'mpv' && (this.audioController as MpvController).isMpvInitialized === false) {
                    throw new Error("MpvController reported not initialized after successful initialize call.");
                }
            } catch (e) {
                const initError = e instanceof Error ? e : new Error(String(e));
                logger.logError(`TrackPlayer: Audio controller (${backendType}) initialization failed.`, initError);
                this.setPlayerState(PlayerState.None);
                if (backendType === 'mpv') this.isMpvInitFailed = true;
                this.ee.emit(PlayerEvents.Error, null, new Error(`音频后端 ${backendType} 初始化失败: ${initError.message}`));
                return;
            }
        }

        const musicToRestore = previousState?.music || this.currentMusic;
        const timeToRestore = previousState?.music ? previousState.time : (this.progress.currentTime || 0);
        const qualityToRestore = this.currentQuality || AppConfig.getConfig("playMusic.defaultQuality");
        const shouldAutoPlay = previousState?.isPlaying === true;


        if (musicToRestore && this.audioController ) {
            if (this.isMpvInitFailed && backendType === 'mpv') {
                logger.logInfo("TrackPlayer: MPV initialization was marked as failed, skipping track restoration.");
                this.setPlayerState(PlayerState.None);
                this.ee.emit(PlayerEvents.Error, musicToRestore, new Error("MPV播放器未能成功初始化，无法恢复播放。"));
                return;
            }

            logger.logInfo("TrackPlayer: Attempting to load/restore track with new backend.", { title: musicToRestore.title, time: timeToRestore });
            this.setCurrentMusic(musicToRestore); // Set current music first
            this.currentIndex = this.findMusicIndex(musicToRestore);
            if (this.audioController) await this.audioController.prepareTrack?.(musicToRestore);

            try {
                // For restoration, always force fetching a new network source
                const {mediaSource, quality: actualQuality} = await this.fetchMediaSource(musicToRestore, qualityToRestore, true);
                if (!mediaSource?.url) {
                    throw new Error("Media source URL is empty for track restoration.");
                }
                // Check if musicItem is still the one we intend to restore
                if (this.isCurrentMusic(musicToRestore) && this.audioController) {
                    this.setCurrentQuality(actualQuality);
                    await this.setTrack(mediaSource, musicToRestore, {
                        seekTo: timeToRestore,
                        autoPlay: shouldAutoPlay
                    });
                }
            } catch (e: any) {
                logger.logError("Error restoring/loading track with new backend:", e);
                this.ee.emit(PlayerEvents.Error, musicToRestore, e instanceof Error ? e : new Error(String(e)));
                this.setPlayerState(PlayerState.None);
            }
        } else if (!musicToRestore) {
            this.setPlayerState(PlayerState.None);
            this.resetProgress();
        }
    }

    private setupAudioControllerEvents() {
        if (!this.audioController) return;

        this.audioController.onEnded = () => {
            logger.logInfo(`TrackPlayer: onEnded triggered. Current repeat mode: ${this.repeatMode}`);
            switch (this.repeatMode) {
                case RepeatMode.Queue:
                case RepeatMode.Shuffle: {
                    logger.logInfo(`TrackPlayer: onEnded - Mode: ${this.repeatMode}, skipping to next.`);
                    this.skipToNext();
                    break;
                }
                case RepeatMode.Loop: {
                    logger.logInfo(`TrackPlayer: onEnded - Mode: Loop, replaying index ${this.currentIndex}.`);
                    // For loop, force refresh source and seek to 0 to ensure reliable replay, especially for network streams
                    this.playIndex(this.currentIndex, {
                        refreshSource: true, // Key change: force refresh for loop
                        seekTo: 0,
                        restartOnSameMedia: true // Ensures it actually reloads/replays
                    });
                    break;
                }
                default:
                    logger.logInfo(`TrackPlayer: onEnded - Default behavior (should not happen), setting player state to None.`);
                    this.setPlayerState(PlayerState.None);
                    this.resetProgress();
                    break;
            }
        }
        this.audioController.onProgressUpdate = ((progress) => {
            this.setProgress(progress);
            if (this.lyric?.parser) {
                const lyricItem = this.lyric.parser.getPosition(progress.currentTime);
                if (this.lyric.currentLrc?.lrc !== lyricItem?.lrc) {
                    this.setCurrentLyric({
                        parser: this.lyric.parser,
                        currentLrc: lyricItem
                    })
                }
            }
        })
        this.audioController.onVolumeChange = (volume) => {
            currentVolumeStore.setValue(volume);
            this.ee.emit(PlayerEvents.VolumeChanged, volume);
        };

        this.audioController.onSpeedChange = (speed) => {
            currentSpeedStore.setValue(speed);
            this.ee.emit(PlayerEvents.SpeedChanged, speed);
        };

        this.audioController.onPlayerStateChanged = (state) => {
            this.setPlayerState(state);
        };

        this.audioController.onError = async (type, reason: any) => {
            const errorMusicItem = this.audioController?.musicItem || this.currentMusic;
            logger.logError("TrackPlayer: Playback error from controller", { type, reason: reason?.message || String(reason), musicItem: errorMusicItem } as any);
            const errorToEmit = reason instanceof Error ? reason : new Error(String(reason) || "Unknown playback error");

            if (type === PlayerErrorReason.EmptyResource && AppConfig.getConfig("playMusic.backend") === "mpv") {
                if (this.audioController && (this.audioController as MpvController).isMpvInitialized === false) {
                     this.isMpvInitFailed = true;
                     this.ee.emit(PlayerEvents.Error, errorMusicItem, new Error(`MPV播放器初始化失败: ${errorToEmit.message}`));
                     return;
                }
            }

            const errorBehavior = AppConfig.getConfig("playMusic.playError");
            if (errorBehavior === "skip") {
                logger.logInfo(`TrackPlayer: onError - Behavior: skip. Skipping to next track.`);
                if (this.musicQueue.length > 1 && errorMusicItem && this.isCurrentMusic(errorMusicItem)) {
                    if (this.playerState !== PlayerState.None) {
                         await delay(1500);
                    }
                    if (this.isCurrentMusic(errorMusicItem)) {
                        this.skipToNext();
                    }
                } else if (errorMusicItem && this.isCurrentMusic(errorMusicItem)) {
                    if (this.audioController) await this.audioController.pause();
                    this.setPlayerState(PlayerState.None);
                    this.resetProgress();
                }
            } else {
                logger.logInfo(`TrackPlayer: onError - Behavior: pause (or default). Pausing player.`);
                if (errorMusicItem && this.isCurrentMusic(errorMusicItem)) {
                    if (this.audioController) await this.audioController.pause();
                    this.setPlayerState(PlayerState.None);
                    this.resetProgress();
                }
            }
            this.ee.emit(PlayerEvents.Error, errorMusicItem, errorToEmit);
        }
    }

    public async setup() {
        if (this.isReady) return;

        const [repeatMode, currentMusicFromPref, currentProgress, volume, speed, preferredQuality] = [
            getUserPreference("repeatMode"),
            getUserPreference("currentMusic"),
            getUserPreference("currentProgress"),
            getUserPreference("volume"),
            getUserPreference("speed"),
            getUserPreference("currentQuality") || AppConfig.getConfig("playMusic.defaultQuality")
        ];
        const playList = (await getUserPreferenceIDB("playList")) ?? [];
        addSortProperty(playList);

        musicQueueStore.setValue(playList);
        this.indexMap.update(playList);

        if (repeatMode) {
            this.setRepeatMode(repeatMode as RepeatMode, false);
        }
        if (preferredQuality) {
            this.setCurrentQuality(preferredQuality);
        }
        if (currentProgress && isFinite(currentProgress)) {
            progressStore.setValue({ currentTime: currentProgress, duration: Infinity });
        }

        this.isReady = true;

        await this.initializeAudioBackend();

        const backendType = AppConfig.getConfig("playMusic.backend");
        const isControllerActuallyNotInitialized = backendType === "mpv" && this.audioController && (this.audioController as MpvController).isMpvInitialized === false;


        if (currentMusicFromPref && !this.currentMusic) {
            this.setCurrentMusic(currentMusicFromPref);
            this.currentIndex = this.findMusicIndex(currentMusicFromPref);
            if (this.audioController && !isControllerActuallyNotInitialized) {
                await this.audioController.prepareTrack?.(currentMusicFromPref);
            }
        } else if (!currentMusicFromPref && !this.currentMusic) {
            this.setPlayerState(PlayerState.None);
            this.resetProgress();
        }

        const deviceId = AppConfig.getConfig("playMusic.audioOutputDevice")?.deviceId;
        if (deviceId && this.audioController && !isControllerActuallyNotInitialized) {
            await this.setAudioOutputDevice(deviceId).catch(e => logger.logError("Failed to set initial audio device", e));
        }
        if (volume !== null && volume !== undefined && this.audioController && !isControllerActuallyNotInitialized) {
            this.setVolume(volume);
        }
        if (speed && this.audioController && !isControllerActuallyNotInitialized) {
            this.setSpeed(speed);
        }

        this.setupEvents();
        AppConfig.onConfigUpdate(async (patch) => {
            if (patch["playMusic.backend"] !== undefined) {
                logger.logInfo("TrackPlayer: Audio backend configuration changed, re-initializing.");
                const previousMusic = this.currentMusic;
                const previousTime = this.progress.currentTime;
                const wasPlaying = this.playerState === PlayerState.Playing;

                if (this.audioController && wasPlaying) {
                    await this.audioController.pause();
                }
                this.setPlayerState(PlayerState.Buffering);

                await this.initializeAudioBackend({ music: previousMusic, time: previousTime, isPlaying: wasPlaying });
            }
            const currentBackend = AppConfig.getConfig("playMusic.backend");
            const isCurrentControllerNotInit = currentBackend === "mpv" && this.audioController && (this.audioController as MpvController).isMpvInitialized === false;
            if (patch["playMusic.audioOutputDevice"] !== undefined && this.audioController && !isCurrentControllerNotInit) {
                const newDeviceId = AppConfig.getConfig("playMusic.audioOutputDevice")?.deviceId;
                await this.setAudioOutputDevice(newDeviceId);
            }
        });

        logger.logInfo("TrackPlayer: Setup complete.");
    }


    private setupEvents() {
        this.ee.on(PlayerEvents.Error, async (errorMusicItem, reason) => {
            logger.logError("TrackPlayer internal error event:", { musicTitle: errorMusicItem?.title, reason: reason.message, stack: reason.stack } as any);
            if (this.isMpvInitFailed && AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.setPlayerState(PlayerState.None);
                return;
            }
        });

        if (navigator.mediaSession) {
            navigator.mediaSession.setActionHandler("nexttrack", () => { this.skipToNext(); });
            navigator.mediaSession.setActionHandler("previoustrack", () => { this.skipToPrev(); });
            navigator.mediaSession.setActionHandler("play", () => { this.resume(); });
            navigator.mediaSession.setActionHandler("pause", () => { this.pause(); });
            navigator.mediaSession.setActionHandler("seekto", (details) => {
                if (details.seekTime != null) { this.seekTo(details.seekTime); }
            });
        }
    }

    public async playIndex(index: number, options: IPlayOptions = {}) {
        if (!this.isReady) await this.setup();
        if (!this.audioController || (AppConfig.getConfig("playMusic.backend") === "mpv" && (this.audioController as MpvController).isMpvInitialized === false) ) {
            const errorMsg = "播放器未正确初始化或后端不可用 (playIndex)。";
            logger.logError(errorMsg, new Error("AudioController not ready or MPV init failed for playIndex"));
            this.ee.emit(PlayerEvents.Error, this.musicQueue[index] || null, new Error(errorMsg));
            return;
        }

        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') {
            try {
                await this.audioController.readyPromise;
            } catch (e) {
                this.ee.emit(PlayerEvents.Error, this.musicQueue[index] || null, new Error(`播放器后端初始化等待失败 (playIndex): ${(e as Error).message}`));
                return;
            }
        }

        let {refreshSource = false, restartOnSameMedia = true, seekTo, quality: intendedQuality} = options;

        if (index === -1 && this.musicQueue.length === 0) { this.reset(); return; }
        index = (index + this.musicQueue.length) % this.musicQueue.length;
        const nextMusicItem = this.musicQueue[index];

        if (!nextMusicItem) {
            logger.logError(`TrackPlayer: nextMusicItem is undefined in playIndex. index: ${index}, qLen: ${this.musicQueue.length}`, new Error("nextMusicItem undefined"));
            this.reset(); return;
        }

        const isNewTrack = !this.isCurrentMusic(nextMusicItem);
        if (isNewTrack) { // If it's a new track, always refresh the source
            refreshSource = true;
        }

        this.setCurrentMusic(nextMusicItem); // Set current music immediately
        this.currentIndex = index;
        this.setPlayerState(PlayerState.Buffering);
        if (this.audioController) this.audioController.prepareTrack?.(nextMusicItem);

        try {
            let mediaSourceToUse: IPlugin.IMediaSourceResult | null = null;
            let qualityToUse: IMusic.IQualityKey | undefined = intendedQuality;

            if (refreshSource || !this.audioController.hasSource) {
                const fetched = await this.fetchMediaSource(nextMusicItem, intendedQuality, refreshSource); // Pass refreshSource as forceNetwork
                mediaSourceToUse = fetched.mediaSource;
                qualityToUse = fetched.quality;
                if (!mediaSourceToUse?.url) throw new Error("无法获取有效的媒体播放链接 (URL is empty).");
                if (!this.isCurrentMusic(nextMusicItem)) return;
                this.setCurrentQuality(qualityToUse);
                await this.setTrack(mediaSourceToUse, nextMusicItem, { seekTo: seekTo ?? 0, autoPlay: true });
            } else { // Same song, controller has source, not forced refresh
                const actualSeekTo = restartOnSameMedia ? 0 : seekTo;
                if (actualSeekTo !== undefined) {
                    await this.audioController.seekTo(actualSeekTo);
                }
                if (this.playerState !== PlayerState.Playing) {
                    await this.audioController.play();
                }
            }

            PluginManager.callPluginDelegateMethod({ platform: nextMusicItem.platform }, "getMusicInfo", nextMusicItem)
                .then(musicInfo => {
                    if (musicInfo && this.isCurrentMusic(nextMusicItem) && typeof musicInfo === "object") {
                        this.setCurrentMusic({...nextMusicItem, ...musicInfo, platform: nextMusicItem.platform, id: nextMusicItem.id });
                    }
                }).catch(voidCallback);
        } catch (e:any) {
            logger.logError("Error in playIndex:", e, {musicItemTitle: nextMusicItem?.title});
            this.setCurrentQuality(AppConfig.getConfig("playMusic.defaultQuality"));
            if (this.audioController) await this.audioController.reset();
            const errorToEmit = e instanceof Error ? e : new Error(String(e) || '播放时发生未知错误');
            this.ee.emit(PlayerEvents.Error, nextMusicItem, errorToEmit);
            this.setPlayerState(PlayerState.None);
        }
    }

    public async playMusic(musicItem: IMusic.IMusicItem, options: IPlayOptions = {}) {
        if (!this.isReady) await this.setup();
        if (!this.audioController || (AppConfig.getConfig("playMusic.backend") === "mpv" && (this.audioController as MpvController).isMpvInitialized === false) ) {
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("播放器未正确初始化或后端不可用 (playMusic)。")); return;
        }
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') {
            try {
                 await this.audioController.readyPromise;
            } catch (e) {
                this.ee.emit(PlayerEvents.Error, musicItem, new Error(`播放器后端初始化等待失败 (playMusic): ${(e as Error).message}`)); return;
            }
        }

        const queueIndex = this.findMusicIndex(musicItem);
        if (queueIndex === -1) {
            const newQueue = [...this.musicQueue, {...musicItem, [timeStampSymbol]: Date.now(), [sortIndexSymbol]: this.musicQueue.length }];
            this.setMusicQueue(newQueue);
            await this.playIndex(newQueue.length - 1, {...options, refreshSource: true}); // Force refresh for newly added
        } else {
            await this.playIndex(queueIndex, options);
        }
    }

    public async playMusicWithReplaceQueue(musicList: IMusic.IMusicItem[], musicItem?: IMusic.IMusicItem) {
        if (!this.isReady) await this.setup();
        if (!this.audioController || (AppConfig.getConfig("playMusic.backend") === "mpv" && (this.audioController as MpvController).isMpvInitialized === false) ) {
            this.ee.emit(PlayerEvents.Error, musicItem || (musicList.length ? musicList[0] : null), new Error("播放器未正确初始化 (playMusicWithReplaceQueue)。")); return;
        }
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') {
            try {
                 await this.audioController.readyPromise;
            } catch (e) {
                this.ee.emit(PlayerEvents.Error, musicItem || (musicList.length ? musicList[0] : null), new Error(`后端初始化等待失败 (playMusicWithReplaceQueue): ${(e as Error).message}`)); return;
            }
        }

        if (!musicList.length && !musicItem) { this.reset(); return; }

        addSortProperty(musicList);
        if (this.repeatMode === RepeatMode.Shuffle) musicList = shuffle(musicList);

        musicItem = musicItem ?? musicList[0];

        this.setMusicQueue(musicList);
        await this.playMusic(musicItem!, {refreshSource: true});
    }

    public async skipToPrev() {
        if (!this.isReady || !this.audioController) return;
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }
        if (this.isEmpty) { this.reset(); return; }
        this.playIndex(this.currentIndex - 1, {refreshSource: true}); // Force refresh on skip
    }

    public async skipToNext() {
        if (!this.isReady || !this.audioController) return;
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }
        if (this.isEmpty) { this.reset(); return; }
        this.playIndex(this.currentIndex + 1, {refreshSource: true}); // Force refresh on skip
    }

    public async reset() {
        if (this.audioController) await this.audioController.reset();
        this.setMusicQueue([]);
        this.setCurrentMusic(null);
        this.setPlayerState(PlayerState.None);
        this.resetProgress();
        this.currentIndex = -1;
    }


    public async seekTo(seconds: number) {
        if (!this.isReady || !this.audioController) return;
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }
        this.audioController.seekTo(seconds);
    }

    public async pause() {
        if (!this.isReady || !this.audioController) return;
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }
        this.audioController.pause();
    }

    public async resume() {
        if (!this.isReady) await this.setup();
        if (!this.audioController || (AppConfig.getConfig("playMusic.backend") === "mpv" && (this.audioController as MpvController).isMpvInitialized === false)) {
            const errorMsg = "播放器未正确初始化或后端不可用 (resume)";
            logger.logError(errorMsg, new Error("AudioController not ready or MPV init failed for resume"));
            this.ee.emit(PlayerEvents.Error, this.currentMusic, new Error(errorMsg));
            return;
        }
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') {
            try {
                await this.audioController.readyPromise;
            } catch (e) {
                this.ee.emit(PlayerEvents.Error, this.currentMusic, new Error(`播放器后端初始化等待失败 (resume): ${(e as Error).message}`));
                return;
            }
        }

        if (!this.audioController.hasSource && this.currentMusic) {
            logger.logInfo("TrackPlayer.resume: No source in controller, but currentMusic exists. Attempting to play current track.", this.currentMusicBasicInfo);
            const seekToTime = this.progress.currentTime > 0 ? this.progress.currentTime : undefined;
            await this.playIndex(this.currentIndex, {
                restartOnSameMedia: false,
                seekTo: seekToTime,
                quality: this.currentQuality,
                refreshSource: true
            });
        } else if (this.audioController.hasSource) {
            await this.audioController.play();
        } else {
            const errorMsg = AppConfig.getConfig("playMusic.backend") === "mpv" && this.isMpvInitFailed ?
                "MPV 播放器初始化失败，无法播放。" :
                "无有效播放源或播放器未准备好。";
            logger.logInfo(`TrackPlayer.resume: Condition not met for play - ${errorMsg}`);
            this.ee.emit(PlayerEvents.Error, this.currentMusic, new Error(errorMsg));
            this.setPlayerState(PlayerState.None);
        }
    }


    public async setVolume(volume: number) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        if (!this.isReady || !this.audioController) {
            currentVolumeStore.setValue(clampedVolume);
            setUserPreference("volume", clampedVolume);
            return;
        }
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }
        this.audioController.setVolume(clampedVolume);
    }

    public async setSpeed(speed: number) {
        if (!this.isReady || !this.audioController) {
            currentSpeedStore.setValue(speed);
            setUserPreference("speed", speed);
            return;
        }
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }
        this.audioController.setSpeed(speed);
    }

    public addNext(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) {
        if (!this.isReady) return;
        let _musicItems: IMusic.IMusicItem[];
        if (Array.isArray(musicItems)) _musicItems = [...musicItems];
        else _musicItems = [musicItems];

        const now = Date.now();
        _musicItems.forEach((item, index) => {
            if (item[timeStampSymbol] === undefined) item[timeStampSymbol] = now;
            if (item[sortIndexSymbol] === undefined) item[sortIndexSymbol] = index;
        });

        const itemsToAdd: IMusic.IMusicItem[] = [];
        for (const newItem of _musicItems) {
            if (this.findMusicIndex(newItem) === -1) {
                itemsToAdd.push(newItem);
            }
        }
        if (itemsToAdd.length === 0) return;

        const oldQueue = this.musicQueue;
        let insertPosition = this.currentIndex + 1;
        if (insertPosition > oldQueue.length || insertPosition < 0) insertPosition = oldQueue.length;

        const newQueue = [...oldQueue.slice(0, insertPosition), ...itemsToAdd, ...oldQueue.slice(insertPosition)];
        this.setMusicQueue(newQueue);
    }


    public removeMusic(musicItemsToRemove: IMusic.IMusicItem | IMusic.IMusicItem[] | number) {
        if (!this.isReady) return;

        const currentQueue = this.musicQueue;
        if (currentQueue.length === 0) return;

        let indicesToRemove: number[] = [];
        if (typeof musicItemsToRemove === 'number') {
            if (musicItemsToRemove >= 0 && musicItemsToRemove < currentQueue.length) {
                indicesToRemove.push(musicItemsToRemove);
            }
        } else {
            const itemsArray = Array.isArray(musicItemsToRemove) ? musicItemsToRemove : [musicItemsToRemove];
            itemsArray.forEach(item => {
                const idx = this.findMusicIndex(item);
                if (idx !== -1) {
                    indicesToRemove.push(idx);
                }
            });
            indicesToRemove = [...new Set(indicesToRemove)];
        }

        if (indicesToRemove.length === 0) return;

        indicesToRemove.sort((a, b) => b - a);

        const newQueue = [...currentQueue];
        let newCurrentIndex = this.currentIndex;
        let currentMusicWasRemoved = false;

        for (const index of indicesToRemove) {
            newQueue.splice(index, 1);
            if (index === this.currentIndex) {
                currentMusicWasRemoved = true;
            } else if (index < this.currentIndex) {
                newCurrentIndex--;
            }
        }

        if (!currentMusicWasRemoved) {
            this.currentIndex = newCurrentIndex;
        }

        this.setMusicQueue(newQueue);

        if (currentMusicWasRemoved) {
            if (this.audioController) this.audioController.reset();
            this.resetProgress();
            this.setCurrentMusic(null);

            if (newQueue.length > 0) {
                const playNextIdx = (newCurrentIndex >= 0 && newCurrentIndex < newQueue.length) ? newCurrentIndex : 0;
                this.playIndex(playNextIdx);
            } else {
                this.reset();
            }
        } else if (newQueue.length === 0) {
            this.reset();
        }
    }


    public async setQuality(qualityKey: IMusic.IQualityKey) {
        if (!this.isReady || !this.audioController) return;
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }

        const currentMusic = this.currentMusic;
        if (currentMusic && qualityKey !== this.currentQuality) {
            const currentTime = this.progress.currentTime;
            const wasPlaying = this.playerState === PlayerState.Playing;

            if (wasPlaying && this.audioController) await this.audioController.pause();

            this.setPlayerState(PlayerState.Buffering);
            try {
                // Force network fetch when changing quality
                const {mediaSource, quality: realQuality} = await this.fetchMediaSource(currentMusic, qualityKey, true)
                if (this.isCurrentMusic(currentMusic) && this.audioController) {
                    await this.setTrack(mediaSource, currentMusic, { seekTo: currentTime, autoPlay: wasPlaying });
                    this.setCurrentQuality(realQuality);
                }
            } catch (e: any) {
                logger.logError("Error setting quality:", e, {musicTitle: currentMusic.title});
                this.ee.emit(PlayerEvents.Error, currentMusic, e instanceof Error ? e : new Error(String(e)));
                if (wasPlaying && this.audioController) await this.audioController.play();
                else this.setPlayerState(PlayerState.Paused);
            }
        }
    }

    public toggleRepeatMode() {
        if (!this.isReady) return;
        let nextRepeatMode = this.repeatMode;
        switch (nextRepeatMode) {
            case RepeatMode.Shuffle: nextRepeatMode = RepeatMode.Loop; break;
            case RepeatMode.Loop: nextRepeatMode = RepeatMode.Queue; break;
            case RepeatMode.Queue: default: nextRepeatMode = RepeatMode.Shuffle; break;
        }
        this.setRepeatMode(nextRepeatMode);
    }

    public setRepeatMode(repeatMode: RepeatMode, triggerReorder: boolean = true) {
        const oldRepeatMode = this.repeatMode;
        repeatModeStore.setValue(repeatMode);
        setUserPreference("repeatMode", repeatMode);

        if (this.isReady && triggerReorder) {
            if (repeatMode === RepeatMode.Shuffle && oldRepeatMode !== RepeatMode.Shuffle) {
                this.setMusicQueue(shuffle(this.musicQueue));
            } else if (oldRepeatMode === RepeatMode.Shuffle && repeatMode !== RepeatMode.Shuffle) {
                this.setMusicQueue(sortByTimestampAndIndex([...this.musicQueue], true));
            }
        }
        this.ee.emit(PlayerEvents.RepeatModeChanged, repeatMode);
    }


    public async setAudioOutputDevice(deviceId?: string) {
        if (!this.isReady || !this.audioController) return;
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }
        try {
            await this.audioController.setSinkId(deviceId ?? "");
        } catch (e: any) {
            logger.logError("设置音频输出设备失败", e);
        }
    }

    public setMusicQueue(musicQueue: IMusic.IMusicItem[]) {
        musicQueueStore.setValue(musicQueue);
        setUserPreferenceIDB("playList", musicQueue);
        this.indexMap.update(musicQueue);
        this.currentIndex = this.findMusicIndex(this.currentMusic);
    }


    public async fetchCurrentLyric(forceLoad = false) {
        if (!this.isReady) return;
        const currentMusic = this.currentMusic;
        if (!currentMusic) { this.setCurrentLyric(null); return; }

        const currentLyricData = this.lyric;
        if (!forceLoad && currentLyricData && this.isCurrentMusic(currentLyricData.parser?.musicItem)) return;

        try {
            const linkedLyricItem = await getLinkedLyric(currentMusic);
            let lyricSource: ILyric.ILyricSource | null = null;

            if (linkedLyricItem) {
                lyricSource = (await PluginManager.callPluginDelegateMethod(linkedLyricItem, "getLyric", linkedLyricItem).catch(voidCallback)) || null;
            }
            if ((!lyricSource || (!lyricSource.rawLrc && !lyricSource.translation)) && this.isCurrentMusic(currentMusic)) {
                lyricSource = (await PluginManager.callPluginDelegateMethod(currentMusic, "getLyric", currentMusic).catch(voidCallback)) || null;
            }

            if (!this.isCurrentMusic(currentMusic)) return;

            if (!lyricSource?.rawLrc && !lyricSource?.translation) { this.setCurrentLyric(null); return; }

            if (!lyricSource.rawLrc && lyricSource.translation) {
                lyricSource.rawLrc = lyricSource.translation;
                lyricSource.translation = undefined;
            }

            const parser = new LyricParser(lyricSource.rawLrc!, { musicItem: currentMusic, translation: lyricSource.translation });
            this.setCurrentLyric({ parser, currentLrc: parser.getPosition(this.progress.currentTime || 0) });
        } catch (e: any) {
            logger.logError("歌词解析失败", e);
            this.setCurrentLyric(null);
        }
    }


    private async fetchMediaSource(musicItem: IMusic.IMusicItem, quality?: IMusic.IQualityKey, forceNetwork = false): Promise<{ quality: IMusic.IQualityKey; mediaSource: IPlugin.IMediaSourceResult | null; }> {
        if (!this.isReady) throw new Error("TrackPlayer not ready to fetch media source.");

        if (!forceNetwork) {
            const downloadedData = getInternalData<IMusic.IMusicItemInternalData>(musicItem, "downloadData");
            if (downloadedData) {
                const {quality: downloadedQuality, path: _path} = downloadedData;
                if (await fsUtil.isFile(_path)) {
                    logger.logInfo(`Using downloaded file for ${musicItem.title} at path: ${_path}`);
                    return { quality: downloadedQuality || "standard", mediaSource: { url: fsUtil.addFileScheme(_path) }};
                } else {
                    logger.logInfo(`Downloaded file for ${musicItem.title} not found at path: ${_path}. Fetching online.`);
                }
            }
        }


        const defaultQuality = AppConfig.getConfig("playMusic.defaultQuality") || "standard";
        const whenQualityMissing = AppConfig.getConfig("playMusic.whenQualityMissing") || "lower";
        const qualityOrder = getQualityOrder(quality ?? this.currentQuality ?? defaultQuality, whenQualityMissing);

        let mediaSource: IPlugin.IMediaSourceResult | null = null;
        let realQuality: IMusic.IQualityKey = qualityOrder[0];

        for (const q of qualityOrder) {
            try {
                const sourceFromPlugin = await PluginManager.callPluginDelegateMethod({ platform: musicItem.platform }, "getMediaSource", musicItem, q);
                if (sourceFromPlugin?.url) {
                    mediaSource = sourceFromPlugin;
                    realQuality = q;
                    break;
                }
            } catch (e: any) {
                logger.logInfo(`Failed to get media source from plugin for quality ${q} for music ${musicItem.title}: ${e.message}`);
            }
        }
        
        if (!mediaSource?.url && (forceNetwork || !getInternalData<IMusic.IMusicItemInternalData>(musicItem, "downloadData")) ) { // Only fallback if not a downloaded item or if forcing network
            logger.logInfo(`Plugin did not return a valid source for ${musicItem.title}. Trying fallback to musicItem.url or qualities.`);
            const fallbackUrl = musicItem.qualities?.[realQuality]?.url || musicItem.url;
            if (fallbackUrl) {
                mediaSource = { url: fallbackUrl };
            }
        }
        
        if (!mediaSource?.url) throw new Error(`无法为歌曲 ${musicItem.title} 获取任何有效的播放链接。`);
        return { quality: realQuality, mediaSource };
    }


    private setCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        const isActuallyDifferent = !this.isCurrentMusic(musicItem) ||
                                  (musicItem && this.currentMusic && JSON.stringify(musicItem) !== JSON.stringify(this.currentMusic));

        currentMusicStore.setValue(musicItem);

        if (isActuallyDifferent) {
            this.ee.emit(PlayerEvents.MusicChanged, musicItem);
            this.fetchCurrentLyric(true);
            this.resetProgress();
            if (musicItem) setUserPreference("currentMusic", musicItem);
            else removeUserPreference("currentMusic");
        }
    }


    private setProgress(progress: CurrentTime) {
        progressStore.setValue(progress);
        if (isFinite(progress.currentTime)) setUserPreference("currentProgress", progress.currentTime);
        this.ee.emit(PlayerEvents.ProgressChanged, progress);
    }

    private setCurrentQuality(quality: IMusic.IQualityKey) {
        setUserPreference("currentQuality", quality);
        currentQualityStore.setValue(quality);
    }

    private setCurrentLyric(lyric?: ICurrentLyric | null) {
        const prev = this.lyric;
        const newLyric = (lyric && Object.keys(lyric).length > 0) ? lyric as ICurrentLyric : null;
        currentLyricStore.setValue(newLyric);

        if (newLyric?.parser !== prev?.parser) this.ee.emit(PlayerEvents.LyricChanged, newLyric?.parser ?? null);
        if (newLyric?.currentLrc?.lrc !== prev?.currentLrc?.lrc) this.ee.emit(PlayerEvents.CurrentLyricChanged, newLyric?.currentLrc ?? null);
    }


    private setPlayerState(playerState: PlayerState) {
        playerStateStore.setValue(playerState);
        this.ee.emit(PlayerEvents.StateChanged, playerState);
    }

    private findMusicIndex(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) return -1;
        return this.indexMap.indexOf(musicItem);
    }

    private resetProgress() {
        resetProgress();
        removeUserPreference("currentProgress");
    }


    private async setTrack(mediaSource: IPlugin.IMediaSourceResult | null, musicItem: IMusic.IMusicItem, options: ITrackOptions = { autoPlay: true }) {
        if (!this.audioController) {
            logger.logError("setTrack called but audioController is null.", new Error("audioController is null"));
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("播放器核心组件丢失。"));
            this.setPlayerState(PlayerState.None);
            return;
        }
        if (this.audioController.readyPromise && typeof this.audioController.readyPromise.then === 'function') { await this.audioController.readyPromise; }

        await this.audioController.reset();
        this.resetProgress();

        if (!mediaSource || !mediaSource.url) {
            const errorMsg = `setTrack called with invalid mediaSource for music: ${musicItem.title}`;
            logger.logError(errorMsg, new Error(`Invalid mediaSource: ${JSON.stringify(mediaSource)}`));
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("无效的媒体源或URL为空"));
            this.setPlayerState(PlayerState.None);
            return;
        }

        this.setPlayerState(PlayerState.Buffering);

        await this.audioController.setTrackSource(mediaSource, musicItem);
        if (options.seekTo !== undefined && isFinite(options.seekTo) && options.seekTo >= 0) {
            this.audioController.seekTo(options.seekTo);
        }
        if (options.autoPlay) {
            this.audioController.play();
        } else if (this.playerState !== PlayerState.Paused && this.playerState !== PlayerState.None) {
            this.setPlayerState(PlayerState.Paused);
        }
    }

    public isCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        return isSameMedia(musicItem, this.currentMusic);
    }
}

export default new TrackPlayer();