/**
 * TrackPlayer — 编排层（单例，唯一对外 API）
 *
 * 协调 AudioController、PlayQueue、LyricManager 三大子模块，
 * 通过 jotai atoms 驱动 UI，通过 AppSync 同步状态到辅助窗口和主进程。
 */
import type { IMusicItemSlim } from '@appTypes/infra/musicSheet';
import { PlayerState, RepeatMode, QUALITY_KEYS } from '@common/constant';
import { isSameMedia } from '@common/mediaKey';
import musicItemToSlim from '@common/musicItemToSlim';
import delay from '@common/delay';
import throttle from '@common/throttle';
import musicSheet from '@infra/musicSheet/renderer';
import pluginManager from '@infra/pluginManager/renderer';
import appConfig from '@infra/appConfig/renderer';
import downloadManager from '@infra/downloadManager/renderer';
import fsUtil from '@infra/fsUtil/renderer';
import { addToRecentlyPlayed } from '../recentlyPlayed';
import appSync from '@infra/appSync/renderer/main';
import { syncKV } from '@renderer/common/kvStore';
import { REPEAT_MODE_MAP } from '@renderer/common/repeatModeMap';
import { type IAudioController, createAudioController } from './audioController';
import PlayQueue from './playQueue';
import LyricManager from './lyricManager';
import type { IPlayOptions } from './types';
import {
    store,
    currentMusicAtom,
    playerStateAtom,
    repeatModeAtom,
    progressAtom,
    volumeAtom,
    speedAtom,
    qualityAtom,
    currentLyricAtom,
} from './store';

// ─── AppSync 桥接 ───

/**
 * 订阅 store → appSync 桥接。
 * 注意：这些 subscriptions 故意不清理——主窗口生命周期 === 应用生命周期，
 * store.sub 返回的 unsub 函数不需要调用。
 */
function setupAppSyncBridge(): void {
    // 计算当前歌曲是否已收藏
    const getIsFavorite = () => {
        const music = store.get(currentMusicAtom);
        return music ? musicSheet.isFavoriteMusic(music) : false;
    };

    store.sub(currentMusicAtom, () => {
        appSync.syncAppState({
            musicItem: store.get(currentMusicAtom),
            isFavorite: getIsFavorite(),
        });
    });
    store.sub(playerStateAtom, () => {
        appSync.syncAppState({ playerState: store.get(playerStateAtom) });
    });
    store.sub(repeatModeAtom, () => {
        appSync.syncAppState({ repeatMode: store.get(repeatModeAtom) });
    });
    store.sub(currentLyricAtom, () => {
        const lyric = store.get(currentLyricAtom);
        appSync.syncAppState({ currentLrc: lyric?.currentLrc ?? null });
    });

    // 收藏状态变化时同步
    musicSheet.subscribeFavoriteChange(() => {
        appSync.syncAppState({ isFavorite: getIsFavorite() });
    });

    // 进度同步节流 1s——辅助窗口不需要实时精度
    const throttledProgressSync = throttle(
        (progress: { currentTime: number; duration: number }) => {
            appSync.syncAppState({ progress });
        },
        1000,
    );
    store.sub(progressAtom, () => {
        throttledProgressSync(store.get(progressAtom));
    });

    // 获取当前完整状态快照
    const getCurrentState = () => ({
        musicItem: store.get(currentMusicAtom),
        playerState: store.get(playerStateAtom),
        repeatMode: store.get(repeatModeAtom),
        progress: store.get(progressAtom),
        currentLrc: store.get(currentLyricAtom)?.currentLrc ?? null,
        isFavorite: getIsFavorite(),
    });

    // 初始同步：store.sub 仅监听后续变化，此处补推一次当前状态
    appSync.syncAppState(getCurrentState());

    // 辅助窗口新订阅时，从 store（唯一 source of truth）定向推送
    appSync.onSubscribe((windowType) => {
        appSync.syncAppStateTo(windowType, getCurrentState());
    });
}

// ─── TrackPlayer ───

class TrackPlayer {
    private audioController!: IAudioController;
    private playQueue!: PlayQueue;
    private lyricManager!: LyricManager;

    // 进度持久化节流
    private lastProgressWriteTime = 0;
    private readonly PROGRESS_WRITE_INTERVAL = 10_000; // 10s

