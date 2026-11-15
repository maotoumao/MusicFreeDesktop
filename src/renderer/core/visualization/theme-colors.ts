/** 主窗口读不到主题色时的兜底配色（与 WMP Metal 主题一致） */
export const defaultThemeColors: IVisualization.IThemeColors = {
    primary: "#f0a020",
    text: "#ffffff",
    background: "#232c36",
};

/**
 * 从 CSS 变量原始值里解析主题色，缺失或空白则回落到默认色。
 */
export function parseThemeColors(
    raw: Record<string, string>,
): IVisualization.IThemeColors {
    const pick = (key: string, fallback: string): string => {
        const value = raw?.[key];
        if (typeof value !== "string") {
            return fallback;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : fallback;
    };

    return {
        primary: pick("--primaryColor", defaultThemeColors.primary),
        text: pick("--textColor", defaultThemeColors.text),
        background: pick("--backgroundColor", defaultThemeColors.background),
    };
}

/** 从当前生效的 CSS 变量里读主题色 */
export function readThemeColors(): IVisualization.IThemeColors {
    if (typeof document === "undefined") {
        return defaultThemeColors;
    }
    const style = getComputedStyle(document.documentElement);
    return parseThemeColors({
        "--primaryColor": style.getPropertyValue("--primaryColor"),
        "--textColor": style.getPropertyValue("--textColor"),
        "--backgroundColor": style.getPropertyValue("--backgroundColor"),
    });
}

/**
 * 监听主题变化，变化时回调新的配色。返回一个取消监听的函数。
 *
 * 主题包切换时，preload 会重写 `<style id="themepack-node">` 的 innerHTML，
 * 用 MutationObserver 感知这个写入即可；app 自带的 `:root` 变量常驻，
 * 重读一次拿到的就是最终生效值（主题包用 `html:root` 提高特异性，
 * getComputedStyle 取到的正是它）。
 */
export function observeThemeChanges(
    onChange: (colors: IVisualization.IThemeColors) => void,
): () => void {
    const notify = () => {
        onChange(readThemeColors());
    };

    // 先同步一次
    notify();

    if (typeof document === "undefined") {
        return () => undefined;
    }

    const node = document.querySelector("#themepack-node");
    if (!node) {
        // 没有主题包节点（app 默认变量常驻），读一次就够
        return () => undefined;
    }

    const observer = new MutationObserver(notify);
    observer.observe(node, {
        childList: true,
        characterData: true,
        subtree: true,
    });

    return () => {
        observer.disconnect();
    };
}
