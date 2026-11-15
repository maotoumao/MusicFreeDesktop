import type { IVisualizationEffect } from "../types.ts";
import { shiftHue, withAlpha } from "../color.ts";

interface ISpark {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    hue: number;
    size: number;
}

interface IExplosion {
    x: number;
    y: number;
    sparks: ISpark[];
}

/**
 * 烟花 —— 鼓点处炸开的粒子火花。
 *
 * 每个爆炸 30~60 个粒子，按随机方向飞散、受重力下拉、透明度随寿命衰减。
 */
export function createFireworksEffect(): IVisualizationEffect {
    let explosions: IExplosion[] = [];
    let lastBeatAt = 0;

    return {
        id: "fireworks",
        nameKey: "settings.visualization.effect.fireworks",

        render(ctx, size, frame, colors) {
            // 只在节拍**刚触发**时炸一次（用时间戳去重，避免每帧重复炸）
            if (frame.beat > 0.5) {
                const now = Date.now();
                if (now - lastBeatAt > 120) {
                    lastBeatAt = now;
                    const count = 30 + Math.floor(Math.random() * 30);
                    const x = size.width * (0.2 + Math.random() * 0.6);
                    const y = size.height * (0.15 + Math.random() * 0.45);
                    const hue = (Math.random() - 0.5) * 140;
                    const sparks: ISpark[] = [];
                    for (let i = 0; i < count; i++) {
                        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
                        const speed = 60 + Math.random() * 130;
                        sparks.push({
                            x,
                            y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 1,
                            hue: hue + (Math.random() - 0.5) * 40,
                            size: 1.2 + Math.random() * 2,
                        });
                    }
                    explosions.push({ x, y, sparks });
                }
            }

            for (let e = explosions.length - 1; e >= 0; e--) {
                const explosion = explosions[e];
                let alive = 0;

                for (const spark of explosion.sparks) {
                    spark.x += spark.vx * 0.016;
                    spark.y += spark.vy * 0.016;
                    spark.vy += 150 * 0.016; // 重力
                    spark.vx *= 0.99;
                    spark.vy *= 0.99;
                    spark.life -= 0.008;

                    if (spark.life <= 0) {
                        continue;
                    }
                    alive++;

                    ctx.fillStyle = withAlpha(
                        shiftHue(colors.primary, spark.hue),
                        Math.max(0, Math.min(1, spark.life)) * 0.95,
                    );
                    ctx.beginPath();
                    ctx.arc(spark.x, spark.y, spark.size * spark.life, 0, Math.PI * 2);
                    ctx.fill();
                }

                if (alive === 0) {
                    explosions.splice(e, 1);
                }
            }
        },

        reset() {
            explosions = [];
            lastBeatAt = 0;
        },
    };
}
