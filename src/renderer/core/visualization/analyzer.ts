import { mapToLogBins } from "./analysis/log-bins.ts";
import { BeatDetector } from "./analysis/beat-detector.ts";

/** 频域 bin 数（对数分布后） */
const FREQUENCY_BIN_COUNT = 512;
/** 时域采样点数 */
const WAVEFORM_SAMPLE_COUNT = 256;
/** 用于节拍检测的低频 bin 数 */
const LOW_FREQUENCY_BIN_COUNT = 8;

/**
 * 浏览器 API 的依赖注入点。
 *
 * 采集链路依赖 AudioContext / captureStream 这些只在浏览器里有的 API，
 * 直接测不了；把它们抽成可注入的环境，单测就能塞假的进去。
 * 生产环境用 defaultAudioEnvironment。
 */
export interface IAudioEnvironment {
    now(): number;
    createAudioContext(): AudioContext;
    createMediaStreamSource(
        context: AudioContext,
        stream: MediaStream,
    ): MediaStreamAudioSourceNode;
    createMediaElementSource(
        context: AudioContext,
        element: HTMLMediaElement,
    ): MediaElementAudioSourceNode;
    createAnalyser(context: AudioContext): AnalyserNode;
}

export const defaultAudioEnvironment: IAudioEnvironment = {
    now: () => Date.now(),
    createAudioContext: () => new AudioContext(),
    createMediaStreamSource: (context, stream) =>
        context.createMediaStreamSource(stream),
    createMediaElementSource: (context, element) =>
        context.createMediaElementSource(element),
    createAnalyser: (context) => context.createAnalyser(),
};

/**
 * 音频分析器：把播放中的音频变成一帧一帧的分析数据。
 *
 * 采集策略按 A → B 顺序尝试，**都以「不产生静音」为硬约束**：
 *
 * - **A（首选）** `captureStream()` → MediaStreamSource → AnalyserNode。
 *   完全不介入主播放器的音频链路：跨域不静音、现有音量模型零影响、
 *   分析用的 AudioContext 不接 destination。
 * - **B（回退）** 只在元素是同源 `blob:` URL 时才用
 *   `createMediaElementSource()`。跨域走这条路会让**整个播放器静音**，
 *   所以非 blob 直接判定不可用。
 * - 两者都不成 → 进入"无数据"状态，`available = false`，
 *   由界面明确告知用户「此音源无法可视化」，而不是静默冻结。
 */
export class AudioAnalyzer {
    private readonly env: IAudioEnvironment;
    private readonly beatDetector = new BeatDetector();

    /** 全局复用一个，不随换歌重建（重建要 50~100ms 且会多出上下文） */
    private context: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private mediaElementSource: MediaElementAudioSourceNode | null = null;

    private element: HTMLMediaElement | null = null;
    private available = false;

    /** 复用的缓冲区，避免每帧分配 */
    private readonly frequencyBuffer = new Uint8Array(1024);
    private readonly timeDomainBuffer = new Uint8Array(2048);

    constructor(env: IAudioEnvironment = defaultAudioEnvironment) {
        this.env = env;
    }

    get isAvailable(): boolean {
        return this.available;
    }

    /**
     * 绑定音频元素。重复调用会先解绑上一个。
     *
     * 时机由调用方把握：应当在元素**开始出声**（playing 事件）或
     * **换源**（src 变化）时调用——此刻元素上才有资源。
     */
    attach(mediaElement: HTMLMediaElement): void {
        this.detach();

        this.element = mediaElement;

        // ── 策略 A：captureStream ──
        try {
            // captureStream 在 TS 5.0 的 lib.dom 里还没有声明
            const captureStream = (
                mediaElement as HTMLMediaElement & {
                    captureStream?: () => MediaStream;
                }
            ).captureStream;
            const stream =
                typeof captureStream === "function"
                    ? captureStream.call(mediaElement)
                    : null;
            if (stream && stream.getAudioTracks().length > 0) {
                const ctx = this.ensureContext();
                const source = this.env.createMediaStreamSource(ctx, stream);
                const analyser = this.env.createAnalyser(ctx);
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0.75;
                source.connect(analyser);
                // 分析用的 context **不接 destination**：只做分析，绝不影响出声
                this.sourceNode = source;
                this.analyser = analyser;
                this.available = true;
                this.beatDetector.reset();
                return;
            }
        } catch {
            // 跨域：SecurityError「Cannot capture from element with cross-origin data」
            // 走下面的回退判定
        }

        // ── 策略 B：仅限同源 blob URL ──
        const isBlob = (mediaElement.src ?? "").startsWith("blob:");
        if (isBlob) {
            try {
                const ctx = this.ensureContext();
                const source = this.env.createMediaElementSource(ctx, mediaElement);
                const analyser = this.env.createAnalyser(ctx);
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0.75;
                source.connect(analyser);
                // 必须接回 destination，否则播放器会静音
                source.connect(ctx.destination);
                this.mediaElementSource = source;
                this.analyser = analyser;
                this.available = true;
                this.beatDetector.reset();
                return;
            } catch {
                // 落到不可用状态
            }
        }

        this.available = false;
    }

