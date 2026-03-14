import { useCallback, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '@common/cn';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface TabItem {
    /** 唯一标识 */
    key: string;
    /** 标签文本 */
    label: string;
    /** 前置图标 */
    icon?: ReactNode;
    /** 是否禁用 */
    disabled?: boolean;
}

export type TabBarMode = 'wrap' | 'scroll';

export interface TabBarProps {
    /** 标签列表 */
    items: TabItem[];
    /** 当前选中的 key */
    activeKey: string;
    /** 切换回调 */
    onChange?: (key: string) => void;
    /**
     * 模式：
     *   - `wrap`   — 换行模式，标签超出容器宽度时自动换行（默认）
     *   - `scroll` — 滚动模式，标签不换行，超出时水平滚动
     */
    mode?: TabBarMode;
    /** 额外 className */
    className?: string;
}

/**
 * TabBar — 组合组件
 *
 * 设计稿还原（像素级）：
 *   容器: flex, gap-24, border-bottom 1px border-subtle, pb-12
 *   Tab: flex items-center gap-8, text-sm(14px), pb-8, whitespace-nowrap
 *     默认: color text-secondary, hover → text-primary
 *     激活: color text-primary, font-weight-semibold
 *   指示器: absolute, top 动态计算 (跟随激活 tab 所在行), h-2px, bg fill-brand, rounded-full
 *           宽度跟随 tab
 *   图标: 16×16
 *
 * 支持两种模式：wrap（换行）和 scroll（水平滚动）。
 */
export function TabBar({ items, activeKey, onChange, mode = 'wrap', className }: TabBarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const activeTabRef = useRef<HTMLButtonElement>(null);
    const indicatorRef = useRef<HTMLSpanElement>(null);

    // ── 指示器位置更新 ──
    const updateIndicator = useCallback(() => {
        if (!containerRef.current || !activeTabRef.current || !indicatorRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const tabRect = activeTabRef.current.getBoundingClientRect();

        const left = tabRect.left - containerRect.left + containerRef.current.scrollLeft;
        const width = tabRect.width;
        // 指示器与 tab 底边的间距 (tab padding-bottom 8px 的中点偏下)
        const indicatorGap = 4;
        const top = tabRect.bottom - containerRect.top + indicatorGap;

        indicatorRef.current.style.left = `${left}px`;
        indicatorRef.current.style.width = `${width}px`;
        indicatorRef.current.style.top = `${top}px`;
    }, []);

    useEffect(() => {
        updateIndicator();
    }, [activeKey, items, updateIndicator]);

    // 容器尺寸变化时重新计算（覆盖 window resize、sidebar 切换等场景）
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(updateIndicator);
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [updateIndicator]);

    // scroll 模式下，滚动激活 tab 到可见区域（仅滚动自身容器，不冒泡到外层）
    useEffect(() => {
        if (mode !== 'scroll' || !activeTabRef.current || !containerRef.current) return;

        const container = containerRef.current;
        const tab = activeTabRef.current;
        const tabLeft = tab.offsetLeft;
        const tabRight = tabLeft + tab.offsetWidth;
        const scrollLeft = container.scrollLeft;
        const viewWidth = container.clientWidth;

        if (tabLeft < scrollLeft) {
            container.scrollTo({ left: tabLeft, behavior: 'smooth' });
        } else if (tabRight > scrollLeft + viewWidth) {
            container.scrollTo({ left: tabRight - viewWidth, behavior: 'smooth' });
        }
    }, [activeKey, mode]);

    const wrapperClassNames = cn('tab-bar', `tab-bar--${mode}`, className);

    return (
        <div ref={containerRef} className={wrapperClassNames}>
            <div className="tab-bar__list">
                {items.map((item) => {
                    const isActive = item.key === activeKey;
                    const tabClassNames = cn(
                        'tab-bar__tab',
                        isActive && 'is-active',
                        item.disabled && 'is-disabled',
                    );

                    return (
                        <button
                            key={item.key}
                            ref={isActive ? activeTabRef : undefined}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={tabClassNames}
                            disabled={item.disabled}
                            onClick={() => {
                                if (!item.disabled) onChange?.(item.key);
                            }}
                        >
                            {item.icon && <span className="tab-bar__tab-icon">{item.icon}</span>}
                            {item.label}
                        </button>
                    );
                })}
            </div>
            {/* 底部指示器 */}
            <span ref={indicatorRef} className="tab-bar__indicator" />
        </div>
    );
}

export default TabBar;
