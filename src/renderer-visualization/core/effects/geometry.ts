import type { IVisualizationEffect } from "../types.ts";
import { withAlpha } from "../color.ts";

interface ILayer {
    /** 多边形边数 */
    sides: number;
    /** 当前旋转角 */
    rotation: number;
    /** 基础半径占比 */
    radius: number;
    /** 颜色深浅 */
    depth: number;
}

/**
 * 几何多边形 —— 魔幻组：中心旋转的多层多边形。
 *
 * 中频能量控制旋转速度与形变幅度，节拍触发一次形状脉冲。
 */
export function createGeometryEffect(): IVisualizationEffect {
    const layers: ILayer[] = [
        { sides: 5, rotation: 0, radius: 0.32, depth: 1 },
        { sides: 7, rotation: 0.6, radius: 0.24, depth: 0.7 },
        { sides: 9, rotation: 1.2, radius: 0.16, depth: 0.45 },
    ];
    let pulse = 0;

    return {
        id: "geometry",
        nameKey: "settings.visualization.effect.geometry",

        render(ctx, size, frame, colors) {
            // 中频能量：取频谱中间一段
            const source = frame.frequency;
            const midStart = Math.floor((source?.length ?? 0) * 0.25);
            const midEnd = Math.floor((source?.length ?? 0) * 0.6);
            let midEnergy = 0;
            if (source && midEnd > midStart) {
                let sum = 0;
                for (let i = midStart; i < midEnd; i++) {
                    sum += source[i];
                }
                midEnergy = sum / (midEnd - midStart) / 255;
            }

            if (frame.beat > pulse) {
                pulse = frame.beat;
            }
            pulse *= 0.88;

            const cx = size.width / 2;
            const cy = size.height / 2;
            const base = Math.min(size.width, size.height);

            layers.forEach((layer, index) => {
                // 中频越强转得越快
                layer.rotation += 0.002 + midEnergy * 0.02 * (index + 1);

                // 节拍时半径冲高再回落
                const scale = 1 + pulse * 0.28 * (1 - index * 0.22);
                const radius =
                    base * layer.radius * scale * (0.85 + midEnergy * 0.5);

                ctx.beginPath();
                for (let i = 0; i <= layer.sides; i++) {
                    const angle =
                        layer.rotation + (i / layer.sides) * Math.PI * 2;
                    const x = cx + Math.cos(angle) * radius;
                    const y = cy + Math.sin(angle) * radius;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();

                ctx.strokeStyle = withAlpha(
                    colors.primary,
                    0.85 * layer.depth + pulse * 0.15,
                );
                ctx.lineWidth = 1.5 + layer.depth * 1.5;
                ctx.stroke();

                ctx.fillStyle = withAlpha(
                    colors.primary,
                    0.08 * layer.depth + pulse * 0.06,
                );
                ctx.fill();
            });
        },

        reset() {
            pulse = 0;
            layers.forEach((layer) => {
                layer.rotation = 0;
            });
        },
    };
}
