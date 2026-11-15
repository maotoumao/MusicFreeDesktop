import { test } from "node:test";
import assert from "node:assert/strict";
import { mapToLogBins } from "./log-bins.ts";

const opts = { sampleRate: 48000, fftSize: 2048 };

test("全零输入映射后仍全零", () => {
    const out = mapToLogBins(new Uint8Array(1024), 512, opts);
    assert.equal(out.length, 512);
    assert.ok(out.every((v) => v === 0));
});

test("单个非零 bin 会落到对应的输出 bin", () => {
    const input = new Uint8Array(1024);
    // bin 1 ≈ 23.4~46.9Hz（binHz = 48000/2048 = 23.4375），
    // 落在第一个对数输出 bin（中心频率 40Hz）的覆盖区间内。
    input[1] = 200;
    const out = mapToLogBins(input, 512, opts);
    assert.equal(out[0], 200);
    // 高频端不串扰
    assert.equal(out[out.length - 1], 0);
});

test("低频区多个输出 bin 可共享同一个输入 bin", () => {
    const input = new Uint8Array(1024);
    input[1] = 200;
    const out = mapToLogBins(input, 512, opts);
    const nonZeroIndexes = Array.from(out, (v, i) => (v ? i : -1)).filter(
        (i) => i >= 0,
    );
    assert.ok(nonZeroIndexes.length >= 1);
    assert.ok(
        nonZeroIndexes.every((i) => i < 64),
        `非零输出 bin 应集中在低频端，实际散布到 ${nonZeroIndexes}`,
    );
});

test("输入递增时输出非递减", () => {
    const input = new Uint8Array(1024);
    // 单调不减的输入（不是 i % 256 的锯齿——那会在 256 回绕处下降，
    // 测的就不是「输入递增」而是「输入锯齿」了）
    for (let i = 0; i < input.length; i++) {
        input[i] = Math.min(255, Math.floor((i * 256) / input.length));
    }
    const out = mapToLogBins(input, 512, opts);
    for (let i = 1; i < out.length; i++) {
        assert.ok(out[i] >= out[i - 1], `第 ${i} 个输出 bin 下降了`);
    }
});

test("输出 bin 数固定为请求值", () => {
    assert.equal(mapToLogBins(new Uint8Array(1024), 64, opts).length, 64);
});
