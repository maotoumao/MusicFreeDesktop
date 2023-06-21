import Store from "@/common/store";
import trackPlayer from "./internal";
import { PlayerState, RepeatMode, TrackPlayerEvent } from "./enum";
import trackPlayerEventsEmitter from "./event";
import shuffle from "lodash.shuffle";
import { isSameMedia, sortByTimestampAndIndex } from "@/common/media-util";
import { timeStampSymbol, sortIndexSymbol } from "@/common/constant";
import { callPluginDelegateMethod } from "../plugin-delegate";
import LyricParser from "@/renderer/utils/lyric-parser";

const initProgress = {
  currentTime: 0,
  duration: Infinity,
};

/** 音乐队列 */
const musicQueueStore = new Store<IMusic.IMusicItem[]>([]);

/** 当前播放 */
const currentMusicStore = new Store<IMusic.IMusicItem | null>(null);

interface ICurrentLyric {
  parser?: LyricParser;
  currentLrc?: {
    lrc?: ILyric.IParsedLrcItem; // 当前时刻的歌词
    index?: number; // 下标
  };
}
/** 当前歌词解析器 */
const currentLyricStore = new Store<ICurrentLyric | null>(null);

/** 播放模式 */
const repeatModeStore = new Store(RepeatMode.Queue);

/** 进度 */
const progressStore = new Store(initProgress);

/** 播放状态 */
const playerStateStore = new Store(PlayerState.None);

/** 播放下标 */
let currentIndex = -1;

export function setupPlayer() {
  trackPlayerEventsEmitter.on(TrackPlayerEvent.PlayEnd, () => {
    progressStore.setValue(initProgress);
    switch (repeatModeStore.getValue()) {
      case RepeatMode.Queue:
      case RepeatMode.Shuffle: {
        skipToNext();
        break;
      }
      case RepeatMode.Loop: {
        playIndex(currentIndex);
        break;
      }
    }
  });

  trackPlayerEventsEmitter.on(TrackPlayerEvent.TimeUpdated, (res) => {
    progressStore.setValue(res);
    const currentLyric = currentLyricStore.getValue();
    if (currentLyric?.parser) {
      const lrcItem = currentLyric.parser.getPosition(res.currentTime);
      if (lrcItem?.lrc !== currentLyric.currentLrc?.lrc) {
        currentLyricStore.setValue({
          parser: currentLyric.parser,
          currentLrc: lrcItem,
        });
      }
    }
  });

  trackPlayerEventsEmitter.on(TrackPlayerEvent.StateChanged, (st) => {
    playerStateStore.setValue(st);
  });

  trackPlayerEventsEmitter.on(TrackPlayerEvent.Error, () => {
    // 播放错误时自动跳到下一首
    if (musicQueueStore.getValue().length > 1) {
      skipToNext();
    }
  });

  // 更新当前音乐的歌词
  trackPlayerEventsEmitter.on(TrackPlayerEvent.UpdateLyric, async () => {
    const currentMusic = currentMusicStore.getValue();
    // 当前没有歌曲
    if (!currentMusic) {
      currentLyricStore.setValue(null);
      return;
    }
    console.log("here1");

    const currentLyric = currentLyricStore.getValue();
    // 已经有了
    if (
      currentLyric &&
      isSameMedia(currentLyric?.parser?.getCurrentMusicItem?.(), currentMusic)
    ) {
      console.log("here2");

      return;
    } else {
      try {
        const lyric = await callPluginDelegateMethod(
          currentMusic,
          "getLyric",
          currentMusic
        );
        console.log(lyric, "lyric");
        if (!isSameMedia(currentMusic, currentMusicStore.getValue())) {
          return;
        }
        if (!lyric?.rawLrc) {
          currentLyricStore.setValue({});
          return;
        }
        const rawLrc = lyric?.rawLrc;
        const parser = new LyricParser(rawLrc, currentMusic);
        currentLyricStore.setValue({
          parser,
        });
      } catch (e) {
        console.log(e, "歌词解析失败");
        currentLyricStore.setValue({});

        // 解析歌词失败
      }
    }
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    skipToPrev();
  });
  navigator.mediaSession.setActionHandler("nexttrack", () => {
    skipToNext();
  });
}

