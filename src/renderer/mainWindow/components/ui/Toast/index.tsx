import { atom, getDefaultStore } from 'jotai';
import { useAtomValue } from 'jotai/react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle, Info, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { cn } from '@common/cn';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ToastType = 'info' | 'warn';

export interface ToastOptions {
    /** 变体 @default "info" */
    type?: ToastType;
    /** 辅助说明文案 */
    description?: string;
    /** 自动关闭延时（ms） @default 3200 */
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
const store = getDefaultStore();

/** 同时可见的最大 toast 数量 */
const MAX_VISIBLE = 5;

// ── 活跃计时器 ──
const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

function removeToast(id: string) {
    const timer = timerMap.get(id);
    if (timer) {
        clearTimeout(timer);
        timerMap.delete(id);
    }
    store.set(toastQueueAtom, (prev) => prev.filter((t) => t.id !== id));
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * 显示一条 toast 通知。
 *
 * @example
 * ```ts
 * showToast("操作成功");
 * showToast("连接失败", { type: "warn", description: "请检查网络" });
 * showToast("已复制", { actionLabel: "撤销", onAction: () => undo() });
 * ```
 */
export function showToast(title: string, options?: ToastOptions): void {
    const id = nanoid(8);
    const item: ToastItem = {
        id,
        title,
        type: options?.type ?? 'info',
        description: options?.description,
        duration: options?.duration ?? 3200,
        closable: options?.closable ?? true,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
    };

    store.set(toastQueueAtom, (prev) => {
        const next = [...prev, item];
        // 超限：移除最早的，直到 <= MAX_VISIBLE
        while (next.length > MAX_VISIBLE) {
            const oldest = next.shift()!;
            const timer = timerMap.get(oldest.id);
            if (timer) {
                clearTimeout(timer);
                timerMap.delete(oldest.id);
            }
        }
        return next;
    });

    // 自动关闭
    if (item.duration > 0) {
        const timer = setTimeout(() => {
            removeToast(id);
        }, item.duration);
        timerMap.set(id, timer);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Toast Card
// ────────────────────────────────────────────────────────────────────────────

function ToastCard({ toast }: { toast: ToastItem }) {
    const { t } = useTranslation();
    const Icon = toast.type === 'warn' ? AlertTriangle : Info;

    const handleAction = () => {
        toast.onAction?.();
        removeToast(toast.id);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={cn('toast', `toast--${toast.type}`)}
        >
            <div className="toast__body">
                {/* 图标 */}
                <div className="toast__icon-wrapper">
                    <Icon className="toast__icon" />
                </div>

                {/* 内容 */}
                <div className="toast__content">
                    <div className="toast__title">{toast.title}</div>
                    {toast.description && <div className="toast__desc">{toast.description}</div>}
                    {toast.actionLabel && toast.onAction && (
                        <button type="button" className="toast__action" onClick={handleAction}>
                            {toast.actionLabel}
                        </button>
                    )}
                </div>

                {/* 关闭 */}
                {toast.closable && (
                    <button
                        type="button"
                        className="toast__close"
                        onClick={() => removeToast(toast.id)}
                        aria-label={t('common.close')}
                    >
                        <X className="toast__close-icon" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Toast Container （挂载在 App 顶层）
// ────────────────────────────────────────────────────────────────────────────

/**
 * ToastContainer — 模式组件
 *
 * Toast 通知容器，固定在窗口右上角 TopBar 下方。
 * 由 showToast() 命令式驱动，通过 jotai atom 管理队列。
 *
 * 设计稿还原（像素级）：
 *   容器: fixed, top-72 right-24, z-toast(1100), flex-col, gap-12
 *   卡片: min-w-260 max-w-320, rounded-modal(20px), shadow-lg,
 *          backdrop-blur-xl(40px)
 *   Info: bg status-info-bg, border status-info-border
 *   Warn: bg status-warn-bg, border status-warn-border
 *   图标: 28×28 圆形, bg *-text/20
 *   标题: 13px, color text-primary, font-medium
 *   描述: 12px, color text-muted
 */
export function ToastContainer() {
    const toasts = useAtomValue(toastQueueAtom);

    return (
        <div className="toast-container">
            {toasts.map((toast) => (
                <ToastCard key={toast.id} toast={toast} />
            ))}
        </div>
    );
}
