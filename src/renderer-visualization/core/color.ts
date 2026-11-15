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

/** #rgb / #rrggbb → [r, g, b]；解析不了返回 null */
function hexToRgb(color: string): [number, number, number] | null {
    const trimmed = (color ?? "").trim();
    if (!trimmed.startsWith("#")) {
        return null;
    }
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
        hex = hex
            .split("")
            .map((c) => c + c)
            .join("");
    }
    if (hex.length !== 6) {
        return null;
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
        return null;
    }
    return [r, g, b];
}

/**
 * 把颜色转成色相偏移后的版本。
 *
 * 粒子、烟花这类效果需要「同一个主色的不同变体」，
 * 直接用主色会显得单调；转成 HSL 偏移色相后既有层次又不会跑偏主题色。
 * 解析不了的颜色原样返回。
 */
export function shiftHue(color: string, degrees: number): string {
    const rgb = hexToRgb(color);
    if (!rgb) {
        return color;
    }
    const [r, g, b] = rgb.map((v) => v / 255);

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;

    let hue = 0;
    let saturation = 0;
    if (delta !== 0) {
        saturation = delta / (1 - Math.abs(2 * lightness - 1));
        if (max === r) {
            hue = 60 * (((g - b) / delta) % 6);
        } else if (max === g) {
            hue = 60 * ((b - r) / delta + 2);
        } else {
            hue = 60 * ((r - g) / delta + 4);
        }
    }
    if (hue < 0) {
        hue += 360;
    }

    const shifted = (hue + degrees + 360) % 360;
    return `hsl(${shifted.toFixed(1)}, ${(saturation * 100).toFixed(
        1,
    )}%, ${(lightness * 100).toFixed(1)}%)`;
}
