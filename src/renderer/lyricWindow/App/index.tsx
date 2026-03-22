// ============================================================================
// App — 歌词窗口根组件
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@common/cn';
import appSyncAuxiliary from '@infra/appSync/renderer/auxiliary';
import { useConfigValue } from '@renderer/common/hooks/useConfigValue';

import LyricToolbar from '../components/LyricToolbar';
import LyricText from '../components/LyricText';

import './index.scss';

export default function App() {
    const [locked] = useConfigValue('lyric.lockLyric');
    const isLocked = locked ?? false;

    // hover 状态管理
    const [showToolbar, setShowToolbar] = useState(false);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearHoverTimer = useCallback(() => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
    }, []);

    const handleMouseOver = useCallback(() => {
        if (!isLocked) {
            setShowToolbar(true);
            return;
        }
        // 锁定态：延迟显示解锁按钮
        if (hoverTimerRef.current) return;
        hoverTimerRef.current = setTimeout(() => {
            setShowToolbar(true);
            hoverTimerRef.current = null;
        }, 600);
    }, [isLocked]);

    const handleMouseLeave = useCallback(() => {
        clearHoverTimer();
        setShowToolbar(false);
    }, [clearHoverTimer]);

    // document 级别的 mouseleave —— 透明窗口中比 React onMouseLeave 更可靠
    useEffect(() => {
        const onDocLeave = () => {
            clearHoverTimer();
            setShowToolbar(false);
        };
        document.addEventListener('mouseleave', onDocLeave);
        return () => document.removeEventListener('mouseleave', onDocLeave);
    }, [clearHoverTimer]);

    // 锁定状态切换时重置 toolbar 显示
    useEffect(() => {
        setShowToolbar(false);
        clearHoverTimer();
    }, [isLocked, clearHoverTimer]);

    // 订阅应用状态
    useEffect(() => {
        appSyncAuxiliary.subscribeAppState(['musicItem', 'playerState', 'currentLrc', 'progress']);
    }, []);

    return (
        <div
            className={cn(
                'l-lyric-shell',
                isLocked ? 'is-locked' : 'is-unlocked',
                showToolbar && 'is-hovered',
            )}
            onMouseOver={handleMouseOver}
            onMouseLeave={handleMouseLeave}
        >
            <LyricToolbar locked={isLocked} visible={showToolbar} />
            <LyricText />
        </div>
    );
}