    // 连续播放错误计数
    private consecutiveErrors = 0;
    private readonly MAX_CONSECUTIVE_ERRORS = 3;

    // ─── 启动恢复 ───

    async setup(): Promise<void> {
        // 1. 创建子模块
        this.audioController = createAudioController('web-audio');
        this.playQueue = new PlayQueue();
        this.lyricManager = new LyricManager();

        // 2. 恢复持久化状态（localStorage 同步读取，首帧可用）
        const volume = syncKV.get('player.volume') ?? 1;
        const speed = syncKV.get('player.speed') ?? 1;
        const repeatMode = syncKV.get('player.repeatMode') ?? RepeatMode.Queue;
        const savedMusic = syncKV.get('player.currentMusic');
        const savedProgress = syncKV.get('player.currentProgress') ?? 0;
        const savedQuality = syncKV.get('player.currentQuality') ?? 'standard';
        const validQuality: IMusic.IQualityKey = QUALITY_KEYS.includes(savedQuality as any)
            ? (savedQuality as IMusic.IQualityKey)
            : 'standard';

        store.set(volumeAtom, volume);
        store.set(speedAtom, speed);
        store.set(repeatModeAtom, repeatMode);
        store.set(qualityAtom, validQuality);

        this.audioController.setVolume(volume);
        this.audioController.setSpeed(speed);

        // 3. 恢复播放队列（异步 IPC）
        await this.playQueue.setup();

        // 3.5 恢复 Shuffle 状态（纯内存导航，需在 setup 后重建）
        if (repeatMode === RepeatMode.Shuffle) {
            this.playQueue.enterShuffle();
        }

        // 4. 恢复当前歌曲
        if (savedMusic) {
            store.set(currentMusicAtom, musicItemToSlim(savedMusic));

            // 获取完整数据并加载音源（不自动播放）
            const fullItem = await musicSheet.getRawMusicItem(savedMusic.platform, savedMusic.id);
            const musicItem = fullItem ?? savedMusic;

            try {
                // 优先使用已下载的本地文件
                const localSource = await this.tryLocalSource(musicItem);
                const result =
                    localSource ??
                    (await pluginManager.adapters.getMediaSource({
                        hash: pluginManager.getPluginByPlatform(musicItem.platform)?.hash ?? '',
                        musicItem,
                        quality: validQuality,
                        qualityOrder: QUALITY_KEYS,
                        qualityFallbackOrder: this.getQualityFallbackOrder(),
                    }));

                if (result?.url && this.isCurrentMusic(savedMusic)) {
                    this.audioController.setTrackSource(result, musicItem);
                    this.audioController.seekTo(savedProgress);
                    store.set(qualityAtom, result.quality!);
                }
            } catch {
                // 恢复失败不阻塞启动
            }

            // 加载歌词
            this.lyricManager.fetchLyric(musicItem);
        }

        // 5. 绑定事件
        this.bindAudioEvents();
        this.bindAppSyncCommands();
        setupAppSyncBridge();
        this.bindMediaSession();

        // 6. beforeunload 兜底
        window.addEventListener('beforeunload', () => {
            syncKV.set('player.currentProgress', store.get(progressAtom).currentTime);
        });

        // 7. 恢复音频输出设备
        const device = appConfig.getConfigByKey('playMusic.audioOutputDevice');
        if (device?.deviceId) {
            this.audioController.setSinkId(device.deviceId).catch(() => {});
        }

        // 8. 监听配置变化
        appConfig.onConfigUpdated((patch) => {
            if ('playMusic.audioOutputDevice' in patch) {
                this.audioController
                    .setSinkId(patch['playMusic.audioOutputDevice']?.deviceId ?? '')
                    .catch(() => {});
            }
        });

        // 9. 监听音频输出设备断开
        navigator.mediaDevices.addEventListener('devicechange', async () => {
            try {
                const savedDevice = appConfig.getConfigByKey('playMusic.audioOutputDevice');
                if (!savedDevice?.deviceId || savedDevice.deviceId === 'default') return;

                await delay(100);
                const devices = await navigator.mediaDevices.enumerateDevices();
                const stillExists = devices.some(
                    (d) => d.kind === 'audiooutput' && d.deviceId === savedDevice.deviceId,
                );

                if (!stillExists) {
                    this.audioController.setSinkId('').catch(() => {});

                    const behavior =
                        appConfig.getConfigByKey('playMusic.whenDeviceRemoved') ?? 'play';
                    if (behavior === 'pause') {
                        this.pause();
                    }
                }
            } catch {
                /* enumerateDevices 失败时静默忽略 */
            }
        });
    }

