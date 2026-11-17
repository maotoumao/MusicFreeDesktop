import { test } from "node:test";
import assert from "node:assert/strict";
import { getSeekTarget } from "./seek.ts";

test("正常前进 5 秒", () => {
    assert.equal(getSeekTarget(10, 100, 5), 15);
});

test("正常后退 5 秒", () => {
    assert.equal(getSeekTarget(10, 100, -5), 5);
});

test("从 0 附近快退停在 0，不出现负数", () => {
    assert.equal(getSeekTarget(2, 100, -5), 0);
});

test("不超过曲目时长", () => {
    assert.equal(getSeekTarget(98, 100, 5), 100);
});

test("时长未知时只夹下界", () => {
    assert.equal(getSeekTarget(10, Infinity, 5), 15);
    assert.equal(getSeekTarget(10, NaN, 5), 15);
    assert.equal(getSeekTarget(2, Infinity, -5), 0);
});

test("当前时间非有限值时按 0 处理", () => {
    assert.equal(getSeekTarget(NaN, 100, 5), 5);
});
