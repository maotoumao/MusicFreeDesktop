import type { IEffectSize, IVisualizationEffect } from "./types.ts";

/**
 * 引擎的外部依赖。
 *
 * 引擎不直接依赖 message-bus / AppConfig——由页面把这些「怎么拿」
 * 的函数传进来，引擎只管「怎么画」。这样引擎可以在没有 DOM 的
 * 环境里被测试。
 */
export interface IEngineOptions {
    /** 当前模式：效果 id，或 "random" 表示每首歌随机轮换 */
    getMode: () => string;
    /** 所有可用效果的 id */
    getAllIds: () => string[];
    /** 取当前音频帧 */
    getFrame: () => IVisualization.IAudioFrame;
    /** 取当前主题配色 */
    getColors: () => IVisualization.IThemeColors;
    /** 效果工厂表 */
    registry: Record<string, () => IVisualizationEffect>;
}

/**
 * 按设备像素比调整画布尺寸。
 *
 * 不做这一步，在高分屏上画面会糊。
 */
export function fitCanvas(
    canvas: HTMLCanvasElement,
    cssWidth: number,
    cssHeight: number,
): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}

/**
 * 算出下一个该用哪个效果。
 *
 * - 锁定模式（mode 不是 "random"）→ 就用它
 * - 随机模式 → 从列表里排除当前效果后随机取一个；
 *   只剩一个效果时只能用它自己
 */
export function pickNextEffectId(
    currentId: string,
    mode: string,
    allIds: string[],
): string {
    if (mode !== "random") {
        return mode;
    }
    if (allIds.length <= 1) {
        return allIds[0] ?? currentId;
    }
    const candidates = allIds.filter((id) => id !== currentId);
    if (candidates.length === 0) {
        return currentId;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

export interface IEngine {
    /** 切换到指定效果 */
    setEffect(id: string): void;
    /** 通知引擎「换歌了」——随机模式下会换一个效果 */
    notifyMusicChanged(): void;
    /** 暂停绘制（此音源无法可视化时用） */
    pause(): void;
    /** 恢复绘制 */
    resume(): void;
    /** 停止 rAF 循环 */
    destroy(): void;
}

/**
 * 创建效果引擎：负责 canvas 尺寸、rAF 循环、效果分发与切换。
 */
export function createEngine(
    canvas: HTMLCanvasElement,
    options: IEngineOptions,
): IEngine {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("无法获取 canvas 2d 上下文");
    }

    let size: IEffectSize = { width: canvas.clientWidth, height: canvas.clientHeight };
    let currentEffect: IVisualizationEffect | null = null;
    let currentEffectId = "";
    let rafId = 0;
    let destroyed = false;
    let paused = false;

    const applyCanvasSize = () => {
        size = {
            width: canvas.clientWidth || size.width,
            height: canvas.clientHeight || size.height,
        };
        fitCanvas(canvas, size.width, size.height);
        currentEffect?.init?.(ctx, size);
    };

    const setEffect = (id: string) => {
        if (id === currentEffectId && currentEffect) {
            return;
        }
        const factory = options.registry[id];
        if (!factory) {
            return;
        }
        currentEffect?.reset?.();
        currentEffect = factory();
        currentEffectId = id;
        currentEffect.init?.(ctx, size);
    };

    // 初始效果：锁定模式直接用它，随机模式先随便选一个
    {
        const mode = options.getMode();
        const allIds = options.getAllIds();
        const initialId =
            mode === "random"
                ? allIds[Math.floor(Math.random() * allIds.length)] ?? ""
                : mode;
        if (initialId) {
            setEffect(initialId);
        }
    }

    const render = () => {
        if (destroyed) {
            return;
        }
        rafId = requestAnimationFrame(render);

        // 窗口不可见时不画（省 CPU）
        if (typeof document !== "undefined" && document.hidden) {
            return;
        }
        // 此音源无法可视化时停画，让界面显示提示而不是一片死画面
        if (paused) {
            ctx.clearRect(0, 0, size.width, size.height);
            return;
        }

        ctx.clearRect(0, 0, size.width, size.height);
        currentEffect?.render(ctx, size, options.getFrame(), options.getColors());
    };
    rafId = requestAnimationFrame(render);

    const onResize = () => applyCanvasSize();
    window.addEventListener("resize", onResize);
    applyCanvasSize();

    return {
        setEffect,
        notifyMusicChanged() {
            const mode = options.getMode();
            if (mode !== "random") {
                setEffect(mode);
                return;
            }
            setEffect(
                pickNextEffectId(currentEffectId, mode, options.getAllIds()),
            );
        },
        pause() {
            paused = true;
        },
        resume() {
            paused = false;
        },
        destroy() {
            destroyed = true;
            cancelAnimationFrame(rafId);
            window.removeEventListener("resize", onResize);
            currentEffect?.reset?.();
            currentEffect = null;
        },
    };
}
