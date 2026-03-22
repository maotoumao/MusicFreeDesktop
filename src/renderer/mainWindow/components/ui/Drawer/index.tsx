import { type ReactNode, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@common/cn';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface DrawerProps {
    /** 是否打开 */
    open: boolean;
    /** 请求关闭 */
    onClose: () => void;
    /** 抽屉标题 */
    title?: ReactNode;
    /** 是否显示关闭按钮 @default true */
    closable?: boolean;
    /** 是否点击遮罩关闭 @default true */
    closeOnBackdrop?: boolean;
    /** 是否按 Escape 键关闭 @default true */
    closeOnEscape?: boolean;
    /** 是否显示遮罩 @default true */
    showOverlay?: boolean;
    /** 是否点击抽屉外部区域关闭 @default false */
    closeOnClickOutside?: boolean;
    /** 抽屉内容 */
    children?: ReactNode;
    /** 额外 className */
    className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Animation
// ────────────────────────────────────────────────────────────────────────────

const drawerVariants = {
    closed: { x: '100%' },
    open: { x: 0 },
};

const transition = {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1] as const,
};

// ────────────────────────────────────────────────────────────────────────────
// Drawer Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Drawer — 模式组件
 *
 * 从右侧滑入的面板，常用于播放队列。
 * 通过 createPortal 渲染到 body，避免被父级 overflow 裁切。
 *
 * 设计稿还原（像素级）：
 *   位置: fixed, top 0, right 0, bottom 0
 *   宽度: --size-drawer-w (340px)
 *   背景: --color-bg-drawer rgba(24,24,27,0.95)
 *   模糊: backdrop-filter blur(--blur-lg)
 *   边框: 左边 1px --color-border-default
 *   圆角: 左上+左下 --radius-modal(20px)
 *   阴影: --shadow-left
 *   层级: --z-drawer
 *   滑入: transform 300ms ease-standard
 */
export default function Drawer({
    open,
    onClose,
    title,
    closable = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    showOverlay = true,
    closeOnClickOutside = false,
    children,
    className,
}: DrawerProps) {
    const { t } = useTranslation();
    const drawerRef = useRef<HTMLDivElement>(null);

    // ── Click outside ──
    useEffect(() => {
        if (!open || !closeOnClickOutside) return;
        const handler = (e: globalThis.MouseEvent) => {
            const target = e.target as HTMLElement;
            // 忽略 Drawer 内部点击
            if (drawerRef.current?.contains(target)) return;
            // 忽略 portal 浮层（ContextMenu / Modal / Toast）内的点击
            if (
                target.closest(
                    '[role="menu"], [role="dialog"], [role="alert"], [data-click-outside-ignore]',
                )
            )
                return;
            onClose();
        };
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [open, closeOnClickOutside, onClose]);

    // ── Escape ──
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

    // ── Overlay click ──
    const handleOverlayClick = useCallback(
        (e: MouseEvent) => {
            if (closeOnBackdrop && e.target === e.currentTarget) {
                onClose();
            }
        },
        [closeOnBackdrop, onClose],
    );

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    {showOverlay && (
                        <motion.div
                            className="drawer-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={transition}
                            onClick={handleOverlayClick}
                        />
                    )}
                    <motion.aside
                        ref={drawerRef}
                        className={cn('drawer', className)}
                        role="dialog"
                        aria-modal="true"
                        variants={drawerVariants}
                        initial="closed"
                        animate="open"
                        exit="closed"
                        transition={transition}
                    >
                        {/* ── Header ── */}
                        {(title || closable) && (
                            <div className="drawer__header">
                                {title && <div className="drawer__title">{title}</div>}
                                {closable && (
                                    <button
                                        type="button"
                                        className="drawer__close"
                                        onClick={onClose}
                                        aria-label={t('common.close')}
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ── Body ── */}
                        <div className="drawer__body">{children}</div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}

export { Drawer };
