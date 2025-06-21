import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import Condition from "@/renderer/components/Condition";
import SvgAsset from "@/renderer/components/SvgAsset";
import {PlayerState} from "@/common/constant";
import getTextWidth from "@/renderer/utils/get-text-width";
import useAppConfig from "@/hooks/useAppConfig";
import {appWindowUtil} from "@shared/utils/renderer";
import AppConfig from "@shared/app-config/renderer";
import messageBus, {useAppStatePartial} from "@shared/message-bus/renderer/extension";
import {IAppState} from "@shared/message-bus/type";

const LYRIC_OFFSET_STEP = 0.1; // 100ms

export default function LyricWindowPage() {
    const currentMusic = useAppStatePartial("musicItem");
    const playerState = useAppStatePartial("playerState");
    const lockLyric = useAppConfig("lyric.lockLyric");
    const [lyricOffset, setLyricOffset] = useAppConfig("lyric.offset");
    const [showOperations, setShowOperations] = useState(false);

    const mouseOverTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (lockLyric) {
            setShowOperations(false);
        }
    }, [lockLyric]);

    return (
        <div
            className={classNames({
                "container": true,
                "lock-lyric": lockLyric,
            })}
            onMouseOver={() => {
                if (!lockLyric || mouseOverTimerRef.current) {
                    if (!lockLyric) {
                        setShowOperations(true);
                    }
                    return;
                }
                mouseOverTimerRef.current = window.setTimeout(() => {
                    setShowOperations(true);
                    clearTimeout(mouseOverTimerRef.current);
                    mouseOverTimerRef.current = null;
                }, 1000);
            }}
            onMouseLeave={() => {
                setShowOperations(false);
                if (mouseOverTimerRef.current) {
                    clearTimeout(mouseOverTimerRef.current);
                    mouseOverTimerRef.current = null;
                }
            }}
        >
            <div className='operation-outer-container'>
                <Condition condition={showOperations}>
                    <div className="operation-container">
                        <Condition
                            condition={!lockLyric}
                            falsy={
                                <div
                                    className="operation-button"
                                    onClick={() => {
                                        AppConfig.setConfig({
                                            "lyric.lockLyric": false
                                        })
                                    }}
                                    onMouseOver={() => {
                                        appWindowUtil.ignoreMouseEvent(false);
                                    }}
                                    onMouseLeave={() => {
                                        appWindowUtil.ignoreMouseEvent(true);
                                    }}
                                >
                                    <SvgAsset iconName="lock-open"></SvgAsset>
                                </div>
                            }
                        >
                            <div
                                className="operation-button"
                                onClick={() => {
                                    messageBus.sendCommand("SkipToPrevious");
                                }}
                            >
                                <SvgAsset iconName="skip-left"></SvgAsset>
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    if (currentMusic) {
                                        messageBus.sendCommand("TogglePlayerState");
                                    }
                                }}
                            >
                                <SvgAsset
                                    iconName={
                                        playerState === PlayerState.Playing ? "pause" : "play"
                                    }
                                ></SvgAsset>
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    messageBus.sendCommand("SkipToNext");
                                }}
                            >
                                <SvgAsset iconName="skip-right"></SvgAsset>
                            </div>
                            {/* Lyric Offset Adjustment Buttons */}
                            <div
                                className="operation-button"
                                onClick={() => {
                                    setLyricOffset((lyricOffset ?? 0) - LYRIC_OFFSET_STEP);
                                }}
                            >
                                <SvgAsset iconName="font-size-smaller"></SvgAsset> {/* Placeholder icon */}
                            </div>
                            <div className="operation-button-text">
                                {((lyricOffset ?? 0) * 1000).toFixed(0)}ms
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    setLyricOffset((lyricOffset ?? 0) + LYRIC_OFFSET_STEP);
                                }}
                            >
                                <SvgAsset iconName="font-size-larger"></SvgAsset> {/* Placeholder icon */}
                            </div>
                            {/* End Lyric Offset Adjustment Buttons */}
                            <div
                                className="operation-button"
                                onClick={() => {
                                    AppConfig.setConfig({
                                        "lyric.lockLyric": true
                                    });
                                }}
                            >
                                <SvgAsset iconName="lock-closed"></SvgAsset>
                            </div>
                            <div
                                className="operation-button"
                                onClick={() => {
                                    appWindowUtil.setLyricWindow(false);
                                }}
                            >
                                <SvgAsset iconName="x-mark"></SvgAsset>
                            </div>
                        </Condition>
                    </div>
                </Condition>
            </div>
            <div className="content-container">
                <LyricContent></LyricContent>
            </div>
        </div>
    );
}

