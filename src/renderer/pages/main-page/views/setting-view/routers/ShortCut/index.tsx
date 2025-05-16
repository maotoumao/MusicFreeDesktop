// src/renderer/pages/main-page/views/setting-view/routers/ShortCut/index.tsx
import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import {useEffect, useRef, useState} from "react";

import hotkeys from "hotkeys-js";
import {useTranslation} from "react-i18next";
import useAppConfig from "@/hooks/useAppConfig";
import {IAppConfig} from "@/types/app-config";
import shortCut from "@shared/short-cut/renderer";
import {shortCutKeys} from "@/common/constant"; // shortCutKeys 已经是 IShortCutKeys[] 类型
import SvgAsset from "@renderer/components/SvgAsset";

// 定义 IShortCutKeys 类型，使其与 IAppConfig["shortCut.shortcuts"] 的键匹配
type IShortCutKeyNames = keyof IAppConfig["shortCut.shortcuts"];


export default function ShortCut() {
    const {t} = useTranslation();

    return (
        <div className="setting-view--short-cut-container">
            <CheckBoxSettingItem
                keyPath="shortCut.enableLocal"
                label={t("settings.short_cut.enable_local")}
            ></CheckBoxSettingItem>
            <CheckBoxSettingItem
                keyPath="shortCut.enableGlobal"
                label={t("settings.short_cut.enable_global")}
            ></CheckBoxSettingItem>
            <ShortCutTable></ShortCutTable>
        </div>
    );
}

// type IShortCutKeys = keyof IAppConfig["shortCut.shortcuts"]; // 移到上面


function ShortCutTable() {
    const {t} = useTranslation();

    const enableLocalShortCut = useAppConfig("shortCut.enableLocal");
    const enableGlobalShortCut = useAppConfig("shortCut.enableGlobal");
    const shortCuts = useAppConfig("shortCut.shortcuts");


    return (
        <div className="setting-view--short-cut-table-container">
            <div className="setting-view--short-cut-table-row">
                <div className="short-cut-cell">{t("settings.short_cut.ability")}</div>
                <div className="short-cut-cell">
                    {t("settings.short_cut.enable_local")}
                </div>
                <div className="short-cut-cell">
                    {t("settings.short_cut.enable_global")}
                </div>
            </div>
            {/* 确保 shortCutKeys 数组中的元素类型是 IShortCutKeyNames */}
            {(shortCutKeys as IShortCutKeyNames[]).map((it: IShortCutKeyNames) => ( // 修改此处的 it 类型
                <div className="setting-view--short-cut-table-row" key={it}>
                    <div className="short-cut-cell">{t(`settings.short_cut.${it}`)}</div>
                    <div className="short-cut-cell">
                        <ShortCutItem
                            enabled={enableLocalShortCut}
                            value={shortCuts?.[it]?.local}
                            onChange={(val) => {
                                shortCut.registerLocalShortCut(it, val); // it 现在是正确的类型
                            }}
                            showClearButton
                            onClear={() => {
                                shortCut.unregisterLocalShortCut(it); // it 现在是正确的类型
                            }}
                        ></ShortCutItem>
                    </div>
                    <div className="short-cut-cell">
                        <ShortCutItem
                            enabled={enableGlobalShortCut}
                            value={shortCuts?.[it]?.global}
                            onChange={(val) => {
                                shortCut.registerGlobalShortCut(it, val); // it 现在是正确的类型
                            }}
                            showClearButton
                            onClear={() => {
                                shortCut.unregisterGlobalShortCut(it); // it 现在是正确的类型
                            }}
                        ></ShortCutItem>
                    </div>
                </div>
            ))}
        </div>
    );
}

interface IShortCutItemProps {
    enabled?: boolean;
    isGlobal?: boolean;
    value?: string[] | null; // 允许 null
    onChange?: (sc?: string[] | null) => void; // 允许 null
    showClearButton?: boolean;
    onClear?: () => void;
}

function formatValue(val: string[] | null | undefined) { // 允许 null 或 undefined
    return val && val.length > 0 ? val.join(" + ") : "";
}

function keyCodeMap(code: string) {
    switch (code) {
        case "arrowup":
            return "Up";
        case "arrowdown":
            return "Down";
        case "arrowleft":
            return "Left";
        case "arrowright":
            return "Right";
        default:
            return code;
    }
}

