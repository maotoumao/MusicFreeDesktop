import {
    forwardRef,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type CSSProperties,
    type FocusEvent,
} from 'react';
import { atom, getDefaultStore, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { AlertTriangle, CircleCheck, CircleX, Info, X, type LucideIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { cn } from '@common/cn';
import { useCurrentThemePack } from '@infra/themepack/renderer';
import { duration as motionDuration, easing } from '@common/motionTokens';
import { measureToastScrim, type ToastScrim } from './contrast';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * - info：状态提示
 * - success：用户发起的操作已完成
 * - warn：前置条件不满足或输入有误，用户可自行处理
 * - error：操作失败
 */
export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface ToastOptions {
    /** 变体 @default "info" */
    type?: ToastType;
    /** 辅助说明文案 */
    description?: string;
    /** 自动关闭延时（ms），≤ 0 表示不自动关闭；默认 info / success 3200，warn / error 5000，带操作按钮 6000 */
    duration?: number;
    /** 是否显示关闭按钮 @default true */
    closable?: boolean;
    /** 操作按钮文字 */
    actionLabel?: string;
    /** 操作按钮回调（点击后自动关闭） */
    onAction?: () => void;
}

interface ToastItem extends Required<Pick<ToastOptions, 'type' | 'duration' | 'closable'>> {
    id: string;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Jotai State
// ────────────────────────────────────────────────────────────────────────────

const toastQueueAtom = atom<ToastItem[]>([]);

/** 读屏播报：写入常驻的播报区（失败用 assertive，其余用 polite），过一段时间移除 */
interface Announcement {
    id: string;
    text: string;
    assertive: boolean;
}
const announcementAtom = atom<Announcement[]>([]);
const ANNOUNCEMENT_TTL = 7000;
const store = getDefaultStore();

/** 同时可见的最大 toast 数量 */
const MAX_VISIBLE = 5;

function defaultDuration(type: ToastType, hasAction: boolean): number {
    if (hasAction) return 6000;
    return type === 'warn' || type === 'error' ? 5000 : 3200;
}

// ── 自动关闭计时：悬停或键盘焦点在卡片上时暂停，离开后按剩余时间继续 ──

type PauseReason = 'hover' | 'focus';

interface ToastTimer {
    handle: ReturnType<typeof setTimeout> | null;
    deadline: number;
    remaining: number;
    pauses: Set<PauseReason>;
    /** 悬停暂停的上限计时：收不到 mouseleave（如鼠标直接移进标题栏拖拽区）时也会恢复 */
    hoverLimit: ReturnType<typeof setTimeout> | null;
}

/** 悬停暂停最长时间 */
const HOVER_PAUSE_LIMIT = 30000;

const timerMap = new Map<string, ToastTimer>();

function startTimer(id: string, ms: number) {
    const timer = timerMap.get(id) ?? {
        handle: null,
        deadline: 0,
        remaining: ms,
        pauses: new Set<PauseReason>(),
        hoverLimit: null,
    };
    if (timer.handle) clearTimeout(timer.handle);
    timer.remaining = ms;
    timer.deadline = performance.now() + ms;
    timer.handle = timer.pauses.size > 0 ? null : setTimeout(() => removeToast(id), ms);
    timerMap.set(id, timer);
}

function pauseTimer(id: string, reason: PauseReason) {
    const timer = timerMap.get(id);
    if (!timer) return;
    timer.pauses.add(reason);
    if (reason === 'hover' && !timer.hoverLimit) {
        timer.hoverLimit = setTimeout(() => resumeTimer(id, 'hover'), HOVER_PAUSE_LIMIT);
    }
    if (timer.handle) {
        clearTimeout(timer.handle);
        timer.handle = null;
        timer.remaining = Math.max(0, timer.deadline - performance.now());
    }
}

function resumeTimer(id: string, reason: PauseReason) {
    const timer = timerMap.get(id);
    if (!timer) return;
    timer.pauses.delete(reason);
    if (reason === 'hover' && timer.hoverLimit) {
        clearTimeout(timer.hoverLimit);
        timer.hoverLimit = null;
    }
    if (timer.pauses.size === 0 && !timer.handle) {
        timer.deadline = performance.now() + timer.remaining;
        timer.handle = setTimeout(() => removeToast(id), timer.remaining);
    }
}

function clearTimer(id: string) {
    const timer = timerMap.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    if (timer?.hoverLimit) clearTimeout(timer.hoverLimit);
    timerMap.delete(id);
}

/** 窗口失焦或鼠标离开页面时，解除所有卡片的暂停 */
function resumeAll(reasons: PauseReason[]) {
    for (const id of [...timerMap.keys()]) {
        for (const reason of reasons) resumeTimer(id, reason);
    }
}

function announce(item: ToastItem) {
    const announcement: Announcement = {
        id: item.id,
        text: item.description ? `${item.title}。${item.description}` : item.title,
        assertive: item.type === 'error',
    };
    store.set(announcementAtom, (prev) => [...prev, announcement]);
    setTimeout(() => {
        store.set(announcementAtom, (prev) => prev.filter((a) => a.id !== announcement.id));
    }, ANNOUNCEMENT_TTL);
}

function removeToast(id: string) {
    clearTimer(id);
    store.set(toastQueueAtom, (prev) => prev.filter((t) => t.id !== id));
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * 显示一条 toast 通知。与正在显示的某条内容和选项完全相同（且都没有操作回调）时，不再重复显示，只重新计时。
 *
 * @example
 * ```ts
 * showToast("已添加到歌单", { type: "success" });
 * showToast("连接失败", { type: "error", description: "请检查网络" });
 * showToast("已删除", { actionLabel: "撤销", onAction: () => undo() });
 * ```
 */
export function showToast(title: string, options?: ToastOptions): void {
    const type = options?.type ?? 'info';
    const hasAction = Boolean(options?.actionLabel && options?.onAction);
    const item: ToastItem = {
        id: nanoid(8),
        title,
        type,
        description: options?.description,
        duration: options?.duration ?? defaultDuration(type, hasAction),
        closable: options?.closable ?? true,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
    };

    const same = store
        .get(toastQueueAtom)
        .find(
            (t) =>
                t.title === item.title &&
                t.type === item.type &&
                t.description === item.description &&
                t.actionLabel === item.actionLabel &&
                t.duration === item.duration &&
                t.closable === item.closable &&
                !t.onAction &&
                !item.onAction,
        );
    if (same) {
        if (same.duration > 0) startTimer(same.id, same.duration);
        announce(item);
        return;
    }

    store.set(toastQueueAtom, (prev) => {
        const next = [...prev, item];
        // 超限：移除最早的，直到 <= MAX_VISIBLE
        while (next.length > MAX_VISIBLE) {
            clearTimer(next.shift()!.id);
        }
        return next;
    });

    if (item.duration > 0) {
        startTimer(item.id, item.duration);
    }
    announce(item);
}

// ── 系统「减少动态效果」设置：运行中切换也会生效 ──

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function subscribeReducedMotion(onChange: () => void) {
    reducedMotionQuery.addEventListener('change', onChange);
    return () => reducedMotionQuery.removeEventListener('change', onChange);
}

function getReducedMotion() {
    return reducedMotionQuery.matches;
}

// ────────────────────────────────────────────────────────────────────────────
// Toast Card
// ────────────────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, LucideIcon> = {
    info: Info,
    success: CircleCheck,
    warn: AlertTriangle,
    error: CircleX,
};

const ToastCard = forwardRef<HTMLDivElement, { toast: ToastItem; reduceMotion: boolean }>(
    function ToastCard({ toast, reduceMotion }, ref) {
        const { t } = useTranslation();
        const Icon = ICONS[toast.type];
        const offset = reduceMotion ? 0 : 16;
        // 已移出队列、正在退场的卡片不再响应操作
        const isPresent = useIsPresent();

        const handleAction = () => {
            if (!store.get(toastQueueAtom).some((item) => item.id === toast.id)) return;
            toast.onAction?.();
            removeToast(toast.id);
        };

        const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                resumeTimer(toast.id, 'focus');
            }
        };

        return (
            <motion.div
                ref={ref}
                layout={reduceMotion ? false : 'position'}
                initial={{ opacity: 0, x: offset }}
                animate={{
                    opacity: 1,
                    x: 0,
                    transition: { duration: motionDuration.normal, ease: easing.popup },
                }}
                exit={{
                    opacity: 0,
                    x: offset,
                    transition: { duration: motionDuration.fast, ease: easing.accelerate },
                }}
                transition={{ duration: motionDuration.normal, ease: easing.standard }}
                className={cn('toast', `toast--${toast.type}`)}
                inert={!isPresent}
                onMouseEnter={() => pauseTimer(toast.id, 'hover')}
                onMouseLeave={() => resumeTimer(toast.id, 'hover')}
                onFocus={() => pauseTimer(toast.id, 'focus')}
                onBlur={handleBlur}
            >
                <div className="toast__body">
                    {/* 图标 */}
                    <div className="toast__icon-wrapper" aria-hidden="true">
                        <Icon className="toast__icon" />
                    </div>

                    {/* 内容 */}
                    <div className="toast__content">
                        <div className="toast__title">{toast.title}</div>
                        {toast.description && (
                            <div className="toast__desc">{toast.description}</div>
                        )}
                    </div>

                    {/* 操作 */}
                    {toast.actionLabel && toast.onAction && (
                        <button type="button" className="toast__action" onClick={handleAction}>
                            {toast.actionLabel}
                        </button>
                    )}

                    {/* 关闭 */}
                    {toast.closable && (
                        <button
                            type="button"
                            className="toast__close"
                            onClick={() => removeToast(toast.id)}
                            aria-label={t('common.close')}
                        >
                            <X className="toast__close-icon" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </motion.div>
        );
    },
);

// ────────────────────────────────────────────────────────────────────────────
// Toast Container （挂载在 App 顶层）
// ────────────────────────────────────────────────────────────────────────────

/**
 * ToastContainer — 模式组件
 *
 * Toast 通知容器，固定在窗口右上角 TopBar 下方，由 showToast() 命令式驱动。
 * 卡片为随主题变化的中性浮层，状态只体现在图标颜色上；样式见 index.scss。
 */
export function ToastContainer() {
    const toasts = useAtomValue(toastQueueAtom);
    const announcements = useAtomValue(announcementAtom);
    const reduceMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion);

    // 主题切换后重新检查卡片配色的对比度
    const themePack = useCurrentThemePack();
    const probeRef = useRef<HTMLDivElement>(null);
    const [scrim, setScrim] = useState<ToastScrim>({ amount: 0, anti: 'black' });
    useLayoutEffect(() => {
        if (!probeRef.current) return;
        const next = measureToastScrim(probeRef.current);
        setScrim((prev) => (prev.amount === next.amount && prev.anti === next.anti ? prev : next));
    }, [themePack]);
    const containerStyle =
        scrim.amount > 0
            ? ({
                  '--_toast-scrim': `${Math.round(scrim.amount * 100)}%`,
                  '--_toast-anti': scrim.anti,
              } as CSSProperties)
            : undefined;

    useEffect(() => {
        const onBlur = () => resumeAll(['hover', 'focus']);
        const onLeave = () => resumeAll(['hover']);
        window.addEventListener('blur', onBlur);
        document.documentElement.addEventListener('mouseleave', onLeave);
        return () => {
            window.removeEventListener('blur', onBlur);
            document.documentElement.removeEventListener('mouseleave', onLeave);
        };
    }, []);

    return (
        <div className="toast-container" style={containerStyle}>
            {/* 对比度探针：不可见，只用于读取当前主题下的实际颜色 */}
            <div ref={probeRef} className="toast-probe" aria-hidden="true">
                <span className="toast-probe__base" />
                {(Object.keys(ICONS) as ToastType[]).map((type) => (
                    <div key={type} className={cn('toast', `toast--${type}`)}>
                        <span className="toast__title" />
                        <span className="toast__desc" />
                        <span className="toast__icon" />
                    </div>
                ))}
            </div>
            {/* 常驻的读屏播报区：内容追加时才会被朗读 */}
            {(['polite', 'assertive'] as const).map((level) => (
                <div
                    key={level}
                    className="toast-announcer"
                    aria-live={level}
                    aria-relevant="additions"
                >
                    {announcements
                        .filter((a) => a.assertive === (level === 'assertive'))
                        .map((a) => (
                            <span key={a.id}>{a.text}</span>
                        ))}
                </div>
            ))}
            <AnimatePresence mode="popLayout" initial={false}>
                {toasts.map((toast) => (
                    <ToastCard key={toast.id} toast={toast} reduceMotion={reduceMotion} />
                ))}
            </AnimatePresence>
        </div>
    );
}
