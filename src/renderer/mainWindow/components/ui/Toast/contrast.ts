/**
 * Toast 对比度保护
 *
 * 卡片底色取自主题的浮层色。部分主题包的浮层色与文字、状态色过于接近，
 * 这里读取实际生效的颜色，求出把底色往文字反色（黑或白）方向压多少才能达标：
 * 标题 ≥ 4.5:1，说明文字与图标 ≥ 3:1；最多压 60%，达不到时取 60%。
 * 已达标的主题不做任何改动。
 */

type RGBA = [r: number, g: number, b: number, a: number];

const BLACK: RGBA = [0, 0, 0, 1];
const WHITE: RGBA = [255, 255, 255, 1];

const TITLE_MIN = 4.5;
const SECONDARY_MIN = 3;
const SCRIM_STEP = 0.05;
const SCRIM_MAX = 0.6;

export interface ToastScrim {
    /** 底色向 anti 混合的比例，0–SCRIM_MAX */
    amount: number;
    anti: 'black' | 'white';
}

let ctx: CanvasRenderingContext2D | null = null;

/** 把任意 CSS 颜色转成 sRGB 的 RGBA（经 canvas 归一化，支持 color()、oklch() 等写法） */
function toRGBA(color: string): RGBA {
    if (!ctx) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (!ctx) return BLACK;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
}

function over(fg: RGBA, bg: RGBA): RGBA {
    const a = fg[3];
    return [
        fg[0] * a + bg[0] * (1 - a),
        fg[1] * a + bg[1] * (1 - a),
        fg[2] * a + bg[2] * (1 - a),
        1,
    ];
}

/** 与 CSS color-mix(in srgb, base, anti p) 相同的预乘混合 */
function mixToward(base: RGBA, anti: RGBA, p: number): RGBA {
    const a = base[3] * (1 - p) + anti[3] * p;
    if (a === 0) return [0, 0, 0, 0];
    const ch = (i: number) => (base[i] * base[3] * (1 - p) + anti[i] * anti[3] * p) / a;
    return [ch(0), ch(1), ch(2), a];
}

function luminance([r, g, b]: RGBA): number {
    const lin = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGBA, b: RGBA): number {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * 从探针元素读取当前主题下的实际颜色并计算所需的压暗/提亮比例。
 * 探针结构见 ToastContainer：.toast-probe__base 的 color 为窗口底色，
 * 每个 .toast 探针内含 .toast__title / .toast__desc / .toast__icon。
 */
export function measureToastScrim(probe: HTMLElement): ToastScrim {
    const read = (el: Element | null, prop: 'color' | 'backgroundColor') =>
        toRGBA(el ? getComputedStyle(el)[prop] : 'transparent');

    const base = over(read(probe.querySelector('.toast-probe__base'), 'color'), BLACK);
    const cards = Array.from(probe.querySelectorAll<HTMLElement>('.toast'));
    if (cards.length === 0) return { amount: 0, anti: 'black' };

    const surface = read(cards[0], 'backgroundColor');
    const title = read(cards[0].querySelector('.toast__title'), 'color');
    const desc = read(cards[0].querySelector('.toast__desc'), 'color');
    const icons = cards.map((card) => read(card.querySelector('.toast__icon'), 'color'));

    const opaqueTitle = over(title, over(surface, base));
    const antiColor = contrast(opaqueTitle, BLACK) >= contrast(opaqueTitle, WHITE) ? BLACK : WHITE;
    const anti = antiColor === BLACK ? 'black' : 'white';

    for (let p = 0; p <= SCRIM_MAX + 1e-9; p += SCRIM_STEP) {
        const bg = over(mixToward(surface, antiColor, p), base);
        const ok =
            contrast(over(title, bg), bg) >= TITLE_MIN &&
            contrast(over(desc, bg), bg) >= SECONDARY_MIN &&
            icons.every((icon) => contrast(over(icon, bg), bg) >= SECONDARY_MIN);
        if (ok) return { amount: Math.round(p * 100) / 100, anti };
    }
    return { amount: SCRIM_MAX, anti };
}
