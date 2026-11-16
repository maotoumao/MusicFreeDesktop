import { CurrentTime, ICurrentLyric, PlayerEvents } from "./enum";
import shuffle from "lodash.shuffle";
import {
    addSortProperty,
    getInternalData,
    getQualityOrder,
    isSameMedia,
    sortByTimestampAndIndex,
} from "@/common/media-util";
import { PlayerState, RepeatMode, sortIndexSymbol, timeStampSymbol } from "@/common/constant";
import LyricParser, { IParsedLrcItem } from "@/renderer/utils/lyric-parser";
import {
    getUserPreference,
    getUserPreferenceIDB,
    removeUserPreference,
    setUserPreference,
    setUserPreferenceIDB,
} from "@/renderer/utils/user-perference";
import AppConfig from "@shared/app-config/renderer";
import { createIndexMap, IIndexMap } from "@/common/index-map";
import _trackPlayerStore from "./store";
import EventEmitter from "eventemitter3";
import { IAudioController } from "@/types/audio-controller";
import AudioController from "@renderer/core/track-player/controller/audio-controller";
import logger from "@shared/logger/renderer";
import voidCallback from "@/common/void-callback";
import { delay } from "@/common/time-util";
import { createUniqueMap } from "@/common/unique-map";
import { getLinkedLyric, getLinkedLyricText } from "@renderer/core/link-lyric";
import {
    applyLyricCandidate,
    hasSearched,
    markSearched,
    pickLyricCandidate,
    recordCandidates,
    searchLyricCandidates,
    unmarkSearched,
} from "@renderer/core/smart-lyric";
import { isEmptyLyricSource } from "@/common/lyric-util";
import { fsUtil } from "@shared/utils/renderer";
import PluginManager from "@shared/plugin-manager/renderer";
import { correctDurationByMeasured } from "@renderer/core/music-duration";
import { i18n } from "@/shared/i18n/renderer";
import { toast } from "react-toastify";

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
    resetProgress,
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
    // 自动播放
    autoPlay?: boolean;
}

class TrackPlayer {
    get currentMusic() {
        return currentMusicStore.getValue();
    }