function setMusicQueue(musicQueue: IMusic.IMusicItem[]) {
  musicQueueStore.setValue(musicQueue);
}

/** 设置当前播放的音乐 */
function setCurrentMusic(music: IMusic.IMusicItem | null) {
  if (!isSameMedia(music, currentMusicStore.getValue())) {
    currentMusicStore.setValue(music);
    currentLyricStore.setValue(null);
    trackPlayerEventsEmitter.emit(TrackPlayerEvent.UpdateLyric);
  } else {
    currentMusicStore.setValue(music);
  }
}

export function useCurrentMusic() {
  return currentMusicStore.useValue();
}

export const useProgress = progressStore.useValue;

export const getProgress = progressStore.getValue;

export const usePlayerState = playerStateStore.useValue;

export const useRepeatMode = repeatModeStore.useValue;

export const useMusicQueue = musicQueueStore.useValue;

export const useLyric = currentLyricStore.useValue;

export function toggleRepeatMode() {
  let nextRepeatMode: RepeatMode = repeatModeStore.getValue();
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
  setRepeatMode(nextRepeatMode);
}

export function setRepeatMode(repeatMode: RepeatMode) {
  if (repeatMode === RepeatMode.Shuffle) {
    setMusicQueue(shuffle(musicQueueStore.getValue()));
  } else if (repeatModeStore.getValue() === RepeatMode.Shuffle) {
    setMusicQueue(sortByTimestampAndIndex(musicQueueStore.getValue(), true));
  }
  repeatModeStore.setValue(repeatMode);
  currentIndex = findMusicIndex(currentMusicStore.getValue());
}

function findMusicIndex(musicItem?: IMusic.IMusicItem) {
  if (!musicItem) {
    return -1;
  }
  const musicQueue = musicQueueStore.getValue();
  return musicQueue.findIndex((item) => isSameMedia(musicItem, item));
}

/**
 * 歌单行为
 */

function addToEnd() {}

