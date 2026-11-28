/**
 * 滑块键盘操作（WAI-ARIA slider 规范）：
 * ←/↓ 减一步，→/↑ 加一步，PageDown/PageUp 按大步长，Home/End 到两端。
 * 带修饰键时不处理，留给全局快捷键。
 */
export interface ISliderKeyOptions {
    min: number;
    max: number;
    step: number;
    largeStep: number;
}

/** 返回按键后的新值；不是滑块按键时返回 null */
export function getSliderKeyValue(
    event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
    value: number,
    { min, max, step, largeStep }: ISliderKeyOptions,
): number | null {
    if (event.ctrlKey || event.metaKey || event.altKey) return null;
    let next: number;
    switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
            next = value + step;
            break;
        case 'ArrowLeft':
        case 'ArrowDown':
            next = value - step;
            break;
        case 'PageUp':
            next = value + largeStep;
            break;
        case 'PageDown':
            next = value - largeStep;
            break;
        case 'Home':
            next = min;
            break;
        case 'End':
            next = max;
            break;
        default:
            return null;
    }
    return Math.max(min, Math.min(max, next));
}