    // ─── 播放控制 ───

    /** 播放指定位置 */
    async playIndex(
        index: number,
        options: IPlayOptions = { restartOnSameMedia: true },
    ): Promise<void> {
        if (this.playQueue.isEmpty) return;

        const queue = this.playQueue.queue;
        index = ((index % queue.length) + queue.length) % queue.length;

        const targetSlim = queue[index];

        // 相同歌曲处理
        if (this.playQueue.getCurrentIndex() === index && this.isCurrentMusic(targetSlim)) {
            if (options.restartOnSameMedia) this.audioController.seekTo(0);
            this.audioController.play();
            return;
        }

        // 切歌
        this.playQueue.setCurrentIndex(index);
        store.set(currentMusicAtom, targetSlim);
        store.set(playerStateAtom, PlayerState.Buffering);
        this.audioController.prepareTrack(targetSlim);
        this.resetProgress();

        try {
            // 从 SQLite 获取完整数据（一首，一次 IPC）
            const fullItem = await musicSheet.getRawMusicItem(targetSlim.platform, targetSlim.id);
            const musicItem: IMusic.IMusicItem = fullItem ?? (targetSlim as IMusic.IMusicItem);

            // 获取音源：优先使用已下载的本地文件
            const quality = store.get(qualityAtom);
            const localSource = await this.tryLocalSource(musicItem);
            const result =
                localSource ??
                (await pluginManager.adapters.getMediaSource({
                    hash: pluginManager.getPluginByPlatform(musicItem.platform)?.hash ?? '',
                    musicItem,
                    quality,
                    qualityOrder: QUALITY_KEYS,
                    qualityFallbackOrder: this.getQualityFallbackOrder(),
                }));

            if (!result?.url) throw new Error('No media source');
            if (!this.isCurrentMusic(targetSlim)) return; // 切歌了

            // 播放
            store.set(qualityAtom, result.quality ?? quality);
            this.audioController.setTrackSource(result, musicItem);
            this.audioController.play();
            this.consecutiveErrors = 0; // 播放成功，重置错误计数

            this.setCurrentMusic(musicItem);
            syncKV.set('player.currentQuality', result.quality!);

            // 记录到最近播放（异步，不阻塞播放）
            addToRecentlyPlayed(musicItem).catch(() => {});

            // 异步丰富元数据（锦上添花，失败不影响播放）
            pluginManager
                .callPluginMethod({
                    platform: musicItem.platform,
                    method: 'getMusicInfo',
                    args: [musicItem],
                })
                .then((info) => {
                    if (info && typeof info === 'object' && this.isCurrentMusic(targetSlim)) {
                        const enriched = {
                            ...musicItem,
                            ...info,
                            platform: musicItem.platform,
                            id: musicItem.id,
                        };
                        this.setCurrentMusic(enriched, false);
                    }
                })
                .catch(() => {});
        } catch (e) {
            this.audioController.reset();
            this.handlePlayError(targetSlim, e);
        }
    }

    /** 播放单首歌曲（如不在队列则追加到队尾） */
    async playMusic(item: IMusic.IMusicItem): Promise<void> {
        const queueIndex = this.playQueue.findIndex(item);
        if (queueIndex !== -1) {
            await this.playIndex(queueIndex);
        } else {
            this.playQueue.append([item]);
            await this.playIndex(this.playQueue.queue.length - 1);
        }
    }

    /**
     * 替换队列并播放。统一接口，不区分本地/远程歌单。
     * @param list       歌曲列表（IMusicItem 或 IMusicItemSlim）
     * @param options.startItem    起始播放歌曲
     * @param options.fromSheetId  可选性能优化提示：若来自某本地歌单，主进程用 INSERT...SELECT
     */
    async playMusicWithReplaceQueue(
        list: (IMusic.IMusicItem | IMusicItemSlim)[],
        options?: { startItem?: IMedia.IMediaBase; fromSheetId?: string },
    ): Promise<void> {
        const startItem = options?.startItem;
        const startIndex = startItem ? list.findIndex((it) => isSameMedia(it, startItem)) : 0;

        this.playQueue.setQueue(list, {
            playIndex: Math.max(startIndex, 0),
            fromSheetId: options?.fromSheetId,
        });
        await this.playIndex(Math.max(startIndex, 0));
    }

