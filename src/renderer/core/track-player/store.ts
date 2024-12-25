import Store from "@/common/store";
import {ICurrentLyric} from "@renderer/core/track-player/enum";
import {PlayerState, RepeatMode} from "@/common/constant";

const initProgress = {
    currentTime: 0,
    duration: Infinity,
};


/** 音乐队列 */
const musicQueueStore = new Store<IMusic.IMusicItem[]>([]);

/** 当前播放 */
const currentMusicStore = new Store<IMusic.IMusicItem | null>(null);

/** 当前歌词解析器 */
const currentLyricStore = new Store<ICurrentLyric | null>(null);

/** 播放模式 */
const repeatModeStore = new Store(RepeatMode.Queue);

/** 进度 */
const progressStore = new Store(initProgress);

/** 播放状态 */
const playerStateStore = new Store(PlayerState.None);

/** 音量 */
const currentVolumeStore = new Store(1);

/** 速度 */
const currentSpeedStore = new Store(1);

/** 音质 */
const currentQualityStore = new Store<IMusic.IQualityKey>("standard");


function resetProgress() {
    progressStore.setValue(initProgress);
}

const _trackPlayerStore = {
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
}

export default _trackPlayerStore;
