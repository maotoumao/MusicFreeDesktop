import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ContextMenuItemDef {
    /** 唯一标识 */
    id: string;
    /** 菜单项标签 */
    label: string;
    /** 前置图标（ReactNode，如 <SvgIcon name="xxx" /> 或 lucide icon） */
    icon?: ReactNode;
    /** 是否为危险操作项（hover 时红色） */
    danger?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 点击回调 */
    onClick?: () => void;
}

export interface ContextMenuSeparator {
    type: 'separator';
}

export type ContextMenuEntry = ContextMenuItemDef | ContextMenuSeparator;

export interface ContextMenuPosition {
    x: number;
    y: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

/** 菜单项 */
function ContextMenuItem({
    icon,
    label,
    danger = false,
    disabled = false,
    onClick,
}: Omit<ContextMenuItemDef, 'id'>) {
    const classNames = cn(
        'context-menu__item',
        danger && 'context-menu__item--danger',
        disabled && 'is-disabled',
    );

    return (
        <button type="button" className={classNames} disabled={disabled} onClick={onClick}>
            {icon && <span className="context-menu__item-icon">{icon}</span>}
            <span className="context-menu__item-label">{label}</span>
        </button>
    );
}

/** 分隔线 */
function ContextMenuDivider() {
    return <div className="context-menu__divider" />;
}

// ────────────────────────────────────────────────────────────────────────────
// ContextMenu 主组件
// ────────────────────────────────────────────────────────────────────────────

export interface ContextMenuProps {
    /** 是否可见 */
    visible: boolean;
    /** 菜单位置 */
    position: ContextMenuPosition;
    /**
     * 菜单内容 — 两种模式：
     *   1. 传入 items 数组（标准模板）
     *   2. 传入 children（完全自定义）
     * 同时传入时 children 优先。
     */
    items?: ContextMenuEntry[];
    /** 完全自定义的菜单内容 */
    children?: ReactNode;
    /** 菜单关闭回调 */
    onClose?: () => void;
    /** 额外 className */
    className?: string;
}

/**
 * ContextMenu — 模式组件
 *
 * 设计稿还原：
 *   - 180px 宽，暗色玻璃态背景（bg-popover + blur）
 *   - 圆角 8px，边框 border-default，阴影 shadow-lg
 *   - 菜单项 hover：品牌色填充 + 深色文字
 *   - 危险项 hover：danger 背景 + 红色文字
 *   - 支持边缘检测自动调整位置
 *
 * 使用方式：
 *   1. 标准模板 — 传 items 数组即可
 *   2. 自定义内容 — 传 children（可使用 ContextMenu.Item / ContextMenu.Divider）
 */
function ContextMenu({ visible, position, items, children, onClose, className }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = useState(position);

    // ── 位置调整（边缘检测） ──
    useEffect(() => {
        if (!visible) return;

        let x = position.x;
        let y = position.y;

        // 延迟一帧读取实际尺寸
        requestAnimationFrame(() => {
            if (!menuRef.current) return;
            const rect = menuRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            if (x + rect.width > vw) x = vw - rect.width - 4;
            if (y + rect.height > vh) y = vh - rect.height - 4;
            if (x < 4) x = 4;
            if (y < 4) y = 4;

            setAdjustedPos({ x, y });
        });
    }, [visible, position]);

    // ── 点击外部 / 滚动 → 关闭 ──
    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e: globalThis.MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose?.();
            }
        };

        const handleScroll = () => {
            onClose?.();
        };

        // 使用 capture 确保在目标元素的 click 之前触发
        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [visible, onClose]);

    // ── ESC 关闭 ──
    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose?.();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [visible, onClose]);

    if (!visible) return null;

    const handleItemClick = (item: ContextMenuItemDef) => {
        if (item.disabled) return;
        item.onClick?.();
        onClose?.();
    };

    const renderContent = () => {
        if (children) return children;
        if (!items?.length) return null;

        return items.map((entry, index) => {
            if ('type' in entry && entry.type === 'separator') {
                return <ContextMenuDivider key={`sep-${index}`} />;
            }

            const item = entry as ContextMenuItemDef;
            return (
                <ContextMenuItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    danger={item.danger}
                    disabled={item.disabled}
                    onClick={() => handleItemClick(item)}
                />
            );
        });
    };

    return (
        <div
            ref={menuRef}
            className={cn('context-menu', className)}
            style={{ left: adjustedPos.x, top: adjustedPos.y }}
            role="menu"
        >
            {renderContent()}
        </div>
    );
}

// ── 复合组件导出 ──
ContextMenu.Item = ContextMenuItem;
ContextMenu.Divider = ContextMenuDivider;

export { ContextMenu, ContextMenuItem, ContextMenuDivider };
