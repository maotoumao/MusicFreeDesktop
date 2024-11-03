import "./index.scss";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import {useEffect, useRef, useState} from "react";

import hotkeys from "hotkeys-js";
import {bindShortCut} from "@/renderer/core/shortcut";
import {ipcRendererSend} from "@/shared/ipc/renderer";
import {useTranslation} from "react-i18next";
import AppConfig from "@shared/app-config/renderer";
import useAppConfig from "@/hooks/useAppConfig";
import {IAppConfig} from "@/types/app-config";


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
                onChange={(_evt, val) => {
                    ipcRendererSend("enable-global-short-cut", val);
                }}
                label={t("settings.short_cut.enable_global")}
            ></CheckBoxSettingItem>
            <ShortCutTable></ShortCutTable>
        </div>
    );
}

type IShortCutKeys = keyof IAppConfig["shortCut.shortcuts"];

const shortCutKeys: IShortCutKeys[] = [
    "play/pause",
    "skip-next",
    "skip-previous",
    "volume-up",
    "volume-down",
    "toggle-desktop-lyric",
    "like/dislike",
];


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
            {shortCutKeys.map((it) => (
                <div className="setting-view--short-cut-table-row" key={it}>
                    <div className="short-cut-cell">{t(`settings.short_cut.${it}`)}</div>
                    <div className="short-cut-cell">
                        <ShortCutItem
                            enabled={enableLocalShortCut}
                            value={shortCuts?.[it]?.local}
                            onChange={(val) => {
                                bindShortCut(it as IShortCutKeys, val);
                                const prevShortCuts: any = AppConfig.getConfig("shortCut.shortcuts") || {};
                                prevShortCuts[it] = {
                                    ...(prevShortCuts[it] ?? {}),
                                    local: val
                                };
                                AppConfig.setConfig({
                                    "shortCut.shortcuts": prevShortCuts
                                })
                            }}
                        ></ShortCutItem>
                    </div>
                    <div className="short-cut-cell">
                        <ShortCutItem
                            enabled={enableGlobalShortCut}
                            value={shortCuts?.[it]?.global}
                            onChange={(val) => {
                                bindShortCut(it as IShortCutKeys, val, true);
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
    value?: string[];
    onChange?: (sc?: string[]) => void;
}

function formatValue(val: string[]) {
    return val.join(" + ");
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
    const {value, onChange, enabled, isGlobal} = props;
    const [tmpValue, setTmpValue] = useState<string[] | null>();
    const realValue = formatValue(tmpValue ?? value ?? []);
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
                console.log(evt);
                const type = evt.type;
                let key = evt.key.toLowerCase();
                if (evt.code === "Space") {
                    key = "Space";
                }
                if (type === "keydown") {
                    isRecordingRef.current = true;
                    if (key === "backspace") {
                        // 删除
                        setTmpValue(null);
                        isRecordingRef.current = false;
                        recordedKeysRef.current.clear();
                        // 新的快捷键为空
                        onChange?.([]);
                    } else if (key === "meta") {
                        setTmpValue(null);
                        isRecordingRef.current = false;
                        recordedKeysRef.current.clear();
                    } else {
                        if (!recordedKeysRef.current.has(key)) {
                            recordedKeysRef.current.add(key);
                            setTmpValue(
                                [...recordedKeysRef.current].map((it) =>
                                    it.replace(/^(.)/, (_, $1: string) => $1.toUpperCase())
                                )
                            );
                        }
                    }
                } else if (type === "keyup" && isRecordingRef.current) {
                    isRecordingRef.current = false;
                    // 开始结算
                    const recordedSet = recordedKeysRef.current;
                    const _recordShortCutKey = [];

                    let statusCode = 0;
                    if (recordedSet.has("ctrl") || recordedSet.has("control")) {
                        _recordShortCutKey.push("Ctrl");
                        recordedSet.delete("ctrl");
                        recordedSet.delete("control");
                        statusCode |= 1;
                    }
                    if (recordedSet.has("command")) {
                        _recordShortCutKey.push("Command");
                        recordedSet.delete("command");
                        statusCode |= 1;
                    }
                    if (recordedSet.has("option")) {
                        _recordShortCutKey.push("Option");
                        recordedSet.delete("option");
                        statusCode |= 1;
                    }
                    if (recordedSet.has("shift")) {
                        _recordShortCutKey.push("Shift");
                        recordedSet.delete("shift");
                        statusCode |= 1;
                    }

                    if (recordedSet.has("alt")) {
                        _recordShortCutKey.push("Alt");
                        recordedSet.delete("alt");
                        statusCode |= 1;
                    }

                    if (recordedSet.size === 1 && (isGlobal ? statusCode : true)) {
                        _recordShortCutKey.push(
                            keyCodeMap([...recordedSet.values()][0]).replace(
                                /^(.)/,
                                (_, $1: string) => $1.toUpperCase()
                            )
                        );
                        setTmpValue(_recordShortCutKey);
                        onChange?.(_recordShortCutKey);
                    } else {
                        setTmpValue(null);
                    }

                    recordedKeysRef.current.clear();
                }
            }
        );
    }, []);

    return (
        <input
            data-capture="true"
            data-disabled={!enabled}
            autoCorrect="off"
            autoCapitalize="off"
            type="text"
            readOnly
            aria-live="off"
            className="short-cut-item--container"
            value={realValue || t("settings.short_cut.no_short_cut")}
            onKeyDown={(e) => {
                e.preventDefault();
            }}
            onFocus={() => {
                hotkeys.setScope(scopeRef.current);
            }}
            onBlur={() => {
                hotkeys.setScope("all");
                setTmpValue(null);
                recordedKeysRef.current.clear();
            }}
        ></input>
    );
}
