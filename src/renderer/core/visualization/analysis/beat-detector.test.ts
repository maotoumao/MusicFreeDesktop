import { test } from "node:test";
import assert from "node:assert/strict";
import { BeatDetector } from "./beat-detector.ts";

test("恒定输入不产生节拍", () => {
    const d = new BeatDetector();
    let maxBeat = 0;
    for (let i = 0; i < 200; i++) {
        maxBeat = Math.max(maxBeat, d.push(0.3, i * 16.67).beat);
    }
    assert.equal(maxBeat, 0);
    assert.equal(d.push(0.3, 3000).bpm, 0);
});

test("每 500ms 一个脉冲被判为 120 BPM", () => {
    const d = new BeatDetector();
    for (let i = 0; i < 600; i++) {
        const t = i * 16.67;
        const energy = i % 30 === 0 ? 0.9 : 0.2; // 30 帧 ≈ 500ms
        d.push(energy, t);
    }
    const bpm = d.push(0.2, 600 * 16.67).bpm;
    assert.ok(Math.abs(bpm - 120) < 12, `期望 ~120 BPM，实际 ${bpm}`);
});

test("节拍包络在触发后衰减", () => {
    const d = new BeatDetector();
    for (let i = 0; i < 30; i++) d.push(0.2, i * 16.67);
    const hit = d.push(0.95, 30 * 16.67);
    assert.ok(hit.beat > 0.9, `触发时应接近 1，实际 ${hit.beat}`);
    const later = d.push(0.2, 30 * 16.67 + 500);
    assert.ok(later.beat < 0.1, `500ms 后应衰减到接近 0，实际 ${later.beat}`);
});

test("过于密集的脉冲不会重复触发", () => {
    const d = new BeatDetector();
    for (let i = 0; i < 30; i++) d.push(0.2, i * 16.67);
    d.push(0.95, 30 * 16.67);
    const second = d.push(0.95, 30 * 16.67 + 50); // 距上一拍仅 50ms
    assert.ok(second.beat < 0.5, `50ms 内不应再次触发，实际 ${second.beat}`);
});
