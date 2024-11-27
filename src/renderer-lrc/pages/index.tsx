import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import {useEffect, useMemo, useRef, useState} from "react";
import Condition from "@/renderer/components/Condition";
import SvgAsset from "@/renderer/components/SvgAsset";
import {PlayerState} from "@/common/constant";
import getTextWidth from "@/renderer/utils/get-text-width";
import useAppConfig from "@/hooks/useAppConfig";
import {appWindowUtil} from "@shared/utils/renderer";
import AppConfig from "@/shared/app-config/renderer";
import messageBus, {useAppStatePartial} from "@shared/message-bus/renderer/extension";

export default function LyricWindowPage() {
    const currentMusic = useAppStatePartial("musicItem");
    const playerState = useAppStatePartial("playerState");
    const lockLyric = useAppConfig("lyric.lockLyric");
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
                "lyric-window-container": true,
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
            <Condition condition={showOperations}>
                <div className="lyric-window-operation-container">
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
            <div className="lyric-window-content-container">
                <LyricContent></LyricContent>
            </div>
        </div>
    );
}

function LyricContent() {
    const currentMusic = useAppStatePartial("musicItem");
    const currentLyric = useAppStatePartial("parsedLrc");

    const fontDataConfig = useAppConfig("lyric.fontData");
    const fontSizeConfig = useAppConfig("lyric.fontSize");
    const fontColorConfig = useAppConfig("lyric.fontColor");
    const fontStrokeConfig = useAppConfig("lyric.strokeColor");

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

    // const lastIndexRef = useRef(0);

    // const currentIndex = useMemo(() => {
    //   if (!lyric?.length) {
    //     return -1;
    //   }
    //   for (
    //     let i = lastIndexRef.current % lyric.length;
    //     i !== (lastIndexRef.current + lyric.length - 1) % lyric.length;
    //     i = (i + 1) % lyric.length
    //   ) {
    //     if (lyric[i].time >= progress.currentTime) {
    //       lastIndexRef.current = i - 1;
    //       return i - 1;
    //     }
    //   }
    //   lastIndexRef.current = lyric.length - 1;
    //   return lyric.length - 1;
    // }, [lyric, progress]);

    return (
        <div
            className="lyric-text-row"
            style={{
                color: fontColorConfig,
                WebkitTextStrokeColor: fontStrokeConfig,
                fontSize: fontSizeConfig,
                fontFamily: fontDataConfig?.family || undefined,
                left: textWidth > window.innerWidth ? 0 : undefined,
            }}
        >
            {currentLyric?.lrc ??
                (currentMusic
                    ? `${currentMusic.title} - ${currentMusic.artist}`
                    : "暂无歌词")}
        </div>
    );
}
