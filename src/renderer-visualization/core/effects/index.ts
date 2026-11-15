import type { IVisualizationEffect } from "../types.ts";
import { createBarsEffect } from "./bars.ts";
import { createOscilloscopeEffect } from "./oscilloscope.ts";
import { createSpectrumEffect } from "./spectrum.ts";
import { createParticleEffect } from "./particle.ts";
import { createGeometryEffect } from "./geometry.ts";

/**
 * 效果注册表：id → 工厂函数。
 *
 * 新增第 9 个效果只能改一个效果文件 + 这里加一行。
 */
export const effectRegistry: Record<string, () => IVisualizationEffect> = {
    bars: createBarsEffect,
    oscilloscope: createOscilloscopeEffect,
    spectrum: createSpectrumEffect,
    particle: createParticleEffect,
    geometry: createGeometryEffect,
};

/** 所有效果的 id（顺序即设置页里的展示顺序） */
export const effectIds = Object.keys(effectRegistry);