    // 只有基础信息
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
        } as IMusic.IMusicItem;
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

    /** 最近一次使用的音源 */
    private lastMediaSource: IPlugin.IMediaSourceResult | null = null;

    /** 最近一次测到的音频时长，用来判断是不是变了 */
    private lastMeasuredDuration = 0;

    /** 当前歌曲已经因为「音源中断」换过几次源了，防止无限重试 */
    private sourceRecoveryCount = 0;
    /** 换源次数上限 */
    private static readonly MAX_SOURCE_RECOVERY = 2;

    private ee: EventEmitter<InternalPlayerEvents>;

    constructor() {
        this.indexMap = createIndexMap();
        this.ee = new EventEmitter();
        this.audioController = new AudioController();
    }

    on<T extends keyof InternalPlayerEvents>(event: T, callback: InternalPlayerEvents[T]) {
        this.ee.on(event, callback as any);
    }

    off<T extends keyof InternalPlayerEvents>(event: T, callback: InternalPlayerEvents[T]) {
        this.ee.off(event, callback as any);
    }

    private setupEvents() {
        this.ee.on(PlayerEvents.Error, async (errorMusicItem) => {
            // config
            const needSkip = AppConfig.getConfig("playMusic.playError") === "skip";

            // 以前这里只把进度清零，界面上看不出发生了什么，
            // 用户只看到「歌曲自己停了」。给个提示。
            toast.error(i18n.t("playback.play_failed"));

            this.resetProgress();
            if (this.musicQueue.length > 1 && needSkip) {
                await delay(500);
                if (this.isCurrentMusic(errorMusicItem)) {
                    this.skipToNext();
                }
            }
        });

        navigator.mediaSession.setActionHandler("nexttrack", () => {
            this.skipToNext();
        });

        navigator.mediaSession.setActionHandler("previoustrack", () => {
            this.skipToPrev();
        });
    }


    private createAudioController() {
        const audioController = new AudioController();
        // 播放结束
        audioController.onEnded = () => {
            this.resetProgress();

            switch (this.repeatMode) {
                case RepeatMode.Queue:
                case RepeatMode.Shuffle: {
                    this.skipToNext();
                    break;
                }
                case RepeatMode.Loop: {
                    this.playIndex(this.currentIndex, {
                        restartOnSameMedia: true,
                    });
                }
            }
        };
        // 进度更新
        audioController.onProgressUpdate = ((progress) => {
            this.setProgress(progress);
            this.captureRealDuration(progress.duration);
            // 检查歌词
            if (this.lyric?.parser) {
                const lyricItem = this.lyric.parser.getPosition(progress.currentTime);
                if (this.lyric.currentLrc?.lrc !== lyricItem?.lrc) {
                    this.setCurrentLyric({
                        parser: this.lyric.parser,
                        currentLrc: lyricItem,
                    });
                }
            }
        });

        audioController.onVolumeChange = (volume) => {
            currentVolumeStore.setValue(volume);
            setUserPreference("volume", volume);
        };

        audioController.onSpeedChange = (speed) => {
            currentSpeedStore.setValue(speed);
            setUserPreference("speed", speed);
        };

        audioController.onPlayerStateChanged = (state) => {
            this.setPlayerState(state);
        };

        audioController.onError = async (type, reason) => {
            this.ee.emit(PlayerEvents.Error, audioController.musicItem, reason);
        };

        // 音源中途断了：重新取一次源，从当前位置接着播
        audioController.onStalled = () => {
            this.recoverFromBrokenSource();
        };
        // 本地文件没下全：改用在线音源
        audioController.onSourceIncomplete = () => {
            this.recoverFromBrokenSource();
        };


        this.audioController = audioController;
    }

    public async setup() {
        // 1. Config
        const [repeatMode, currentMusic, currentProgress, volume, speed, defaultQuality] = [
            getUserPreference("repeatMode"),
            getUserPreference("currentMusic"),
            getUserPreference("currentProgress"),
            getUserPreference("volume"),
            getUserPreference("speed"),
            getUserPreference("currentQuality") || AppConfig.getConfig("playMusic.defaultQuality"),
        ];
        const playList = ((await getUserPreferenceIDB("playList")) ?? []).filter(it => !!it);
        addSortProperty(playList);
        const deviceId = AppConfig.getConfig("playMusic.audioOutputDevice")?.deviceId;

        // 2. init audio controller
        this.createAudioController();
        this.setupEvents();

        // 3. resume state
        musicQueueStore.setValue(playList);
        this.indexMap.update(playList);

        if (repeatMode) {
            this.setRepeatMode(repeatMode as RepeatMode);
        }

        this.setCurrentMusic(currentMusic);
        this.currentIndex = this.findMusicIndex(currentMusic);

        if (deviceId) {
            this.setAudioOutputDevice(deviceId);
        }

        if (volume !== null && volume !== undefined) {
            this.setVolume(volume);
        }

        if (speed) {
            this.setSpeed(speed);
        }

        // 4. reload lyric
        this.fetchCurrentLyric();

        // 5. fetch music source
        this.fetchMediaSource(currentMusic, defaultQuality).then(({ mediaSource, quality }) => {
            if (this.isCurrentMusic(currentMusic)) {
                this.setTrack(mediaSource, currentMusic, {
                    seekTo: currentProgress,
                    autoPlay: false,
                });
                this.setCurrentQuality(quality);
            }
        }).catch(voidCallback);
    }


    // 切换播放模式
    public toggleRepeatMode() {
        let nextRepeatMode = this.repeatMode;
        switch (nextRepeatMode) {
            case RepeatMode.Shuffle:
                nextRepeatMode = RepeatMode.Loop;
                break;
            case RepeatMode.Loop:
                nextRepeatMode = RepeatMode.Queue;
                break;
            case RepeatMode.Queue:
                nextRepeatMode = RepeatMode.Shuffle;
                break;
        }

        this.setRepeatMode(nextRepeatMode);
    }

    public async playIndex(index: number, options: IPlayOptions = {}) {
        const { refreshSource, restartOnSameMedia = true, seekTo, quality: intendedQuality } = options;
        if (index === -1 && this.musicQueue.length === 0) {
            // 播放列表为空
            return;
        }
        // 1. normalize index
        index = (index + this.musicQueue.length) % this.musicQueue.length;

        // 2. same media
        if (this.currentIndex === index && this.isCurrentMusic(this.musicQueue[index]) && !refreshSource) {
            if (restartOnSameMedia) {
                this.seekTo(0);
            }
            this.audioController.play();

            return;
        }

        // update music
        const nextMusicItem = this.musicQueue[index];
        this.setCurrentMusic(nextMusicItem);
        this.currentIndex = index;

        this.setPlayerState(PlayerState.Buffering);
        this.audioController.prepareTrack?.(nextMusicItem);

        try {
            const { mediaSource, quality } = await this.fetchMediaSource(nextMusicItem, intendedQuality);

            if (!mediaSource.url) {
                throw new Error("mediaSource.url is empty");
            }

            if (!this.isCurrentMusic(nextMusicItem)) {
                // should be aborted
                return;
            }

            this.setCurrentQuality(quality);
            this.setTrack(mediaSource, nextMusicItem, {
                seekTo,
                autoPlay: true,
            });

            // extra information
            const musicInfo = await PluginManager.callPluginDelegateMethod(
                {
                    platform: nextMusicItem.platform,
                },
                "getMusicInfo",
                nextMusicItem,
            ).catch(voidCallback);

            if (!(musicInfo && this.isCurrentMusic(nextMusicItem) && typeof musicInfo === "object")) {
                return;
            }

            this.setCurrentMusic({
                ...nextMusicItem,
                ...musicInfo,
                platform: nextMusicItem.platform,
                id: nextMusicItem.id,
            });

        } catch (e) {
            // 播放失败
            this.setCurrentQuality(AppConfig.getConfig("playMusic.defaultQuality"));
            this.audioController.reset();
            this.ee.emit(PlayerEvents.Error, nextMusicItem, e);
        }


    }

    public async playMusic(musicItem: IMusic.IMusicItem, options: IPlayOptions = {}) {
        if (!musicItem) {
            return;
        }
        const queueIndex = this.findMusicIndex(musicItem);
        if (queueIndex === -1) {
            // TODO: 用add代替
            const newQueue = [
                ...this.musicQueue,
                {
                    ...musicItem,
                    [timeStampSymbol]: Date.now(),
                    [sortIndexSymbol]: 0,
                },
            ];
            this.setMusicQueue(newQueue);
            await this.playIndex(newQueue.length - 1, options);
        } else {
            await this.playIndex(queueIndex, options);
        }
    }

    /**
     * 换用当前歌曲的另一个音源（比如唱卡拉OK 时放伴奏版）。
     * 歌单与播放队列都不动，只是把声音换掉，并从当前进度接着播
     */
    public async switchAudioSource(mediaSource: IPlugin.IMediaSourceResult) {
        const musicItem = this.currentMusic;
        if (!musicItem || !mediaSource?.url) {
            return false;
        }
        const position = this.progress.currentTime || 0;
        this.setTrack(mediaSource, musicItem, {
            autoPlay: true,
            seekTo: position,
        });
        return true;
    }

    /** 当前正在用的音源，切回原唱时用得上 */
    public getCurrentMediaSource() {
        return this.lastMediaSource;
    }

    /**
     * 用新条目替换队列里的旧条目，保持原位置，并播放替换后的条目
     * @returns 队列里是否存在并替换了旧条目
     */
    public async replaceMusic(
        oldItem: IMusic.IMusicItem,
        newItem: IMusic.IMusicItem,
        options: { play?: boolean; restartFromStart?: boolean } = {},
    ) {
        const { play = true, restartFromStart = true } = options;
        const queue = this.musicQueue;
        // indexMap 是覆盖式的，重复条目只会命中最后一个，这里必须按数组下标找
        const indexes: number[] = [];
        queue.forEach((item, index) => {
            if (isSameMedia(item, oldItem)) {
                indexes.push(index);
            }
        });
        if (!indexes.length) {
            // 队列里没有旧条目，追加播放即可
            if (play) {
                await this.playMusic(newItem);
            }
            return false;
        }
        const isCurrent = indexes.includes(this.currentIndex);
        const newQueue = [...queue];
        indexes.forEach((index) => {
            const origin = newQueue[index];
            newQueue[index] = {
                ...newItem,
                [timeStampSymbol]: origin?.[timeStampSymbol] ?? Date.now(),
                [sortIndexSymbol]: origin?.[sortIndexSymbol] ?? 0,
            };
        });
        this.setMusicQueue(newQueue);
        const targetIndex = indexes[0];
        if (isCurrent) {
            // setMusicQueue 会按 currentMusic 重算 currentIndex，换源后旧条目已不在队列里，会变成 -1
            this.currentIndex = targetIndex;
            this.setCurrentMusic(newQueue[targetIndex]);
        }
        if (play) {
            await this.playIndex(targetIndex, {
                // 换了音源，必须强制刷新，否则会走同曲短路分支只 seek 不换源
                refreshSource: true,
                seekTo: restartFromStart ? 0 : undefined,
            });
        }
        return true;
    }

    public async playMusicWithReplaceQueue(musicList: IMusic.IMusicItem[], musicItem?: IMusic.IMusicItem) {
        if (!musicList.length && !musicItem) {
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
        if (this.isEmpty) {
            this.setCurrentMusic(null);
            this.currentIndex = -1;
            return;
        }
        this.playIndex(this.currentIndex - 1);
    }

    public skipToNext() {
        if (this.isEmpty) {
            this.setCurrentMusic(null);
            this.currentIndex = -1;
            return;
        }
        this.playIndex(this.currentIndex + 1);
    }


    // 重置播放状态
    public reset() {
        this.audioController.reset();
        this.setMusicQueue([]);
        this.setCurrentMusic(null);
        this.resetProgress();
        this.currentIndex = -1;

    }

    public seekTo(seconds: number) {
        this.audioController.seekTo(seconds);
    }

    public pause() {
        this.audioController.pause();
        if (this.playerState !== this.audioController.playerState) {
            this.setPlayerState(this.audioController.playerState);
        }
    }

    public resume() {
        this.audioController.play();

        if (this.playerState !== this.audioController.playerState) {
            this.setPlayerState(this.audioController.playerState);
        }
    }

    public setVolume(volume: number) {
        this.audioController.setVolume(volume);
    }

    /**
     * 本地增益：唱卡拉OK 时单独调人声响度，
     * 不影响全局音量与用户偏好
     */
    public setLocalGain(gain: number) {
        this.audioController.setLocalGain?.(gain);
    }

    public setSpeed(speed: number) {
        this.audioController.setSpeed(speed);
    }

    public addNext(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) {
        let _musicItems: IMusic.IMusicItem[];
        if (Array.isArray(musicItems)) {
            _musicItems = musicItems;
        } else {
            _musicItems = [musicItems];
        }

        const now = Date.now();

        let duplicateIndex = -1;
        _musicItems.forEach((item, index) => {
            _musicItems[index] = {
                ...item,
                [timeStampSymbol]: now,
                [sortIndexSymbol]: index,
            };
            if (duplicateIndex === -1 && this.isCurrentMusic(item)) {
                duplicateIndex = index;
            }
        });

        if (duplicateIndex !== -1) {
            _musicItems = [
                _musicItems[duplicateIndex],
                ..._musicItems.slice(0, duplicateIndex),
                ..._musicItems.slice(duplicateIndex + 1),
            ];
        }


        const startPart = [];
        const tailPart = [];

        const oldQueue = this.musicQueue;
        const uniqueMap = createUniqueMap(_musicItems);

        for (let i = 0; i < oldQueue.length; ++i) {
            if (i <= this.currentIndex) {
                if (!uniqueMap.has(oldQueue[i])) {
                    startPart.push(oldQueue[i]);
                }
            } else {
                if (!uniqueMap.has(oldQueue[i])) {
                    tailPart.push(oldQueue[i]);
                }
            }
        }


        const newQueue = [
            ...startPart,
            ..._musicItems,
            ...tailPart,
        ];

        this.setMusicQueue(newQueue);
    }


    public removeMusic(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[] | number) {
        if (Array.isArray(musicItems)) {
            const uniqueMap = createUniqueMap(musicItems);

            const newQueue = [];
            const oldQueue = this.musicQueue;

            for (let i = 0; i < oldQueue.length; i++) {
                const musicItem = oldQueue[i];
                if (uniqueMap.has(musicItem)) {
                    if (this.currentIndex === i) {
                        this.audioController.reset();
                        this.currentIndex = -1;
                        resetProgress();
                        this.setCurrentMusic(null);
                    }
                } else {
                    newQueue.push(musicItem);
                    if (this.currentIndex === i) {
                        this.currentIndex = newQueue.length - 1;
                    }
                }
            }
            this.setMusicQueue(newQueue);
        } else {

            const musicIndex = typeof musicItems === "number" ? musicItems : this.findMusicIndex(musicItems);
            if (musicIndex === -1) {
                return;
            }
            if (musicIndex === this.currentIndex) {
                this.audioController.reset();
                this.currentIndex = -1;
                resetProgress();
                this.setCurrentMusic(null);
            }

            const newQueue = [...this.musicQueue];
            newQueue.splice(musicIndex, 1);
            this.setMusicQueue(newQueue);
        }
    }


    public async setQuality(quality: IMusic.IQualityKey) {
        const currentMusic = this.currentMusic;
        if (currentMusic && quality !== this.currentQuality) {
            const { mediaSource, quality: realQuality } = await this.fetchMediaSource(currentMusic, quality);
            if (this.isCurrentMusic(currentMusic)) {
                this.setTrack(mediaSource, currentMusic, {
                    seekTo: this.progress.currentTime ?? 0,
                    autoPlay: this.playerState === PlayerState.Playing,
                });
                this.setCurrentQuality(realQuality);
            }
        }
    }

    public setRepeatMode(repeatMode: RepeatMode) {
        if (repeatMode === RepeatMode.Shuffle) {
            this.setMusicQueue(shuffle(this.musicQueue));
        } else if (this.repeatMode === RepeatMode.Shuffle) {
            this.setMusicQueue(sortByTimestampAndIndex(this.musicQueue, true));
        }
        repeatModeStore.setValue(repeatMode);
        setUserPreference("repeatMode", repeatMode);
        this.ee.emit(PlayerEvents.RepeatModeChanged, repeatMode);
    }

    public async setAudioOutputDevice(deviceId?: string) {
        try {
            await this.audioController.setSinkId(deviceId ?? "");
        } catch (e) {
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
            // 直接关联的歌词文本（声音识别等场景）
            const linkedText = await getLinkedLyricText(currentMusic);
            if (linkedText?.rawLrc) {
                if (!this.isCurrentMusic(currentMusic)) {
                    return;
                }
                this.applyLyricText(currentMusic, linkedText.rawLrc, linkedText.translation);
                return;
            }

            // 获取被关联的歌词
            const linkedLyricItem = await getLinkedLyric(currentMusic);
            let lyricSource: ILyric.ILyricSource | null = null;

            if (linkedLyricItem) {
                lyricSource = await this.safeGetLyric(linkedLyricItem);
            }
            if (!lyricSource && this.isCurrentMusic(currentMusic)) {
                lyricSource = await this.safeGetLyric(currentMusic);
            }

            if (!this.isCurrentMusic(currentMusic)) {
                return;
            }

            if (isEmptyLyricSource(lyricSource?.rawLrc, lyricSource?.translation)) {
                // 没有歌词，尝试用标题/歌手智能匹配
                this.setCurrentLyric({});
                void this.trySmartLyric(currentMusic);
                return;
            }

            const rawLrc = lyricSource.rawLrc || lyricSource.translation;
            const parser = new LyricParser(rawLrc, {
                musicItem: currentMusic,
                translation: lyricSource.translation,
                // 插件给了逐字歌词就用真的，没有就按行均分生成伪逐字
                wordLyric: lyricSource.wordLyric,
            });

            this.setCurrentLyric({
                parser,
                currentLrc: parser.getPosition(this.progress.currentTime || 0),
            });
        } catch (e) {
            logger.logError("歌词解析失败", e);
            this.setCurrentLyric({});
        }


    }

    /**
     * 取歌词。插件报错时按没有歌词处理，
     * 否则异常会中断后面的智能匹配
     */
    private async safeGetLyric(
        musicItem: IMusic.IMusicItem,
    ): Promise<ILyric.ILyricSource | null> {
        try {
            return await PluginManager.callPluginDelegateMethod(
                musicItem,
                "getLyric",
                musicItem,
            );
        } catch (e) {
            logger.logError("获取歌词失败", e);
            return null;
        }
    }

    /** 直接用一段歌词文本刷新当前歌词 */
    public applyLyricText(
        musicItem: IMusic.IMusicItem,
        rawLrc: string,
        translation?: string,
    ) {
        if (!this.isCurrentMusic(musicItem)) {
            return;
        }
        const parser = new LyricParser(rawLrc, {
            musicItem,
            translation,
        });
        this.setCurrentLyric({
            parser,
            currentLrc: parser.getPosition(this.progress.currentTime || 0),
        });
    }

    /**
     * 歌词缺失时，用清洗后的标题去各个插件里搜索候选。
     * 得分足够高时直接关联，否则把候选留给界面展示。
     */
    private async trySmartLyric(musicItem: IMusic.IMusicItem) {
        if (!AppConfig.getConfig("lyric.smartSearch.enabled")) {
            return;
        }
        if (hasSearched(musicItem)) {
            return;
        }
        markSearched(musicItem);
        try {
            const threshold =
                AppConfig.getConfig("lyric.smartSearch.autoApplyThreshold") ?? 0.8;
            const candidates = await searchLyricCandidates(musicItem, {
                stopWhenScore: threshold,
            });
            recordCandidates(musicItem, candidates);
            if (!candidates.length) {
                // 接口被风控时可能什么都没搜到，下次播放再试一次
                unmarkSearched(musicItem);
                return;
            }
            // 得分最高的候选未必真的有歌词，顺位往下找
            const usable = await pickLyricCandidate(candidates, threshold);
            if (!usable) {
                return;
            }
            await applyLyricCandidate(musicItem, usable);
            if (!this.isCurrentMusic(musicItem)) {
                return;
            }
            await this.fetchCurrentLyric(true);
        } catch (e) {
            logger.logError("智能匹配歌词失败", e);
        }
    }


    private async fetchMediaSource(
        musicItem: IMusic.IMusicItem,
        quality?: IMusic.IQualityKey,
        options?: { preferLocal?: boolean },
    ) {
        const defaultQuality = AppConfig.getConfig("playMusic.defaultQuality");
        const whenQualityMissing = AppConfig.getConfig("playMusic.whenQualityMissing");

        const qualityOrder = getQualityOrder(quality ?? defaultQuality, whenQualityMissing);

        let mediaSource: IPlugin.IMediaSourceResult | null = null;
        let realQuality: IMusic.IQualityKey = qualityOrder[0];

        // 1. 判断是否已下载
        //    换源重试时不走本地文件 —— 本地文件没下全正是最常见的断流原因
        const preferLocal = options?.preferLocal ?? true;
        const downloadedData = getInternalData<IMusic.IMusicItemInternalData>(
            musicItem,
            "downloadData",
        );
        if (preferLocal && downloadedData) {
            const { quality, path: _path, incomplete } = downloadedData;
            // 下载时就知道文件没下全的（时长明显短于标称时长），
            // 这种文件播到断点就没声音了，直接改用在线音源
            if (!incomplete && (await fsUtil.isFile(_path))) {
                return {
                    quality,
                    mediaSource: {
                        url: fsUtil.addFileScheme(_path),
                    },
                };
            }
        }

        // 2. 如果没有下载
        for (const quality of qualityOrder) {
            try {
                mediaSource = await PluginManager.callPluginDelegateMethod(
                    {
                        platform: musicItem.platform,
                    },
                    "getMediaSource",
                    musicItem,
                    quality,
                );
                if (!mediaSource?.url) {
                    continue;
                }
                realQuality = quality;
                break;
            } catch {
                // pass
            }
        }
        return {
            quality: realQuality,
            mediaSource: mediaSource,
        };
    }


    /**
     * 音源中途断了，换一次源接着播。
     *
     * 断流有两种常见来源：
     *   1. 本地下载的文件没下全（下载中断留下的半截文件）——改用在线音源；
     *   2. 网络流被切断（连接提前结束、地址过期）——重新取一个新地址。
     * 两种都用在线音源重试，重试次数用完就按播放失败处理。
     */
    private async recoverFromBrokenSource() {
        const musicItem = this.currentMusic;
        if (!musicItem) {
            return;
        }
        if (this.sourceRecoveryCount >= TrackPlayer.MAX_SOURCE_RECOVERY) {
            // 换了这么多次还是断，只能按播放失败处理（按配置跳过或停下）
            this.ee.emit(
                PlayerEvents.Error,
                musicItem,
                new Error("音源中断"),
            );
            return;
        }
        this.sourceRecoveryCount++;
        // 从断掉的地方接着播
        const position = this.progress.currentTime || 0;
        try {
            const { mediaSource, quality } = await this.fetchMediaSource(
                musicItem,
                this.currentQuality,
                { preferLocal: false },
            );
            if (!mediaSource?.url || !this.isCurrentMusic(musicItem)) {
                return;
            }
            this.setCurrentQuality(quality);
            this.setTrack(mediaSource, musicItem, {
                seekTo: position,
                autoPlay: true,
            });
            toast.info(i18n.t("playback.source_recovered"));
        } catch (e) {
            this.ee.emit(PlayerEvents.Error, musicItem, e);
        }
    }

    // 只读数据的设置
    private setCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        if (!this.isCurrentMusic(musicItem)) {
            currentMusicStore.setValue(musicItem);
            this.ee.emit(PlayerEvents.MusicChanged, musicItem);
            this.fetchCurrentLyric();
            this.setCurrentLyric(null);
            // 换歌了，之前的中断计数作废
            this.sourceRecoveryCount = 0;

            if (musicItem) {
                setUserPreference("currentMusic", musicItem);
            } else {
                removeUserPreference("currentMusic");
            }
        } else {
            // 相同的歌曲，不需要额外触发事件
            currentMusicStore.setValue(musicItem);
        }
    }

    private setProgress(progress: CurrentTime) {
        progressStore.setValue(progress);
        setUserPreference("currentProgress", progress.currentTime);
        this.ee.emit(PlayerEvents.ProgressChanged, progress);
    }

    private setCurrentQuality(quality: IMusic.IQualityKey) {
        setUserPreference("currentQuality", quality);
        currentQualityStore.setValue(quality);
    }

    private setCurrentLyric(lyric?: ICurrentLyric) {
        const prev = this.lyric;
        currentLyricStore.setValue(lyric);

        if (lyric?.parser !== prev?.parser) {
            this.ee.emit(PlayerEvents.LyricChanged, lyric?.parser ?? null);
        } else if (lyric?.currentLrc !== prev?.currentLrc) {
            this.ee.emit(PlayerEvents.CurrentLyricChanged, lyric?.currentLrc ?? null);
        }
    }

    private setPlayerState(playerState: PlayerState) {
        playerStateStore.setValue(playerState);
        this.ee.emit(PlayerEvents.StateChanged, playerState);
    }

    // 获取音乐在播放列表中的下标
    private findMusicIndex(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) {
            return -1;
        }
        return this.indexMap.indexOf(musicItem);
    }


    private resetProgress() {
        resetProgress();
        removeUserPreference("currentProgress");
    }

    /**
     * 用实际播出来的音频长度校正歌曲时长：
     * 插件给的时长有的是毫秒、有的是空的、有的干脆是错的，
     * 音频文件本身的长度才是准的。
     */
    private captureRealDuration(duration: number) {
        if (!isFinite(duration) || duration <= 0) {
            return;
        }
        // 进度事件很频繁，时长没变就不重复处理
        if (Math.abs(duration - this.lastMeasuredDuration) < 1) {
            return;
        }
        this.lastMeasuredDuration = duration;
        const musicItem = this.currentMusic;
        if (!musicItem) {
            return;
        }
        correctDurationByMeasured(musicItem, duration).catch(console.error);
    }

    private setTrack(mediaSource: IPlugin.IMediaSourceResult, musicItem: IMusic.IMusicItem, options: ITrackOptions = {
        autoPlay: true,
    }) {
        this.resetProgress();
        this.lastMeasuredDuration = 0;
        this.lastMediaSource = mediaSource;
        this.audioController.setTrackSource(mediaSource, musicItem);

        if (options.seekTo >= 0) {
            this.audioController.seekTo(options.seekTo);
        }

        if (options.autoPlay) {
            this.audioController.play();
        }
    }

    /** 当前播放使用的音源，用于声音识别 */
    public get currentMediaSource() {
        return this.lastMediaSource;
    }

    /** 当前实际播放的地址，用于声音识别 */
    public get currentSourceUrl() {
        return this.audioController.resolvedSourceUrl;
    }


    // 判断某首歌是否是当前播放的歌曲
    public isCurrentMusic(musicItem: IMusic.IMusicItem) {
        return isSameMedia(musicItem, this.currentMusic);
    }

}


export default new TrackPlayer();
