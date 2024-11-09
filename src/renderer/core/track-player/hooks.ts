import _trackPlayerStore from "@renderer/core/track-player/store";

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
} = _trackPlayerStore;

export const useCurrentMusic = currentMusicStore.useValue;

export const useProgress = progressStore.useValue;

export const usePlayerState = playerStateStore.useValue;

export const useRepeatMode = repeatModeStore.useValue;

export const useMusicQueue = musicQueueStore.useValue;

export const useLyric = currentLyricStore.useValue;

export const useVolume = currentVolumeStore.useValue;

export const useSpeed = currentSpeedStore.useValue;

export const useQuality = currentQualityStore.useValue;
