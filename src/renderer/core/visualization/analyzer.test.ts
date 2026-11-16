import { test } from "node:test";
import assert from "node:assert/strict";
import { AudioAnalyzer } from "./analyzer.ts";
import type { IAudioEnvironment } from "./analyzer.ts";

/** 假的音频节点：记录 connect/disconnect 调用 */
function fakeNode(record?: { disconnects: number; connects: number }) {
    return {
        connect: (): void => {
            if (record) record.connects++;
        },
        disconnect: (): void => {
            if (record) record.disconnects++;
        },
    };
}

/** 假 analyser：可控的频域/时域数据 */
function createFakeAnalyser(frequency: number[], timeDomain: number[]) {
    const freq = new Uint8Array(2048);
    frequency.forEach((v, i) => (freq[i] = v));
    const wave = new Uint8Array(4096);
    timeDomain.forEach((v, i) => (wave[i] = v));
    return {
        fftSize: 4096,
        frequencyBinCount: 2048,
        getByteFrequencyData: (arr: Uint8Array) => arr.set(freq.subarray(0, arr.length)),
        getByteTimeDomainData: (arr: Uint8Array) => arr.set(wave.subarray(0, arr.length)),
        connect: (): void => undefined,
        disconnect: (): void => undefined,
    } as unknown as AnalyserNode;
}

/** 假环境：记录调用顺序，可控制 captureStream 行为 */
function createFakeEnv(options: {
    captureError?: Error;
    audioTracks?: number;
    frequency?: number[];
    timeDomain?: number[];
}) {
    const calls: string[] = [];
    const frequency = options.frequency ?? [];
    const timeDomain = options.timeDomain ?? [];

    const analyser = createFakeAnalyser(frequency, timeDomain);
    /** createMediaElementSource 的调用次数（真实 API 对同一元素只能调一次） */
    let mediaElementSourceCalls = 0;
    /** 元素源节点的 connect/disconnect 计数 */
    const elementNodeRecord = { disconnects: 0, connects: 0 };

    const env: IAudioEnvironment = {
        now: () => 0,
        createAudioContext: () => {
            calls.push("createAudioContext");
            return {
                sampleRate: 48000,
                state: "running",
                destination: {},
                resume: async (): Promise<void> => undefined,
                createMediaStreamSource: () => {
                    calls.push("createMediaStreamSource");
                    return fakeNode();
                },
                createMediaElementSource: () => {
                    calls.push("createMediaElementSource");
                    return fakeNode();
                },
                createAnalyser: () => {
                    calls.push("createAnalyser");
                    return analyser;
                },
                close: async (): Promise<void> => undefined,
            } as unknown as AudioContext;
        },
        createMediaStreamSource: (
            _ctx: AudioContext,
            stream: MediaStream,
        ): MediaStreamAudioSourceNode => {
            calls.push("createMediaStreamSource");
            return fakeNode() as unknown as MediaStreamAudioSourceNode;
        },
        createMediaElementSource: (
            _ctx: AudioContext,
            _element: HTMLMediaElement,
        ): MediaElementAudioSourceNode => {
            calls.push("createMediaElementSource");
            mediaElementSourceCalls++;
            return fakeNode(elementNodeRecord) as unknown as MediaElementAudioSourceNode;
        },
        createAnalyser: (): AnalyserNode => {
            calls.push("createAnalyser");
            return analyser;
        },
    };

    const mediaElement = {
        src: "blob:fake",
        paused: false,
        captureStream: () => {
            calls.push("captureStream");
            if (options.captureError) {
                throw options.captureError;
            }
            return {
                getAudioTracks: () =>
                    new Array(Math.max(0, options.audioTracks ?? 1)).fill({}),
            } as unknown as MediaStream;
        },
    } as unknown as HTMLMediaElement;

    return {
        env,
        calls,
        mediaElement,
        elementNodeRecord,
        getMediaElementSourceCalls: () => mediaElementSourceCalls,
    };
}

test("captureStream 拿到音轨时走策略 A 并可读帧", () => {
    const { env, calls, mediaElement } = createFakeEnv({
        frequency: new Array(2048).fill(0),
        timeDomain: new Array(4096).fill(128),
    });
    const analyzer = new AudioAnalyzer(env);

    analyzer.attach(mediaElement);
    assert.equal(analyzer.isAvailable, true);
    assert.ok(calls.includes("captureStream"));
    assert.ok(calls.includes("createMediaStreamSource"));
    assert.ok(!calls.includes("createMediaElementSource"), "策略 A 成功时不应走回退");
});

test("captureStream 抛 SecurityError 且 src 不是 blob 时降级为不可用", () => {
    const { env, calls, mediaElement } = createFakeEnv({
        captureError: new Error("Cannot capture from element with cross-origin data"),
    });
    (mediaElement as unknown as { src: string }).src = "https://example.com/a.mp3";
    const analyzer = new AudioAnalyzer(env);

    analyzer.attach(mediaElement);
    assert.equal(analyzer.isAvailable, false);
    assert.ok(
        !calls.includes("createMediaElementSource"),
        "跨域场景绝不能走 createMediaElementSource——那会让播放器静音",
    );
});

