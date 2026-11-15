import type { IVisualizationEffect } from "../types.ts";
import { shiftHue, withAlpha } from "../color.ts";

interface IParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    /** 色相偏移（度） */
    hue: number;
    size: number;
}

/** 粒子上限 */
const MAX_PARTICLES = 300;

/**
 * 粒子 —— 魔幻组：跟随音乐节奏发射的粒子群。
 *
 * 发射率与初速度跟音量（level）走，节拍时爆发一批。
 */
export function createParticleEffect(): IVisualizationEffect {
    let particles: IParticle[] = [];

    const emit = (
        size: { width: number; height: number },
        count: number,
        level: number,
    ) => {
        for (let i = 0; i < count; i++) {
            if (particles.length >= MAX_PARTICLES) {
                particles.shift();
            }
            const angle = Math.random() * Math.PI * 2;
            const speed = (40 + Math.random() * 120) * (0.4 + level);
            particles.push({
                x: size.width / 2 + (Math.random() - 0.5) * size.width * 0.3,
                y: size.height * 0.92,
                vx: Math.cos(angle) * speed * 0.6,
                vy: Math.sin(angle) * speed - 40,
                life: 1,
                hue: (Math.random() - 0.5) * 120,
                size: 1.5 + Math.random() * 2.5,
            });
        }
    };

    return {
        id: "particle",
        nameKey: "settings.visualization.effect.particle",

        render(ctx, size, frame, colors) {
            // 发射率随音量
            if (frame.level > 0.01) {
                const count = Math.floor(frame.level * 0.6 * 12);
                if (count > 0) {
                    emit(size, count, frame.level);
                }
            }
            // 节拍爆发
            if (frame.beat > 0.6) {
                emit(size, 12 + Math.floor(frame.beat * 24), frame.level);
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx * 0.016;
                p.y += p.vy * 0.016;
                p.vy += 120 * 0.016; // 重力
                p.life -= 0.008;

                if (p.life <= 0) {
                    particles.splice(i, 1);
                    continue;
                }

                ctx.fillStyle = withAlpha(
                    shiftHue(colors.primary, p.hue),
                    Math.max(0, Math.min(1, p.life)) * 0.9,
                );
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fill();
            }
        },

        reset() {
            particles = [];
        },
    };
}