export function addNext(musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]) {
  let _musicItems: IMusic.IMusicItem[];
  if (Array.isArray(musicItems)) {
    _musicItems = musicItems;
  } else {
    _musicItems = [musicItems];
  }

  const now = Date.now();

  const currentMusic = currentMusicStore.getValue();
  let duplicateIndex = -1;
  _musicItems.forEach((item, index) => {
    item[timeStampSymbol] = now;
    item[sortIndexSymbol] = index;
    if (duplicateIndex === -1 && isSameMedia(item, currentMusic)) {
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

  const queue = musicQueueStore.getValue();

  if (!currentMusic) {
    // 加在末尾
    const filteredQueue = queue.filter(
      (item) => _musicItems.findIndex((mi) => isSameMedia(item, mi)) === -1
    );
    setMusicQueue([...filteredQueue, ..._musicItems]);
  } else {
    const prevQueue = queue
      .slice(0, currentIndex + 1)
      .filter(
        (item) => _musicItems.findIndex((mi) => isSameMedia(item, mi)) === -1
      );
    const tailQueue = queue
      .slice(currentIndex + 1)
      .filter(
        (item) => _musicItems.findIndex((mi) => isSameMedia(item, mi)) === -1
      );

    const newQueue = [...prevQueue, ..._musicItems, ...tailQueue];
    setMusicQueue(newQueue);
    currentIndex = findMusicIndex(currentMusic);
  }
}

export function skipToPrev() {
  const musicQueue = musicQueueStore.getValue();
  if (musicQueue.length === 0) {
    currentIndex = -1;
    setCurrentMusic(null);
    return;
  }
  playIndex(currentIndex - 1);
}

export function skipToNext() {
  const musicQueue = musicQueueStore.getValue();
  if (musicQueue.length === 0) {
    currentIndex = -1;
    setCurrentMusic(null);
    return;
  }
  playIndex(currentIndex + 1);
}

function splice() {}

interface IPlayOptions {
  /** 播放相同音乐时是否从头开始 */
  restartOnSameMedia?: boolean;
  /** 强制更新源 */
  refreshSource?: boolean;
}

async function playIndex(nextIndex: number, options?: IPlayOptions) {
  const musicQueue = musicQueueStore.getValue();

  nextIndex = (nextIndex + musicQueue.length) % musicQueue.length;
  // 歌曲重复
  if (
    !options?.refreshSource &&
    nextIndex === currentIndex &&
    currentIndex !== -1
  ) {
    const restartOnSameMedia = options?.restartOnSameMedia ?? true;
    if (restartOnSameMedia) {
      trackPlayer.seekTo(0);
    }
    trackPlayer.play();
  } else {
    currentIndex = nextIndex;

    // 插件获取media
    const musicItem = musicQueue[currentIndex];

    try {
      const mediaSource = await callPluginDelegateMethod(
        {
          platform: musicItem.platform,
        },
        "getMediaSource",
        musicItem,
        "standard"
      );
      if (!mediaSource?.url) {
        throw new Error("Empty Source");
      }
      console.log("MEDIA SOURCE", mediaSource, musicItem);
      if (isSameMedia(musicItem, musicQueueStore.getValue()[currentIndex])) {
        setCurrentMusic(musicItem);
        setTrackAndPlay(mediaSource, musicItem);
      }
    } catch (e) {
      // 播放失败
      trackPlayer.clear();
      console.log(e);
    }
  }
}

export async function playMusic(
  musicItem: IMusic.IMusicItem,
  options?: IPlayOptions
) {
  const musicQueue = musicQueueStore.getValue();
  const queueIndex = findMusicIndex(musicItem);
  if (queueIndex === -1) {
    // 添加到列表末尾
    const newQueue = [
      ...musicQueue,
      {
        ...musicItem,
        [timeStampSymbol]: Date.now(),
        [sortIndexSymbol]: 0,
      },
    ];
    setMusicQueue(newQueue);
    await playIndex(newQueue.length - 1, options);
  } else {
    await playIndex(queueIndex, options);
  }
}

export async function playMusicWithReplaceQueue(
  musicItem: IMusic.IMusicItem,
  musicList: IMusic.IMusicItem[]
) {
  musicQueueStore.setValue(musicList);
  await playMusic(musicItem);
}

export function resumePlay() {
  trackPlayer.play();
}

/** 内部播放 */
function setTrackAndPlay(
  mediaSource: IPlugin.IMediaSourceResult,
  musicItem: IMusic.IMusicItem
) {
  progressStore.setValue(initProgress);
  trackPlayer.setTrackSource(mediaSource, musicItem);
  trackPlayer.play();
}
/** 清空播放队列 */
export function clearQueue() {
  trackPlayer.clear();
  setMusicQueue([]);
  setCurrentMusic(null);
  currentIndex = -1;
}

export function removeFromQueue(musicItem: IMusic.IMusicItem | number) {
  let musicIndex: number;
  if (typeof musicItem !== "number") {
    musicIndex = findMusicIndex(musicItem);
  } else {
    musicIndex = musicItem;
  }
  if (musicIndex === -1) {
    return;
  }

  if (musicIndex === currentIndex) {
    trackPlayer.clear();
    currentIndex = -1;
    setCurrentMusic(null);
  }

  const newQueue = [...musicQueueStore.getValue()];
  newQueue.splice(musicIndex, 1);

  setMusicQueue(newQueue);
  currentIndex = findMusicIndex(currentMusicStore.getValue());
}

export function seekTo(position: number) {
  trackPlayer.seekTo(position);
}

export function pause() {
  trackPlayer.pause();
}
