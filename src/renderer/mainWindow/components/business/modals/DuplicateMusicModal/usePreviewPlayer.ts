/**
 * DuplicateMusicModal — 独立试听播放器
 *
 * 与主播放器完全隔离：只播放去重列表里的本地文件，不读写主播放器队列。
 * 开始试听时暂停主播放器，停止试听（切 tab / 关闭弹窗 / 清空列表）时
 * 恢复主播放器原先的播放状态，保证同一时刻只有一个声音源。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayerState } from '@common/constant';
import fsUtil from '@infra/fsUtil/renderer';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { usePlayerState } from '@renderer/mainWindow/core/trackPlayer/hooks';
import { playerStateAtom, store } from '@renderer/mainWindow/core/trackPlayer/store';
import type { ScanItem } from './scan';

export interface PreviewPlayerState {
    /** 当前试听曲目；null 表示没有试听会话 */
    current: ScanItem | null;
    playing: boolean;
    currentTime: number;
    duration: number;
    /** 当前曲目无法播放（文件缺失/损坏） */
    error: boolean;
    /** 队列中还有下一首 */
    hasNext: boolean;
}

export interface PreviewPlayer {
    state: PreviewPlayerState;
    /** 播放指定歌曲，并以 queue 作为本轮试听队列 */
    play: (item: ScanItem, queue: ScanItem[]) => void;
    toggle: () => void;
    next: () => void;
    /** ratio 0–1 */
    seekTo: (ratio: number) => void;
    /** 停止并清空试听队列，恢复外部播放器状态 */
    stop: () => void;
}

export function usePreviewPlayer(): PreviewPlayer {
    const externalState = usePlayerState();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const queueRef = useRef<ScanItem[]>([]);
    const indexRef = useRef(-1);
    const currentRef = useRef<ScanItem | null>(null);
    /** 试听开始前主播放器是否在播放，停止时用于恢复 */
    const resumeExternalRef = useRef(false);

    const [current, setCurrent] = useState<ScanItem | null>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(false);
    const [hasNext, setHasNext] = useState(false);

    const ensureAudio = useCallback((): HTMLAudioElement => {
        if (audioRef.current) return audioRef.current;
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
        audio.addEventListener('durationchange', () => {
            setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
        });
        audio.addEventListener('play', () => setPlaying(true));
        audio.addEventListener('pause', () => setPlaying(false));
        audio.addEventListener('ended', () => setPlaying(false));
        audio.addEventListener('error', () => {
            // 清理 src（stop/卸载）触发的空源错误忽略
            if (!audio.getAttribute('src')) return;
            setPlaying(false);
            setError(true);
        });
        audioRef.current = audio;
        return audio;
    }, []);

    const playItem = useCallback(
        (item: ScanItem, queue: ScanItem[]) => {
            const audio = ensureAudio();
            const index = queue.findIndex((it) => it.key === item.key);
            queueRef.current = queue;
            indexRef.current = index;
            currentRef.current = item;
            setCurrent(item);
            setError(false);
            setCurrentTime(0);
            setDuration(item.duration ?? 0);
            setHasNext(index >= 0 && index + 1 < queue.length);

            // 与主播放器互斥：记住它是否在播，然后暂停
            const state = store.get(playerStateAtom);
            if (state === PlayerState.Playing || state === PlayerState.Buffering) {
                resumeExternalRef.current = true;
                trackPlayer.pause();
            }

            audio.src = fsUtil.addFileScheme(item.localPath);
            audio.play().catch(() => {
                setPlaying(false);
                setError(true);
            });
        },
        [ensureAudio],
    );

    const toggle = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !currentRef.current) return;
        if (audio.paused) {
            if (audio.ended) audio.currentTime = 0;
            audio.play().catch(() => {
                setPlaying(false);
                setError(true);
            });
        } else {
            audio.pause();
        }
    }, []);

    const next = useCallback(() => {
        const queue = queueRef.current;
        const index = indexRef.current;
        if (index < 0 || index + 1 >= queue.length) return;
        playItem(queue[index + 1], queue);
    }, [playItem]);

    const seekTo = useCallback((ratio: number) => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
        audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
        setCurrentTime(audio.currentTime);
    }, []);

    const stop = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
        }
        queueRef.current = [];
        indexRef.current = -1;
        currentRef.current = null;
        setCurrent(null);
        setPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setError(false);
        setHasNext(false);

        if (resumeExternalRef.current) {
            resumeExternalRef.current = false;
            trackPlayer.resume();
        }
    }, []);

    // 双向互斥：试听期间若外部播放器被其他入口恢复，则让出播放权暂停试听
    useEffect(() => {
        if (playing && externalState === PlayerState.Playing) {
            resumeExternalRef.current = false;
            audioRef.current?.pause();
        }
    }, [playing, externalState]);

    // 卸载时停止音频并恢复外部播放
    useEffect(() => {
        return () => {
            const audio = audioRef.current;
            if (audio) {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
            }
            if (resumeExternalRef.current) {
                resumeExternalRef.current = false;
                trackPlayer.resume();
            }
        };
    }, []);

    return {
        state: { current, playing, currentTime, duration, error, hasNext },
        play: playItem,
        toggle,
        next,
        seekTo,
        stop,
    };
}
