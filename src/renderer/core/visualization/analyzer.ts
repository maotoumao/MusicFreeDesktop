import { mapToLogBins } from "./analysis/log-bins.ts";
import { BeatDetector } from "./analysis/beat-detector.ts";

/**
 * 分析器状态。
 *
 * 必须区分「暂时没有数据」和「这个音源没法分析」——两者在用户眼里完全不同：
 * 前者等一下就好，后者该给提示。
 */
export type IAnalyzerState = "idle" | "ok" | "unsupported";

/**
 * 频域 bin 数（对数分布后）。
 *
 * 不要调大：40Hz–16kHz 在 fftSize=4096 / 48kHz 下只对应约 1360 个输入 bin，
 * 输出 bin 超过这个量级，低频区就会出现大量重复值（多个输出 bin 映射到
 * 同一个输入 bin），柱状图会糊成一整块。
 */
const FREQUENCY_BIN_COUNT = 256;
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
    /**
     * 元素源节点（策略 B）。
     *
     * createMediaElementSource 对同一元素**只能调用一次**，且调用后元素的音频
     * 只能经由它到达扬声器——所以它必须活到元素生命周期结束，解绑时绝不能断开
     * （断了播放器就永久静音）。
     */
    private mediaElementSource: MediaElementAudioSourceNode | null = null;
    /** mediaElementSource 是为哪个元素创建的 */
    private mediaElementSourceOwner: HTMLMediaElement | null = null;

    private element: HTMLMediaElement | null = null;
    private state: IAnalyzerState = "idle";

    /** 复用的缓冲区，避免每帧分配 */
    private readonly frequencyBuffer = new Uint8Array(2048);
    private readonly timeDomainBuffer = new Uint8Array(4096);

    constructor(env: IAudioEnvironment = defaultAudioEnvironment) {
        this.env = env;
    }

    get isAvailable(): boolean {
        return this.state === "ok";
    }

    /** 当前状态：idle（暂时没数据）/ ok（正在分析）/ unsupported（此音源无法分析） */
    get status(): IAnalyzerState {
        return this.state;
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
                analyser.fftSize = 4096;
                analyser.smoothingTimeConstant = 0.75;
                source.connect(analyser);
                // 分析用的 context **不接 destination**：只做分析，绝不影响出声
                this.sourceNode = source;
                this.analyser = analyser;
                this.state = "ok";
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
                let source: MediaElementAudioSourceNode;
                if (
                    this.mediaElementSource &&
                    this.mediaElementSourceOwner === mediaElement
                ) {
                    // 复用：createMediaElementSource 对同一元素只能调一次，
                    // 第二次会抛 InvalidStateError
                    source = this.mediaElementSource;
                } else {
                    source = this.env.createMediaElementSource(
                        ctx,
                        mediaElement,
                    );
                    this.mediaElementSource = source;
                    this.mediaElementSourceOwner = mediaElement;
                    // 必须接回 destination，否则播放器会静音
                    source.connect(ctx.destination);
                }
                const analyser = this.env.createAnalyser(ctx);
                analyser.fftSize = 4096;
                analyser.smoothingTimeConstant = 0.75;
                source.connect(analyser);
                this.analyser = analyser;
                this.state = "ok";
                this.beatDetector.reset();
                return;
            } catch {
                // 落到不可用状态
            }
        }

        this.state = "unsupported";
    }

    /**
     * 解绑当前元素（不关闭 AudioContext——上下文是复用的）。
     *
     * **不会断开 mediaElementSource**：它连着 destination，断开等于让播放器
     * 永久静音（元素的音频只能经由它到达扬声器）。这里只断开 captureStream
     * 的源节点与分析分支。
     */
    detach(): void {
        try {
            this.sourceNode?.disconnect();
        } catch {
            // 已经断开
        }
        try {
            this.analyser?.disconnect();
        } catch {
            // 已经断开
        }
        this.sourceNode = null;
        this.analyser = null;
        this.element = null;
        // idle 不是 unsupported：换歌期间只是暂时没有数据，不该提示用户
        this.state = "idle";
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

        if (!this.isAvailable || !this.analyser || !this.element) {
            return {
                frequency,
                waveform,
                level: 0,
                beat: 0,
                bpm: 0,
                playing: false,
                available: false,
                state: this.state,
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

            // level 用**时域 RMS**。
            //
            // 不能用频域均值：getByteFrequencyData 把 -100..-30dB 映射到 0..255，
            // 真实音乐里绝大部分 bin 是 0，均值被稀释到 0.02~0.06——
            // 而效果（粒子发射率、流体注入、电池充电）都按 0..1 设计，
            // 用频域均值会让它们几乎不动。
            let sumSquares = 0;
            for (let i = 0; i < timeLength; i++) {
                const value = (timeDomain[i] - 128) / 128;
                sumSquares += value * value;
            }
            const level =
                timeLength > 0 ? Math.sqrt(sumSquares / timeLength) : 0;

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
                state: this.state,
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
                state: "idle",
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
