/**
 * cn — 轻量级 className 拼接工具
 *
 * 用于替代各组件中重复的 `[...].filter(Boolean).join(' ')` 模式。
 *
 * @example
 *   cn('btn', `btn--${variant}`, loading && 'btn--loading', className)
 *   // => 'btn btn--primary btn--loading my-class'
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
}
