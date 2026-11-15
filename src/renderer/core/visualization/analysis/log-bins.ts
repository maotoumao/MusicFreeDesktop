export interface ILogBinsOptions {
    /** AudioContext.sampleRate —— 必须用实测值（Electron 上是 48000），不能硬编码 44100 */
    sampleRate: number;
    /** AnalyserNode.fftSize */
    fftSize: number;
    /** 最低映射频率，默认 40Hz */
    fMin?: number;
    /** 最高映射频率，默认 16000Hz */
    fMax?: number;
}

/**
 * 把线性频域 bin 映射成对数分布的 bin。
 *
 * 线性 FFT bin 的频率是等间距的，低频只占很小一段，直接画柱状图会挤成一根。
 * 对数映射让低频稀、高频密，视觉上才像真正的频谱分析仪。
 *
 * 每个输出 bin 覆盖一个频率区间，取区间内的**最大值**（不是平均值）——
 * 平均会把高频能量稀释掉。
 */
export function mapToLogBins(
    data: Uint8Array,
    outputCount: number,
    options: ILogBinsOptions,
): Uint8Array {
    const output = new Uint8Array(outputCount);

    if (outputCount <= 0 || data.length === 0) {
        return output;
    }

    if (outputCount === 1) {
        output[0] = data[0];
        return output;
    }

    const fMin = options.fMin ?? 40;
    const fMax = options.fMax ?? 16000;
    const binHz = options.sampleRate / options.fftSize;

    if (!Number.isFinite(binHz) || binHz <= 0 || fMax <= fMin) {
        return output;
    }

    const ratio = fMax / fMin;
    const lastIndex = outputCount - 1;

    for (let i = 0; i < outputCount; i++) {
        const f = fMin * Math.pow(ratio, i / lastIndex);
        const fNext =
            i === lastIndex
                ? fMax
                : fMin * Math.pow(ratio, (i + 1) / lastIndex);

        let lo = Math.floor(f / binHz);
        let hi = Math.floor(fNext / binHz);

        if (lo < 0) {
            lo = 0;
        }
        if (lo > data.length - 1) {
            lo = data.length - 1;
        }
        if (hi > data.length) {
            hi = data.length;
        }
        // 低频区多个输出 bin 可能落在同一个输入 bin 上，此时区间为空，
        // 取该输入 bin 本身，避免漏掉能量。
        if (hi <= lo) {
            hi = Math.min(lo + 1, data.length);
        }

        let max = 0;
        for (let k = lo; k < hi; k++) {
            if (data[k] > max) {
                max = data[k];
            }
        }
        output[i] = max;
    }

    return output;
}
