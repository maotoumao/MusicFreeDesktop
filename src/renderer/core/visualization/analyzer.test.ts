import { test } from "node:test";
import assert from "node:assert/strict";
import { AudioAnalyzer } from "./analyzer.ts";
import type { IAudioEnvironment } from "./analyzer.ts";

/** 假的音频节点：只需要 connect/disconnect 会被调用 */
function fakeNode() {
    return { connect: (): void => undefined, disconnect: (): void => undefined };
}

/** 假 analyser：可控的频域/时域数据 */
function createFakeAnalyser(frequency: number[], timeDomain: number[]) {
    const freq = new Uint8Array(1024);
    frequency.forEach((v, i) => (freq[i] = v));
    const wave = new Uint8Array(2048);
    timeDomain.forEach((v, i) => (wave[i] = v));
    return {
        fftSize: 2048,
        frequencyBinCount: 1024,
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
            return fakeNode() as unknown as MediaElementAudioSourceNode;
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

    return { env, calls, mediaElement };
}

test("captureStream 拿到音轨时走策略 A 并可读帧", () => {
    const { env, calls, mediaElement } = createFakeEnv({
        frequency: new Array(1024).fill(0),
        timeDomain: new Array(2048).fill(128),
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
    assert.equal(frame.frequency.length, 512);
    assert.equal(frame.waveform.length, 256);
    assert.ok(frame.frequency.every((v) => v === 0));
});

test("level 按频域均值计算", () => {
    const frequency = new Array(1024).fill(0);
    frequency.fill(255, 0, 100); // 前 100 个 bin 满量程
    const { env, mediaElement } = createFakeEnv({
        frequency,
        timeDomain: new Array(2048).fill(128),
    });
    const analyzer = new AudioAnalyzer(env);
    analyzer.attach(mediaElement);

    const frame = analyzer.readFrame();
    // 100/1024 个 bin 满量程 → 平均约 25/255
    assert.ok(frame.level > 0.05 && frame.level < 0.15, `level 异常：${frame.level}`);
    assert.equal(frame.available, true);
    assert.equal(frame.playing, true);
});

test("波形被抽稀到 256 点", () => {
    const timeDomain = new Array(2048).fill(0);
    for (let i = 0; i < 2048; i++) timeDomain[i] = i % 256;
    const { env, mediaElement } = createFakeEnv({
        frequency: new Array(1024).fill(0),
        timeDomain,
    });
    const analyzer = new AudioAnalyzer(env);
    analyzer.attach(mediaElement);

    const frame = analyzer.readFrame();
    assert.equal(frame.waveform.length, 256);
});
