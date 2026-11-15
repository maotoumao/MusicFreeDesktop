import type { IVisualizationEffect } from "../types.ts";
import { withAlpha } from "../color.ts";

/** 最多画多少根柱子 */
const MAX_BARS = 64;
/** 每根柱子至少占多宽（像素） */
const BAR_WIDTH_STEP = 6;

/**
 * 条形频谱 —— WMP「条形与波浪组」最经典的形态。
 *
 * 低频柱高、高频柱矮（真实频谱的能量分布就是这样），
 * 柱子有「上升快、回落慢」的包络，模拟频谱仪的余晖。
 */
export function createBarsEffect(): IVisualizationEffect {
    /** 柱高包络（0..1） */
    const heights = new Float32Array(MAX_BARS);
    let barCount = 0;

    return {
        id: "bars",
        nameKey: "settings.visualization.effect.bars",

        init(_ctx, size) {
            barCount = Math.min(
                MAX_BARS,
                Math.max(1, Math.floor(size.width / BAR_WIDTH_STEP)),
            );
            heights.fill(0);
        },

        render(ctx, size, frame, colors) {
            const n =
                barCount ||
                Math.min(
                    MAX_BARS,
                    Math.max(1, Math.floor(size.width / BAR_WIDTH_STEP)),
                );
            const source = frame.frequency;
            if (!source || source.length === 0) {
                return;
            }

            const slot = size.width / n;
            const barWidth = Math.max(2, slot * 0.72);

            for (let i = 0; i < n; i++) {
                // 从 512 个对数 bin 里按比例取样
                const binIndex = Math.min(
                    source.length - 1,
                    Math.floor((i / n) * source.length),
                );
                // 低频更突出
                const weight =
                    Math.pow(1 - i / Math.max(1, n - 1), 1.35) * 0.55 + 0.45;
                const target = (source[binIndex] / 255) * weight;

                // 上升快、回落慢，接近真实频谱的包络
                const k = target > heights[i] ? 0.34 : 0.09;
                heights[i] += (target - heights[i]) * k;

                let height = heights[i] * size.height;
                // 节拍时整体抬升一下
                if (frame.beat > 0) {
                    height *= 1 + frame.beat * 0.12;
                }
                height = Math.max(1, height);

                const x = i * slot + (slot - barWidth) / 2;
                const y = size.height - height;

                const gradient = ctx.createLinearGradient(0, y, 0, size.height);
                gradient.addColorStop(0, withAlpha(colors.primary, 0.95));
                gradient.addColorStop(0.45, withAlpha(colors.primary, 0.55));
                gradient.addColorStop(1, withAlpha(colors.primary, 0.06));

                ctx.fillStyle = gradient;
                ctx.fillRect(x, y, barWidth, height);
            }
        },

        reset() {
            heights.fill(0);
        },
    };
}
