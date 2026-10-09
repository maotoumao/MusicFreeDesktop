/**
 * TrackPlayer — React Hooks
 */
import { useAtomValue } from 'jotai/react';
import {
    currentMusicAtom,
    musicQueueAtom,
    playerStateAtom,
    repeatModeAtom,
    progressAtom,
    volumeAtom,
    speedAtom,
    qualityAtom,
    currentLyricAtom,
    associatedLyricAtom,
} from './store';

export const useCurrentMusic = () => useAtomValue(currentMusicAtom);
export const useProgress = () => useAtomValue(progressAtom);
export const usePlayerState = () => useAtomValue(playerStateAtom);
export const useRepeatMode = () => useAtomValue(repeatModeAtom);
export const useMusicQueue = () => useAtomValue(musicQueueAtom);
export const useLyric = () => useAtomValue(currentLyricAtom);
export const useVolume = () => useAtomValue(volumeAtom);
export const useSpeed = () => useAtomValue(speedAtom);
export const useQuality = () => useAtomValue(qualityAtom);
export const useAssociatedLyric = () => useAtomValue(associatedLyricAtom);
