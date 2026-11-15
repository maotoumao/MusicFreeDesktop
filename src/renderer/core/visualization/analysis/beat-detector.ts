export interface IBeatDetectorOptions {
    /** 瞬时能量超过滑动均值多少倍算一拍，默认 1.35 */
    threshold?: number;
    /** 滑动窗口帧数，默认 43（约 0.7s @60fps） */
    windowFrames?: number;
    /** 两次拍点的最小间隔（毫秒），默认 200 */
    minIntervalMs?: number;
    /** 包络衰减时间常数（毫秒），默认 150 */
    decayMs?: number;
}

export interface IBeatResult {
    /** 0..1 包络，刚触发时为 1，之后指数衰减 */
    beat: number;
    /** 估算 BPM，估不出来时为 0 */
    bpm: number;
}

/**
 * 节拍检测：把低频能量的一串脉冲识别成拍子，并输出一个指数衰减的包络。
 *
 * 判定条件：瞬时能量 > 滑动均值 × threshold，且距上一拍超过 minIntervalMs。
 * BPM 取最近若干个拍点间隔的**中位数**的倒数——用中位数是为了让偶发的
 * 漏拍/误拍不至于带偏估计。
 */
export class BeatDetector {
    private readonly threshold: number;
    private readonly windowFrames: number;
    private readonly minIntervalMs: number;
    private readonly decayMs: number;

    /** 最近的低频能量样本（不含当前帧） */
    private readonly window: number[] = [];
    /** 最近的拍点间隔（毫秒） */
    private readonly intervals: number[] = [];

    private envelope = 0;
    private lastBeatAt = Number.NEGATIVE_INFINITY;
    private lastPushAt = 0;
    private hasPushed = false;

    constructor(options?: IBeatDetectorOptions) {
        this.threshold = options?.threshold ?? 1.35;
        this.windowFrames = options?.windowFrames ?? 43;
        this.minIntervalMs = options?.minIntervalMs ?? 200;
        this.decayMs = options?.decayMs ?? 150;
    }

    /**
     * 送入一帧的低频能量（0..1）与时间戳，返回本帧的节拍信息。
     */
    push(lowFrequencyEnergy: number, nowMs: number): IBeatResult {
        const dt = this.hasPushed ? nowMs - this.lastPushAt : 0;
        this.lastPushAt = nowMs;
        this.hasPushed = true;

        // 1. 包络按时间衰减
        if (dt > 0) {
            this.envelope *= Math.exp(-dt / this.decayMs);
        }

        // 2. 滑动均值（只用当前帧之前的样本；没有历史样本时不可能是尖峰）
        let average = 0;
        if (this.window.length > 0) {
            let sum = 0;
            for (let i = 0; i < this.window.length; i++) {
                sum += this.window[i];
            }
            average = sum / this.window.length;
        } else {
            average = lowFrequencyEnergy;
        }

        const isSpike = lowFrequencyEnergy > average * this.threshold;

        if (isSpike) {
            if (nowMs - this.lastBeatAt > this.minIntervalMs) {
                // 触发新的一拍
                if (Number.isFinite(this.lastBeatAt)) {
                    this.intervals.push(nowMs - this.lastBeatAt);
                    if (this.intervals.length > 8) {
                        this.intervals.shift();
                    }
                }
                this.lastBeatAt = nowMs;
                this.envelope = 1;
            } else {
                // 间隔过密，这一拍被抑制：包络归零，不显示这次节拍
                this.envelope = 0;
            }
        }

        // 3. 当前能量入窗（判定之后才入，避免高能量把自己平均掉）
        this.window.push(lowFrequencyEnergy);
        if (this.window.length > this.windowFrames) {
            this.window.shift();
        }

        return { beat: this.envelope, bpm: this.getBpm() };
    }

    /** 清空所有内部状态 */
    reset(): void {
        this.window.length = 0;
        this.intervals.length = 0;
        this.envelope = 0;
        this.lastBeatAt = Number.NEGATIVE_INFINITY;
        this.lastPushAt = 0;
        this.hasPushed = false;
    }

    private getBpm(): number {
        if (this.intervals.length < 4) {
            return 0;
        }
        const sorted = [...this.intervals].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median =
            sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
        if (median <= 0) {
            return 0;
        }
        return 60000 / median;
    }
}
