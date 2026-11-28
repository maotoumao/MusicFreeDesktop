import { type HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Inbox, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@common/cn';
import { RequestStatus } from '@common/constant';
import './index.scss';

export interface StatusPlaceholderProps extends HTMLAttributes<HTMLDivElement> {
    /** 当前请求状态 */
    status: RequestStatus;
    /** 数据是否为空（仅在 status === Done 时生效，为 true 则展示空态） */
    isEmpty?: boolean;

    // ── Error 态自定义 ──
    /** 错误态图标 @default AlertCircle */
    errorIcon?: LucideIcon;
    /** 错误态主文案 @default "加载失败" */
    errorTitle?: string;
    /** 错误态辅助文案 */
    errorDescription?: string;
    /** 错误态重试回调（传入后自动展示"重试"按钮） */
    onRetry?: () => void;

    // ── Empty 态自定义 ──
    /** 空态图标 @default Inbox */
    emptyIcon?: LucideIcon;
    /** 空态主文案 @default "暂无内容" */
    emptyTitle?: string;
    /** 空态辅助文案 */
    emptyDescription?: string;
    /** 空态操作按钮文字 */
    emptyActionLabel?: string;
    /** 空态操作按钮回调 */
    onEmptyAction?: () => void;
}

/**
 * StatusPlaceholder — 模式组件
 *
 * 根据 RequestStatus 枚举驱动的全区域占位组件。
 * 覆盖 Pending（加载中）、Error（加载失败）、Done + isEmpty（空数据）三种状态。
 * Idle 和 Done（有数据）不渲染任何内容。
 *
 * 设计稿还原（像素级）：
 *   容器: flex-col, items-center, justify-center, py-80, min-h-240
 *   图标: 48×48, strokeWidth 1.5, color white/15, mb-20
 *   标题: 15px, color white/50, font-weight medium
 *   描述: 13px, color white/25, mt-6, max-w-300, text-center, leading-relaxed
 *   按钮: mt-20, px-16 py-6, rounded-lg(8px), 13px,
 *          text white/60 hover white, bg white/5 hover white/10,
 *          border white/6 hover white/10
 *   Pending: Loader2 36×36 旋转 + "加载中…" 13px white/25
 */
export function StatusPlaceholder({
    status,
    isEmpty = false,

    errorIcon: ErrorIcon = AlertCircle,
    errorTitle,
    errorDescription,
    onRetry,

    emptyIcon: EmptyIcon = Inbox,
    emptyTitle,
    emptyDescription,
    emptyActionLabel,
    onEmptyAction,

    className,
    ...rest
}: StatusPlaceholderProps) {
    const { t } = useTranslation();

    const resolvedErrorTitle = errorTitle ?? t('status.load_error');
    const resolvedEmptyTitle = emptyTitle ?? t('status.empty');

    // Idle — 不渲染
    if (status === RequestStatus.Idle) {
        return null;
    }

    // Done + 非空 — 不渲染（调用方展示实际内容）
    if (status === RequestStatus.Done && !isEmpty) {
        return null;
    }

    // ── Pending ──
    if (status === RequestStatus.Pending) {
        return (
            <div
                className={cn('status-placeholder', 'status-placeholder--pending', className)}
                {...rest}
            >
                <Loader2 className="status-placeholder__spinner" aria-hidden="true" />
                <div className="status-placeholder__title">{t('common.loading')}…</div>
            </div>
        );
    }

    // ── Error ──
    if (status === RequestStatus.Error) {
        return (
            <div
                className={cn('status-placeholder', 'status-placeholder--error', className)}
                {...rest}
            >
                <ErrorIcon
                    className="status-placeholder__icon"
                    strokeWidth={1.5}
                    aria-hidden="true"
                />
                <div className="status-placeholder__title">{resolvedErrorTitle}</div>
                {errorDescription && (
                    <div className="status-placeholder__desc">{errorDescription}</div>
                )}
                {onRetry && (
                    <button type="button" className="status-placeholder__action" onClick={onRetry}>
                        {t('common.retry')}
                    </button>
                )}
            </div>
        );
    }

    // ── Done + isEmpty ──
    return (
        <div className={cn('status-placeholder', 'status-placeholder--empty', className)} {...rest}>
            <EmptyIcon className="status-placeholder__icon" strokeWidth={1.5} aria-hidden="true" />
            <div className="status-placeholder__title">{resolvedEmptyTitle}</div>
            {emptyDescription && <div className="status-placeholder__desc">{emptyDescription}</div>}
            {emptyActionLabel && onEmptyAction && (
                <button
                    type="button"
                    className="status-placeholder__action"
                    onClick={onEmptyAction}
                >
                    {emptyActionLabel}
                </button>
            )}
        </div>
    );
}

export default StatusPlaceholder;
