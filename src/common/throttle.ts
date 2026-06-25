export interface IThrottledFunction<T extends (...args: any[]) => void> {
    (...args: Parameters<T>): void;
    /** 取消待执行的尾部调用 */
    cancel(): void;
}

/**
 * 简易节流函数：在 ms 毫秒内最多执行一次，尾部调用保证最终状态被处理。
 * 返回的函数附带 cancel() 方法，可取消待执行的尾部定时器。
 */
export default function throttle<T extends (...args: any[]) => void>(
    fn: T,
    ms: number,
): IThrottledFunction<T> {
    let lastTime = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const throttled = ((...args: any[]) => {
        const now = Date.now();

        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        if (now - lastTime >= ms) {
            lastTime = now;
            fn(...args);
        } else {
            // 尾部调用：确保最后一次触发的值不丢失
            timer = setTimeout(
                () => {
                    lastTime = Date.now();
                    timer = null;
                    fn(...args);
                },
                ms - (now - lastTime),
            );
        }
    }) as IThrottledFunction<T>;

    throttled.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    return throttled;
}
