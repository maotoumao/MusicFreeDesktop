import rendererAppConfig from "@/common/app-config/renderer";
import currentLyricStore from "../store/current-lyric-store";
import "./index.scss";
import classNames from "@/renderer/utils/classnames";
import { useEffect, useRef, useState } from "react";
import Condition from "@/renderer/components/Condition";
import SvgAsset from "@/renderer/components/SvgAsset";
import { ipcRendererSend } from "@/common/ipc-util/renderer";

export default function LyricWindowPage() {
  const lyric = currentLyricStore.useValue();
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
        console.log("over");
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
                ipcRendererSend("set-desktop-lyric-lock", true);
              }}
            >
              <SvgAsset iconName="lock-closed"></SvgAsset>
            </div>
          </Condition>
        </div>
      </Condition>
      <div className="lyric-window-content-container">
        <div className="lyric-text-row">{lyric[0]?.lrc ?? "暂无歌词"}</div>
      </div>
    </div>
  );
}
