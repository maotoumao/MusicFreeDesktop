import { type HTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@common/cn';
import { RequestStatus } from '@common/constant';
import './index.scss';

export interface ListFooterProps extends HTMLAttributes<HTMLDivElement> {
    /** 当前请求状态 */
    status: RequestStatus;
    /** 错误态的重试回调 */
    onRetry?: () => void;
}

/**
 * ListFooter — 模式组件
 *
 * 列表底部指示器，用于滚动分页场景的加载中 / 加载失败 / 没有更多。
 * 消费 RequestStatus 枚举：Pending → loading, Error → 重试, Done → 没有更多了, Idle → null。
 *
 * 设计稿还原（像素级）：
 *   loading: Loader2 16×16 旋转 + "加载中…" 13px, color white/25, gap-10, py-32
 *   error:   "加载失败" 13px white/30 + "·" white/10 + "点击重试" 13px primary/80, gap-12, py-24
 *   done:    水平线 h-1px bg white/4 + "没有更多了" 12px white/15 + 水平线, gap-16, py-32
 */
export function ListFooter({ status, onRetry, className, ...rest }: ListFooterProps) {
    if (status === RequestStatus.Idle) {
        return null;
    }

    if (status === RequestStatus.Pending) {
        return (
            <div className={cn('list-footer', 'list-footer--loading', className)} {...rest}>
                <Loader2 className="list-footer__spinner" aria-hidden="true" />
                <span className="list-footer__text">加载中…</span>
            </div>
        );
    }

    if (status === RequestStatus.Error) {
        return (
            <div className={cn('list-footer', 'list-footer--error', className)} {...rest}>
                <span className="list-footer__text">加载失败</span>
                <span className="list-footer__dot" aria-hidden="true">
                    ·
                </span>
                <button type="button" className="list-footer__retry" onClick={onRetry}>
                    点击重试
                </button>
            </div>
        );
    }

    // Done
    return (
        <div className={cn('list-footer', 'list-footer--done', className)} {...rest}>
            <div className="list-footer__line" aria-hidden="true" />
            <span className="list-footer__text">没有更多了</span>
            <div className="list-footer__line" aria-hidden="true" />
        </div>
    );
}

export default ListFooter;
