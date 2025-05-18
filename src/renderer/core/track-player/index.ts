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
// import {createUniqueMap} from "@/common/unique-map"; // Not used
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
    private isMpvInitFailed = false; // Tracks if MPV specifically failed initialization

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
        this.isMpvInitFailed = false; // Reset MPV init failure flag

        if (this.audioController) {
            // @ts-ignore // Assuming destroy might be on the specific controller type
            await this.audioController.destroy?.();
            this.audioController = null;
        }

        if (backendType === "mpv") {
            this.audioController = new MpvController();
        } else {
            this.audioController = new AudioController();
        }
        this.setupAudioControllerEvents(); // Setup events for the new controller

        // @ts-ignore
        if (typeof this.audioController.initialize === 'function') {
            try {
                // @ts-ignore
                await this.audioController.initialize(); // This now returns a Promise for MpvController
                logger.logInfo(`TrackPlayer: Audio controller (${backendType}) initialized successfully.`);
                 // @ts-ignore
                if (backendType === 'mpv' && this.audioController.isMpvInitialized === false) {
                    // This case should ideally be caught by the promise rejection from MpvController.initialize()
                    throw new Error("MpvController reported not initialized after successful initialize call.");
                }
            } catch (e) {
                const initError = e instanceof Error ? e : new Error(String(e));
                logger.logError(`TrackPlayer: Audio controller (${backendType}) initialization failed.`, initError);
                this.setPlayerState(PlayerState.None); // Ensure player state is None
                if (backendType === 'mpv') this.isMpvInitFailed = true;
                this.ee.emit(PlayerEvents.Error, null, new Error(`音频后端 ${backendType} 初始化失败: ${initError.message}`));
                return; // Stop further execution if backend init fails
            }
        }

        // Restore state only if initialization was successful (or not needed for web audio)
        const musicToRestore = previousState?.music || this.currentMusic;
        const timeToRestore = previousState?.music ? previousState.time : (this.progress.currentTime || 0);
        const qualityToRestore = this.currentQuality || AppConfig.getConfig("playMusic.defaultQuality");
        const shouldAutoPlay = previousState?.isPlaying === true;


        if (musicToRestore && this.audioController ) { // Check audioController again
            // @ts-ignore
            if (this.isMpvInitFailed && backendType === 'mpv') { // Check MPV specific failure
                logger.logInfo("TrackPlayer: MPV initialization was marked as failed, skipping track restoration.");
                this.setPlayerState(PlayerState.None); // Ensure state is None
                this.ee.emit(PlayerEvents.Error, musicToRestore, new Error("MPV播放器未能成功初始化，无法恢复播放。"));
                return;
            }

            logger.logInfo("TrackPlayer: Attempting to load/restore track with new backend.", { title: musicToRestore.title, time: timeToRestore });
            this.setCurrentMusic(musicToRestore); // Set current music (might trigger lyric fetch etc.)
            this.currentIndex = this.findMusicIndex(musicToRestore); // Update current index
            if (this.audioController) await this.audioController.prepareTrack?.(musicToRestore); // Prepare metadata

            try {
                const {mediaSource, quality: actualQuality} = await this.fetchMediaSource(musicToRestore, qualityToRestore);
                if (!mediaSource?.url) {
                    throw new Error("Media source URL is empty for track restoration.");
                }
                // Ensure it's still the current music before setting track (important for async operations)
                if (this.isCurrentMusic(musicToRestore) && this.audioController) {
                    this.setCurrentQuality(actualQuality); // Set the quality that was actually fetched
                    await this.setTrack(mediaSource, musicToRestore, {
                        seekTo: timeToRestore,
                        autoPlay: shouldAutoPlay // Only auto-play if it was playing before
                    });
                }
            } catch (e: any) {
                logger.logError("Error restoring/loading track with new backend:", e);
                this.ee.emit(PlayerEvents.Error, musicToRestore, e instanceof Error ? e : new Error(String(e)));
                this.setPlayerState(PlayerState.None); // Set to None on error
            }
        } else if (!musicToRestore) {
            // If no music to restore, ensure player is in a clean state
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
                    this.playIndex(this.currentIndex, {
                        restartOnSameMedia: true // Ensure it restarts from beginning
                    });
                    break;
                }
                default:
                    // Should not happen if repeatMode is always one of the defined values
                    logger.logInfo(`TrackPlayer: onEnded - Default behavior (should not happen), setting player state to None.`);
                    this.setPlayerState(PlayerState.None);
                    this.resetProgress(); // Reset progress if playback stops
                    break;
            }
        }
        this.audioController.onProgressUpdate = ((progress) => {
            this.setProgress(progress); // Update internal progress state
            if (this.lyric?.parser) { // Check if lyric parser exists
                const lyricItem = this.lyric.parser.getPosition(progress.currentTime);
                // Only update if the lyric line actually changed
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
            this.setPlayerState(state); // Update TrackPlayer's state based on controller
        };

        this.audioController.onError = async (type, reason: any) => {
            const errorMusicItem = this.audioController?.musicItem || this.currentMusic; // Get the problematic item
            logger.logError("TrackPlayer: Playback error from controller", { type, reason: reason?.message || String(reason), musicItem: errorMusicItem } as any);
            const errorToEmit = reason instanceof Error ? reason : new Error(String(reason) || "Unknown playback error");

            // Special handling for MPV init failure
            if (type === PlayerErrorReason.EmptyResource && AppConfig.getConfig("playMusic.backend") === "mpv") {
                 // @ts-ignore
                if (this.audioController && this.audioController.isMpvInitialized === false) { // Check MpvController's specific flag
                     this.isMpvInitFailed = true; // Mark MPV as failed in TrackPlayer
                     this.ee.emit(PlayerEvents.Error, errorMusicItem, new Error(`MPV播放器初始化失败: ${errorToEmit.message}`));
                     return; // Stop further error handling for this specific case
                }
            }

            // General error handling based on config
            const errorBehavior = AppConfig.getConfig("playMusic.playError");
            if (errorBehavior === "skip") {
                logger.logInfo(`TrackPlayer: onError - Behavior: skip. Skipping to next track.`);
                // Ensure there's another track and it's the current one that errored
                if (this.musicQueue.length > 1 && errorMusicItem && this.isCurrentMusic(errorMusicItem)) {
                    // Small delay before skipping to allow UI to potentially show error
                    if (this.playerState !== PlayerState.None) { // Avoid delay if already stopped
                         await delay(1500);
                    }
                    // Check again if it's still the current music after delay (user might have acted)
                    if (this.isCurrentMusic(errorMusicItem)) {
                        this.skipToNext();
                    }
                } else if (errorMusicItem && this.isCurrentMusic(errorMusicItem)) { // Last song or only song errored
                    if (this.audioController) await this.audioController.pause(); // Pause first
                    this.setPlayerState(PlayerState.None); // Then set to None
                    this.resetProgress();
                }
            } else { // Default behavior is "pause"
                logger.logInfo(`TrackPlayer: onError - Behavior: pause (or default). Pausing player.`);
                if (errorMusicItem && this.isCurrentMusic(errorMusicItem)) { // Only act if the error is for the current song
                    if (this.audioController) await this.audioController.pause();
                    this.setPlayerState(PlayerState.None); // Set to None after pausing
                    this.resetProgress();
                }
            }
            this.ee.emit(PlayerEvents.Error, errorMusicItem, errorToEmit); // Emit the error for UI
        }
    }

    public async setup() {
        if (this.isReady) return;

        // Load preferences
        const [repeatMode, currentMusicFromPref, currentProgress, volume, speed, preferredQuality] = [
            getUserPreference("repeatMode"),
            getUserPreference("currentMusic"),
            getUserPreference("currentProgress"),
            getUserPreference("volume"),
            getUserPreference("speed"),
            getUserPreference("currentQuality") || AppConfig.getConfig("playMusic.defaultQuality") // Fallback to default config
        ];
        const playList = (await getUserPreferenceIDB("playList")) ?? [];
        addSortProperty(playList); // Ensure sort properties are present

        // Initialize stores
        musicQueueStore.setValue(playList);
        this.indexMap.update(playList); // Update index map for the queue

        if (repeatMode) {
            this.setRepeatMode(repeatMode as RepeatMode, false); // Set repeat mode without reordering yet
        }
        if (preferredQuality) {
            this.setCurrentQuality(preferredQuality);
        }
        if (currentProgress && isFinite(currentProgress)) {
            // Set initial progress, duration will be updated when track loads
            progressStore.setValue({ currentTime: currentProgress, duration: Infinity });
        }

        this.isReady = true; // Mark TrackPlayer as ready

        // Initialize the audio backend (this will also attempt to restore the track if `currentMusicFromPref` exists)
        await this.initializeAudioBackend();

        // After backend initialization, apply other settings if controller is valid
        const backendType = AppConfig.getConfig("playMusic.backend");
        // @ts-ignore // Check MpvController's specific flag if it's the MPV backend
        const isControllerActuallyNotInitialized = backendType === "mpv" && this.audioController && this.audioController.isMpvInitialized === false;


        // If there was a preferred music item and it hasn't been set by initializeAudioBackend (e.g., if backend init failed before track restore)
        if (currentMusicFromPref && !this.currentMusic) {
            this.setCurrentMusic(currentMusicFromPref);
            this.currentIndex = this.findMusicIndex(currentMusicFromPref);
            // If controller is valid, prepare track (metadata for media session)
            if (this.audioController && !isControllerActuallyNotInitialized) {
                await this.audioController.prepareTrack?.(currentMusicFromPref);
            }
        } else if (!currentMusicFromPref && !this.currentMusic) { // No previous track and no current track
            this.setPlayerState(PlayerState.None); // Ensure state is None
            this.resetProgress();
        }

        // Set audio output device if configured and controller is valid
        const deviceId = AppConfig.getConfig("playMusic.audioOutputDevice")?.deviceId;
        if (deviceId && this.audioController && !isControllerActuallyNotInitialized) {
            await this.setAudioOutputDevice(deviceId).catch(e => logger.logError("Failed to set initial audio device", e));
        }
        // Set volume if configured and controller is valid
        if (volume !== null && volume !== undefined && this.audioController && !isControllerActuallyNotInitialized) {
            this.setVolume(volume); // This will call audioController.setVolume
        }
        // Set speed if configured and controller is valid
        if (speed && this.audioController && !isControllerActuallyNotInitialized) {
            this.setSpeed(speed); // This will call audioController.setSpeed
        }

        this.setupEvents(); // Setup TrackPlayer's internal event forwarding and media session handlers
        // Listen for backend changes from AppConfig
        AppConfig.onConfigUpdate(async (patch) => {
            if (patch["playMusic.backend"] !== undefined) {
                logger.logInfo("TrackPlayer: Audio backend configuration changed, re-initializing.");
                const previousMusic = this.currentMusic;
                const previousTime = this.progress.currentTime;
                const wasPlaying = this.playerState === PlayerState.Playing;

                if (this.audioController && wasPlaying) { // Pause current playback if any
                    await this.audioController.pause();
                }
                this.setPlayerState(PlayerState.Buffering); // Indicate buffering during backend switch

                // Re-initialize with the new backend, attempting to restore state
                await this.initializeAudioBackend({ music: previousMusic, time: previousTime, isPlaying: wasPlaying });
            }
            // Re-check controller validity after potential backend switch
            const currentBackend = AppConfig.getConfig("playMusic.backend");
            // @ts-ignore
            const isCurrentControllerNotInit = currentBackend === "mpv" && this.audioController && this.audioController.isMpvInitialized === false;
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
            // Error handling logic (skip/pause) is now primarily within this.audioController.onError
            // This event listener is for any additional TrackPlayer-level actions or logging.

            // If MPV initialization specifically failed, ensure player state reflects this.
            if (this.isMpvInitFailed && AppConfig.getConfig("playMusic.backend") === "mpv") {
                this.setPlayerState(PlayerState.None); // Ensure state is None if MPV is unusable
                return; // Further actions might depend on UI or higher-level logic
            }
        });

        // Setup Media Session handlers
        if (navigator.mediaSession) {
            navigator.mediaSession.setActionHandler("nexttrack", () => { this.skipToNext(); });
            navigator.mediaSession.setActionHandler("previoustrack", () => { this.skipToPrev(); });
            navigator.mediaSession.setActionHandler("play", () => { this.resume(); });
            navigator.mediaSession.setActionHandler("pause", () => { this.pause(); });
            navigator.mediaSession.setActionHandler("seekto", (details) => {
                if (details.seekTime != null) { this.seekTo(details.seekTime); }
            });
            // Consider adding seekforward, seekbackward, stop if desired
        }
    }

    public async playIndex(index: number, options: IPlayOptions = {}) {
        if (!this.isReady) await this.setup(); // Ensure setup is complete
        // @ts-ignore // Check MpvController's specific flag
        if (!this.audioController || (AppConfig.getConfig("playMusic.backend") === "mpv" && this.audioController.isMpvInitialized === false) ) {
            const errorMsg = "播放器未正确初始化或后端不可用 (playIndex)。";
            logger.logError(errorMsg, new Error("AudioController not ready or MPV init failed for playIndex"));
            this.ee.emit(PlayerEvents.Error, this.musicQueue[index] || null, new Error(errorMsg));
            return;
        }

        // @ts-ignore // Await MpvController's readyPromise if it exists
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) {
            try { // @ts-ignore
                await this.audioController.readyPromise;
            } catch (e) {
                this.ee.emit(PlayerEvents.Error, this.musicQueue[index] || null, new Error(`播放器后端初始化等待失败 (playIndex): ${(e as Error).message}`));
                return;
            }
        }

        const {refreshSource, restartOnSameMedia = true, seekTo, quality: intendedQuality} = options;

        if (index === -1 && this.musicQueue.length === 0) { this.reset(); return; } // Handle empty queue
        index = (index + this.musicQueue.length) % this.musicQueue.length; // Normalize index
        const nextMusicItem = this.musicQueue[index];

        if (!nextMusicItem) { // Should not happen if queue is not empty
            logger.logError(`TrackPlayer: nextMusicItem is undefined in playIndex. index: ${index}, qLen: ${this.musicQueue.length}`, new Error("nextMusicItem undefined"));
            this.reset(); return;
        }

        // If it's the same song and not forced to refresh or restart
        if (this.currentIndex === index && this.isCurrentMusic(nextMusicItem) && !refreshSource && !restartOnSameMedia) {
            if (this.playerState !== PlayerState.Playing) { // If paused or stopped, resume
                if (this.audioController) await this.audioController.play();
            }
            return; // Already playing or was just unpaused
        }
        // If same song but restartOnSameMedia is true
        if (this.currentIndex === index && this.isCurrentMusic(nextMusicItem) && !refreshSource && restartOnSameMedia) {
            await this.seekTo(0); // Seek to beginning
            if (this.playerState !== PlayerState.Playing) {
                if (this.audioController) await this.audioController.play();
            }
            return;
        }


        this.setCurrentMusic(nextMusicItem); // This will update currentMusicStore and fetch lyrics
        this.currentIndex = index;

        this.setPlayerState(PlayerState.Buffering); // Set state to Buffering before fetching source
        if (this.audioController) this.audioController.prepareTrack?.(nextMusicItem); // Prepare metadata

        try {
            const {mediaSource, quality} = await this.fetchMediaSource(nextMusicItem, intendedQuality);
            if (!mediaSource?.url) throw new Error("无法获取有效的媒体播放链接 (URL is empty).");
            // Double check if it's still the current music (user might have clicked fast)
            if (!this.isCurrentMusic(nextMusicItem)) return;

            this.setCurrentQuality(quality); // Update current quality
            await this.setTrack(mediaSource, nextMusicItem, { seekTo, autoPlay: true }); // autoPlay is true for playIndex

            // Fetch additional music info (non-blocking)
            PluginManager.callPluginDelegateMethod({ platform: nextMusicItem.platform }, "getMusicInfo", nextMusicItem)
                .then(musicInfo => {
                    if (musicInfo && this.isCurrentMusic(nextMusicItem) && typeof musicInfo === "object") {
                        // Merge new info, ensuring platform and id are not overwritten if missing in musicInfo
                        this.setCurrentMusic({...nextMusicItem, ...musicInfo, platform: nextMusicItem.platform, id: nextMusicItem.id });
                    }
                }).catch(voidCallback); // Silently catch errors for non-critical info fetch
        } catch (e:any) {
            logger.logError("Error in playIndex:", e, {musicItemTitle: nextMusicItem?.title});
            this.setCurrentQuality(AppConfig.getConfig("playMusic.defaultQuality")); // Reset to default quality on error
            if (this.audioController) await this.audioController.reset(); // Reset controller
            const errorToEmit = e instanceof Error ? e : new Error(String(e) || '播放时发生未知错误');
            this.ee.emit(PlayerEvents.Error, nextMusicItem, errorToEmit);
            this.setPlayerState(PlayerState.None); // Set state to None on error
        }
    }

    // ... (rest of the methods like playMusic, playMusicWithReplaceQueue, skipToPrev, skipToNext, reset, seekTo, pause, resume, etc.
    // would follow similar patterns of awaiting this.isReady and this.audioController.readyPromise, and error handling)
    // For brevity, I'll show a few more key methods with the pattern.

    public async playMusic(musicItem: IMusic.IMusicItem, options: IPlayOptions = {}) {
        if (!this.isReady) await this.setup();
        // @ts-ignore
        if (!this.audioController || (AppConfig.getConfig("playMusic.backend") === "mpv" && this.audioController.isMpvInitialized === false) ) {
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("播放器未正确初始化或后端不可用 (playMusic)。")); return;
        }
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) {
            try { // @ts-ignore
                await this.audioController.readyPromise;
            } catch (e) {
                this.ee.emit(PlayerEvents.Error, musicItem, new Error(`播放器后端初始化等待失败 (playMusic): ${(e as Error).message}`)); return;
            }
        }

        const queueIndex = this.findMusicIndex(musicItem);
        if (queueIndex === -1) { // If not in queue, add it
            // Add to the end, or based on a smarter insertion logic if needed
            const newQueue = [...this.musicQueue, {...musicItem, [timeStampSymbol]: Date.now(), [sortIndexSymbol]: this.musicQueue.length }];
            this.setMusicQueue(newQueue); // This updates indexMap and currentIndex
            await this.playIndex(newQueue.length - 1, options); // Play the newly added item
        } else {
            await this.playIndex(queueIndex, options); // Play existing item in queue
        }
    }

    public async playMusicWithReplaceQueue(musicList: IMusic.IMusicItem[], musicItem?: IMusic.IMusicItem) {
        if (!this.isReady) await this.setup();
        // @ts-ignore
        if (!this.audioController || (AppConfig.getConfig("playMusic.backend") === "mpv" && this.audioController.isMpvInitialized === false) ) {
            this.ee.emit(PlayerEvents.Error, musicItem || (musicList.length ? musicList[0] : null), new Error("播放器未正确初始化 (playMusicWithReplaceQueue)。")); return;
        }
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) {
            try { // @ts-ignore
                 await this.audioController.readyPromise;
            } catch (e) {
                this.ee.emit(PlayerEvents.Error, musicItem || (musicList.length ? musicList[0] : null), new Error(`后端初始化等待失败 (playMusicWithReplaceQueue): ${(e as Error).message}`)); return;
            }
        }

        if (!musicList.length && !musicItem) { this.reset(); return; } // Nothing to play

        addSortProperty(musicList); // Add sort properties if not already present
        if (this.repeatMode === RepeatMode.Shuffle) musicList = shuffle(musicList); // Shuffle if mode is shuffle

        musicItem = musicItem ?? musicList[0]; // Determine the item to start playing

        this.setMusicQueue(musicList); // Replace the current queue
        // playMusic will find the item in the new queue (or add if somehow not found) and play it
        await this.playMusic(musicItem!); // musicItem is guaranteed to be non-null if musicList is not empty
    }

    public async skipToPrev() {
        if (!this.isReady || !this.audioController) return;
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }
        if (this.isEmpty) { this.reset(); return; }
        this.playIndex(this.currentIndex - 1); // playIndex handles index wrapping
    }

    public async skipToNext() {
        if (!this.isReady || !this.audioController) return;
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }
        if (this.isEmpty) { this.reset(); return; }
        this.playIndex(this.currentIndex + 1); // playIndex handles index wrapping
    }

    public async reset() {
        if (this.audioController) await this.audioController.reset();
        this.setMusicQueue([]); // Clears queue and updates indexMap
        this.setCurrentMusic(null); // Clears current music and related states
        this.setPlayerState(PlayerState.None);
        this.resetProgress(); // Resets progress store and preference
        this.currentIndex = -1; // Reset current index
    }


    public async seekTo(seconds: number) {
        if (!this.isReady || !this.audioController) return;
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }
        this.audioController.seekTo(seconds);
    }

    public async pause() {
        if (!this.isReady || !this.audioController) return;
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }
        this.audioController.pause();
    }

    public async resume() {
        if (!this.isReady) await this.setup();
        // @ts-ignore
        if (!this.audioController || (AppConfig.getConfig("playMusic.backend") === "mpv" && this.audioController.isMpvInitialized === false)) {
            const errorMsg = "播放器未正确初始化或后端不可用 (resume)";
            logger.logError(errorMsg, new Error("AudioController not ready or MPV init failed for resume"));
            this.ee.emit(PlayerEvents.Error, this.currentMusic, new Error(errorMsg));
            return;
        }
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) {
            try { // @ts-ignore
                await this.audioController.readyPromise;
            } catch (e) {
                this.ee.emit(PlayerEvents.Error, this.currentMusic, new Error(`播放器后端初始化等待失败 (resume): ${(e as Error).message}`));
                return;
            }
        }

        // If controller has no source but there's a current track, attempt to play it (handles recovery)
        if (!this.audioController.hasSource && this.currentMusic) {
            logger.logInfo("TrackPlayer.resume: No source in controller, but currentMusic exists. Attempting to play current track.", this.currentMusicBasicInfo);
            const seekToTime = this.progress.currentTime > 0 ? this.progress.currentTime : undefined;
            await this.playIndex(this.currentIndex, { // Use current index
                restartOnSameMedia: false, // Don't restart if it's the same media, just resume
                seekTo: seekToTime,
                quality: this.currentQuality // Use current quality setting
            });
        } else if (this.audioController.hasSource) { // If source exists, just tell controller to play
            await this.audioController.play();
        } else { // No source and no currentMusic, or some other invalid state
            const errorMsg = AppConfig.getConfig("playMusic.backend") === "mpv" && this.isMpvInitFailed ?
                "MPV 播放器初始化失败，无法播放。" :
                "无有效播放源或播放器未准备好。";
            logger.logInfo(`TrackPlayer.resume: Condition not met for play - ${errorMsg}`);
            this.ee.emit(PlayerEvents.Error, this.currentMusic, new Error(errorMsg));
            this.setPlayerState(PlayerState.None); // Ensure state is None
        }
    }


    public async setVolume(volume: number) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        if (!this.isReady || !this.audioController) {
            // If controller not ready, still update store and preference for future use
            currentVolumeStore.setValue(clampedVolume);
            setUserPreference("volume", clampedVolume);
            return;
        }
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }
        this.audioController.setVolume(clampedVolume); // Controller will emit VolumeChanged
    }

    public async setSpeed(speed: number) {
        if (!this.isReady || !this.audioController) {
            currentSpeedStore.setValue(speed);
            setUserPreference("speed", speed);
            return;
        }
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }
        this.audioController.setSpeed(speed); // Controller will emit SpeedChanged
    }

    // addNext and removeMusic remain largely the same, ensure they update currentIndex correctly
    public addNext(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) {
        if (!this.isReady) return; // Should ideally not happen if setup is called first
        let _musicItems: IMusic.IMusicItem[];
        if (Array.isArray(musicItems)) _musicItems = [...musicItems]; // Clone to avoid modifying original
        else _musicItems = [musicItems];

        const now = Date.now();
        // Ensure new items have sort properties, important if they come from external source
        _musicItems.forEach((item, index) => {
            if (item[timeStampSymbol] === undefined) item[timeStampSymbol] = now;
            if (item[sortIndexSymbol] === undefined) item[sortIndexSymbol] = index; // Relative sort index for this batch
        });

        // Filter out items already in the queue to avoid duplicates if that's the desired behavior
        const itemsToAdd: IMusic.IMusicItem[] = [];
        for (const newItem of _musicItems) {
            if (this.findMusicIndex(newItem) === -1) { // Only add if not already present
                itemsToAdd.push(newItem);
            }
        }
        if (itemsToAdd.length === 0) return; // No new unique items to add

        const oldQueue = this.musicQueue;
        let insertPosition = this.currentIndex + 1;
        // Ensure insertPosition is valid, even if currentIndex is -1 (e.g., empty queue)
        if (insertPosition > oldQueue.length || insertPosition < 0) insertPosition = oldQueue.length;

        const newQueue = [...oldQueue.slice(0, insertPosition), ...itemsToAdd, ...oldQueue.slice(insertPosition)];
        this.setMusicQueue(newQueue); // This updates store, preference, indexMap, and currentIndex
    }


    public removeMusic(musicItemsToRemove: IMusic.IMusicItem | IMusic.IMusicItem[] | number) {
        if (!this.isReady) return;

        const currentQueue = this.musicQueue;
        if (currentQueue.length === 0) return;

        let indicesToRemove: number[] = [];
        if (typeof musicItemsToRemove === 'number') { // If a single index is provided
            if (musicItemsToRemove >= 0 && musicItemsToRemove < currentQueue.length) {
                indicesToRemove.push(musicItemsToRemove);
            }
        } else { // If one or more music items are provided
            const itemsArray = Array.isArray(musicItemsToRemove) ? musicItemsToRemove : [musicItemsToRemove];
            itemsArray.forEach(item => {
                const idx = this.findMusicIndex(item); // Find each item in the current queue
                if (idx !== -1) {
                    indicesToRemove.push(idx);
                }
            });
            indicesToRemove = [...new Set(indicesToRemove)]; // Remove duplicate indices
        }

        if (indicesToRemove.length === 0) return; // Nothing to remove

        // Sort indices in descending order to correctly splice from the array
        indicesToRemove.sort((a, b) => b - a);

        const newQueue = [...currentQueue];
        let newCurrentIndex = this.currentIndex; // Assume current index might change
        let currentMusicWasRemoved = false;

        for (const index of indicesToRemove) {
            newQueue.splice(index, 1); // Remove item at index
            if (index === this.currentIndex) {
                currentMusicWasRemoved = true; // Mark if the currently playing/paused song was removed
            } else if (index < this.currentIndex) {
                newCurrentIndex--; // Adjust current index if an item before it was removed
            }
        }

        // If the current music was not removed, update currentIndex to its new position
        if (!currentMusicWasRemoved) {
            this.currentIndex = newCurrentIndex;
        }
        // If current music was removed, currentIndex will be updated by playIndex or reset

        this.setMusicQueue(newQueue); // Update the queue (this also updates indexMap and currentIndex based on currentMusic)

        if (currentMusicWasRemoved) {
            if (this.audioController) this.audioController.reset(); // Stop playback and clear controller
            this.resetProgress(); // Reset progress display
            this.setCurrentMusic(null); // Clear current music info

            if (newQueue.length > 0) {
                // Determine next track to play. If old currentIndex was valid in new shorter queue, play that.
                // Otherwise, play from the start (index 0).
                const playNextIdx = (newCurrentIndex >= 0 && newCurrentIndex < newQueue.length) ? newCurrentIndex : 0;
                this.playIndex(playNextIdx); // Play the new current/next item
            } else {
                this.reset(); // If queue becomes empty, fully reset player
            }
        } else if (newQueue.length === 0) { // Queue became empty but current music wasn't the one removed (should not happen if logic is correct)
            this.reset();
        }
        // If current music was NOT removed, but queue changed, currentIndex is already updated by setMusicQueue.
        // No need to call playIndex unless specific behavior is desired (e.g. restart current if queue changes significantly).
    }


    public async setQuality(qualityKey: IMusic.IQualityKey) {
        if (!this.isReady || !this.audioController) return;
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }

        const currentMusic = this.currentMusic;
        if (currentMusic && qualityKey !== this.currentQuality) { // Only act if quality actually changes
            const currentTime = this.progress.currentTime;
            const wasPlaying = this.playerState === PlayerState.Playing;

            if (wasPlaying && this.audioController) await this.audioController.pause(); // Pause before changing source

            this.setPlayerState(PlayerState.Buffering); // Indicate buffering
            try {
                const {mediaSource, quality: realQuality} = await this.fetchMediaSource(currentMusic, qualityKey)
                // Double check if it's still the current music (user might have acted fast)
                if (this.isCurrentMusic(currentMusic) && this.audioController) {
                    await this.setTrack(mediaSource, currentMusic, { seekTo: currentTime, autoPlay: wasPlaying });
                    this.setCurrentQuality(realQuality); // Update to the quality actually used
                }
            } catch (e: any) {
                logger.logError("Error setting quality:", e, {musicTitle: currentMusic.title});
                this.ee.emit(PlayerEvents.Error, currentMusic, e instanceof Error ? e : new Error(String(e)));
                // Attempt to resume with old state if quality change failed
                if (wasPlaying && this.audioController) await this.audioController.play();
                else this.setPlayerState(PlayerState.Paused); // Or revert to paused if it wasn't playing
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
        this.setRepeatMode(nextRepeatMode); // triggerReorder defaults to true
    }

    public setRepeatMode(repeatMode: RepeatMode, triggerReorder: boolean = true) {
        const oldRepeatMode = this.repeatMode;
        repeatModeStore.setValue(repeatMode); // Update store
        setUserPreference("repeatMode", repeatMode); // Persist preference

        if (this.isReady && triggerReorder) { // Only reorder if ready and requested
            if (repeatMode === RepeatMode.Shuffle && oldRepeatMode !== RepeatMode.Shuffle) {
                this.setMusicQueue(shuffle(this.musicQueue)); // Shuffle the queue
            } else if (oldRepeatMode === RepeatMode.Shuffle && repeatMode !== RepeatMode.Shuffle) {
                // If changing from shuffle to a non-shuffle mode, sort by original add order
                this.setMusicQueue(sortByTimestampAndIndex([...this.musicQueue], true));
            }
            // If neither of above, order remains as is (e.g. Loop to Queue or vice-versa)
        }
        this.ee.emit(PlayerEvents.RepeatModeChanged, repeatMode); // Notify listeners
    }


    public async setAudioOutputDevice(deviceId?: string) {
        if (!this.isReady || !this.audioController) return;
        // @ts-ignore
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }
        try {
            await this.audioController.setSinkId(deviceId ?? ""); // Pass empty string for default device
        } catch (e: any) {
            logger.logError("设置音频输出设备失败", e);
            // Optionally notify UI or handle error (e.g., revert to default in AppConfig)
        }
    }

    // Updates the music queue, persists it, and recalculates currentIndex
    public setMusicQueue(musicQueue: IMusic.IMusicItem[]) {
        musicQueueStore.setValue(musicQueue);
        setUserPreferenceIDB("playList", musicQueue); // Persist to IndexedDB
        this.indexMap.update(musicQueue); // Update the internal index map
        // Recalculate currentIndex based on the currentMusic and the new queue
        this.currentIndex = this.findMusicIndex(this.currentMusic);
    }


    public async fetchCurrentLyric(forceLoad = false) {
        if (!this.isReady) return; // Ensure player is ready
        const currentMusic = this.currentMusic;
        if (!currentMusic) { this.setCurrentLyric(null); return; } // No music, no lyrics

        const currentLyricData = this.lyric;
        // If not forcing load and lyrics for current song already exist, do nothing
        if (!forceLoad && currentLyricData && this.isCurrentMusic(currentLyricData.parser?.musicItem)) return;

        try {
            const linkedLyricItem = await getLinkedLyric(currentMusic); // Check for externally linked lyric
            let lyricSource: ILyric.ILyricSource | null = null;

            // Try fetching lyric from linked item first
            if (linkedLyricItem) {
                lyricSource = (await PluginManager.callPluginDelegateMethod(linkedLyricItem, "getLyric", linkedLyricItem).catch(voidCallback)) || null;
            }
            // If no lyric from linked item (or no linked item), or if it's not for the current music anymore, try current music's plugin
            if ((!lyricSource || (!lyricSource.rawLrc && !lyricSource.translation)) && this.isCurrentMusic(currentMusic)) {
                lyricSource = (await PluginManager.callPluginDelegateMethod(currentMusic, "getLyric", currentMusic).catch(voidCallback)) || null;
            }

            if (!this.isCurrentMusic(currentMusic)) return; // Check again after async operations

            if (!lyricSource?.rawLrc && !lyricSource?.translation) { this.setCurrentLyric(null); return; } // No lyric content found

            // If only translation exists, use it as rawLrc (some plugins might only provide translation)
            if (!lyricSource.rawLrc && lyricSource.translation) {
                lyricSource.rawLrc = lyricSource.translation;
                lyricSource.translation = undefined;
            }

            const parser = new LyricParser(lyricSource.rawLrc!, { musicItem: currentMusic, translation: lyricSource.translation });
            this.setCurrentLyric({ parser, currentLrc: parser.getPosition(this.progress.currentTime || 0) });
        } catch (e: any) {
            logger.logError("歌词解析失败", e);
            this.setCurrentLyric(null); // Clear lyrics on error
        }
    }


    // Fetches media source, trying different qualities based on config
    private async fetchMediaSource(musicItem: IMusic.IMusicItem, quality?: IMusic.IQualityKey): Promise<{ quality: IMusic.IQualityKey; mediaSource: IPlugin.IMediaSourceResult | null; }> {
        if (!this.isReady) throw new Error("TrackPlayer not ready to fetch media source.");

        const defaultQuality = AppConfig.getConfig("playMusic.defaultQuality") || "standard";
        const whenQualityMissing = AppConfig.getConfig("playMusic.whenQualityMissing") || "lower";
        // Determine the order of qualities to try
        const qualityOrder = getQualityOrder(quality ?? this.currentQuality ?? defaultQuality, whenQualityMissing);

        let mediaSource: IPlugin.IMediaSourceResult | null = null;
        let realQuality: IMusic.IQualityKey = qualityOrder[0]; // Assume first in order will be tried

        // Check for downloaded version first
        const downloadedData = getInternalData<IMusic.IMusicItemInternalData>(musicItem, "downloadData");
        if (downloadedData) {
            const {quality: downloadedQuality, path: _path} = downloadedData;
            if (await fsUtil.isFile(_path)) { // Check if file actually exists
                logger.logInfo(`Using downloaded file for ${musicItem.title} at path: ${_path}`);
                return { quality: downloadedQuality || "standard", mediaSource: { url: fsUtil.addFileScheme(_path) }};
            } else {
                logger.logInfo(`Downloaded file for ${musicItem.title} not found at path: ${_path}. Fetching online.`);
            }
        }

        // Try fetching online source based on quality order
        for (const q of qualityOrder) {
            try {
                mediaSource = await PluginManager.callPluginDelegateMethod({ platform: musicItem.platform }, "getMediaSource", musicItem, q);
                if (!mediaSource?.url) continue; // If no URL, try next quality
                realQuality = q; // Found a valid source with this quality
                break; // Stop trying other qualities
            } catch (e: any) {
                logger.logInfo(`Failed to get media source for quality ${q} for music ${musicItem.title}: ${e.message}`);
                // Continue to next quality
            }
        }

        if (!mediaSource?.url) throw new Error(`无法为歌曲 ${musicItem.title} 获取任何有效的播放链接。`);
        return { quality: realQuality, mediaSource };
    }


    // Sets the current music item, updates store, fetches lyrics, resets progress, and saves preference
    private setCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        const isActuallyDifferent = !this.isCurrentMusic(musicItem) ||
                                  (musicItem && this.currentMusic && JSON.stringify(musicItem) !== JSON.stringify(this.currentMusic));

        currentMusicStore.setValue(musicItem); // Update store

        if (isActuallyDifferent) { // Only if music actually changed
            this.ee.emit(PlayerEvents.MusicChanged, musicItem); // Emit event
            this.fetchCurrentLyric(true); // Force fetch new lyrics
            this.resetProgress(); // Reset progress for new song
            if (musicItem) setUserPreference("currentMusic", musicItem); // Save to preference
            else removeUserPreference("currentMusic");
        }
    }


    // Sets playback progress, saves to preference, and emits event
    private setProgress(progress: CurrentTime) {
        progressStore.setValue(progress);
        if (isFinite(progress.currentTime)) setUserPreference("currentProgress", progress.currentTime); // Save current time
        this.ee.emit(PlayerEvents.ProgressChanged, progress);
    }

    // Sets current playback quality and saves to preference
    private setCurrentQuality(quality: IMusic.IQualityKey) {
        setUserPreference("currentQuality", quality); // Save preference
        currentQualityStore.setValue(quality); // Update store
    }

    // Sets current lyric (parsed and current line) and emits events
    private setCurrentLyric(lyric?: ICurrentLyric | null) {
        const prev = this.lyric;
        const newLyric = (lyric && Object.keys(lyric).length > 0) ? lyric as ICurrentLyric : null; // Ensure null if empty
        currentLyricStore.setValue(newLyric);

        // Emit events only if relevant parts of lyric data changed
        if (newLyric?.parser !== prev?.parser) this.ee.emit(PlayerEvents.LyricChanged, newLyric?.parser ?? null);
        if (newLyric?.currentLrc?.lrc !== prev?.currentLrc?.lrc) this.ee.emit(PlayerEvents.CurrentLyricChanged, newLyric?.currentLrc ?? null);
    }


    // Sets player state and emits event
    private setPlayerState(playerState: PlayerState) {
        playerStateStore.setValue(playerState);
        this.ee.emit(PlayerEvents.StateChanged, playerState);
    }

    // Finds index of a music item in the current queue
    private findMusicIndex(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) return -1;
        return this.indexMap.indexOf(musicItem);
    }

    // Resets progress store and clears preference for currentProgress
    private resetProgress() { // Made private as it's an internal helper
        resetProgress(); // Calls the function from store.ts
        removeUserPreference("currentProgress");
    }


    // Sets the track source on the audio controller, seeks, and handles autoPlay
    private async setTrack(mediaSource: IPlugin.IMediaSourceResult | null, musicItem: IMusic.IMusicItem, options: ITrackOptions = { autoPlay: true }) {
        if (!this.audioController) {
            logger.logError("setTrack called but audioController is null.", new Error("audioController is null"));
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("播放器核心组件丢失。"));
            this.setPlayerState(PlayerState.None);
            return;
        }
        // @ts-ignore // Await MpvController's readyPromise if it exists
        if (typeof this.audioController.readyPromise === 'object' && this.audioController.readyPromise !== null) { await this.audioController.readyPromise; }

        await this.audioController.reset(); // Reset controller before setting new track
        this.resetProgress(); // Reset progress for the new track

        if (!mediaSource || !mediaSource.url) {
            const errorMsg = `setTrack called with invalid mediaSource for music: ${musicItem.title}`;
            logger.logError(errorMsg, new Error(`Invalid mediaSource: ${JSON.stringify(mediaSource)}`));
            this.ee.emit(PlayerEvents.Error, musicItem, new Error("无效的媒体源或URL为空"));
            this.setPlayerState(PlayerState.None);
            return;
        }

        this.setPlayerState(PlayerState.Buffering); // Set to buffering before loading

        await this.audioController.setTrackSource(mediaSource, musicItem); // Set the source on the controller
        // Seek if requested and valid
        if (options.seekTo !== undefined && isFinite(options.seekTo) && options.seekTo >= 0) {
            this.audioController.seekTo(options.seekTo);
        }
        // Auto-play if requested
        if (options.autoPlay) {
            this.audioController.play(); // Tell controller to play
        } else if (this.playerState !== PlayerState.Paused && this.playerState !== PlayerState.None) {
            // If not auto-playing, and not already paused/stopped, set to paused.
            // This handles cases where a track is loaded but not immediately played.
            this.setPlayerState(PlayerState.Paused);
        }
    }

    // Checks if the given musicItem is the currently playing/loaded one
    public isCurrentMusic(musicItem: IMusic.IMusicItem | null) {
        return isSameMedia(musicItem, this.currentMusic);
    }
}

export default new TrackPlayer();