test("captureStream 无音轨但 src 是 blob 时回退到策略 B", () => {
    const { env, calls, mediaElement } = createFakeEnv({ audioTracks: 0 });
    const analyzer = new AudioAnalyzer(env);

    analyzer.attach(mediaElement);
    assert.equal(analyzer.isAvailable, true);
    assert.ok(calls.includes("createMediaElementSource"), "blob 场景应回退到策略 B");
});

test("不可用时读出的帧是静默的", () => {
    const { env, mediaElement } = createFakeEnv({
        captureError: new Error("cross-origin"),
    });
    (mediaElement as unknown as { src: string }).src = "https://example.com/a.mp3";
    const analyzer = new AudioAnalyzer(env);
    analyzer.attach(mediaElement);

    const frame = analyzer.readFrame();
    assert.equal(frame.available, false);
    assert.equal(frame.level, 0);
    assert.equal(frame.beat, 0);
    assert.equal(frame.bpm, 0);
    assert.equal(frame.playing, false);
    assert.equal(frame.frequency.length, 256);
    assert.equal(frame.waveform.length, 256);
    assert.ok(frame.frequency.every((v) => v === 0));
});

test("静音时时域 RMS 为 0", () => {
    const { env, mediaElement } = createFakeEnv({
        frequency: new Array(2048).fill(0),
        timeDomain: new Array(4096).fill(128),
    });
    const analyzer = new AudioAnalyzer(env);
    analyzer.attach(mediaElement);

    const frame = analyzer.readFrame();
    assert.equal(frame.level, 0);
    assert.equal(frame.state, "ok");
});

test("level 用时域 RMS——满幅信号接近 1", () => {
    // 满幅方波（0 与 255 交替）：(v-128)/128 ≈ ±1，RMS ≈ 1
    const timeDomain = new Array(4096).fill(0);
    for (let i = 0; i < 4096; i++) timeDomain[i] = i % 2 === 0 ? 0 : 255;
    const { env, mediaElement } = createFakeEnv({
        frequency: new Array(2048).fill(0),
        timeDomain,
    });
    const analyzer = new AudioAnalyzer(env);
    analyzer.attach(mediaElement);

    const frame = analyzer.readFrame();
    // 频域均值会被大量静音 bin 稀释到 0.02~0.06，时域 RMS 才能覆盖真实响度范围
    assert.ok(frame.level > 0.9, `level 应为接近 1 的 RMS，实际 ${frame.level}`);
    assert.equal(frame.available, true);
    assert.equal(frame.playing, true);
});

test("波形被抽稀到 256 点", () => {
    const timeDomain = new Array(4096).fill(0);
    for (let i = 0; i < 4096; i++) timeDomain[i] = i % 256;
    const { env, mediaElement } = createFakeEnv({
        frequency: new Array(2048).fill(0),
        timeDomain,
    });
    const analyzer = new AudioAnalyzer(env);
    analyzer.attach(mediaElement);

    const frame = analyzer.readFrame();
    assert.equal(frame.waveform.length, 256);
});

test("解绑后是 idle 状态，不是 unsupported", () => {
    const { env, mediaElement } = createFakeEnv({ audioTracks: 1 });
    const analyzer = new AudioAnalyzer(env);

    analyzer.attach(mediaElement);
    assert.equal(analyzer.status, "ok");

    // 换歌时会先解绑——这不是「无法可视化」，只是暂时没有数据
    analyzer.detach();
    assert.equal(analyzer.status, "idle");
});

test("跨域时是 unsupported 状态", () => {
    const { env, mediaElement } = createFakeEnv({
        captureError: new Error("cross-origin"),
    });
    (mediaElement as unknown as { src: string }).src =
        "https://example.com/a.mp3";
    const analyzer = new AudioAnalyzer(env);

    analyzer.attach(mediaElement);
    assert.equal(analyzer.status, "unsupported");
});

test("策略 B 之后解绑不会断开元素源——断了播放器就永久静音", () => {
    const { env, mediaElement, elementNodeRecord } = createFakeEnv({
        audioTracks: 0,
    });
    const analyzer = new AudioAnalyzer(env);

    analyzer.attach(mediaElement);
    assert.equal(analyzer.status, "ok");

    analyzer.detach();

    // createMediaElementSource 之后，元素的音频**只能**经由该节点到达扬声器，
    // 断开它等于永久静音——所以解绑时绝不能碰它
    assert.equal(
        elementNodeRecord.disconnects,
        0,
        "解绑时断开了元素源，播放器会被永久静音",
    );
});

test("重新绑定同一元素时复用已有的元素源（该 API 对同一元素只能调一次）", () => {
    const { env, mediaElement, getMediaElementSourceCalls } = createFakeEnv({
        audioTracks: 0,
    });
    const analyzer = new AudioAnalyzer(env);

    analyzer.attach(mediaElement);
    assert.equal(getMediaElementSourceCalls(), 1);

    analyzer.detach();
    analyzer.attach(mediaElement);

    assert.equal(
        getMediaElementSourceCalls(),
        1,
        "重复调用 createMediaElementSource 会抛 InvalidStateError",
    );
});
