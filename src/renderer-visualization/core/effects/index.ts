import type { IVisualizationEffect } from "../types.ts";
import { createBarsEffect } from "./bars.ts";
import { createOscilloscopeEffect } from "./oscilloscope.ts";
import { createSpectrumEffect } from "./spectrum.ts";
import { createParticleEffect } from "./particle.ts";
import { createGeometryEffect } from "./geometry.ts";
import { createFluidEffect } from "./fluid.ts";
import { createBatteryEffect } from "./battery.ts";
import { createFireworksEffect } from "./fireworks.ts";

/**
 * 效果注册表：id → 工厂函数。
 *
 * 新增第 9 个效果只能改一个效果文件 + 这里加一行。
 */
export const effectRegistry: Record<string, () => IVisualizationEffect> = {
    // 条形与波浪组
    bars: createBarsEffect,
    oscilloscope: createOscilloscopeEffect,
    spectrum: createSpectrumEffect,
    // 魔幻组
    particle: createParticleEffect,
    geometry: createGeometryEffect,
    fluid: createFluidEffect,
    // 其他组
    battery: createBatteryEffect,
    fireworks: createFireworksEffect,
};

/** 所有效果的 id（顺序即设置页里的展示顺序） */
export const effectIds = Object.keys(effectRegistry);
