// src/renderer/core/track-player/index.ts
// ... (保留大部分 import)
import {CurrentTime, ICurrentLyric, PlayerEvents,} from "./enum";
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
    removeUserPreference,
    setUserPreference,
    setUserPreferenceIDB,
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
import {createUniqueMap} from "@/common/unique-map";
import {getLinkedLyric} from "@renderer/core/link-lyric";
import {fsUtil} from "@shared/utils/renderer";
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
    [PlayerEvents.Error]: (errorMusicItem: IMusic.IMusicItem | null, reason: any) => void;
    [PlayerEvents.ProgressChanged]: (progress: CurrentTime) => void;
    [PlayerEvents.StateChanged]: (state: PlayerState) => void;
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
    private ee: EventEmitter<InternalPlayerEvents>; // ee 仍然是私有的
    private isReady = false;

    constructor() {
        this.indexMap = createIndexMap();
        this.ee = new EventEmitter(); // 初始化 EventEmitter
    }

    // 公共的事件监听方法
    public on<E extends keyof InternalPlayerEvents>(event: E, listener: InternalPlayerEvents[E]): void {
        this.ee.on(event, listener as any);
    }

    // 公共的移除事件监听方法 (可选，但推荐)
    public off<E extends keyof InternalPlayerEvents>(event: E, listener: InternalPlayerEvents[E]): void {
        this.ee.off(event, listener as any);
    }


    private async initializeAudioBackend(previousState?: { music: IMusic.IMusicItem | null, time: number, isPlaying: boolean }) {
        const backendType = AppConfig.getConfig("playMusic.backend");
        logger.logInfo(`TrackPlayer: Initializing audio backend - ${backendType}`);

        if (this.audioController) {
            this.audioController.destroy();
            this.audioController = null;
        }

        if (backendType === "mpv") {
            this.audioController = new MpvController();
        } else {
            this.audioController = new AudioController();
        }
        this.setupAudioControllerEvents();

        if (previousState && previousState.music && this.audioController) {
            logger.logInfo("TrackPlayer: Restoring previous playback state after backend switch.", previousState);
            this.setCurrentMusic(previousState.music);
            this.currentIndex = this.findMusicIndex(previousState.music);

            this.setPlayerState(PlayerState.Buffering);
            this.audioController.prepareTrack?.(previousState.music);

            try {
                const qualityToUse = this.currentQuality || AppConfig.getConfig("playMusic.defaultQuality");
                const {mediaSource, quality} = await this.fetchMediaSource(previousState.music, qualityToUse);

                if (!mediaSource?.url) {
                    throw new Error("mediaSource.url is empty after backend switch");
                }

                if (this.isCurrentMusic(previousState.music)) {
                    this.setCurrentQuality(quality);
                    this.setTrack(mediaSource, previousState.music, {
                        seekTo: previousState.time,
                        autoPlay: previousState.isPlaying
                    });
                }
            } catch (e: any) {
                logger.logError("Error restoring track after backend switch:", e);
                this.ee.emit(PlayerEvents.Error, previousState.music, e);
                this.setPlayerState(PlayerState.None);
            }
        } else if (this.audioController) {
            const currentMusicToLoad = this.currentMusic;
            const currentProgressToSeek = this.progress.currentTime;
            const qualityToUse = this.currentQuality || AppConfig.getConfig("playMusic.defaultQuality");

            if (currentMusicToLoad) {
                logger.logInfo("TrackPlayer: Loading current track with new backend on initial setup or simple backend switch without active play.", currentMusicToLoad);
                this.audioController.prepareTrack?.(currentMusicToLoad);
                 try {
                    const {mediaSource, quality} = await this.fetchMediaSource(currentMusicToLoad, qualityToUse);
                     if (!mediaSource?.url) throw new Error("mediaSource.url is empty for initial load with new backend");

                    if (this.isCurrentMusic(currentMusicToLoad)) {
                        this.setCurrentQuality(quality);
                        this.setTrack(mediaSource, currentMusicToLoad, {
                            seekTo: currentProgressToSeek,
                            autoPlay: false
                        });
                    }
                } catch (e: any) {
                    logger.logError("Error loading current track with new backend:", e);
                    this.ee.emit(PlayerEvents.Error, currentMusicToLoad, e);
                }
            }
        }
    }

    private setupAudioControllerEvents() {
        if (!this.audioController) return;

        this.audioController.onEnded = () => {
            this.resetProgress();
            switch (this.repeatMode) {
                case RepeatMode.Queue:
                case RepeatMode.Shuffle: {
                    this.skipToNext();
                    break;
                }
                case RepeatMode.Loop: {
                    this.playIndex(this.currentIndex, {
                        restartOnSameMedia: true
                    });
                }
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
            setUserPreference("volume", volume);
        }
        this.audioController.onSpeedChange = (speed) => {
            currentSpeedStore.setValue(speed);
            setUserPreference("speed", speed);
        }
        this.audioController.onPlayerStateChanged = (state) => {
            this.setPlayerState(state);
        }
        this.audioController.onError = async (type, reason) => {
            logger.logError("TrackPlayer: Playback error from controller", { type, reason, musicItem: this.audioController?.musicItem } as any);
            this.ee.emit(PlayerEvents.Error, this.audioController?.musicItem, reason);
        }
    }

    public async setup() {
        if (this.isReady) return;

        await this.initializeAudioBackend();

        AppConfig.onConfigUpdate(async (patch) => {
            if (patch["playMusic.backend"] !== undefined) {
                logger.logInfo("TrackPlayer: Audio backend configuration changed, re-initializing.");
                const previousMusic = this.currentMusic;
                const previousTime = this.progress.currentTime;
                const wasPlaying = this.playerState === PlayerState.Playing;

                if (this.audioController && wasPlaying) {
                    this.audioController.pause();
                }
                this.setPlayerState(PlayerState.None);

                await this.initializeAudioBackend({ music: previousMusic, time: previousTime, isPlaying: wasPlaying });
            }
            if (patch["playMusic.audioOutputDevice"] !== undefined && this.audioController) {
                const deviceId = AppConfig.getConfig("playMusic.audioOutputDevice")?.deviceId;
                await this.setAudioOutputDevice(deviceId);
            }
        });

        const [repeatMode, currentMusic, currentProgress, volume, speed, defaultQuality] = [
            getUserPreference("repeatMode"),
            getUserPreference("currentMusic"),
            getUserPreference("currentProgress"),
            getUserPreference("volume"),
            getUserPreference("speed"),
            getUserPreference("currentQuality") || AppConfig.getConfig("playMusic.defaultQuality")
        ];
        const playList = (await getUserPreferenceIDB("playList")) ?? [];
        addSortProperty(playList);
        const deviceId = AppConfig.getConfig("playMusic.audioOutputDevice")?.deviceId;

        this.setupEvents();

        musicQueueStore.setValue(playList);
        this.indexMap.update(playList);

        if (repeatMode) {
            this.setRepeatMode(repeatMode as RepeatMode);
        }

        this.setCurrentMusic(currentMusic);
        this.currentIndex = this.findMusicIndex(currentMusic);

        if (deviceId && this.audioController) {
            await this.setAudioOutputDevice(deviceId);
        }

        if (volume !== null && volume !== undefined && this.audioController) {
            this.setVolume(volume);
        }

        if (speed && this.audioController) {
            this.setSpeed(speed)
        }

        if (currentMusic && this.audioController) {
            this.fetchMediaSource(currentMusic, defaultQuality).then(({mediaSource, quality}) => {
                if (this.isCurrentMusic(currentMusic) && this.audioController) {
                    this.setTrack(mediaSource, currentMusic, {
                        seekTo: currentProgress,
                        autoPlay: false
                    });
                    this.setCurrentQuality(quality);
                }
            }).catch(err => {
                logger.logError("Error fetching media source on setup", err as Error);
                this.ee.emit(PlayerEvents.Error, currentMusic, err);
            });
        }
        this.isReady = true;
    }

    private setupEvents() {
        this.ee.on(PlayerEvents.Error, async (errorMusicItem, reason) => {
            logger.logError("TrackPlayer internal error event:", { musicTitle: errorMusicItem?.title, reason } as any);
            this.resetProgress();
            const needSkip = AppConfig.getConfig("playMusic.playError") === "skip";
            if (this.musicQueue.length > 1 && needSkip && errorMusicItem && this.isCurrentMusic(errorMusicItem)) {
                await delay(500);
                if (this.isCurrentMusic(errorMusicItem)) {
                    this.skipToNext();
                }
            } else if (errorMusicItem && this.isCurrentMusic(errorMusicItem)) {
                this.pause();
                 this.setPlayerState(PlayerState.None);
            }
        });

        if (navigator.mediaSession) {
            navigator.mediaSession.setActionHandler("nexttrack", () => {
                this.skipToNext();
            })
            navigator.mediaSession.setActionHandler("previoustrack", () => {
                this.skipToPrev();
            })
        }
    }

    public async playIndex(index: number, options: IPlayOptions = {}) {
        if (!this.isReady || !this.audioController) {
            logger.logInfo("TrackPlayer not ready or audioController not initialized in playIndex. Attempting to setup.");
            await this.setup();
            if (!this.isReady || !this.audioController) {
                 logger.logError("TrackPlayer setup failed in playIndex.", new Error("TrackPlayer setup failed in playIndex."));
                 return;
            }
        }

        const {refreshSource, restartOnSameMedia = true, seekTo, quality: intendedQuality} = options;

        if (index === -1 && this.musicQueue.length === 0) {
            this.reset();
            return;
        }
        index = (index + this.musicQueue.length) % this.musicQueue.length;
        const nextMusicItem = this.musicQueue[index];

        if (!nextMusicItem) {
            logger.logError(
                `TrackPlayer: nextMusicItem is undefined in playIndex. index: ${index}, queueLength: ${this.musicQueue.length}`,
                new Error("nextMusicItem is undefined")
            );
            this.reset();
            return;
        }

        if (this.currentIndex === index && this.isCurrentMusic(nextMusicItem) && !refreshSource) {
            if (restartOnSameMedia) {
                this.seekTo(0);
            }
            this.audioController.play();
            return;
        }

        this.setCurrentMusic(nextMusicItem);
        this.currentIndex = index;

        this.setPlayerState(PlayerState.Buffering);
        this.audioController.prepareTrack?.(nextMusicItem);

        try {
            const {mediaSource, quality} = await this.fetchMediaSource(nextMusicItem, intendedQuality);
            if (!mediaSource?.url) {
                throw new Error("mediaSource.url is empty");
            }
            if (!this.isCurrentMusic(nextMusicItem)) return;

            this.setCurrentQuality(quality);
            this.setTrack(mediaSource, nextMusicItem, {
                seekTo,
                autoPlay: true
            });

            const musicInfo = await PluginManager.callPluginDelegateMethod(
                { platform: nextMusicItem.platform }, "getMusicInfo", nextMusicItem
            ).catch(voidCallback);

            if (musicInfo && this.isCurrentMusic(nextMusicItem) && typeof musicInfo === "object") {
                this.setCurrentMusic({
                    ...nextMusicItem,
                    ...musicInfo,
                    platform: nextMusicItem.platform,
                    id: nextMusicItem.id,
                });
            }
        } catch (e: any) {
            logger.logError("Error in playIndex:", e, {musicItemTitle: nextMusicItem?.title}); // 修改日志记录
            this.setCurrentQuality(AppConfig.getConfig("playMusic.defaultQuality"));
            if (this.audioController) this.audioController.reset();
            this.ee.emit(PlayerEvents.Error, nextMusicItem, e);
        }
    }

    public async playMusic(musicItem: IMusic.IMusicItem, options: IPlayOptions = {}) {
        if (!this.isReady || !this.audioController) {
             logger.logInfo("TrackPlayer not ready or audioController not initialized in playMusic.");
             await this.setup();
             if (!this.isReady || !this.audioController) {
                  logger.logError("TrackPlayer setup failed in playMusic.", new Error("TrackPlayer setup failed in playMusic."));
                  return;
             }
        }
        const queueIndex = this.findMusicIndex(musicItem);
        if (queueIndex === -1) {
            const newQueue = [
                ...this.musicQueue,
                {
                    ...musicItem,
                    [timeStampSymbol]: Date.now(),
                    [sortIndexSymbol]: this.musicQueue.length
                }
            ]
            this.setMusicQueue(newQueue);
            await this.playIndex(newQueue.length - 1, options);
        } else {
            await this.playIndex(queueIndex, options);
        }
    }

    public async playMusicWithReplaceQueue(musicList: IMusic.IMusicItem[], musicItem?: IMusic.IMusicItem) {
        if (!this.isReady || !this.audioController) {
            logger.logInfo("TrackPlayer not ready or audioController not initialized in playMusicWithReplaceQueue.");
            await this.setup();
            if (!this.isReady || !this.audioController) {
                 logger.logError("TrackPlayer setup failed in playMusicWithReplaceQueue.", new Error("TrackPlayer setup failed in playMusicWithReplaceQueue."));
                 return;
            }
        }
        if (!musicList.length && !musicItem) {
            this.reset();
            return;
        }
        addSortProperty(musicList);
        if (this.repeatMode === RepeatMode.Shuffle) {
            musicList = shuffle(musicList);
        }
        musicItem = musicItem ?? musicList[0];
        this.setMusicQueue(musicList);
        await this.playMusic(musicItem);
    }

    public skipToPrev() {
        if (!this.isReady || !this.audioController) return;
        if (this.isEmpty) {
            this.reset();
            return;
        }
        this.playIndex(this.currentIndex - 1);
    }

    public skipToNext() {
        if (!this.isReady || !this.audioController) return;
        if (this.isEmpty) {
            this.reset();
            return;
        }
        this.playIndex(this.currentIndex + 1);
    }

    public reset() {
        if (this.audioController) this.audioController.reset();
        this.setMusicQueue([]);
        this.setCurrentMusic(null);
        this.currentIndex = -1;
        this.setPlayerState(PlayerState.None);
    }

    public seekTo(seconds: number) {
        if (!this.isReady || !this.audioController) return;
        this.audioController.seekTo(seconds);
    }

    public pause() {
        if (!this.isReady || !this.audioController) return;
        this.audioController.pause();
    }

    public resume() {
        if (!this.isReady || !this.audioController) return;
        this.audioController.play();
    }

    public setVolume(volume: number) {
        if (!this.isReady || !this.audioController) {
            currentVolumeStore.setValue(volume);
            setUserPreference("volume", volume);
            return;
        }
        this.audioController.setVolume(volume);
    }

    public setSpeed(speed: number) {
        if (!this.isReady || !this.audioController) {
            currentSpeedStore.setValue(speed);
            setUserPreference("speed", speed);
            return;
        }
        this.audioController.setSpeed(speed);
    }

    public addNext(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) {
        if (!this.isReady) return;
        let _musicItems: IMusic.IMusicItem[];
        if (Array.isArray(musicItems)) {
            _musicItems = [...musicItems];
        } else {
            _musicItems = [musicItems];
        }

        const now = Date.now();
        _musicItems.forEach((item, index) => {
            // @ts-ignore
            item[timeStampSymbol] = now;
            // @ts-ignore
            item[sortIndexSymbol] = index;
        });

        const itemsToAdd: IMusic.IMusicItem[] = [];
        const uniqueMapForNewItems = createUniqueMap(_musicItems);
        const oldQueue = this.musicQueue;

        for (const newItem of _musicItems) {
            if (this.findMusicIndex(newItem) === -1) {
                itemsToAdd.push(newItem);
            }
        }

        if (itemsToAdd.length === 0) return;

        let insertPosition = this.currentIndex + 1;
        if (insertPosition > oldQueue.length) {
            insertPosition = oldQueue.length;
        }

        const newQueue = [
            ...oldQueue.slice(0, insertPosition),
            ...itemsToAdd,
            ...oldQueue.slice(insertPosition)
        ];
        this.setMusicQueue(newQueue);
    }

    public removeMusic(musicItemsToRemove: IMusic.IMusicItem | IMusic.IMusicItem[] | number) {
        if (!this.isReady) return;

        const currentQueue = this.musicQueue;
        let indicesToRemove: number[] = [];

        if (typeof musicItemsToRemove === 'number') {
            if (musicItemsToRemove >= 0 && musicItemsToRemove < currentQueue.length) {
                indicesToRemove.push(musicItemsToRemove);
            }
        } else if (Array.isArray(musicItemsToRemove)) {
            musicItemsToRemove.forEach(item => {
                const idx = this.findMusicIndex(item);
                if (idx !== -1) indicesToRemove.push(idx);
            });
            indicesToRemove = [...new Set(indicesToRemove)].sort((a, b) => b - a);
        } else {
            const idx = this.findMusicIndex(musicItemsToRemove);
            if (idx !== -1) indicesToRemove.push(idx);
        }

        if (indicesToRemove.length === 0) return;

        const newQueue = [...currentQueue];
        let newCurrentIndex = this.currentIndex;
        let currentMusicWasRemoved = false;

        for (const index of indicesToRemove) {
            // Splicing modifies array in place, so adjust index if removing from earlier part
            const adjustedIndex = index - (indicesToRemove.filter(i => i < index).length);
            if (adjustedIndex < newQueue.length) {
                 newQueue.splice(adjustedIndex, 1); // Use adjustedIndex for splicing
                if (index === this.currentIndex) { // Compare with original index for currentMusic check
                    currentMusicWasRemoved = true;
                } else if (index < this.currentIndex) {
                    newCurrentIndex--;
                }
            }
        }
        this.currentIndex = newCurrentIndex;

        if (currentMusicWasRemoved) {
            if (this.audioController) this.audioController.reset();
            this.resetProgress();
            this.setCurrentMusic(null);
        }

        this.setMusicQueue(newQueue);

        if (currentMusicWasRemoved && newQueue.length > 0) {
            const playNextIdx = (this.currentIndex >= 0 && this.currentIndex < newQueue.length) ? this.currentIndex : 0;
            if (newQueue[playNextIdx]) { // Ensure the item exists
                 this.playIndex(playNextIdx);
            } else if (newQueue.length > 0) { // Fallback to first if calculated index is out of bounds
                this.playIndex(0);
            }
        } else if (newQueue.length === 0) {
            this.reset();
        }
    }

    public async setQuality(qualityKey: IMusic.IQualityKey) {
        if (!this.isReady || !this.audioController) return;
        const currentMusic = this.currentMusic;
        if (currentMusic && qualityKey !== this.currentQuality) {
            const currentTime = this.progress.currentTime;
            const wasPlaying = this.playerState === PlayerState.Playing;
            if (wasPlaying && this.audioController) this.audioController.pause();

            this.setPlayerState(PlayerState.Buffering);
            try {
                const {mediaSource, quality: realQuality} = await this.fetchMediaSource(currentMusic, qualityKey)
                if (this.isCurrentMusic(currentMusic) && this.audioController) {
                    this.setTrack(mediaSource, currentMusic, {
                        seekTo: currentTime,
                        autoPlay: wasPlaying
                    })
                    this.setCurrentQuality(realQuality);
                }
            } catch (e: any) {
                logger.logError("Error setting quality:", e, {musicTitle: currentMusic.title}); // Use musicTitle
                this.ee.emit(PlayerEvents.Error, currentMusic, e);
                if (wasPlaying && this.audioController) this.audioController.play();
                else this.setPlayerState(PlayerState.Paused);
            }
        }
    }

    // 公共的 toggleRepeatMode 方法
    public toggleRepeatMode() {
        if (!this.isReady) return;
        let nextRepeatMode = this.repeatMode;
        switch (nextRepeatMode) {
            case RepeatMode.Shuffle:
                nextRepeatMode = RepeatMode.Loop;
                break;
            case RepeatMode.Loop:
                nextRepeatMode = RepeatMode.Queue;
                break;
            case RepeatMode.Queue:
            default: // Default to shuffle if current mode is somehow invalid
                nextRepeatMode = RepeatMode.Shuffle;
                break;
        }
        this.setRepeatMode(nextRepeatMode);
    }


    public setRepeatMode(repeatMode: RepeatMode) {
        if (!this.isReady) {
            repeatModeStore.setValue(repeatMode);
            setUserPreference("repeatMode", repeatMode);
            this.ee.emit(PlayerEvents.RepeatModeChanged, repeatMode);
            return;
        }
        const oldRepeatMode = this.repeatMode;
        repeatModeStore.setValue(repeatMode);
        setUserPreference("repeatMode", repeatMode);

        if (repeatMode === RepeatMode.Shuffle && oldRepeatMode !== RepeatMode.Shuffle) {
            this.setMusicQueue(shuffle(this.musicQueue));
        } else if (oldRepeatMode === RepeatMode.Shuffle && repeatMode !== RepeatMode.Shuffle) {
            // When switching from shuffle to a non-shuffle mode, re-sort by original order
            this.setMusicQueue(sortByTimestampAndIndex([...this.musicQueue], true)); // Use a copy for sorting
        }
        this.ee.emit(PlayerEvents.RepeatModeChanged, repeatMode);
    }

    public async setAudioOutputDevice(deviceId?: string) {
        if (!this.isReady || !this.audioController) return;
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
        if (!currentMusic) {
            this.setCurrentLyric(null);
            return;
        }

        const currentLyric = this.lyric;
        if (!forceLoad && currentLyric && this.isCurrentMusic(currentLyric?.parser?.musicItem)) {
            return;
        }
        try {
            const linkedLyricItem = await getLinkedLyric(currentMusic);
            let lyricSource: ILyric.ILyricSource | null = null;

            if (linkedLyricItem) {
                lyricSource = (await PluginManager.callPluginDelegateMethod(
                    linkedLyricItem, "getLyric", linkedLyricItem
                ).catch(voidCallback)) || null;
            }
            if ((!lyricSource || (!lyricSource.rawLrc && !lyricSource.translation)) && this.isCurrentMusic(currentMusic)) {
                lyricSource = (await PluginManager.callPluginDelegateMethod(
                    currentMusic, "getLyric", currentMusic
                ).catch(voidCallback)) || null;
            }

            if (!this.isCurrentMusic(currentMusic)) return;

            if (!lyricSource?.rawLrc && !lyricSource?.translation) {
                this.setCurrentLyric({});
                return;
            }
            const parser = new LyricParser(lyricSource.rawLrc, {
                musicItem: currentMusic,
                translation: lyricSource.translation
            });
            this.setCurrentLyric({
                parser,
                currentLrc: parser.getPosition(this.progress.currentTime || 0)
            });
        } catch (e: any) {
            logger.logError("歌词解析失败", e);
            this.setCurrentLyric({});
        }
    }

    private async fetchMediaSource(musicItem: IMusic.IMusicItem, quality?: IMusic.IQualityKey): Promise<{ quality: IMusic.IQualityKey; mediaSource: IPlugin.IMediaSourceResult | null; }> {
        if (!this.isReady) {
            throw new Error("TrackPlayer not ready to fetch media source.");
        }
        const defaultQuality = AppConfig.getConfig("playMusic.defaultQuality") || "standard"; // Ensure fallback
        const whenQualityMissing = AppConfig.getConfig("playMusic.whenQualityMissing") || "lower"; // Ensure fallback
        const qualityOrder = getQualityOrder(quality ?? defaultQuality, whenQualityMissing);
        let mediaSource: IPlugin.IMediaSourceResult | null = null;
        let realQuality: IMusic.IQualityKey = qualityOrder[0];

        const downloadedData = getInternalData<IMusic.IMusicItemInternalData>(musicItem, "downloadData");
        if (downloadedData) {
            const {quality: downloadedQuality, path: _path} = downloadedData;
            if (await fsUtil.isFile(_path)) {
                return {
                    quality: downloadedQuality || "standard", // Fallback for downloaded quality
                    mediaSource: { url: fsUtil.addFileScheme(_path) },
                };
            }
        }

        for (const q of qualityOrder) {
            try {
                mediaSource = await PluginManager.callPluginDelegateMethod(
                    { platform: musicItem.platform }, "getMediaSource", musicItem, q
                );
                if (!mediaSource?.url) continue;
                realQuality = q;
                break;
            } catch (e: any) {
                logger.logInfo(`Failed to get media source for quality ${q}`, e);
            }
        }
        return { quality: realQuality, mediaSource };
    }

    private setCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        const isActuallyDifferent = !this.isCurrentMusic(musicItem) ||
                                  (musicItem && this.currentMusic && JSON.stringify(musicItem) !== JSON.stringify(this.currentMusic));

        currentMusicStore.setValue(musicItem); // Update store regardless to reflect potential info changes

        if (isActuallyDifferent) {
            this.ee.emit(PlayerEvents.MusicChanged, musicItem);
            this.fetchCurrentLyric();
            this.resetProgress();

            if (musicItem) {
                setUserPreference("currentMusic", musicItem);
            } else {
                removeUserPreference("currentMusic");
            }
        }
    }

    private setProgress(progress: CurrentTime) {
        progressStore.setValue(progress);
        if (isFinite(progress.currentTime)) {
            setUserPreference("currentProgress", progress.currentTime);
        }
        this.ee.emit(PlayerEvents.ProgressChanged, progress);
    }

    private setCurrentQuality(quality: IMusic.IQualityKey) {
        setUserPreference("currentQuality", quality);
        currentQualityStore.setValue(quality);
    }

    private setCurrentLyric(lyric?: ICurrentLyric | {}) { // Allow empty object for no lyrics
        const prev = this.lyric;
        const newLyric = lyric === null || (typeof lyric === 'object' && !lyric.hasOwnProperty('parser')) ? null : lyric as ICurrentLyric;
        currentLyricStore.setValue(newLyric);


        if (newLyric?.parser !== prev?.parser) {
            this.ee.emit(PlayerEvents.LyricChanged, newLyric?.parser ?? null);
        }
        if (newLyric?.currentLrc !== prev?.currentLrc) {
            this.ee.emit(PlayerEvents.CurrentLyricChanged, newLyric?.currentLrc ?? null);
        }
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

    private setTrack(mediaSource: IPlugin.IMediaSourceResult | null, musicItem: IMusic.IMusicItem, options: ITrackOptions = { autoPlay: true }) {
        if (!this.audioController) {
            logger.logError("setTrack called but audioController is null.", new Error("audioController is null"));
            return;
        }
        this.audioController.reset();
        this.resetProgress();

        if (!mediaSource || !mediaSource.url) {
            logger.logError(
                `setTrack called with invalid mediaSource. music: ${musicItem.title}`,
                new Error(`Invalid mediaSource: ${JSON.stringify(mediaSource)}`)
            );
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("无效的媒体源"));
            this.setPlayerState(PlayerState.None);
            return;
        }

        this.audioController.setTrackSource(mediaSource, musicItem);

        if (options.seekTo !== undefined && isFinite(options.seekTo) && options.seekTo >= 0) {
            this.audioController.seekTo(options.seekTo);
        }

        if (options.autoPlay) {
            this.audioController.play();
        }
    }

    public isCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        return isSameMedia(musicItem, this.currentMusic);
    }
}

export default new TrackPlayer();