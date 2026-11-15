import { test } from "node:test";
import assert from "node:assert/strict";
import { pickNextEffectId } from "./engine.ts";

const ids = ["bars", "oscilloscope", "spectrum"];

test("锁定模式返回指定效果", () => {
    assert.equal(pickNextEffectId("bars", "bars", ids), "bars");
});

test("随机模式不会选到当前效果", () => {
    for (let i = 0; i < 20; i++) {
        const next = pickNextEffectId("bars", "random", ids);
        assert.notEqual(next, "bars");
        assert.ok(ids.includes(next));
    }
});

test("只有一个效果时随机模式返回它自己", () => {
    assert.equal(pickNextEffectId("bars", "random", ["bars"]), "bars");
});
