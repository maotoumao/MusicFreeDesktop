import { test } from "node:test";
import assert from "node:assert/strict";
import { parseThemeColors, defaultThemeColors } from "./theme-colors.ts";

test("缺失的变量回落到默认色", () => {
    const c = parseThemeColors({});
    assert.equal(c.primary, defaultThemeColors.primary);
    assert.equal(c.text, defaultThemeColors.text);
    assert.equal(c.background, defaultThemeColors.background);
});

test("提供了就用提供的值", () => {
    const c = parseThemeColors({
        "--primaryColor": "#f0a020",
        "--textColor": "#fff",
    });
    assert.equal(c.primary, "#f0a020");
    assert.equal(c.text, "#fff");
});

test("空字符串视为缺失", () => {
    const c = parseThemeColors({ "--primaryColor": "   " });
    assert.equal(c.primary, defaultThemeColors.primary);
});