    /** 手动切到下一首（与 repeatMode 无关，始终前进） */
    async skipToNext(): Promise<void> {
        if (this.playQueue.isEmpty) {
            this.clearPlayback();
            return;
        }
        await this.playIndex(this.playQueue.getNextIndex());
    }

    /** 手动切到上一首（与 repeatMode 无关，始终后退） */
    async skipToPrev(): Promise<void> {
        if (this.playQueue.isEmpty) {
            this.clearPlayback();
            return;
        }
        await this.playIndex(this.playQueue.getPrevIndex());
    }

    /** 下一首播放：将歌曲插入当前播放曲目之后 */
    addNext(items: (IMusic.IMusicItem | IMusicItemSlim)[]): void {
        this.playQueue.addNext(items);
    }

    /** 从队列中移除歌曲。若移除了当前正在播放的曲目，自动切到下一首或清空 */
    async removeMusic(targets: IMedia.IMediaBase | IMedia.IMediaBase[]): Promise<void> {
        const currentMusic = this.playQueue.getCurrentMusic();
        const currentIdx = this.playQueue.getCurrentIndex();
        const bases = Array.isArray(targets) ? targets : [targets];
        const wasCurrentRemoved =
            currentMusic != null && bases.some((t) => isSameMedia(t, currentMusic));

        this.playQueue.remove(targets);

        if (wasCurrentRemoved) {
            if (!this.playQueue.isEmpty) {
                // 有下一首：播放原位置（被删歌曲的后继者现在占据此位置）
                const nextIdx = Math.min(currentIdx, this.playQueue.queue.length - 1);
                await this.playIndex(nextIdx);
            } else {
                this.clearPlayback();
            }
        }
    }

    pause(): void {
        this.audioController.pause();
    }

    resume(): void {
        if (!this.audioController.hasSource) {
            // 无音源（如恢复失败），尝试重新加载当前曲目
            const idx = this.playQueue.getCurrentIndex();
            if (idx >= 0) {
                this.playIndex(idx, { restartOnSameMedia: true }).catch(() => {});
            }
            return;
        }
        this.audioController.play();
    }

    togglePlayPause(): void {
        if (this.audioController.playerState === PlayerState.Playing) {
            this.pause();
        } else {
            this.resume();
        }
    }

    seekTo(seconds: number): void {
        this.audioController.seekTo(seconds);
    }

    // ─── 队列代理 ───

    getPlayQueue(): PlayQueue {
        return this.playQueue;
    }

    /** 重置播放器：清空当前播放状态 + 清空队列 */
    reset(): void {
        this.clearPlayback();
        this.playQueue.clear();
    }

    // ─── 设置 ───

    setVolume(volume: number): void {
        this.audioController.setVolume(volume);
        // volumeChange 事件会自动更新 atom 和 localStorage
    }

    setSpeed(speed: number): void {
        this.audioController.setSpeed(speed);
    }

    async setQuality(quality: IMusic.IQualityKey): Promise<boolean> {
        const current = this.playQueue.getCurrentMusic();
        const prevQuality = store.get(qualityAtom);
        if (!current || quality === prevQuality) return true;

        const currentTime = store.get(progressAtom).currentTime;
        const wasPlaying = this.audioController.playerState === PlayerState.Playing;

        try {
            store.set(playerStateAtom, PlayerState.Buffering);

            const fullItem = await musicSheet.getRawMusicItem(current.platform, current.id);
            const musicItem = fullItem ?? (current as IMusic.IMusicItem);

            // 切换音质：仅在音质匹配时使用本地文件
            const localSource = await this.tryLocalSource(musicItem, quality);
            const result =
                localSource ??
                (await pluginManager.adapters.getMediaSource({
                    hash: pluginManager.getPluginByPlatform(musicItem.platform)?.hash ?? '',
                    musicItem,
                    quality,
                    qualityOrder: QUALITY_KEYS,
                    qualityFallbackOrder: this.getQualityFallbackOrder(),
                }));

            if (result?.url && this.isCurrentMusic(current)) {
                this.audioController.setTrackSource(result, musicItem);
                this.audioController.seekTo(currentTime);
                if (wasPlaying) this.audioController.play();
                store.set(qualityAtom, result.quality!);
                syncKV.set('player.currentQuality', result.quality!);
                return result.quality === quality;
            } else {
                // 切歌了或无结果，恢复原状态
                store.set(qualityAtom, prevQuality);
                store.set(playerStateAtom, wasPlaying ? PlayerState.Playing : PlayerState.Paused);
                return false;
            }
        } catch {
            // 切换失败，恢复原音质标记
            store.set(qualityAtom, prevQuality);
            store.set(playerStateAtom, wasPlaying ? PlayerState.Playing : PlayerState.Paused);
            return false;
        }
    }

