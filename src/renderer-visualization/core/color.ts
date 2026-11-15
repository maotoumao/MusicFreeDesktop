/**
 * 给 CSS 颜色加透明度。
 *
 * 效果需要由主题主色派生出「顶部亮、底部淡」的渐变，
 * canvas 的 fillStyle 不支持 color-mix()，只能自己转 rgba。
 * 解析不了的颜色（比如 rgb(1 2 3) 这种新语法）原样返回，
 * 由调用方配合 globalAlpha 处理。
 */
export function withAlpha(color: string, alpha: number): string {
    const trimmed = (color ?? "").trim();

    if (trimmed.startsWith("#")) {
        let hex = trimmed.slice(1);
        if (hex.length === 3) {
            hex = hex
                .split("")
                .map((c) => c + c)
                .join("");
        }
        if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            if (
                !Number.isNaN(r) &&
                !Number.isNaN(g) &&
                !Number.isNaN(b)
            ) {
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
        }
        return trimmed;
    }

    if (trimmed.startsWith("rgb(") && !trimmed.startsWith("rgba(")) {
        return trimmed.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
    }

    return trimmed;
}
