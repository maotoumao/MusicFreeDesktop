import trackPlayer from "@/renderer/core/track-player";
import "./index.scss";
import Condition, { IfTruthy } from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import { useEffect, useRef, useState } from "react";
import { showCustomContextMenu } from "@/renderer/components/ContextMenu";
import {
  getUserPreference,
  setUserPreference,
  useUserPreference,
} from "@/renderer/utils/user-perference";
import { ipcRendererInvoke } from "@/shared/ipc/renderer";
import { toast } from "react-toastify";
import { showModal } from "@/renderer/components/Modal";
import { getCurrentMusic } from "@/renderer/core/track-player/player";
import SvgAsset from "@/renderer/components/SvgAsset";
import LyricParser from "@/renderer/utils/lyric-parser";
import { getLinkedLyric, unlinkLyric } from "@/renderer/core/link-lyric";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import trackPlayerEventsEmitter from "@/renderer/core/track-player/event";
import { TrackPlayerEvent } from "@/renderer/core/track-player/enum";
import { useTranslation } from "react-i18next";

export default function Lyric() {
  const lyricContext = trackPlayer.useLyric();
  const lyricParser = lyricContext?.parser;
  const currentLrc = lyricContext?.currentLrc;

  const containerRef = useRef<HTMLDivElement>();

  const [fontSize, setFontSize] = useState<string | null>(
    getUserPreference("inlineLyricFontSize")
  );

  const [showTranslation, setShowTranslation] =
    useUserPreference("showTranslation");
  const { t } = useTranslation();

  const mountRef = useRef(false);

  useEffect(() => {
    if (containerRef.current) {
      const currentIndex = lyricContext?.currentLrc?.index;
      if (currentIndex >= 0) {
        const dom = document.querySelector(`#lyric-item-id-${currentIndex}`) as
          | HTMLDivElement
          | undefined;
        if (dom) {
          const offsetTop =
            dom.offsetTop -
            containerRef.current.clientHeight / 2 +
            dom.clientHeight / 2;
          containerRef.current.scrollTo({
            behavior: mountRef.current ? "smooth" : "auto",
            top: offsetTop,
          });
        }
      }
    }
    mountRef.current = true;
  }, [currentLrc]);

  const optionsComponent = (
    <div className="lyric-options-container">
      <div
        className="lyric-option-item"
        role="button"
        title={t("music_detail.translation")}
        data-active={
          !!showTranslation && (lyricParser?.hasTranslation ?? false)
        }
        data-disabled={!lyricParser?.hasTranslation}
        onClick={() => {
          setShowTranslation(!showTranslation);
        }}
      >
        <SvgAsset iconName="language"></SvgAsset>
      </div>
    </div>
  );

  return (
    <div className="lyric-container-outer">
      <div
        className="lyric-container"
        data-loading={lyricContext === null}
        onContextMenu={(e) => {
          showCustomContextMenu({
            x: e.clientX,
            y: e.clientY,
            width: 200,
            height: 146,
            component: (
              <LyricContextMenu
                setLyricFontSize={setFontSize}
                lyricParser={lyricParser}
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
          <Condition
            condition={lyricContext !== null}
            falsy={<Loading></Loading>}
          >
            <Condition
              condition={lyricParser}
              falsy={
                <>
                  <div className="lyric-item">{t("music_detail.no_lyric")}</div>
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
                    {t("music_detail.search_lyric")}
                  </div>
                </>
              }
            >
              {lyricParser?.getLyricItems?.()?.map((lyricItem, index) => (
                <>
                  <div
                    key={index}
                    className="lyric-item"
                    id={`lyric-item-id-${index}`}
                    data-highlight={currentLrc?.index === index}
                  >
                    {lyricItem.lrc}
                  </div>
                  <IfTruthy
                    condition={lyricParser?.hasTranslation && showTranslation}
                  >
                    <div
                      key={"tr" + index}
                      className="lyric-item lyric-item-translation"
                      id={`tr-lyric-item-id-${index}`}
                      data-highlight={currentLrc?.index === index}
                    >
                      {lyricItem.translation}
                    </div>
                  </IfTruthy>
                </>
              ))}
            </Condition>
          </Condition>
        }
      </div>
      {optionsComponent}
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
    getUserPreference("inlineLyricFontSize") ?? "13"
  );
  const [showTranslation, setShowTranslation] =
    useUserPreference("showTranslation");

  const [linkedLyricInfo, setLinkedLyricInfo] = useState<IMedia.IUnique>(null);

  const { t } = useTranslation();

  const currentMusicRef = useRef<IMusic.IMusicItem>(
    getCurrentMusic() ?? ({} as any)
  );

  useEffect(() => {
    if (currentMusicRef.current?.platform) {
      getLinkedLyric(currentMusicRef.current).then((linked) => {
        if (linked) {
          setLinkedLyricInfo(linked);
        }
      });
    }
  }, []);

  function handleFontSize(val: string | number) {
    if (val) {
      const nVal = +val;
      if (8 <= nVal && nVal <= 32) {
        setUserPreference("inlineLyricFontSize", `${val}`);
        setLyricFontSize(`${val}`);
      }
    }
  }

  async function downloadLyric(fileType: "lrc" | "txt") {
    let rawLrc = "";
    if (fileType === "lrc") {
      rawLrc = lyricParser.toString({
        withTimestamp: true,
      });
    } else {
      rawLrc = lyricParser.toString();
    }

    try {
      const result = await ipcRendererInvoke("show-save-dialog", {
        title: t("music_detail.lyric_ctx_download_lyric"),
        defaultPath:
          currentMusicRef.current.title +
          (fileType === "lrc" ? ".lrc" : ".txt"),
        filters: [
          {
            name: t("media.media_type_lyric"),
            extensions: ["lrc", "txt"],
          },
        ],
      });
      if (!result.canceled && result.filePath) {
        await window.fs.writeFile(result.filePath, rawLrc, "utf-8");
        toast.success(t("music_detail.lyric_ctx_download_success"));
      } else {
        throw new Error();
      }
    } catch {
      toast.error(t("music_detail.lyric_ctx_download_fail"));
    }
  }

  return (
    <>
      <div className="lyric-ctx-menu--set-font-title">
        {t("music_detail.lyric_ctx_set_font_size")}
      </div>
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
        data-disabled={!lyricParser?.hasTranslation}
        onClick={() => {
          setShowTranslation(!showTranslation);
        }}
      >
        {showTranslation
          ? t("music_detail.hide_translation")
          : t("music_detail.show_translation")}
      </div>
      <div
        className="lyric-ctx-menu--row-container"
        role="button"
        data-disabled={!lyricParser}
        onClick={() => {
          downloadLyric("lrc");
        }}
      >
        {t("music_detail.lyric_ctx_download_lyric_lrc")}
      </div>
      <div
        className="lyric-ctx-menu--row-container"
        role="button"
        data-disabled={!lyricParser}
        onClick={() => {
          downloadLyric("txt");
        }}
      >
        {t("music_detail.lyric_ctx_download_lyric_txt")}
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
            ? `${t("music_detail.media_lyric_linked")} ${getMediaPrimaryKey(
                linkedLyricInfo
              )}`
            : t("music_detail.search_lyric")}
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
            toast.success(t("music_detail.toast_media_lyric_unlinked"));
          } catch {}
        }}
      >
        {t("music_detail.unlink_media_lyric")}
      </div>
    </>
  );
}
