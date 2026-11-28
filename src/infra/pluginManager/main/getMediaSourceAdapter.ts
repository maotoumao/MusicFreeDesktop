/**
 * pluginManager — getMediaSource 适配器（主进程）
 *
 * 在主进程中实现音质回退和重试逻辑：
 * 1. 按音质偏好顺序依次尝试
 * 2. 每个音质尝试 2 次（初次 + 150ms 延迟重试）
 * 3. normalizer 返回 null 表示该音质不可用，跳过重试直接下一个音质
 *
 * 此适配器在主进程运行，直接调用 callPluginMethod（无 IPC 开销）。
 */

import type {
    IGetMediaSourceParams,
    IGetMediaSourceResult,
    ICallPluginMethodParams,
} from '@appTypes/infra/pluginManager';
import { QUALITY_KEYS } from '@common/constant';
import delay from '@common/delay';

/** 调用插件方法的函数类型（由 PluginManager 注入） */
type CallPluginMethodFn = (params: ICallPluginMethodParams) => Promise<any>;

const RETRY_DELAY_MS = 150;

/**
 * 构建音质尝试顺序。
 * 从请求的音质开始，按 qualityFallbackOrder 方向排列。
 */
function buildQualityOrder(
    requestedQuality: IMusic.IQualityKey,
    qualityOrder: IMusic.IQualityKey[],
    fallbackDirection: 'higher' | 'lower',
): IMusic.IQualityKey[] {
    const idx = QUALITY_KEYS.indexOf(requestedQuality);
    if (idx === -1) return [requestedQuality];

    const result: IMusic.IQualityKey[] = [requestedQuality];

    if (fallbackDirection === 'higher') {
        // 向高音质回退：从当前往上
        for (let i = idx + 1; i < QUALITY_KEYS.length; i++) {
            result.push(QUALITY_KEYS[i]);
        }
        // 然后向低音质
        for (let i = idx - 1; i >= 0; i--) {
            result.push(QUALITY_KEYS[i]);
        }
    } else {
        // 向低音质回退：从当前往下
        for (let i = idx - 1; i >= 0; i--) {
            result.push(QUALITY_KEYS[i]);
        }
        // 然后向高音质
        for (let i = idx + 1; i < QUALITY_KEYS.length; i++) {
            result.push(QUALITY_KEYS[i]);
        }
    }

    // 过滤出 qualityOrder 中包含的音质
    return result.filter((q) => qualityOrder.includes(q));
}

/** getMediaSource adapter 所需的参数（含 hash） */
export interface IGetMediaSourceAdapterParams extends IGetMediaSourceParams {
    /** 插件 hash */
    hash: string;
}

/**
 * getMediaSource 适配器（主进程版本）。
 * 直接调用 callPluginMethod，无 IPC 开销。
 *
 * 流程：
 * - 按音质优先级顺序依次尝试
 * - 每个音质最多 2 次尝试（首次 + 150ms 延迟重试）
 * - normalizer afterCall 返回 null 表示该音质不可用，跳过重试直接下一个音质
 * - 网络/临时错误触发重试
 *
 * @param params 请求参数（含 hash）
 * @param callPluginMethod 调用插件方法的函数
 * @returns 媒体源结果（含实际音质），或 null
 */
export async function getMediaSourceAdapter(
    params: IGetMediaSourceAdapterParams,
    callPluginMethod: CallPluginMethodFn,
): Promise<IGetMediaSourceResult | null> {
    const { musicItem, quality, qualityOrder, qualityFallbackOrder, hash } = params;

    const orderedQualities = buildQualityOrder(quality, qualityOrder, qualityFallbackOrder);

    for (const currentQuality of orderedQualities) {
        // 每个音质最多尝试 2 次
        for (let attempt = 0; attempt < 2; attempt++) {
            if (attempt > 0) {
                await delay(RETRY_DELAY_MS);
            }

            try {
                const result = await callPluginMethod({
                    hash,
                    method: 'getMediaSource',
                    args: [musicItem, currentQuality],
                });

                // null/undefined 表示该音质不可用（normalizer 返回），跳到下一音质
                if (result === null || result === undefined) {
                    break;
                }

                if (result.url) {
                    return {
                        ...result,
                        quality: result.quality ?? currentQuality,
                    };
                }

                // 有返回值但无 url，也视为不可用
                break;
            } catch (err: any) {
                // 网络/临时错误，继续重试
                console.warn(
                    `[getMediaSource] Attempt ${attempt + 1} failed for quality ${currentQuality}:`,
                    err?.message ?? '',
                );
            }
        }
    }

    return null;
}