    /** 解绑当前元素（不关闭 AudioContext——上下文是复用的） */
    detach(): void {
        try {
            this.sourceNode?.disconnect();
        } catch {
            // 已经断开
        }
        try {
            this.mediaElementSource?.disconnect();
        } catch {
            // 已经断开
        }
        try {
            this.analyser?.disconnect();
        } catch {
            // 已经断开
        }
        this.sourceNode = null;
        this.mediaElementSource = null;
        this.analyser = null;
        this.element = null;
        this.available = false;
        this.beatDetector.reset();
    }

    /**
     * 读一帧分析数据。
     *
     * 任何一步失败都只降级（返回静默帧），不抛错、不中断播放。
     */
    readFrame(): IVisualization.IAudioFrame {
        const frequency = new Uint8Array(FREQUENCY_BIN_COUNT);
        const waveform = new Uint8Array(WAVEFORM_SAMPLE_COUNT);

        if (!this.available || !this.analyser || !this.element) {
            return {
                frequency,
                waveform,
                level: 0,
                beat: 0,
                bpm: 0,
                playing: false,
                available: false,
            };
        }

        try {
            const analyser = this.analyser;
            const rawLength = Math.min(
                this.frequencyBuffer.length,
                analyser.frequencyBinCount,
            );
            const raw = this.frequencyBuffer.subarray(0, rawLength);
            analyser.getByteFrequencyData(raw);

            const mapped = mapToLogBins(
                raw,
                FREQUENCY_BIN_COUNT,
                {
                    sampleRate: this.context?.sampleRate ?? 48000,
                    fftSize: analyser.fftSize,
                },
            );
            frequency.set(mapped);

            // level 用**原始**频域算：对数映射会重新分配能量，低频被放大，
            // 用映射后的值算总能量会偏小。
            let sum = 0;
            for (let i = 0; i < raw.length; i++) {
                sum += raw[i];
            }
            const level = raw.length > 0 ? sum / raw.length / 255 : 0;

            // 时域：抽稀到 256 点
            const timeLength = Math.min(
                this.timeDomainBuffer.length,
                analyser.fftSize,
            );
            const timeDomain = this.timeDomainBuffer.subarray(0, timeLength);
            analyser.getByteTimeDomainData(timeDomain);
            const step = Math.max(1, Math.floor(timeLength / WAVEFORM_SAMPLE_COUNT));
            for (let i = 0; i < WAVEFORM_SAMPLE_COUNT; i++) {
                const index = Math.min(timeLength - 1, i * step);
                waveform[i] = timeDomain[index];
            }

            // 低频能量喂节拍检测
            let lowSum = 0;
            const lowCount = Math.min(LOW_FREQUENCY_BIN_COUNT, raw.length);
            for (let i = 0; i < lowCount; i++) {
                lowSum += raw[i];
            }
            const lowEnergy = lowCount > 0 ? lowSum / lowCount / 255 : 0;
            const beatResult = this.beatDetector.push(lowEnergy, this.env.now());

            return {
                frequency,
                waveform,
                level,
                beat: beatResult.beat,
                bpm: beatResult.bpm,
                playing: !this.element.paused,
                available: true,
            };
        } catch {
            return {
                frequency,
                waveform,
                level: 0,
                beat: 0,
                bpm: 0,
                playing: false,
                available: false,
            };
        }
    }

    private ensureContext(): AudioContext {
        if (!this.context) {
            this.context = this.env.createAudioContext();
        }
        // 新建的 AudioContext 可能停在 suspended，此时 AnalyserNode 不产出数据
        // （level 恒为 0，看起来就是"可视化没反应"）
        void this.context.resume?.();
        return this.context;
    }
}

/** 单例 */
export const audioAnalyzer = new AudioAnalyzer();
