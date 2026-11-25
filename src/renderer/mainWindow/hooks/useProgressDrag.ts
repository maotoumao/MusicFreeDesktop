import { useCallback, useRef, useState } from 'react';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import formatDuration from '@common/formatDuration';

/** 键盘调节进度的步长（秒） */
const KEYBOARD_STEP_SECONDS = 5;
const KEYBOARD_LARGE_STEP_SECONDS = 30;

interface ProgressData {
    currentTime: number;
    duration: number;
}

/**
 * 进度条拖拽交互 hook。
 *
 * 拖拽期间使用 useState 驱动 UI 更新，保证进度条跟手。
 * 拖拽结束后延迟清除拖拽值，等待 seekTo 后的 timeupdate 事件
 * 更新 progressAtom，避免短暂闪回拖拽前的位置。
 */
export function useProgressDrag(progress: ProgressData) {
    const [dragValue, setDragValue] = useState<number | null>(null);
    const durationRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    durationRef.current = progress.duration;

    const atomPct =
        progress.duration > 0 && isFinite(progress.duration)
            ? Math.min(100, (progress.currentTime / progress.duration) * 100)
            : 0;

    const isDragging = dragValue !== null;
    const displayValue = isDragging ? dragValue : atomPct;

    const handleChange = useCallback((value: number) => {
        setDragValue(value);
    }, []);

    const handleDragStart = useCallback(() => {
        clearTimeout(timerRef.current);
    }, []);

    const handleDragEnd = useCallback((value: number) => {
        const duration = durationRef.current;
        if (isFinite(duration) && duration > 0) {
            trackPlayer.seekTo((value / 100) * duration);
        }
        // 延迟清除拖拽值，等待 seekTo 后 progressAtom 更新追上，
        // 避免 displayValue 短暂闪回拖拽前的位置
        timerRef.current = setTimeout(() => {
            setDragValue(null);
        }, 200);
    }, []);

    const displayTime = isDragging ? (dragValue / 100) * progress.duration : progress.currentTime;

    const hasDuration = isFinite(progress.duration) && progress.duration > 0;
    const keyboardStep = hasDuration ? (KEYBOARD_STEP_SECONDS / progress.duration) * 100 : 1;
    const keyboardLargeStep = hasDuration
        ? (KEYBOARD_LARGE_STEP_SECONDS / progress.duration) * 100
        : 10;
    const valueText = `${formatDuration(displayTime)} / ${formatDuration(progress.duration)}`;

    return {
        displayValue,
        displayTime,
        keyboardStep,
        keyboardLargeStep,
        valueText,
        handleChange,
        handleDragStart,
        handleDragEnd,
    };
}
