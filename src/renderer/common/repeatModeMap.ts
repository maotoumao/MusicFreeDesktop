import { Repeat, Repeat1, Shuffle, type LucideIcon } from 'lucide-react';
import { RepeatMode, REPEAT_MODE_NEXT } from '@common/constant';

export interface RepeatModeEntry {
    /** 当前模式对应的图标 */
    Icon: LucideIcon;
    /** 当前模式的提示文字 i18n key */
    tipKey: string;
    /** 点击后切换到的下一个模式 */
    next: RepeatMode;
}

/** RepeatMode → 图标 + 提示文字 key + 下一个模式 */
export const REPEAT_MODE_MAP: Record<RepeatMode, RepeatModeEntry> = {
    [RepeatMode.Queue]: {
        Icon: Repeat,
        tipKey: 'playback.repeat_queue',
        next: REPEAT_MODE_NEXT[RepeatMode.Queue],
    },
    [RepeatMode.Shuffle]: {
        Icon: Shuffle,
        tipKey: 'playback.repeat_shuffle',
        next: REPEAT_MODE_NEXT[RepeatMode.Shuffle],
    },
    [RepeatMode.Loop]: {
        Icon: Repeat1,
        tipKey: 'playback.repeat_loop',
        next: REPEAT_MODE_NEXT[RepeatMode.Loop],
    },
};