    setRepeatMode(mode: RepeatMode): void {
        const prev = store.get(repeatModeAtom);

        if (mode === RepeatMode.Shuffle && prev !== RepeatMode.Shuffle) {
            this.playQueue.enterShuffle();
        } else if (prev === RepeatMode.Shuffle && mode !== RepeatMode.Shuffle) {
            this.playQueue.exitShuffle();
        }

        store.set(repeatModeAtom, mode);
        syncKV.set('player.repeatMode', mode);
    }

    toggleRepeatMode(): void {
        const current = store.get(repeatModeAtom);
        this.setRepeatMode(REPEAT_MODE_MAP[current].next);
    }

    /** 获取用户歌词偏移（秒） */
    getLyricOffset(): number {
        return this.lyricManager.getUserOffset();
    }

    /** 设置用户歌词偏移（秒），正值提前，负值延后 */
    setLyricOffset(offset: number): void {
        this.lyricManager.setUserOffset(offset);
    }

    /** 强制重新加载当前歌曲歌词（关联/取消关联歌词后调用） */
    async refreshLyric(): Promise<void> {
        const musicItem = store.get(currentMusicAtom);
        if (!musicItem) return;
        await this.lyricManager.refreshLyric(musicItem as IMusic.IMusicItem);
    }

    async setAudioOutputDevice(deviceId?: string): Promise<void> {
        await this.audioController.setSinkId(deviceId ?? '');
    }

    // ─── 事件绑定 ───

    private bindAudioEvents(): void {
        this.audioController.on('stateChange', (state) => {
            store.set(playerStateAtom, state);
            if (state === PlayerState.Paused) {
                syncKV.set('player.currentProgress', store.get(progressAtom).currentTime);
            }
        });

        this.audioController.on('timeUpdate', (progress) => {
            store.set(progressAtom, progress);
            this.lyricManager.updatePosition(progress.currentTime);

            // 每 10 秒写一次 localStorage，最大丢失 10 秒进度
            const now = Date.now();
            if (now - this.lastProgressWriteTime >= this.PROGRESS_WRITE_INTERVAL) {
                syncKV.set('player.currentProgress', progress.currentTime);
                this.lastProgressWriteTime = now;
            }
        });

        this.audioController.on('ended', async () => {
            this.resetProgress();
            const repeatMode = store.get(repeatModeAtom);
            if (repeatMode === RepeatMode.Loop) {
                // 自然播完 + 单曲循环 → 重播
                await this.playIndex(this.playQueue.getCurrentIndex(), {
                    restartOnSameMedia: true,
                });
            } else {
                // 自然播完 → 下一首（不用 skipToNext，因为它是手动操作语义）
                await this.playIndex(this.playQueue.getNextIndex());
            }
        });

        this.audioController.on('error', (_reason, _detail) => {
            this.handlePlayError(this.playQueue.getCurrentMusic(), _detail);
        });

        this.audioController.on('volumeChange', (volume) => {
            store.set(volumeAtom, volume);
            syncKV.set('player.volume', volume);
        });

        this.audioController.on('speedChange', (speed) => {
            store.set(speedAtom, speed);
            syncKV.set('player.speed', speed);
        });
    }

    private bindAppSyncCommands(): void {
        appSync.onCommand('play/pause', () => this.togglePlayPause());
        appSync.onCommand('skip-next', () => this.skipToNext());
        appSync.onCommand('skip-previous', () => this.skipToPrev());
        appSync.onCommand('volume-up', () =>
            this.setVolume(Math.min(1, store.get(volumeAtom) + 0.05)),
        );
        appSync.onCommand('volume-down', () =>
            this.setVolume(Math.max(0, store.get(volumeAtom) - 0.05)),
        );
        appSync.onCommand('set-repeat-mode', (mode) => this.setRepeatMode(mode));
        appSync.onCommand('like/dislike', () => {
            const music = store.get(currentMusicAtom);
            if (!music) return;
            if (musicSheet.isFavoriteMusic(music)) {
                musicSheet.removeMusicFromFavorite(music);
            } else {
                musicSheet.addMusicToFavorite(music);
            }
        });
    }

