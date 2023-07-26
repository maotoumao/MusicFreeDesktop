import rendererAppConfig from "@/common/app-config/renderer";
import currentLyricStore from "../store/current-lyric-store";
import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import { useEffect, useMemo, useRef, useState } from "react";
import Condition from "@/renderer/components/Condition";
import SvgAsset from "@/renderer/components/SvgAsset";
import { ipcRendererInvoke, ipcRendererSend } from "@/common/ipc-util/renderer";
import { PlayerState } from "@/renderer/core/track-player/enum";

export default function LyricWindowPage() {
  const lyricStore = currentLyricStore.useValue();
  const { lrc: lyric = [], currentMusic, playerState } = lyricStore;
  const lyricAppConfig = rendererAppConfig.useAppConfig()?.lyric;

  const lockLyric = lyricAppConfig?.lockLyric;
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
                  ipcRendererSend("set-desktop-lyric-lock", false);
                }}
                onMouseOver={() => {
                  ipcRendererSend("ignore-mouse-event", {
                    ignore: false,
                    window: "lyric",
                  });
                }}
                onMouseLeave={() => {
                  ipcRendererSend("ignore-mouse-event", {
                    ignore: true,
                    window: "lyric",
                  });
                }}
              >
                <SvgAsset iconName="lock-open"></SvgAsset>
              </div>
            }
          >
            <div
              className="operation-button"
              onClick={() => {
                ipcRendererSend("player-cmd", {
                  cmd: "skip-prev",
                });
              }}
            >
              <SvgAsset iconName="skip-left"></SvgAsset>
            </div>
            <div
              className="operation-button"
              onClick={() => {
                if (currentMusic) {
                  ipcRendererSend("player-cmd", {
                    cmd: "set-player-state",
                    payload:
                      playerState === PlayerState.Playing
                        ? PlayerState.Paused
                        : PlayerState.Playing,
                  });
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
                ipcRendererSend("player-cmd", {
                  cmd: "skip-next",
                });
              }}
            >
              <SvgAsset iconName="skip-right"></SvgAsset>
            </div>
            <div
              className="operation-button"
              onClick={() => {
                ipcRendererSend("set-desktop-lyric-lock", true);
              }}
            >
              <SvgAsset iconName="lock-closed"></SvgAsset>
            </div>
            <div
              className="operation-button"
              onClick={() => {
                ipcRendererInvoke("set-lyric-window", false);
              }}
            >
              <SvgAsset iconName="x-mark"></SvgAsset>
            </div>
          </Condition>
        </div>
      </Condition>
      <div className="lyric-window-content-container">
        <div
          className='lyric-text-row'
          style={{
            color: lyricAppConfig?.fontColor,
            WebkitTextStrokeColor: lyricAppConfig?.strokeColor,
            fontSize: lyricAppConfig?.fontSize,
          }}
        >
          {lyric[0]?.lrc ??
            (currentMusic
              ? `${currentMusic.title} - ${currentMusic.artist}`
              : "暂无歌词")}
        </div>
      </div>
    </div>
  );
}
