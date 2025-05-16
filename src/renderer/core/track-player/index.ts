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
    [PlayerEvents.Error]: (errorMusicItem: IMusic.IMusicItem | null, reason: Error) => void;
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
    private ee: EventEmitter<InternalPlayerEvents>;
    public isReady = false;

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

        // 恢复播放状态的逻辑
        const musicToRestore = previousState?.music || this.currentMusic;
        const timeToRestore = previousState?.music ? previousState.time : this.progress.currentTime;
        const qualityToRestore = this.currentQuality || AppConfig.getConfig("playMusic.defaultQuality");
        const shouldAutoPlay = previousState?.music ? previousState.isPlaying : false; // 只有在明确有先前状态时才考虑自动播放

        if (musicToRestore && this.audioController) {
            logger.logInfo("TrackPlayer: Attempting to load/restore track with new backend.", { title: musicToRestore.title, time: timeToRestore });
            this.setCurrentMusic(musicToRestore); // 确保 currentMusic 已设置
            this.currentIndex = this.findMusicIndex(musicToRestore); // 更新 currentIndex
            this.audioController.prepareTrack?.(musicToRestore);

            try {
                const {mediaSource, quality: actualQuality} = await this.fetchMediaSource(musicToRestore, qualityToRestore);
                if (!mediaSource?.url) {
                    throw new Error("Media source URL is empty for track restoration.");
                }
                if (this.isCurrentMusic(musicToRestore)) { // 再次检查，以防在异步操作中 currentMusic 已改变
                    this.setCurrentQuality(actualQuality);
                    this.setTrack(mediaSource, musicToRestore, {
                        seekTo: timeToRestore,
                        autoPlay: shouldAutoPlay
                    });
                }
            } catch (e: any) {
                logger.logError("Error restoring/loading track with new backend:", e);
                this.ee.emit(PlayerEvents.Error, musicToRestore, e instanceof Error ? e : new Error(String(e)));
                this.setPlayerState(PlayerState.None);
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
        this.audioController.onError = async (type, reason: any) => {
            logger.logError("TrackPlayer: Playback error from controller", { type, reason: reason?.message || String(reason), musicItem: this.audioController?.musicItem } as any);
            const errorToEmit = reason instanceof Error ? reason : new Error(String(reason) || "Unknown playback error");
            this.ee.emit(PlayerEvents.Error, this.audioController?.musicItem, errorToEmit);
        }
    }

    public async setup() {
        if (this.isReady) return;

        // 1. 加载用户偏好设置并设置初始状态
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
            this.setRepeatMode(repeatMode as RepeatMode, false); // false: 不立即重排队列
        }
        if (currentMusicFromPref) {
            this.setCurrentMusic(currentMusicFromPref); // 这会触发歌词获取
            this.currentIndex = this.findMusicIndex(currentMusicFromPref);
        }
        if (preferredQuality) {
            this.setCurrentQuality(preferredQuality);
        }
        if (currentProgress && isFinite(currentProgress)) {
            // 仅设置初始进度值，不实际 seek
            progressStore.setValue({ currentTime: currentProgress, duration: Infinity });
        }


        // 2. 初始化音频后端
        await this.initializeAudioBackend(); // 会根据当前状态（currentMusic, currentProgress）尝试加载

        // 3. 设置音频设备、音量和速度（这些操作依赖 audioController）
        const deviceId = AppConfig.getConfig("playMusic.audioOutputDevice")?.deviceId;
        if (deviceId && this.audioController) {
            await this.setAudioOutputDevice(deviceId).catch(e => logger.logError("Failed to set initial audio device", e));
        }
        if (volume !== null && volume !== undefined && this.audioController) {
            this.setVolume(volume); // audioController 内部会处理
        }
        if (speed && this.audioController) {
            this.setSpeed(speed); // audioController 内部会处理
        }

        // 4. 设置其他事件监听器和配置更新处理
        this.setupEvents(); // 通用播放器事件
        AppConfig.onConfigUpdate(async (patch) => { // 配置变化处理
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
                const newDeviceId = AppConfig.getConfig("playMusic.audioOutputDevice")?.deviceId;
                await this.setAudioOutputDevice(newDeviceId);
            }
        });

        this.isReady = true;
        logger.logInfo("TrackPlayer: Setup complete.");
    }


    private setupEvents() {
        this.ee.on(PlayerEvents.Error, async (errorMusicItem, reason) => {
            logger.logError("TrackPlayer internal error event:", { musicTitle: errorMusicItem?.title, reason: reason.message, stack: reason.stack } as any);
            this.resetProgress(); // 发生错误时重置进度
            const needSkip = AppConfig.getConfig("playMusic.playError") === "skip";
            if (this.musicQueue.length > 1 && needSkip && errorMusicItem && this.isCurrentMusic(errorMusicItem)) {
                await delay(500); // 短暂延迟以避免快速连续跳过
                if (this.isCurrentMusic(errorMusicItem)) { // 再次检查，以防在延迟期间状态已改变
                    this.skipToNext();
                }
            } else if (errorMusicItem && this.isCurrentMusic(errorMusicItem)) {
                // 如果不跳过，或者队列中只有一首歌，则暂停并设置状态为 None
                this.pause(); // 尝试暂停播放器
                this.setPlayerState(PlayerState.None); // 将播放器状态设为 None
            }
        });

        if (navigator.mediaSession) {
            navigator.mediaSession.setActionHandler("nexttrack", () => {
                this.skipToNext();
            })
            navigator.mediaSession.setActionHandler("previoustrack", () => {
                this.skipToPrev();
            })
             navigator.mediaSession.setActionHandler("play", () => {
                this.resume();
            });
            navigator.mediaSession.setActionHandler("pause", () => {
                this.pause();
            });
            navigator.mediaSession.setActionHandler("seekto", (details) => {
                if (details.seekTime != null) {
                    this.seekTo(details.seekTime);
                }
            });
        }
    }

    public async playIndex(index: number, options: IPlayOptions = {}) {
        if (!this.isReady) {
             logger.logInfo("TrackPlayer not ready in playIndex. Attempting to setup.");
             await this.setup(); // 确保已初始化
        }
        if (!this.audioController) {
            logger.logError("TrackPlayer: audioController not initialized in playIndex.", new Error("audioController is null"));
            this.ee.emit(PlayerEvents.Error, this.musicQueue[index] || null, new Error("播放器未正确初始化。"));
            return;
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
                throw new Error("无法获取有效的媒体播放链接 (URL is empty).");
            }
            if (!this.isCurrentMusic(nextMusicItem)) return; // 如果在异步获取音源时歌曲已切换，则中止

            this.setCurrentQuality(quality);
            this.setTrack(mediaSource, nextMusicItem, {
                seekTo,
                autoPlay: true
            });

            // 异步获取并更新音乐的详细信息（例如封面、更准确的时长等）
            PluginManager.callPluginDelegateMethod(
                { platform: nextMusicItem.platform }, "getMusicInfo", nextMusicItem
            ).then(musicInfo => {
                if (musicInfo && this.isCurrentMusic(nextMusicItem) && typeof musicInfo === "object") {
                    this.setCurrentMusic({ // 更新 currentMusic，这会触发 MusicChanged 事件
                        ...nextMusicItem,
                        ...musicInfo,
                        platform: nextMusicItem.platform, // 确保 platform 和 id 不被覆盖
                        id: nextMusicItem.id,
                    });
                }
            }).catch(voidCallback);

        } catch (e: any) {
            logger.logError("Error in playIndex:", e, {musicItemTitle: nextMusicItem?.title, platform: nextMusicItem?.platform, id: nextMusicItem?.id});
            this.setCurrentQuality(AppConfig.getConfig("playMusic.defaultQuality")); // 恢复默认音质
            if (this.audioController) this.audioController.reset();
            const errorToEmit = e instanceof Error ? e : new Error(String(e) || '播放时发生未知错误');
            this.ee.emit(PlayerEvents.Error, nextMusicItem, errorToEmit);
            this.setPlayerState(PlayerState.None);
        }
    }

    public async playMusic(musicItem: IMusic.IMusicItem, options: IPlayOptions = {}) {
        if (!this.isReady) {
             logger.logInfo("TrackPlayer not ready in playMusic.");
             await this.setup();
        }
        if (!this.audioController) {
             logger.logError("TrackPlayer: audioController not initialized in playMusic.", new Error("audioController is null"));
             this.ee.emit(PlayerEvents.Error, musicItem, new Error("播放器未正确初始化。"));
             return;
        }
        const queueIndex = this.findMusicIndex(musicItem);
        if (queueIndex === -1) { // 歌曲不在当前队列中
            const newQueue = [
                ...this.musicQueue,
                {
                    ...musicItem,
                    [timeStampSymbol]: Date.now(),
                    [sortIndexSymbol]: this.musicQueue.length // 正确设置新歌曲的排序索引
                }
            ]
            this.setMusicQueue(newQueue);
            await this.playIndex(newQueue.length - 1, options); // 播放新加入的歌曲
        } else {
            await this.playIndex(queueIndex, options); // 播放队列中已存在的歌曲
        }
    }

    public async playMusicWithReplaceQueue(musicList: IMusic.IMusicItem[], musicItem?: IMusic.IMusicItem) {
        if (!this.isReady) {
            logger.logInfo("TrackPlayer not ready in playMusicWithReplaceQueue.");
            await this.setup();
        }
         if (!this.audioController) {
             logger.logError("TrackPlayer: audioController not initialized in playMusicWithReplaceQueue.", new Error("audioController is null"));
             this.ee.emit(PlayerEvents.Error, musicItem || (musicList.length > 0 ? musicList[0] : null), new Error("播放器未正确初始化。"));
             return;
        }
        if (!musicList.length && !musicItem) {
            this.reset();
            return;
        }
        addSortProperty(musicList); // 为列表中的所有歌曲添加排序属性
        if (this.repeatMode === RepeatMode.Shuffle) {
            musicList = shuffle(musicList); // 如果是随机模式，打乱列表
        }
        musicItem = musicItem ?? musicList[0]; // 如果没有指定播放项，默认播放列表第一首
        this.setMusicQueue(musicList);
        await this.playMusic(musicItem); // 调用 playMusic 播放
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
        this.setMusicQueue([]); // 这会清空队列并更新 currentIndex
        this.setCurrentMusic(null); // 这会重置当前歌曲和歌词
        // currentIndex 会在 setMusicQueue 和 setCurrentMusic 中被间接重置为 -1
        this.setPlayerState(PlayerState.None);
        this.resetProgress(); // 确保进度也被重置
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
        const clampedVolume = Math.max(0, Math.min(1, volume));
        if (!this.isReady || !this.audioController) {
            // 如果播放器未就绪，仅更新存储的值
            currentVolumeStore.setValue(clampedVolume);
            setUserPreference("volume", clampedVolume);
            return;
        }
        this.audioController.setVolume(clampedVolume); // audioController 内部会触发 onVolumeChange
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
            _musicItems = [...musicItems]; // 创建副本以避免修改原始数组
        } else {
            _musicItems = [musicItems];
        }

        const now = Date.now();
        _musicItems.forEach((item, index) => {
            // 确保每个项目都有排序属性
            if (item[timeStampSymbol] === undefined) item[timeStampSymbol] = now;
            if (item[sortIndexSymbol] === undefined) item[sortIndexSymbol] = index;
        });

        const itemsToAdd: IMusic.IMusicItem[] = [];
        // 使用当前队列的 indexMap 来检查重复，而不是为新项目创建临时的 uniqueMap
        for (const newItem of _musicItems) {
            if (this.findMusicIndex(newItem) === -1) { // 如果歌曲不在当前队列中
                itemsToAdd.push(newItem);
            }
        }

        if (itemsToAdd.length === 0) return; // 没有新歌可添加

        const oldQueue = this.musicQueue;
        let insertPosition = this.currentIndex + 1;
        // 确保插入位置有效
        if (insertPosition > oldQueue.length || insertPosition < 0) {
            insertPosition = oldQueue.length; // 如果当前没有播放或索引无效，则追加到末尾
        }

        const newQueue = [
            ...oldQueue.slice(0, insertPosition),
            ...itemsToAdd,
            ...oldQueue.slice(insertPosition)
        ];
        this.setMusicQueue(newQueue); // 更新队列
    }


    public removeMusic(musicItemsToRemove: IMusic.IMusicItem | IMusic.IMusicItem[] | number) {
        if (!this.isReady) return;

        const currentQueue = this.musicQueue;
        if (currentQueue.length === 0) return; // 队列为空，无需操作

        let indicesToRemove: number[] = [];

        if (typeof musicItemsToRemove === 'number') { // 按索引移除
            if (musicItemsToRemove >= 0 && musicItemsToRemove < currentQueue.length) {
                indicesToRemove.push(musicItemsToRemove);
            }
        } else { // 按音乐项或音乐项数组移除
            const itemsArray = Array.isArray(musicItemsToRemove) ? musicItemsToRemove : [musicItemsToRemove];
            itemsArray.forEach(item => {
                const idx = this.findMusicIndex(item);
                if (idx !== -1) indicesToRemove.push(idx);
            });
            indicesToRemove = [...new Set(indicesToRemove)]; // 去重
        }

        if (indicesToRemove.length === 0) return;

        // 从大到小排序索引，这样删除时不会影响前面元素的索引
        indicesToRemove.sort((a, b) => b - a);

        const newQueue = [...currentQueue];
        let newCurrentIndex = this.currentIndex;
        let currentMusicWasRemoved = false;

        for (const index of indicesToRemove) {
            newQueue.splice(index, 1); // 直接按原始索引删除（因为是从大到小删）
            if (index === this.currentIndex) {
                currentMusicWasRemoved = true;
            } else if (index < this.currentIndex) {
                newCurrentIndex--; // 如果删除的是当前播放歌曲之前的歌曲，调整当前索引
            }
        }
        this.currentIndex = newCurrentIndex; // 更新调整后的当前索引

        if (currentMusicWasRemoved) {
            if (this.audioController) this.audioController.reset(); // 重置播放器（停止当前播放）
            this.resetProgress(); // 重置进度
            this.setCurrentMusic(null); // 清空当前歌曲信息
        }

        this.setMusicQueue(newQueue); // 更新队列

        if (currentMusicWasRemoved && newQueue.length > 0) {
            // 如果被删除的是当前歌曲，且队列不为空，则尝试播放调整后的当前索引处的歌曲
            // 如果调整后的索引无效（例如，删除了最后一首歌且它是当前歌曲），则播放第一首
            const playNextIdx = (this.currentIndex >= 0 && this.currentIndex < newQueue.length) ? this.currentIndex : 0;
            this.playIndex(playNextIdx);
        } else if (newQueue.length === 0) {
            this.reset(); // 如果队列为空，则完全重置播放器
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
                if (this.isCurrentMusic(currentMusic) && this.audioController) { // 再次检查
                    this.setTrack(mediaSource, currentMusic, {
                        seekTo: currentTime,
                        autoPlay: wasPlaying
                    })
                    this.setCurrentQuality(realQuality);
                }
            } catch (e: any) {
                logger.logError("Error setting quality:", e, {musicTitle: currentMusic.title});
                this.ee.emit(PlayerEvents.Error, currentMusic, e instanceof Error ? e : new Error(String(e)));
                // 恢复播放状态，即使切换失败
                if (wasPlaying && this.audioController) this.audioController.play();
                else this.setPlayerState(PlayerState.Paused); // 如果之前是暂停，则保持暂停
            }
        }
    }

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
            default:
                nextRepeatMode = RepeatMode.Shuffle;
                break;
        }
        this.setRepeatMode(nextRepeatMode);
    }

    public setRepeatMode(repeatMode: RepeatMode, triggerReorder: boolean = true) {
        const oldRepeatMode = this.repeatMode; // 获取旧模式
        repeatModeStore.setValue(repeatMode);
        setUserPreference("repeatMode", repeatMode);

        if (this.isReady && triggerReorder) { // 只有当播放器就绪且需要时才重排
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
        // 更新当前播放歌曲在队列中的索引，如果歌曲不在新队列中，则currentIndex会变为-1
        this.currentIndex = this.findMusicIndex(this.currentMusic);
    }


    public async fetchCurrentLyric(forceLoad = false) {
        if (!this.isReady) return;
        const currentMusic = this.currentMusic;
        if (!currentMusic) {
            this.setCurrentLyric(null); // 清空歌词
            return;
        }

        const currentLyricData = this.lyric; // 使用 this.lyric
        // 如果不需要强制加载，并且当前歌词解析器对应的音乐与正在播放的音乐相同，则不重新获取
        if (!forceLoad && currentLyricData && this.isCurrentMusic(currentLyricData.parser?.musicItem)) {
            return;
        }
        try {
            const linkedLyricItem = await getLinkedLyric(currentMusic);
            let lyricSource: ILyric.ILyricSource | null = null;

            // 尝试从关联的歌词项获取歌词
            if (linkedLyricItem) {
                lyricSource = (await PluginManager.callPluginDelegateMethod(
                    linkedLyricItem, "getLyric", linkedLyricItem // 使用 linkedLyricItem 作为参数
                ).catch(voidCallback)) || null;
            }
            // 如果没有从关联项获取到歌词，或者当前歌曲已改变，则尝试从当前歌曲本身获取
            if ((!lyricSource || (!lyricSource.rawLrc && !lyricSource.translation)) && this.isCurrentMusic(currentMusic)) {
                lyricSource = (await PluginManager.callPluginDelegateMethod(
                    currentMusic, "getLyric", currentMusic
                ).catch(voidCallback)) || null;
            }

            if (!this.isCurrentMusic(currentMusic)) return; // 再次检查，以防在异步操作中歌曲已切换

            if (!lyricSource?.rawLrc && !lyricSource?.translation) {
                this.setCurrentLyric(null); // 设置为空歌词对象
                return;
            }
            const parser = new LyricParser(lyricSource.rawLrc, {
                musicItem: currentMusic, // 确保 parser 关联到正确的 musicItem
                translation: lyricSource.translation
            });
            this.setCurrentLyric({ // 设置歌词，包括解析器和当前行
                parser,
                currentLrc: parser.getPosition(this.progress.currentTime || 0)
            });
        } catch (e: any) {
            logger.logError("歌词解析失败", e);
            this.setCurrentLyric(null); // 出错时设置为空歌词对象
        }
    }


    private async fetchMediaSource(musicItem: IMusic.IMusicItem, quality?: IMusic.IQualityKey): Promise<{ quality: IMusic.IQualityKey; mediaSource: IPlugin.IMediaSourceResult | null; }> {
        if (!this.isReady) { // 确保播放器已就绪
            throw new Error("TrackPlayer not ready to fetch media source.");
        }
        const defaultQuality = AppConfig.getConfig("playMusic.defaultQuality") || "standard";
        const whenQualityMissing = AppConfig.getConfig("playMusic.whenQualityMissing") || "lower";
        const qualityOrder = getQualityOrder(quality ?? defaultQuality, whenQualityMissing);
        let mediaSource: IPlugin.IMediaSourceResult | null = null;
        let realQuality: IMusic.IQualityKey = qualityOrder[0]; // 默认为尝试的第一个音质

        // 检查本地下载
        const downloadedData = getInternalData<IMusic.IMusicItemInternalData>(musicItem, "downloadData");
        if (downloadedData) {
            const {quality: downloadedQuality, path: _path} = downloadedData;
            if (await fsUtil.isFile(_path)) { // 确保文件存在
                return {
                    quality: downloadedQuality || "standard", // 如果下载的音质未知，则默认为 standard
                    mediaSource: { url: fsUtil.addFileScheme(_path) }, // 添加 file:// 协议头
                };
            }
        }

        // 尝试从插件获取在线音源
        for (const q of qualityOrder) {
            try {
                mediaSource = await PluginManager.callPluginDelegateMethod(
                    { platform: musicItem.platform }, "getMediaSource", musicItem, q
                );
                if (!mediaSource?.url) continue; // 如果没有 URL，尝试下一个音质
                realQuality = q; // 记录实际获取到的音质
                break; // 成功获取到音源，跳出循环
            } catch (e: any) {
                logger.logInfo(`Failed to get media source for quality ${q} for music ${musicItem.title}: ${e.message}`);
            }
        }

        if (!mediaSource?.url) { // 如果所有音质都尝试失败
            throw new Error(`无法为歌曲 ${musicItem.title} 获取任何有效的播放链接。`);
        }
        return { quality: realQuality, mediaSource };
    }


    private setCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        // 只有当歌曲实际发生变化时才执行复杂逻辑（例如，不同的歌，或者同一首歌但信息更新了）
        const isActuallyDifferent = !this.isCurrentMusic(musicItem) ||
                                  (musicItem && this.currentMusic && JSON.stringify(musicItem) !== JSON.stringify(this.currentMusic));

        currentMusicStore.setValue(musicItem); // 总是更新 store 中的值

        if (isActuallyDifferent) {
            this.ee.emit(PlayerEvents.MusicChanged, musicItem);
            this.fetchCurrentLyric(true); // 强制重新加载歌词
            this.resetProgress(); // 新歌，重置进度

            if (musicItem) {
                setUserPreference("currentMusic", musicItem); // 保存到用户偏好
            } else {
                removeUserPreference("currentMusic");
            }
        }
    }


    private setProgress(progress: CurrentTime) {
        progressStore.setValue(progress);
        if (isFinite(progress.currentTime)) { // 只有当 currentTime 是有效数字时才保存
            setUserPreference("currentProgress", progress.currentTime);
        }
        this.ee.emit(PlayerEvents.ProgressChanged, progress);
    }

    private setCurrentQuality(quality: IMusic.IQualityKey) {
        setUserPreference("currentQuality", quality);
        currentQualityStore.setValue(quality);
    }

    private setCurrentLyric(lyric?: ICurrentLyric | null) { // 允许传递 null 来清空歌词
        const prev = this.lyric;
        // 如果 lyric 是 {} (空对象)，也视为 null
        const newLyric = (lyric && Object.keys(lyric).length > 0) ? lyric as ICurrentLyric : null;
        currentLyricStore.setValue(newLyric);

        // 只有当解析器实际改变时才触发 LyricChanged
        if (newLyric?.parser !== prev?.parser) {
            this.ee.emit(PlayerEvents.LyricChanged, newLyric?.parser ?? null);
        }
        // 只有当当前歌词行实际改变时才触发 CurrentLyricChanged
        if (newLyric?.currentLrc?.lrc !== prev?.currentLrc?.lrc) { // 比较 lrc 内容以避免不必要的更新
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
        resetProgress(); // 调用 store 中的重置函数
        removeUserPreference("currentProgress"); // 从用户偏好中移除
    }


    private setTrack(mediaSource: IPlugin.IMediaSourceResult | null, musicItem: IMusic.IMusicItem, options: ITrackOptions = { autoPlay: true }) {
        if (!this.audioController) {
            logger.logError("setTrack called but audioController is null.", new Error("audioController is null"));
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("播放器核心组件丢失。"));
            this.setPlayerState(PlayerState.None);
            return;
        }
        // 在设置新轨道前，先重置播放器的当前状态和进度
        this.audioController.reset(); // 这会停止当前播放并清除音源
        this.resetProgress(); // 重置 TrackPlayer 内部的进度记录

        if (!mediaSource || !mediaSource.url) {
            const errorMsg = `setTrack called with invalid mediaSource for music: ${musicItem.title}`;
            logger.logError(errorMsg, new Error(`Invalid mediaSource: ${JSON.stringify(mediaSource)}`));
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("无效的媒体源或URL为空"));
            this.setPlayerState(PlayerState.None); // 确保状态反映错误
            return;
        }

        this.audioController.setTrackSource(mediaSource, musicItem); // 设置新的音源

        // 如果需要跳转到特定时间
        if (options.seekTo !== undefined && isFinite(options.seekTo) && options.seekTo >= 0) {
            this.audioController.seekTo(options.seekTo);
        }

        // 如果需要自动播放
        if (options.autoPlay) {
            this.audioController.play();
        } else {
            // 如果不自动播放，并且之前不是暂停状态，则可能是缓冲或无状态，此时确保是暂停
            if (this.playerState !== PlayerState.Paused) {
                 this.setPlayerState(PlayerState.Paused); // 或者 PlayerState.None，取决于期望行为
            }
        }
    }


    public isCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        return isSameMedia(musicItem, this.currentMusic);
    }
}

export default new TrackPlayer();