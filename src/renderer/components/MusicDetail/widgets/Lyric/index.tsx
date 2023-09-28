import trackPlayer from "@/renderer/core/track-player";
import "./index.scss";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import { useEffect, useRef, useState } from "react";
import { showContextMenu } from "@/renderer/components/ContextMenu";
import {
  getUserPerference,
  setUserPerference,
} from "@/renderer/utils/user-perference";
import { ipcRendererInvoke } from "@/common/ipc-util/renderer";
import { toast } from "react-toastify";
import { showModal } from "@/renderer/components/Modal";
import { getCurrentMusic } from "@/renderer/core/track-player/player";

const fontSizeList = Array(25)
  .fill(0)
  .map((_, index) => ({
    title: `${index + 8}`,
  }));

export default function Lyric() {
  const currentLrc = trackPlayer.useLyric();
  const containerRef = useRef<HTMLDivElement>();
  const [fontSize, setFontSize] = useState<string | null>(
    getUserPerference("inlineLyricFontSize")
  );

  useEffect(() => {
    if (containerRef.current) {
      const currentIndex = currentLrc?.currentLrc?.index;
      if (currentIndex >= 0) {
        const dom = document.querySelector(`#lyric-item-id-${currentIndex}`) as
          | HTMLDivElement
          | undefined;
        if (dom) {
          const offsetTop = dom.offsetTop - 210 + dom.clientHeight / 2;
          containerRef.current.scrollTo({
            behavior: "smooth",
            top: offsetTop,
          });
        }
      }
    }
  }, [currentLrc?.currentLrc]);

  return (
    <div
      className="lyric-container"
      data-loading={currentLrc === null}
      onContextMenu={(e) => {
        showContextMenu({
          x: e.clientX,
          y: e.clientY,
          menuItems: [
            {
              title: "字体大小",
              subMenu: fontSizeList,
              onClick(value) {
                const title = value.title;
                setFontSize(title);
                setUserPerference("inlineLyricFontSize", title);
              },
            },
            {
              title: "下载歌词",
              show: !!currentLrc.parser,
              subMenu: [
                {
                  title: "lrc 格式",
                },
                {
                  title: "txt 格式",
                },
              ],
              async onClick(value) {
                const parser = currentLrc.parser;
                let rawLrc = "";
                const fileType = value.title.startsWith("lrc") ? "lrc" : "txt";
                if (fileType === "lrc") {
                  rawLrc = parser.getRawLyricStr(true);
                } else {
                  rawLrc = parser.getRawLyricStr();
                }

                try {
                  const result = await ipcRendererInvoke("show-save-dialog", {
                    title: "下载歌词",
                    defaultPath:
                      currentLrc.parser.getCurrentMusicItem().title +
                      (fileType === "lrc" ? ".lrc" : ".txt"),
                    filters: [
                      {
                        name: "歌词",
                        extensions: ["lrc", "txt"],
                      },
                    ],
                  });
                  if (!result.canceled && result.filePath) {
                    await window.fs.writeFile(result.filePath, rawLrc, "utf-8");
                    toast.success("下载成功");
                  } else {
                    throw new Error();
                  }
                } catch {
                  toast.error("下载失败");
                }
              },
            },
          ],
        });
      }}
      style={
        fontSize
          ? {
              fontSize: `${fontSize}px`,
            }
          : null
      }
      ref={containerRef}
    >
      {
        <Condition condition={currentLrc !== null} falsy={<Loading></Loading>}>
          <Condition
            condition={currentLrc?.parser}
            falsy={<>
              <div className="lyric-item">暂无歌词</div>
              <div className="lyric-item search-lyric" role="button" onClick={() => {
                showModal('SearchLyric', {
                  "defaultTitle": getCurrentMusic()?.title
                })
              }}>搜索歌词</div>
            </>}
          >
            {currentLrc?.parser?.getLyric?.()?.map((lrc, index) => (
              <div
                key={index}
                className="lyric-item"
                id={`lyric-item-id-${index}`}
                data-highlight={currentLrc?.currentLrc?.index === index}
              >
                {lrc.lrc}
              </div>
            ))}
          </Condition>
        </Condition>
      }
    </div>
  );
}
