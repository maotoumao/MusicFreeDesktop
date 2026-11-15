import type { IVisualizationEffect } from "../types.ts";
import { withAlpha } from "../color.ts";

/**
 * 频谱山脊 —— 把整段频谱连成一条起伏的山脊曲线。
 *
 * 与条形频谱的区别：柱子是离散的一根根，山脊是一条连续的曲线，
 * 视觉上更像真实的频谱分析仪。
 */
export function createSpectrumEffect(): IVisualizationEffect {
    /** 节拍脉冲的衰减量 */
    let pulse = 0;

    return {
        id: "spectrum",
        nameKey: "settings.visualization.effect.spectrum",

        render(ctx, size, frame, colors) {
            const source = frame.frequency;
            if (!source || source.length === 0) {
                return;
            }

            // 节拍时山脊整体上移并短暂加亮
            if (frame.beat > pulse) {
                pulse = frame.beat;
            }
            pulse *= 0.9;
            const lift = pulse * size.height * 0.06;

            // 相邻点做线性插值，把曲线补到像素宽度
            const steps = Math.max(2, Math.floor(size.width));
            const points: number[] = new Array(steps);
            for (let i = 0; i < steps; i++) {
                const sourceIndex = (i / (steps - 1)) * (source.length - 1);
                const index = Math.floor(sourceIndex);
                const next = Math.min(source.length - 1, index + 1);
                const frac = sourceIndex - index;
                const value =
                    (source[index] / 255) * (1 - frac) +
                    (source[next] / 255) * frac;
                points[i] = value;
            }

            const height = size.height * 0.82;

            ctx.beginPath();
            ctx.moveTo(0, size.height);
            for (let i = 0; i < steps; i++) {
                const x = (i / (steps - 1)) * size.width;
                const y = size.height - points[i] * height - lift;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(size.width, size.height);
            ctx.closePath();

            const gradient = ctx.createLinearGradient(
                0,
                size.height - height,
                0,
                size.height,
            );
            gradient.addColorStop(
                0,
                withAlpha(colors.primary, 0.85 + pulse * 0.15),
            );
            gradient.addColorStop(0.6, withAlpha(colors.primary, 0.35));
            gradient.addColorStop(1, withAlpha(colors.primary, 0.02));
            ctx.fillStyle = gradient;
            ctx.fill();

            // 描一条亮线，山脊更清晰
            ctx.beginPath();
            for (let i = 0; i < steps; i++) {
                const x = (i / (steps - 1)) * size.width;
                const y = size.height - points[i] * height - lift;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.strokeStyle = withAlpha(colors.primary, 0.95);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        },

        reset() {
            pulse = 0;
        },
    };
}
