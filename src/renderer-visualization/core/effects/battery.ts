import type { IVisualizationEffect } from "../types.ts";
import { withAlpha } from "../color.ts";

/**
 * 电池 —— WMP「其他组」的代表效果。
 *
 * 液面高度就是「电量」：由音乐能量积分而来（放电慢、充电快），
 * 电量低于 20% 时变红，节拍时轻微抖动。
 */
export function createBatteryEffect(): IVisualizationEffect {
    /** 当前电量 0..1 */
    let charge = 0;
    /** 节拍抖动量 */
    let shake = 0;

    return {
        id: "battery",
        nameKey: "settings.visualization.effect.battery",

        render(ctx, size, frame, colors) {
            const dt = 1 / 60;
            // 充电快、放电慢
            charge += (frame.level - 0.02) * (dt / 8);
            charge = Math.max(0, Math.min(1, charge));

            if (frame.beat > shake) {
                shake = frame.beat;
            }
            shake *= 0.86;

            const batteryWidth = Math.min(size.width * 0.34, 120);
            const batteryHeight = Math.min(size.height * 0.62, 190);
            const x = (size.width - batteryWidth) / 2 + (Math.random() - 0.5) * shake * 4;
            const y = (size.height - batteryHeight) / 2 + (Math.random() - 0.5) * shake * 4;
            const border = 3;
            const capWidth = batteryWidth * 0.36;
            const capHeight = 6;

            const low = charge < 0.2;
            const fillColor = low ? "#e5544b" : colors.primary;

            // 外壳
            ctx.strokeStyle = withAlpha(colors.text, 0.75);
            ctx.lineWidth = border;
            ctx.beginPath();
            ctx.roundRect(
                x,
                y,
                batteryWidth,
                batteryHeight,
                Math.min(10, batteryWidth / 8),
            );
            ctx.stroke();

            // 顶部触点
            ctx.fillStyle = withAlpha(colors.text, 0.75);
            ctx.beginPath();
            ctx.roundRect(
                x + (batteryWidth - capWidth) / 2,
                y - capHeight,
                capWidth,
                capHeight,
                2,
            );
            ctx.fill();

            // 液面
            const innerHeight = batteryHeight - border * 2;
            const fillHeight = innerHeight * charge;
            if (fillHeight > 0.5) {
                ctx.fillStyle = withAlpha(fillColor, 0.75);
                ctx.beginPath();
                ctx.roundRect(
                    x + border,
                    y + border + (innerHeight - fillHeight),
                    batteryWidth - border * 2,
                    fillHeight,
                    Math.min(8, (batteryWidth - border * 2) / 8),
                );
                ctx.fill();
            }
        },

        reset() {
            charge = 0;
            shake = 0;
        },
    };
}
