/**
 * Toast 对比度保护
 *
 * 卡片底色取自主题的浮层色。部分主题包的浮层色与文字、状态色过于接近，
 * 这里读取实际生效的颜色，求出把底色往黑或白方向压多少才能达标：
 * 标题 ≥ 4.5:1，说明文字与图标 ≥ 3:1；比例从小到大尝试（最多 60%），同一比例先试标题的反色。
 * 都达不到时（如标题与说明一深一浅），说明文字与 info 图标改用标题色（70% 不透明度）再算一次，
 * 取两种方案中各项离要求最近的一档，可能是不调整。
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
    /** 说明文字与 info 图标改用 70% 不透明度的标题色 */
    secondaryFromTitle: boolean;
}

/** 标题色淡化后作为说明文字的后备色 */
const SECONDARY_FROM_TITLE_ALPHA = 0.7;

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

export interface ToastPalette {
    /** 窗口底色（不透明） */
    base: RGBA;
    /** 卡片底色 */
    surface: RGBA;
    title: RGBA;
    desc: RGBA;
    /** 依次为 info / success / warn / error 图标 */
    icons: RGBA[];
    /** info 图标与说明文字同色（都取主题的次要文字色） */
    infoUsesSecondary: boolean;
}

export function chooseScrim(palette: ToastPalette): ToastScrim {
    const plain = searchScrim(palette);
    if (plain.score >= 1) return { ...plain.scrim, secondaryFromTitle: false };

    const { title, icons, infoUsesSecondary } = palette;
    const fadedTitle: RGBA = [title[0], title[1], title[2], title[3] * SECONDARY_FROM_TITLE_ALPHA];
    const alt = searchScrim({
        ...palette,
        desc: fadedTitle,
        icons: infoUsesSecondary ? [fadedTitle, ...icons.slice(1)] : icons,
    });
    return alt.score > plain.score
        ? { ...alt.scrim, secondaryFromTitle: true }
        : { ...plain.scrim, secondaryFromTitle: false };
}

function searchScrim({ base, surface, title, desc, icons }: ToastPalette): {
    scrim: Omit<ToastScrim, 'secondaryFromTitle'>;
    score: number;
} {
    // 各项对比度与要求之比的最小值，≥ 1 即全部达标
    const score = (p: number, anti: RGBA) => {
        const bg = over(mixToward(surface, anti, p), base);
        return Math.min(
            contrast(over(title, bg), bg) / TITLE_MIN,
            contrast(over(desc, bg), bg) / SECONDARY_MIN,
            ...icons.map((icon) => contrast(over(icon, bg), bg) / SECONDARY_MIN),
        );
    };
    const name = (anti: RGBA) => (anti === BLACK ? 'black' : 'white') as ToastScrim['anti'];

    const opaqueTitle = over(title, over(surface, base));
    const preferred = contrast(opaqueTitle, BLACK) >= contrast(opaqueTitle, WHITE) ? BLACK : WHITE;
    const order = [preferred, preferred === BLACK ? WHITE : BLACK];

    let best: Omit<ToastScrim, 'secondaryFromTitle'> = { amount: 0, anti: name(preferred) };
    let bestScore = score(0, preferred);
    if (bestScore >= 1) return { scrim: best, score: bestScore };
    const steps = Math.round(SCRIM_MAX / SCRIM_STEP);
    for (let i = 1; i <= steps; i++) {
        const p = Math.round(i * SCRIM_STEP * 100) / 100;
        for (const anti of order) {
            const s = score(p, anti);
            if (s >= 1) return { scrim: { amount: p, anti: name(anti) }, score: s };
            if (s > bestScore) {
                bestScore = s;
                best = { amount: p, anti: name(anti) };
            }
        }
    }
    return { scrim: best, score: bestScore };
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
    if (cards.length === 0) return { amount: 0, anti: 'black', secondaryFromTitle: false };

    const desc = read(cards[0].querySelector('.toast__desc'), 'color');
    const icons = cards.map((card) => read(card.querySelector('.toast__icon'), 'color'));
    return chooseScrim({
        base,
        surface: read(cards[0], 'backgroundColor'),
        title: read(cards[0].querySelector('.toast__title'), 'color'),
        desc,
        icons,
        infoUsesSecondary: icons[0].every((v, i) => v === desc[i]),
    });
}
