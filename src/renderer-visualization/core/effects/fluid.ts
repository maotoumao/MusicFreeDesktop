import type { IVisualizationEffect } from "../types.ts";
import { withAlpha } from "../color.ts";

/** 流体场的分辨率（格子数） */
const GRID_WIDTH = 32;
const GRID_HEIGHT = 18;

/**
 * 流体涡旋 —— 魔幻组：用噪声场驱动的涡旋流动。
 *
 * 在一个低分辨率标量场上做简化流体：算旋度 → 沿旋度方向平流 →
 * 轻微耗散，再按音量与节拍注入能量。渲染时把场值映射成透明度，
 * 用大格子填色——低分辨率让流动看起来像漩涡而不是噪点。
 */
export function createFluidEffect(): IVisualizationEffect {
    const field = new Float32Array(GRID_WIDTH * GRID_HEIGHT);
    const next = new Float32Array(GRID_WIDTH * GRID_HEIGHT);

    /** 双线性采样 */
    const sample = (x: number, y: number): number => {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        const x1 = (x0 + 1) % GRID_WIDTH;
        const y1 = (y0 + 1) % GRID_HEIGHT;
        const cx0 = ((x0 % GRID_WIDTH) + GRID_WIDTH) % GRID_WIDTH;
        const cy0 = ((y0 % GRID_HEIGHT) + GRID_HEIGHT) % GRID_HEIGHT;

        const v00 = field[cy0 * GRID_WIDTH + cx0];
        const v10 = field[cy0 * GRID_WIDTH + x1];
        const v01 = field[y1 * GRID_WIDTH + cx0];
        const v11 = field[y1 * GRID_WIDTH + x1];

        return (
            v00 * (1 - fx) * (1 - fy) +
            v10 * fx * (1 - fy) +
            v01 * (1 - fx) * fy +
            v11 * fx * fy
        );
    };

    return {
        id: "fluid",
        nameKey: "settings.visualization.effect.fluid",

        render(ctx, size, frame, colors) {
            // 注入能量：音量越大注入越多，节拍时猛灌一口
            const inject = frame.level * 0.85 + frame.beat * 0.6;
            if (inject > 0.02) {
                const count = Math.ceil(inject * 10);
                for (let i = 0; i < count; i++) {
                    const x = Math.floor(Math.random() * GRID_WIDTH);
                    const y = Math.floor(Math.random() * GRID_HEIGHT);
                    field[y * GRID_WIDTH + x] += 0.5 + Math.random() * 0.9;
                }
            }

            // 平流 + 耗散
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    const index = y * GRID_WIDTH + x;
                    const left = field[y * GRID_WIDTH + ((x - 1 + GRID_WIDTH) % GRID_WIDTH)];
                    const right = field[y * GRID_WIDTH + ((x + 1) % GRID_WIDTH)];
                    const up = field[((y - 1 + GRID_HEIGHT) % GRID_HEIGHT) * GRID_WIDTH + x];
                    const down = field[((y + 1) % GRID_HEIGHT) * GRID_WIDTH + x];

                    const curl = right - left - (down - up);

                    // 沿旋度方向回溯采样（半拉格朗日平流）
                    const sourceX = x - curl * 0.55;
                    const sourceY = y + curl * 0.55;
                    next[index] = sample(sourceX, sourceY) * 0.94;
                }
            }
            field.set(next);

            // 渲染：格子越大越像漩涡
            const cellWidth = size.width / GRID_WIDTH;
            const cellHeight = size.height / GRID_HEIGHT;

            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    const value = field[y * GRID_WIDTH + x];
                    if (value <= 0.02) {
                        continue;
                    }
                    const alpha = Math.min(0.85, value * 0.6);
                    ctx.fillStyle = withAlpha(colors.primary, alpha);
                    ctx.fillRect(
                        x * cellWidth,
                        y * cellHeight,
                        cellWidth + 1,
                        cellHeight + 1,
                    );
                }
            }
        },

        reset() {
            field.fill(0);
            next.fill(0);
        },
    };
}