    private bindMediaSession(): void {
        navigator.mediaSession.setActionHandler('nexttrack', () => this.skipToNext());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.skipToPrev());
        navigator.mediaSession.setActionHandler('play', () => this.resume());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
    }

    // ─── 错误处理 ───

    private async handlePlayError(musicItem: IMusicItemSlim | null, _error?: any): Promise<void> {
        this.resetProgress();
        this.consecutiveErrors++;

        // 播放出错时重置音质为默认，避免因高音质源不可用导致连续失败
        store.set(qualityAtom, 'standard');
        syncKV.set('player.currentQuality', 'standard');

        const behavior = appConfig.getConfigByKey('playMusic.playError') ?? 'skip';

        if (
            behavior === 'skip' &&
            this.playQueue.queue.length > 1 &&
            this.consecutiveErrors < this.MAX_CONSECUTIVE_ERRORS
        ) {
            // 主路径：跳到下一首
            await delay(500);
            if (musicItem && this.isCurrentMusic(musicItem)) {
                await this.skipToNext();
            }
        } else if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
            // 安全兜底：连续多次失败，停止播放避免无限循环
            store.set(playerStateAtom, PlayerState.Paused);
            this.consecutiveErrors = 0;
        } else {
            // 单曲队列 / 非 skip 配置，暂停
            store.set(playerStateAtom, PlayerState.Paused);
        }
    }

    /**
     * 确认当前播放歌曲——更新 atom、持久化、加载歌词。
     * @param fetchLyric 默认 true；元数据更新时传 false 避免重复加载
     */
    private setCurrentMusic(musicItem: IMusic.IMusicItem, fetchLyric = true): void {
        store.set(currentMusicAtom, musicItemToSlim(musicItem));
        syncKV.set('player.currentMusic', musicItem);
        if (fetchLyric) {
            this.lyricManager.fetchLyric(musicItem);
        }
    }

    /** 清空播放状态（空队列等场景） */
    private clearPlayback(): void {
        this.audioController.reset();
        this.lyricManager.reset();
        store.set(currentMusicAtom, null);
        store.set(playerStateAtom, PlayerState.None);
        this.resetProgress();
        syncKV.remove('player.currentMusic');
    }

    private resetProgress(): void {
        store.set(progressAtom, { currentTime: 0, duration: Infinity });
        syncKV.remove('player.currentProgress');
    }

    private isCurrentMusic(item: IMedia.IMediaBase | null): boolean {
        return isSameMedia(store.get(currentMusicAtom), item);
    }

    /**
     * 尝试使用已下载的本地文件作为音源。
     * @returns 成功时返回 IMediaSourceResult；文件不存在或未下载时返回 null
     */
    private async tryLocalSource(
        musicItem: { platform: string; id: string },
        targetQuality?: IMusic.IQualityKey,
    ): Promise<IPlugin.IMediaSourceResult | null> {
        const downloaded = downloadManager.isDownloaded(musicItem);
        if (!downloaded) return null;

        // 指定了目标音质时，仅在音质匹配时使用本地文件
        if (targetQuality && downloaded.quality !== targetQuality) return null;

        // 校验文件是否仍存在（用户可能手动删除）
        const exists = await fsUtil.isFile(downloaded.path);
        if (!exists) {
            // 文件已被外部删除，清理下载记录（不删文件，因为已不存在）
            downloadManager
                .removeDownload(musicItem.platform, String(musicItem.id), false)
                .catch(() => {});
            return null;
        }

        return {
            url: fsUtil.addFileScheme(downloaded.path),
            quality: downloaded.quality,
        };
    }

    /** 获取音质回退策略，'skip' 降级为 'lower' */
    private getQualityFallbackOrder(): 'higher' | 'lower' {
        const config = appConfig.getConfigByKey('playMusic.whenQualityMissing');
        return config === 'higher' ? 'higher' : 'lower';
    }
}

// ─── 单例导出 ───

const trackPlayer = new TrackPlayer();
export default trackPlayer;