function LyricContent() {
    const currentMusic = useAppStatePartial("musicItem");
    const currentLyric = useAppStatePartial("parsedLrc");
    const currentFullLyric = useAppStatePartial("fullLyric");
    const [lyricOffset] = useAppConfig("lyric.offset"); // Get the offset

    const fontDataConfig = useAppConfig("lyric.fontData");
    const fontSizeConfig = useAppConfig("lyric.fontSize");
    const fontColorConfig = useAppConfig("lyric.fontColor");
    const fontStrokeConfig = useAppConfig("lyric.strokeColor");

    const [enableTransition, setEnableTransition] = useState(false);

    const textWidth = useMemo(() => {
        if (currentLyric?.lrc) {
            return getTextWidth(currentLyric?.lrc, {
                fontSize: fontSizeConfig ?? 48,
                fontFamily: fontDataConfig?.family || undefined,
            });
        } else if (currentMusic) {
            return getTextWidth(`${currentMusic.title} - ${currentMusic.artist}`, {
                fontSize: fontSizeConfig ?? 48,
                fontFamily: fontDataConfig?.family || undefined,
            });
        }
        return 0;
    }, [currentLyric, fontDataConfig, fontSizeConfig, currentMusic]);

    const [left, setLeft] = useState(null);

    useLayoutEffect(() => {
        if (textWidth > window.innerWidth) {
            setEnableTransition(false);
            setLeft(0);
        } else {
            setLeft(null);
        }
    }, [textWidth]);

    useLayoutEffect(() => {
        const callback = (_: any, patch: IAppState) => {
            if (!patch.progress) {
                return;
            }
            if (textWidth > window.innerWidth) {
                if (currentLyric && currentLyric.index > -1 && currentFullLyric) {
                    const nextLyric = currentFullLyric[currentLyric.index + 1];
                    if (nextLyric && (nextLyric.time > currentLyric.time)) {
                        const diff = nextLyric.time - currentLyric.time;
                        const virtualPointer = (patch.progress - currentLyric.time) / diff * textWidth;
                        if (virtualPointer > window.innerWidth * 0.5) {
                            setEnableTransition(true);
                            setLeft(-Math.min((virtualPointer - window.innerWidth * 0.5) * 1.1, textWidth - window.innerWidth));
                            return;
                        }
                    }
                }
                setEnableTransition(false);
                setLeft(0);
            } else {
                setEnableTransition(false);
                setLeft(null);
            }
        };
        messageBus.onStateChange(callback);

        return () => {
            messageBus.offStateChange(callback);
        }

    }, [textWidth, currentFullLyric, currentLyric]);


    return (
        <div
            className="lyric-text-row"
            style={{
                color: fontColorConfig,
                WebkitTextStrokeColor: fontStrokeConfig,
                fontSize: fontSizeConfig,
                fontFamily: fontDataConfig?.family || undefined,
                left: left,
                transition: enableTransition ? "left 900ms linear" : "none",
            }}
        >
            {currentLyric?.lrc ??
                (currentMusic
                    ? `${currentMusic.title} - ${currentMusic.artist}`
                    : "暂无歌词")}
        </div>
    );
}
