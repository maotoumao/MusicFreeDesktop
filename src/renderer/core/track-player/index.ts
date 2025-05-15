// src/renderer/core/track-player/index.ts
import {CurrentTime, ICurrentLyric, PlayerEvents,} from "./enum";
import shuffle from "lodash.shuffle";
import {
    addSortProperty,
    getInternalData,
    getQualityOrder,
    isSameMedia,
    sortByTimestampAndIndex,
    getMediaPrimaryKey, // <<<< 确保这里或者你的 media-util 中有这个函数并正确导入
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
import logger from "@shared/logger/renderer";
// import voidCallback from "@/common/void-callback"; // voidCallback 在这个文件中似乎未使用
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
    private audioController: IAudioController;
    private ee: EventEmitter<InternalPlayerEvents>;

    constructor() {
        this.indexMap = createIndexMap();
        this.ee = new EventEmitter();
        this.audioController = new AudioController();
    }

    on<T extends keyof InternalPlayerEvents>(event: T, callback: InternalPlayerEvents[T]): void {
        this.ee.on(event, callback as any);
    }

    private setupEvents(): void {
        this.ee.on(PlayerEvents.Error, async (errorMusicItem, reason): Promise<void> => {
            console.error(`[TrackPlayer] Playback error for ${errorMusicItem?.title}:`, reason);
            const needSkip = AppConfig.getConfig("playMusic.playError") === "skip";
            this.resetProgress();

            if (this.isCurrentMusic(errorMusicItem)) {
                this.setPlayerState(PlayerState.Paused);
                if (this.musicQueue.length > 1 && needSkip) {
                    console.log(`[TrackPlayer] Skipping to next track due to error.`);
                    await delay(500);
                    if (this.isCurrentMusic(errorMusicItem)) {
                        this.skipToNext();
                    }
                }
            }
        });

        if (navigator.mediaSession) {
            try {
                navigator.mediaSession.setActionHandler("nexttrack", (): void => {
                    this.skipToNext();
                });
                navigator.mediaSession.setActionHandler("previoustrack", (): void => {
                    this.skipToPrev();
                });
                navigator.mediaSession.setActionHandler('play', async (): Promise<void> => { this.resume(); }); // 修正1
                navigator.mediaSession.setActionHandler('pause', (): void => { this.pause(); });
                navigator.mediaSession.setActionHandler('stop', (): void => { this.reset(); });
                navigator.mediaSession.setActionHandler('seekbackward', (details): void => { this.seekTo(this.progress.currentTime - (details.seekOffset || 10)); });
                navigator.mediaSession.setActionHandler('seekforward', (details): void => { this.seekTo(this.progress.currentTime + (details.seekOffset || 10)); });
            } catch (error) {
                console.warn("[TrackPlayer] Failed to set some media session action handlers:", error);
            }
        } else {
            console.warn("[TrackPlayer] navigator.mediaSession is not available.");
        }
    }

    private createAudioController(): void {
        this.audioController.onEnded = (): void => {
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
                    }).catch(e => console.error("[TrackPlayer] Error restarting looped track:", e));
                    break;
                }
            }
        }
        this.audioController.onProgressUpdate = ((progress): void => {
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
        this.audioController.onVolumeChange = (volume): void => {
            currentVolumeStore.setValue(volume);
            setUserPreference("volume", volume);
        }
        this.audioController.onSpeedChange = (speed): void => {
            currentSpeedStore.setValue(speed);
            setUserPreference("speed", speed);
        }
        this.audioController.onPlayerStateChanged = (state): void => {
            this.setPlayerState(state);
        }
        this.audioController.onError = async (type, reason): Promise<void> => {
            this.ee.emit(PlayerEvents.Error, this.audioController.musicItem, reason);
        }
    }

    public async setup(): Promise<void> {
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

        this.createAudioController();
        this.setupEvents();

        musicQueueStore.setValue(playList);
        this.indexMap.update(playList);

        if (repeatMode) {
            this.setRepeatMode(repeatMode as RepeatMode, false);
        }

        this.setCurrentMusic(currentMusic);
        this.currentIndex = this.findMusicIndex(currentMusic);

        if (deviceId) {
            this.setAudioOutputDevice(deviceId).catch(e => console.error("Failed to set audio output device on setup:", e));
        }
        if (volume !== null && volume !== undefined) this.setVolume(volume);
        if (speed) this.setSpeed(speed);

        this.fetchCurrentLyric();

        if (currentMusic) {
            this.fetchMediaSource(currentMusic, defaultQuality).then(async ({mediaSource, quality}) => {
                if (this.isCurrentMusic(currentMusic) && mediaSource?.url) {
                    await this.setTrack(mediaSource, currentMusic, {
                        seekTo: currentProgress ?? 0,
                        autoPlay: false
                    });
                    this.setCurrentQuality(quality);
                } else if (!mediaSource?.url) {
                    console.warn(`[TrackPlayer Setup] No valid media source found for ${currentMusic.title}`);
                }
            }).catch(e => { // 修正2: 为 catch 添加 (e) =>
                console.error("[TrackPlayer Setup] Error fetching initial media source for " + currentMusic.title + ":", e);
                this.ee.emit(PlayerEvents.Error, currentMusic, e);
            });
        }
    }

    public toggleRepeatMode(): void {
        let nextRepeatMode = this.repeatMode;
        switch (nextRepeatMode) {
            case RepeatMode.Shuffle: nextRepeatMode = RepeatMode.Loop; break;
            case RepeatMode.Loop: nextRepeatMode = RepeatMode.Queue; break;
            case RepeatMode.Queue: nextRepeatMode = RepeatMode.Shuffle; break;
        }
        this.setRepeatMode(nextRepeatMode);
    }

    public async playIndex(index: number, options: IPlayOptions = {}): Promise<void> {
        const { refreshSource = false, restartOnSameMedia = true, seekTo, quality: intendedQuality } = options;

        if (this.musicQueue.length === 0) {
            console.warn("[TrackPlayer] playIndex called with empty queue.");
            this.reset();
            return;
        }
        
        const normalizedIndex = (index + this.musicQueue.length) % this.musicQueue.length;

        const nextMusicItem = this.musicQueue[normalizedIndex];
        if (!nextMusicItem) {
            console.error(`[TrackPlayer] No music item found at normalized index ${normalizedIndex} (original index ${index})`);
            if (this.musicQueue.length > 0) {
                 await this.playIndex(0, options);
            } else {
                this.reset();
            }
            return;
        }
        console.log(`[TrackPlayer] playIndex ${normalizedIndex}: ${nextMusicItem.title}`);

        if (this.currentIndex === normalizedIndex && isSameMedia(this.currentMusic, nextMusicItem) && !refreshSource) {
            if (restartOnSameMedia || (seekTo !== undefined && this.progress.currentTime !== seekTo)) {
                console.log(`[TrackPlayer] Restarting or seeking same media: ${nextMusicItem.title}`);
                this.seekTo(seekTo ?? 0);
                this.audioController.play();
            } else {
                 console.log(`[TrackPlayer] Already playing/paused same media, no action: ${nextMusicItem.title}`);
                 if (this.playerState === PlayerState.Paused && this.audioController.hasSource) this.audioController.play();
            }
            return;
        }
        
        this.setCurrentMusic(nextMusicItem);
        this.currentIndex = normalizedIndex;

        this.setPlayerState(PlayerState.Buffering);
        this.audioController.prepareTrack?.(nextMusicItem);

        try {
            console.log(`[TrackPlayer] Fetching media source for: ${nextMusicItem.title}`);
            const {mediaSource, quality} = await this.fetchMediaSource(nextMusicItem, intendedQuality);

            if (!mediaSource?.url) {
                throw new Error(`Media source URL is empty for ${nextMusicItem.title}`);
            }

            if (!this.isCurrentMusic(nextMusicItem)) {
                console.warn(`[TrackPlayer] Music changed before source could be set for ${nextMusicItem.title}. Aborting.`);
                return;
            }

            this.setCurrentQuality(quality);
            await this.setTrack(mediaSource, nextMusicItem, {
                seekTo: seekTo,
                autoPlay: true
            });
            
            const musicInfo = await PluginManager.callPluginDelegateMethod(
                { platform: nextMusicItem.platform }, "getMusicInfo", nextMusicItem
            ).catch((): null => null);

            if (musicInfo && this.isCurrentMusic(nextMusicItem) && typeof musicInfo === "object") {
                this.setCurrentMusic({
                    ...nextMusicItem, ...musicInfo, platform: nextMusicItem.platform, id: nextMusicItem.id,
                });
            }
        } catch (e) {
            console.error(`[TrackPlayer] Error in playIndex for ${nextMusicItem.title}:`, e);
            this.setCurrentQuality(AppConfig.getConfig("playMusic.defaultQuality"));
            this.ee.emit(PlayerEvents.Error, nextMusicItem, e);
        }
    }

    public async playMusic(musicItem: IMusic.IMusicItem, options: IPlayOptions = {}): Promise<void> {
        const queueIndex = this.findMusicIndex(musicItem);
        if (queueIndex === -1) {
            const newQueue = [
                ...this.musicQueue,
                { ...musicItem, [timeStampSymbol]: Date.now(), [sortIndexSymbol]: this.musicQueue.length }
            ];
            this.setMusicQueue(newQueue);
            await this.playIndex(newQueue.length - 1, options);
        } else {
            await this.playIndex(queueIndex, options);
        }
    }

    public async playMusicWithReplaceQueue(musicList: IMusic.IMusicItem[], musicItem?: IMusic.IMusicItem): Promise<void> {
        if (!musicList.length && !musicItem) {
            return;
        }
        addSortProperty(musicList);
        if (this.repeatMode === RepeatMode.Shuffle && musicList.length > 1) {
            musicList = shuffle(musicList);
        }
        const playTarget = musicItem && musicList.find(item => isSameMedia(item, musicItem)) ? musicItem : musicList[0];
        
        this.setMusicQueue(musicList);
        if(playTarget){
             await this.playMusic(playTarget, { restartOnSameMedia: true });
        } else if (musicList.length > 0) {
             await this.playMusic(musicList[0], { restartOnSameMedia: true });
        }
    }

    public async skipToPrev(): Promise<void> {
        if (this.isEmpty) {
            this.reset();
            return;
        }
        await this.playIndex(this.currentIndex - 1);
    }

    public async skipToNext(): Promise<void> {
        if (this.isEmpty) {
            this.reset();
            return;
        }
        await this.playIndex(this.currentIndex + 1);
    }

    public reset(): void {
        console.log("[TrackPlayer] Resetting player.");
        this.audioController.reset();
        this.setMusicQueue([]);
        this.setCurrentMusic(null);
        this.resetProgress();
        this.setPlayerState(PlayerState.None);
    }

    public seekTo(seconds: number): void {
        if (isFinite(seconds)) {
            this.audioController.seekTo(seconds);
        }
    }

    public pause(): void {
        this.audioController.pause();
    }

    public resume(): void {
        if (!this.audioController.hasSource && !this.isEmpty && this.currentIndex !== -1) {
            console.log("[TrackPlayer] Resume called with no source, attempting to play current index.");
            this.playIndex(this.currentIndex, { restartOnSameMedia: false }).catch(e => console.error("Error on resume/playIndex:", e));
        } else if (this.audioController.hasSource) {
            this.audioController.play();
        } else {
            console.warn("[TrackPlayer] Resume called but no source and queue is empty or index invalid.");
        }
    }

    public setVolume(volume: number): void {
        this.audioController.setVolume(volume);
    }

    public setSpeed(speed: number): void {
        this.audioController.setSpeed(speed);
    }

    public addNext(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]): void {
        let _musicItems: IMusic.IMusicItem[];
        if (Array.isArray(musicItems)) {
            _musicItems = musicItems.map(item => ({...item}));
        } else {
            _musicItems = [{...musicItems}];
        }

        const now = Date.now();
        const uniqueMapForInput = createUniqueMap(_musicItems);
        
        _musicItems.forEach((item, index) => {
            item[timeStampSymbol] = now + index; 
            item[sortIndexSymbol] = index;
        });
        
        const oldQueueFiltered = this.musicQueue.filter(item => !uniqueMapForInput.has(item));

        let adjustedCurrentIndex = this.currentMusic ? oldQueueFiltered.findIndex(item => isSameMedia(item, this.currentMusic)) : -1;
        if (adjustedCurrentIndex === -1 && this.currentMusic) {
             const currentTimestamp = (this.currentMusic as any)[timeStampSymbol] || 0; // 类型断言，并提供默认值
             adjustedCurrentIndex = oldQueueFiltered.findIndex(item => ((item as any)[timeStampSymbol] || 0) < currentTimestamp);
             if (adjustedCurrentIndex === -1 && oldQueueFiltered.length > 0) adjustedCurrentIndex = oldQueueFiltered.length -1;
             else if (adjustedCurrentIndex === -1 && oldQueueFiltered.length === 0) adjustedCurrentIndex = -1;
        }

        const part1 = oldQueueFiltered.slice(0, adjustedCurrentIndex + 1);
        const part2 = _musicItems;
        const part3 = oldQueueFiltered.slice(adjustedCurrentIndex + 1);

        const newQueue = [...part1, ...part2, ...part3];
        this.setMusicQueue(newQueue);
    }

    public removeMusic(musicItemsToRemove: IMusic.IMusicItem | IMusic.IMusicItem[] | number): void {
        const oldQueue = this.musicQueue;
        let newQueue: IMusic.IMusicItem[];
        let musicItemObjectToRemove: IMusic.IMusicItem | null = null;
    
        if (Array.isArray(musicItemsToRemove)) {
            const uniqueMapToRemove = createUniqueMap(musicItemsToRemove);
            newQueue = oldQueue.filter(item => !uniqueMapToRemove.has(item));
        } else {
            if (typeof musicItemsToRemove === 'number') { // remove by index
                if (musicItemsToRemove < 0 || musicItemsToRemove >= oldQueue.length) return;
                musicItemObjectToRemove = oldQueue[musicItemsToRemove];
                newQueue = [...oldQueue];
                newQueue.splice(musicItemsToRemove, 1);
            } else { // remove by musicItem object
                musicItemObjectToRemove = musicItemsToRemove;
                newQueue = oldQueue.filter(item => !isSameMedia(item, musicItemsToRemove as IMusic.IMusicItem)); // 类型断言
            }
        }
    
        const currentPlayingMusic = this.currentMusic;
        const wasPlayingRemoved = currentPlayingMusic && 
                                ( (Array.isArray(musicItemsToRemove) && musicItemsToRemove.some(item => isSameMedia(item, currentPlayingMusic))) ||
                                  (musicItemObjectToRemove && isSameMedia(musicItemObjectToRemove, currentPlayingMusic))
                                );
    
        const oldCurrentIndex = this.currentIndex; // 记录旧的索引
        this.setMusicQueue(newQueue); 
    
        if (wasPlayingRemoved) {
            this.audioController.reset();
            this.resetProgress();
            this.setCurrentMusic(null); 
    
            if (newQueue.length > 0) {
                let nextPlayIndex = 0;
                // 如果是按索引删除，并且该索引在新队列中仍然有效，则播放该位置的歌曲
                if (typeof musicItemsToRemove === 'number' && musicItemsToRemove < newQueue.length) {
                    nextPlayIndex = musicItemsToRemove;
                } 
                // 否则，如果旧的当前索引在新队列中有效，则播放该位置
                else if (oldCurrentIndex < newQueue.length) { 
                    nextPlayIndex = oldCurrentIndex;
                } 
                // 否则，播放列表的第一首歌
                else {
                    nextPlayIndex = 0;
                }
                this.playIndex(nextPlayIndex).catch(e => console.error("Error playing next after removal:", e));
            }
        }
    }    

    public async setQuality(quality: IMusic.IQualityKey): Promise<void> {
        const currentMusic = this.currentMusic;
        if (currentMusic && quality !== this.currentQuality) {
            try {
                const {mediaSource, quality: realQuality} = await this.fetchMediaSource(currentMusic, quality);
                if (this.isCurrentMusic(currentMusic) && mediaSource?.url) {
                    await this.setTrack(mediaSource, currentMusic, {
                        seekTo: this.progress.currentTime ?? 0,
                        autoPlay: this.playerState === PlayerState.Playing
                    });
                    this.setCurrentQuality(realQuality);
                } else if (!mediaSource?.url) {
                    console.warn(`[TrackPlayer] No valid media source found for ${currentMusic.title} with quality ${quality}`);
                }
            } catch (e) {
                console.error(`[TrackPlayer] Error setting quality to ${quality} for ${currentMusic.title}:`, e);
                this.ee.emit(PlayerEvents.Error, currentMusic, e);
            }
        }
    }

    public setRepeatMode(repeatMode: RepeatMode, shuffleIfNeeded = true): void {
        if (this.repeatMode === repeatMode && !shuffleIfNeeded && repeatMode !== RepeatMode.Shuffle) return;
    
        const oldRepeatMode = this.repeatMode;
        repeatModeStore.setValue(repeatMode);
        setUserPreference("repeatMode", repeatMode);
        this.ee.emit(PlayerEvents.RepeatModeChanged, repeatMode);
    
        if (shuffleIfNeeded) {
            const currentPlayingItem = this.currentMusic ? {...this.currentMusic} : null; // 保存当前播放歌曲的副本
            let newQueue = [...this.musicQueue];
    
            if (repeatMode === RepeatMode.Shuffle && newQueue.length > 1) {
                newQueue = shuffle(newQueue);
            } else if (oldRepeatMode === RepeatMode.Shuffle && repeatMode !== RepeatMode.Shuffle) {
                newQueue = sortByTimestampAndIndex(newQueue, false); 
            }
            this.setMusicQueue(newQueue); 
            
            // 队列改变后，重新定位当前播放歌曲的索引
            if (currentPlayingItem) {
                this.currentIndex = this.findMusicIndex(currentPlayingItem);
            } else {
                this.currentIndex = -1;
            }
            console.log(`[TrackPlayer] Repeat mode set to ${repeatMode}. New current index: ${this.currentIndex}`);
        }
    }
    
    public async setAudioOutputDevice(deviceId?: string): Promise<void> {
        try {
            await this.audioController.setSinkId(deviceId ?? "");
        } catch (e) {
            logger.logError("设置音频输出设备失败", e);
        }
    }

    public setMusicQueue(musicQueue: IMusic.IMusicItem[]): void {
        musicQueueStore.setValue(musicQueue);
        setUserPreferenceIDB("playList", musicQueue);
        this.indexMap.update(musicQueue);
        this.currentIndex = this.findMusicIndex(this.currentMusic);
        console.log(`[TrackPlayer] Music queue updated. Length: ${musicQueue.length}. Current index: ${this.currentIndex}`);
    }

    public async fetchCurrentLyric(forceLoad = false): Promise<void> {
        const currentMusic = this.currentMusic;

        if (!currentMusic) {
            this.setCurrentLyric(null);
            return;
        }

        const currentLyric = this.lyric;
        if (!forceLoad && currentLyric?.parser?.musicItem && isSameMedia(currentLyric.parser.musicItem, currentMusic)) {
            return;
        }
        console.log(`[TrackPlayer] Fetching lyric for ${currentMusic.title}`);
        try {
            const linkedLyricItem = await getLinkedLyric(currentMusic);
            let lyricSource: ILyric.ILyricSource | null = null;

            if (linkedLyricItem) {
                lyricSource = await PluginManager.callPluginDelegateMethod(
                    linkedLyricItem, "getLyric", linkedLyricItem
                ).catch((): null => null);
            }

            if (!lyricSource && this.isCurrentMusic(currentMusic)) {
                lyricSource = await PluginManager.callPluginDelegateMethod(
                    currentMusic, "getLyric", currentMusic
                ).catch((): null => null);
            }

            if (!this.isCurrentMusic(currentMusic)) {
                console.warn(`[TrackPlayer] Music changed while fetching lyric for ${currentMusic.title}.`);
                return;
            }

            if (!lyricSource?.rawLrc && !lyricSource?.translation) {
                console.log(`[TrackPlayer] No lyric content found for ${currentMusic.title}.`);
                this.setCurrentLyric({});
            } else {
                const parser = new LyricParser(lyricSource.rawLrc, {
                    musicItem: currentMusic,
                    translation: lyricSource.translation
                });
                this.setCurrentLyric({
                    parser,
                    currentLrc: parser.getPosition(this.progress.currentTime || 0)
                });
            }
        } catch (e) {
            logger.logError(`歌词解析失败 for ${currentMusic.title}`, e as Error); // 类型断言
            this.setCurrentLyric({});
        }
    }

    private async fetchMediaSource(musicItem: IMusic.IMusicItem | null, quality?: IMusic.IQualityKey): Promise<{
        mediaSource: IPlugin.IMediaSourceResult | null,
        quality: IMusic.IQualityKey
    }> {
        const defaultQualityCfg = AppConfig.getConfig("playMusic.defaultQuality");
        if (!musicItem) return { mediaSource: null, quality: defaultQualityCfg };

        const whenQualityMissing = AppConfig.getConfig("playMusic.whenQualityMissing");
        const qualityOrder = getQualityOrder(quality ?? defaultQualityCfg, whenQualityMissing);

        let mediaSource: IPlugin.IMediaSourceResult | null = null;
        let realQuality: IMusic.IQualityKey = qualityOrder[0];

        const downloadedData = getInternalData<IMusic.IMusicItemInternalData>(musicItem, "downloadData");
        if (downloadedData) {
            const {quality: downloadedQuality, path: _path} = downloadedData;
            if (await fsUtil.isFile(_path)) {
                console.log(`[TrackPlayer] Using downloaded file for ${musicItem.title}: ${_path}`);
                return {
                    quality: downloadedQuality,
                    mediaSource: { url: fsUtil.addFileScheme(_path) },
                };
            }
        }

        for (const q of qualityOrder) {
            try {
                mediaSource = await PluginManager.callPluginDelegateMethod(
                    { platform: musicItem.platform }, "getMediaSource", musicItem, q
                );
                if (mediaSource?.url) {
                    realQuality = q;
                    console.log(`[TrackPlayer] Media source found for ${musicItem.title} with quality ${q}.`);
                    break;
                }
            } catch (e: any) {
                console.warn(`[TrackPlayer] Error fetching source for ${musicItem.title} with quality ${q}:`, e.message);
            }
        }
        return { quality: realQuality, mediaSource: mediaSource };
    }

    private setCurrentMusic(musicItem: IMusic.IMusicItem | null): void {
        if (!isSameMedia(this.currentMusic, musicItem)) {
            console.log(`[TrackPlayer] Setting current music to: ${musicItem?.title || 'null'}`);
            currentMusicStore.setValue(musicItem);
            this.ee.emit(PlayerEvents.MusicChanged, musicItem);
            
            this.fetchCurrentLyric(true);

            if (musicItem) {
                setUserPreference("currentMusic", musicItem);
            } else {
                removeUserPreference("currentMusic");
            }
        } else if (musicItem && this.currentMusic?.artwork !== musicItem.artwork) {
            currentMusicStore.setValue(musicItem);
             if (navigator.mediaSession && navigator.mediaSession.metadata && musicItem.artwork) {
                navigator.mediaSession.metadata.artwork = [{ src: musicItem.artwork }];
            }
        }
        this.currentIndex = this.findMusicIndex(musicItem);
    }

    private setProgress(progress: CurrentTime): void {
        progressStore.setValue(progress);
        if (isFinite(progress.duration) && progress.duration > 0) {
            setUserPreference("currentProgress", progress.currentTime);
        }
        this.ee.emit(PlayerEvents.ProgressChanged, progress);
    }

    private setCurrentQuality(quality: IMusic.IQualityKey): void {
        setUserPreference("currentQuality", quality);
        currentQualityStore.setValue(quality);
    }

    private setCurrentLyric(lyric?: ICurrentLyric | null): void {
        const prev = this.lyric;
        currentLyricStore.setValue(lyric);

        if (lyric?.parser !== prev?.parser) {
            this.ee.emit(PlayerEvents.LyricChanged, lyric?.parser ?? null);
        } 
        if (lyric?.currentLrc?.lrc !== prev?.currentLrc?.lrc || lyric?.currentLrc?.time !== prev?.currentLrc?.time) {
            this.ee.emit(PlayerEvents.CurrentLyricChanged, lyric?.currentLrc ?? null);
        }
    }

    private setPlayerState(playerState: PlayerState): void {
        if (this.playerState !== playerState) {
            playerStateStore.setValue(playerState);
            this.ee.emit(PlayerEvents.StateChanged, playerState);
            console.log(`[TrackPlayer] Player state changed to: ${PlayerState[playerState]}`);
        }
    }

    private findMusicIndex(musicItem?: IMusic.IMusicItem | null): number {
        if (!musicItem) {
            return -1;
        }
        return this.indexMap.indexOf(musicItem);
    }

    private resetProgress(): void {
        resetProgress();
        removeUserPreference("currentProgress");
    }

    private async setTrack(mediaSource: IPlugin.IMediaSourceResult, musicItem: IMusic.IMusicItem, options: ITrackOptions = {
        autoPlay: true
    }): Promise<void> {
        console.log(`[TrackPlayer] setTrack called for ${musicItem.title}. AutoPlay: ${options.autoPlay}, SeekTo: ${options.seekTo}`);
        const srcSetSuccessfully = await this.audioController.setTrackSource(mediaSource, musicItem);
        console.log(`[TrackPlayer] audioController.setTrackSource returned: ${srcSetSuccessfully} for ${musicItem.title}`);

        if (srcSetSuccessfully && this.isCurrentMusic(musicItem)) {
             if (options.seekTo === undefined || options.seekTo < 0 || !isFinite(options.seekTo)) {
                 // 如果没有有效的 seekTo 值，或者需要从头播放，我们应该重置进度
                 // 但是，如果歌曲是因错误而重新加载，可能希望从上次的位置继续，这需要更复杂的逻辑
                 // 目前，如果 options.seekTo 未定义或无效，则不显式调用 resetProgress()，
                 // audioController.setTrackSource 内部的 this.resetProgress(); 应该已经处理了。
                 // 如果确实需要从0开始，则 audioController.seekTo(0) 会处理。
                 console.log(`[TrackPlayer] No explicit seekTo or invalid for ${musicItem.title}, relying on audio element's default or previous state.`);
                 if(this.progress.currentTime !==0 && (options.seekTo === undefined || options.seekTo <0)){ // 如果是重新加载源且没有指定seekTo，则从0开始
                    this.audioController.seekTo(0);
                    this.setProgress({ currentTime: 0, duration: this.audioController.musicItem?.duration || Infinity });
                 }
            } else {
                 console.log(`[TrackPlayer] Seeking to ${options.seekTo} for ${musicItem.title}`);
                 this.audioController.seekTo(options.seekTo);
                 this.setProgress({ currentTime: options.seekTo, duration: this.audioController.musicItem?.duration || Infinity });
            }


            if (options.autoPlay) {
                console.log(`[TrackPlayer] Auto-playing ${musicItem.title}`);
                this.audioController.play();
            } else {
                if (this.playerState !== PlayerState.Paused) {
                    this.setPlayerState(PlayerState.Paused);
                }
            }
        } else if (!srcSetSuccessfully) {
            console.warn(`[TrackPlayer] Failed to set source for ${musicItem.title}, playback not started.`);
            if (this.isCurrentMusic(musicItem)) {
                this.ee.emit(PlayerEvents.Error, musicItem, new Error("Failed to set audio source"));
            }
        } else {
            console.warn(`[TrackPlayer] Music item changed before track could be fully set for ${musicItem.title}.`);
        }
    }

    public isCurrentMusic(musicItem: IMusic.IMusicItem | null): boolean {
        return isSameMedia(musicItem, this.currentMusic);
    }
}

export default new TrackPlayer();