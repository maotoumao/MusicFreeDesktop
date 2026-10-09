import { useCallback, type AnchorHTMLAttributes, type ReactNode, type MouseEvent } from 'react';
import { cn } from '@common/cn';
import systemUtil from '@infra/systemUtil/renderer';
import './index.scss';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface AProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
    /** 链接地址（点击后通过系统默认浏览器打开） */
    href: string;
    /** 显示内容 */
    children: ReactNode;
    /** 自定义打开行为（默认 systemUtil.openExternal） */
    onNavigate?: (url: string) => void;
}

/** 默认导航行为：通过 Electron shell 在系统默认浏览器中打开 */
const defaultNavigate = (url: string) => systemUtil.openExternal(url);

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

/**
 * A — 原子组件
 *
 * 外部链接锚点，点击后通过 Electron shell 在系统默认浏览器中打开。
 * 替代原生 `<a>` 标签，避免 Electron 内导航。
 *
 * 样式与原生 `<a>` 一致，仅提供下划线 + hover 规则。
 * font-size、color 等由父容器或 className 控制。
 */
export function A({ href, children, onNavigate = defaultNavigate, className, ...rest }: AProps) {
    const handleClick = useCallback(
        (e: MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            onNavigate(href);
        },
        [href, onNavigate],
    );

    return (
        <a
            {...rest}
            href={href}
            className={cn('ext-link', className)}
            onClick={handleClick}
            rel="noopener noreferrer"
        >
            {children}
        </a>
    );
}

export default A;
