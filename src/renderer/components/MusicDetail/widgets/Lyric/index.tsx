import trackPlayer from "@/renderer/core/track-player";
import "./index.scss";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import { useEffect, useRef, useState } from "react";
import {
  showContextMenu,
  showCustomContextMenu,
} from "@/renderer/components/ContextMenu";
import {
  getUserPerference,
  setUserPerference,
} from "@/renderer/utils/user-perference";
import { ipcRendererInvoke } from "@/common/ipc-util/renderer";
import { toast } from "react-toastify";
import { showModal } from "@/renderer/components/Modal";
import { getCurrentMusic } from "@/renderer/core/track-player/player";
import SvgAsset from "@/renderer/components/SvgAsset";
import LyricParser from "@/renderer/utils/lyric-parser";
import { getLinkedLyric, unlinkLyric } from "@/renderer/core/link-lyric";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import trackPlayerEventsEmitter from "@/renderer/core/track-player/event";
import { TrackPlayerEvent } from "@/renderer/core/track-player/enum";

export default function Lyric() {
  const currentLrc = trackPlayer.useLyric();
  const containerRef = useRef<HTMLDivElement>();
  const [fontSize, setFontSize] = useState<string | null>(
    getUserPerference("inlineLyricFontSize")
  );

  const mountRef = useRef(false);

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
            behavior: mountRef.current ? "smooth" : "auto",
            top: offsetTop,
          });
        }
      }
    }
    mountRef.current = true;
  }, [currentLrc?.currentLrc]);

  return (
    <div
      className="lyric-container"
      data-loading={currentLrc === null}
      onContextMenu={(e) => {
        showCustomContextMenu({
          x: e.clientX,
          y: e.clientY,
          width: 200,
          height: 146,
          component: (
            <LyricContextMenu
              setLyricFontSize={setFontSize}
              lyricParser={currentLrc?.parser}
            ></LyricContextMenu>
          ),
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
            falsy={
              <>
                <div className="lyric-item">暂无歌词</div>
                <div
                  className="lyric-item search-lyric"
                  role="button"
                  onClick={() => {
                    showModal("SearchLyric", {
                      defaultTitle: getCurrentMusic()?.title,
                      musicItem: getCurrentMusic(),
                    });
                  }}
                >
                  搜索歌词
                </div>
              </>
            }
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

interface ILyricContextMenuProps {
  setLyricFontSize: (val: string) => void;
  lyricParser: LyricParser;
}

function LyricContextMenu(props: ILyricContextMenuProps) {
  const { setLyricFontSize, lyricParser } = props;

  const [fontSize, setFontSize] = useState<string | null>(
    getUserPerference("inlineLyricFontSize") ?? "13"
  );

  const [linkedLyricInfo, setLinkedLyricInfo] = useState<IMedia.IUnique>(null);

  const currentMusicRef = useRef<IMusic.IMusicItem>(
    getCurrentMusic() ?? ({} as any)
  );

  console.log(currentMusicRef);

  useEffect(() => {
    getLinkedLyric(currentMusicRef.current).then((linked) => {
      if (linked) {
        setLinkedLyricInfo(linked);
      }
    });
  }, []);

  function handleFontSize(val: string | number) {
    if (val) {
      const nVal = +val;
      if (8 <= nVal && nVal <= 32) {
        setUserPerference("inlineLyricFontSize", `${val}`);
        setLyricFontSize(`${val}`);
      }
    }
  }

  async function downloadLyric(fileType: "lrc" | "txt") {
    let rawLrc = "";
    if (fileType === "lrc") {
      rawLrc = lyricParser.getRawLyricStr(true);
    } else {
      rawLrc = lyricParser.getRawLyricStr();
    }

    try {
      const result = await ipcRendererInvoke("show-save-dialog", {
        title: "下载歌词",
        defaultPath:
          currentMusicRef.current.title +
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
  }

  return (
    <>
      <div className="lyric-ctx-menu--set-font-title">设置字号</div>
      <div
        className="lyric-ctx-menu--font-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          role="button"
          className="font-size-button"
          onClick={() => {
            if (fontSize) {
              setFontSize((prev) => {
                const newFontSize = +prev - 1;
                handleFontSize(newFontSize);
                if (newFontSize < 8) {
                  return "8";
                } else if (newFontSize > 32) {
                  return "32";
                }
                return `${newFontSize}`;
              });
            }
          }}
        >
          <SvgAsset iconName="font-size-smaller"></SvgAsset>
        </div>
        <input
          type="number"
          max={32}
          min={8}
          value={fontSize}
          onChange={(e) => {
            const val = e.target.value;
            handleFontSize(val);
            setFontSize(e.target.value.trim());
          }}
        ></input>
        <div
          role="button"
          className="font-size-button"
          onClick={() => {
            if (fontSize) {
              setFontSize((prev) => {
                const newFontSize = +prev + 1;
                handleFontSize(newFontSize);
                if (newFontSize < 8) {
                  return "8";
                } else if (newFontSize > 32) {
                  return "32";
                }
                return `${newFontSize}`;
              });
            }
          }}
        >
          <SvgAsset iconName="font-size-larger"></SvgAsset>
        </div>
      </div>
      <div className="divider"></div>

      <div
        className="lyric-ctx-menu--row-container"
        role="button"
        data-disabled={!lyricParser}
        onClick={() => {
          downloadLyric("lrc");
        }}
      >
        下载歌词(lrc)
      </div>
      <div
        className="lyric-ctx-menu--row-container"
        role="button"
        data-disabled={!lyricParser}
        onClick={() => {
          downloadLyric("txt");
        }}
      >
        下载歌词(纯文本)
      </div>
      <div className="divider"></div>
      <div
        className="lyric-ctx-menu--row-container"
        role="button"
        onClick={() => {
          showModal("SearchLyric", {
            defaultTitle: currentMusicRef.current.title,
            musicItem: currentMusicRef.current,
          });
        }}
      >
        <span>
          {linkedLyricInfo
            ? `已关联歌词: ${getMediaPrimaryKey(linkedLyricInfo)}`
            : "搜索歌词"}
        </span>
      </div>
      <div
        className="lyric-ctx-menu--row-container"
        role="button"
        data-disabled={!linkedLyricInfo}
        onClick={async () => {
          try {
            await unlinkLyric(currentMusicRef.current);
            if (isSameMedia(currentMusicRef.current, getCurrentMusic())) {
              trackPlayerEventsEmitter.emit(
                TrackPlayerEvent.NeedRefreshLyric,
                true
              );
            }
            toast.success("已取消关联歌词");
          } catch {}
        }}
      >
        取消关联歌词
      </div>
    </>
  );
}
