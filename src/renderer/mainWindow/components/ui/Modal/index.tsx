import { type ReactNode, type MouseEvent, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@common/cn';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
    /** 是否打开 */
    open: boolean;
    /** 请求关闭 */
    onClose: () => void;
    /** 标题 */
    title?: ReactNode;
    /** 副标题 / 说明文案 */
    subtitle?: ReactNode;
    /** 面板尺寸 @default "md" */
    size?: ModalSize;
    /** 是否点击遮罩关闭 @default true */
    closeOnBackdrop?: boolean;
    /** 是否按 Escape 键关闭 @default true */
    closeOnEscape?: boolean;
    /** 是否显示关闭按钮 @default true */
    closable?: boolean;
    /** 主体内容 */
    children?: ReactNode;
    /** 底部操作区 */
    footer?: ReactNode;
}

// ────────────────────────────────────────────────────────────────────────────
// Animation variants
// ────────────────────────────────────────────────────────────────────────────

const panelVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 12 },
    visible: { opacity: 1, scale: 1, y: 0 },
};

const transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

// ────────────────────────────────────────────────────────────────────────────
// Modal Shell Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Modal — 对话框 UI 外壳
 *
 * 纯展示组件，仅包含遮罩 + 面板 + header/body/footer 布局。
 * 由 `modalManager` 命令式驱动，或直接在页面中声明式使用。
 *
 * 设计稿还原：
 *   遮罩: bg-overlay rgba(0,0,0,0.6), blur-overlay 12px, z-overlay 1000
 *   面板: bg-modal rgb(30,30,30), radius-modal 20px, shadow-xl, z-modal 1010
 *   尺寸: sm 400px, md 520px, lg 600px
 *   头部: px 24, py 16, 关闭按钮 28×28 圆形
 *   主体: px 24, py 20
 *   底部: px 24, py 16, border-top
 */
export default function Modal({
    open,
    onClose,
    title,
    subtitle,
    size = 'md',
    closeOnBackdrop = true,
    closeOnEscape = true,
    closable = true,
    children,
    footer,
}: ModalProps) {
    // ── Escape key ──
    useEffect(() => {
        if (!open || !closeOnEscape) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, closeOnEscape, onClose]);

    // ── Backdrop click ──
    const handleBackdropClick = useCallback(
        (e: MouseEvent) => {
            if (closeOnBackdrop && e.target === e.currentTarget) {
                onClose();
            }
        },
        [closeOnBackdrop, onClose],
    );

    const { t } = useTranslation();
    const hasHeader = title || subtitle || closable;

    return createPortal(
        <>
            {/* Backdrop — 纯 CSS，不使用 framer-motion，避免合成层破坏 backdrop-filter */}
            {open && <div className="modal-backdrop" onClick={handleBackdropClick} />}

            {/* Panel + centering wrapper */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="modal-centering"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={transition}
                        onClick={handleBackdropClick}
                    >
                        <motion.div
                            className={cn('modal', `modal--${size}`)}
                            role="dialog"
                            aria-modal="true"
                            variants={panelVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            transition={transition}
                        >
                            {/* ── Header ── */}
                            {hasHeader && (
                                <div className="modal__header">
                                    <div className="modal__titles">
                                        {title && <div className="modal__title">{title}</div>}
                                        {subtitle && (
                                            <div className="modal__subtitle">{subtitle}</div>
                                        )}
                                    </div>
                                    {closable && (
                                        <button
                                            type="button"
                                            className="modal__close"
                                            onClick={onClose}
                                            aria-label={t('common.close')}
                                        >
                                            <X className="modal__close-icon" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* ── Body ── */}
                            {children && <div className="modal__body">{children}</div>}

                            {/* ── Footer ── */}
                            {footer && <div className="modal__footer">{footer}</div>}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>,
        document.body,
    );
}