function ShortCutItem(props: IShortCutItemProps) {
    const {value, onChange, enabled, isGlobal, showClearButton, onClear} = props;
    const [tmpValue, setTmpValue] = useState<string[] | null>(null); // 初始可以是 null
    const realValue = formatValue(tmpValue ?? value); // 如果 tmpValue 是 null，则使用 value
    const isRecordingRef = useRef(false);
    const scopeRef = useRef(Math.random().toString().slice(2));
    const recordedKeysRef = useRef(new Set<string>());
    const {t} = useTranslation();

    useEffect(() => {
        hotkeys(
            "*",
            {
                scope: scopeRef.current,
                keyup: true,
            },
            (evt) => {
                const type = evt.type;
                let key = evt.key.toLowerCase();
                if (evt.code === "Space") {
                    key = "Space";
                }
                if (type === "keydown") {
                    isRecordingRef.current = true;
                    if (key === "meta") { // macOS Command key
                        setTmpValue(null);
                        isRecordingRef.current = false;
                        recordedKeysRef.current.clear();
                    } else {
                        if (!recordedKeysRef.current.has(key)) {
                            recordedKeysRef.current.add(key);
                            setTmpValue(
                                [...recordedKeysRef.current].map((k) => // 使用 k 避免与外部 key 冲突
                                    keyCodeMap(k).replace(/^(.)/, (_, $1: string) => $1.toUpperCase())
                                )
                            );
                        }
                    }
                } else if (type === "keyup" && isRecordingRef.current) {
                    isRecordingRef.current = false;
                    const recordedSet = recordedKeysRef.current;
                    const _recordShortCutKey: string[] = []; // 显式类型

                    let statusCode = 0; // 用于检查是否有修饰键
                    if (recordedSet.has("ctrl") || recordedSet.has("control")) {
                        _recordShortCutKey.push("Ctrl");
                        recordedSet.delete("ctrl");
                        recordedSet.delete("control");
                        statusCode |= 1;
                    }
                    // 在 macOS 上，Command 键通常是主要的修饰键
                    if (recordedSet.has("meta")) { // 监听 meta 键 (Command on macOS, Windows key on Windows)
                        _recordShortCutKey.push("Command"); // 或者根据平台显示不同的名称
                        recordedSet.delete("meta");
                        statusCode |= 1;
                    }
                    if (recordedSet.has("alt") || recordedSet.has("option")) { // option 是 macOS 的 Alt
                        _recordShortCutKey.push("Alt"); // 或者根据平台显示 Option
                        recordedSet.delete("alt");
                        recordedSet.delete("option");
                        statusCode |= 1;
                    }
                    if (recordedSet.has("shift")) {
                        _recordShortCutKey.push("Shift");
                        recordedSet.delete("shift");
                        statusCode |= 1;
                    }


                    if (recordedSet.size === 1 && (isGlobal ? statusCode > 0 : true)) { // 全局快捷键至少需要一个修饰键
                        _recordShortCutKey.push(
                            keyCodeMap([...recordedSet.values()][0]).replace(
                                /^(.)/,
                                (_, $1: string) => $1.toUpperCase()
                            )
                        );
                        setTmpValue(_recordShortCutKey);
                        onChange?.(_recordShortCutKey);
                    } else if (recordedSet.size === 0 && statusCode > 0) { // 只按了修饰键，不合法
                        setTmpValue(null);
                        onChange?.(null);
                    }
                    else {
                        setTmpValue(null);
                         onChange?.(null); // 如果组合不合法，也通知父组件清空
                    }
                    recordedKeysRef.current.clear();
                }
            }
        );
        // 清理 hotkeys 监听
        return () => {
            hotkeys.unbind("*", scopeRef.current);
        };
    }, [isGlobal, onChange]); // 添加 isGlobal 和 onChange 到依赖数组

    return (
        <div className="short-cut-item--container">
            <input
                data-capture="true"
                data-disabled={!enabled}
                // data-show-clear-button={showClearButton} // 这个属性似乎没有在 CSS 中使用
                autoCorrect="off"
                autoCapitalize="off"
                type="text"
                readOnly
                aria-live="off"
                className="short-cut-item--input"
                value={realValue || t("settings.short_cut.no_short_cut")}
                onKeyDown={(e) => {
                    e.preventDefault(); // 阻止默认行为，例如空格滚动页面
                }}
                onFocus={() => {
                    hotkeys.setScope(scopeRef.current);
                }}
                onBlur={() => {
                    hotkeys.setScope("all");
                    if (isRecordingRef.current) { //如果在记录过程中失去焦点，也应该清空
                        onChange?.(tmpValue ?? value ?? null); // 将当前记录的或已有的值提交
                    }
                    setTmpValue(null); // 清空临时值
                    recordedKeysRef.current.clear();
                    isRecordingRef.current = false;
                }}
            />
            {/* 只有当value有值且showClearButton为true时才显示清除按钮 */}
            {(enabled && showClearButton && (value && value.length > 0)) ? (
                <div className='short-cut-item--clear-button' role="button" onClick={() => {
                    setTmpValue(null); // 清空临时值
                    onClear?.();
                }}>
                    <SvgAsset iconName='x-mark'></SvgAsset>
                </div>
            ) : null}
        </div>
    );
}