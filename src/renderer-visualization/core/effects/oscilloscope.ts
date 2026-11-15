import type { IVisualizationEffect } from "../types.ts";
import { withAlpha } from "../color.ts";

/**
 * 示波器 —— 时域波形。
 *
 * 直接把 waveform 连成一条横贯窗口的曲线；
 * 线宽与辉光强度随音量变化，安静时退化成一条居中平线。
 */
export function createOscilloscopeEffect(): IVisualizationEffect {
    return {
        id: "oscilloscope",
        nameKey: "settings.visualization.effect.oscilloscope",

        render(ctx, size, frame, colors) {
            const wave = frame.waveform;
            const mid = size.height / 2;

            if (!wave || wave.length === 0) {
                return;
            }

            // 没有声音时画一条安静的居中线
            if (frame.level <= 0.001) {
                ctx.strokeStyle = withAlpha(colors.primary, 0.35);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, mid);
                ctx.lineTo(size.width, mid);
                ctx.stroke();
                return;
            }

            const amplitude = size.height * 0.42;
            const step = size.width / Math.max(1, wave.length - 1);

            ctx.save();
            ctx.strokeStyle = withAlpha(colors.primary, 0.9);
            ctx.lineWidth = 1.5 + frame.level * 3;
            ctx.lineJoin = "round";
            ctx.shadowColor = colors.primary;
            ctx.shadowBlur = 6 + frame.level * 18;

            ctx.beginPath();
            for (let i = 0; i < wave.length; i++) {
                const x = i * step;
                const y = mid + ((wave[i] - 128) / 128) * amplitude;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.restore();
        },
    };
}
