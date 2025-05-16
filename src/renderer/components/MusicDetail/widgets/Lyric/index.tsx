// src/renderer/components/MusicDetail/widgets/Lyric/index.tsx
import "./index.scss";
import Condition, { IfTruthy } from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import React, { useEffect, useRef, useState } from "react"; // 导入 React
import { showCustomContextMenu } from "@/renderer/components/ContextMenu";
import {
  getUserPreference,
  setUserPreference,
  useUserPreference,
} from "@/renderer/utils/user-perference";
import { toast } from "react-toastify";
import { showModal } from "@/renderer/components/Modal";
import SvgAsset from "@/renderer/components/SvgAsset";
import LyricParser, { IParsedLrcItem } from "@/renderer/utils/lyric-parser";
import { getLinkedLyric, unlinkLyric } from "@/renderer/core/link-lyric";
import { getMediaPrimaryKey } from "@/common/media-util";
import { useTranslation } from "react-i18next";
import {useLyric} from "@renderer/core/track-player/hooks";
import trackPlayer from "@renderer/core/track-player";
import {dialogUtil, fsUtil} from "@shared/utils/renderer";

export default function Lyric() {
  const lyricContext = useLyric();
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
      if (currentIndex !== undefined && currentIndex >= 0) { // 确保 currentIndex 不是 undefined
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
  }, [currentLrc, lyricContext]); // 添加 lyricContext 到依赖数组

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
            // height: 146, // 高度应动态计算或移除
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
              condition={lyricParser && lyricParser.getLyricItems().length > 0} // 确保有歌词项
              falsy={
                <>
                  <div className="lyric-item">{t("music_detail.no_lyric")}</div>
                  <div
                    className="lyric-item search-lyric"
                    role="button"
                    onClick={() => {
                        const currentMusic = trackPlayer.currentMusic;
                      showModal("SearchLyric", {
                        defaultTitle: currentMusic?.title,
                        musicItem: currentMusic,
                      });
                    }}
                  >
                    {t("music_detail.search_lyric")}
                  </div>
                </>
              }
            >
              {lyricParser?.getLyricItems?.()?.map((lyricItem, index) => (
                // 使用 React.Fragment 并提供唯一的 key
                <React.Fragment key={`${lyricItem.time}-${index}`}>
                  <div
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
                      className="lyric-item lyric-item-translation"
                      id={`tr-lyric-item-id-${index}`} // id 也应该是唯一的
                      data-highlight={currentLrc?.index === index}
                    >
                      {lyricItem.translation}
                    </div>
                  </IfTruthy>
                </React.Fragment>
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
  lyricParser: LyricParser | undefined; // 允许 undefined
}

function LyricContextMenu(props: ILyricContextMenuProps) {
  const { setLyricFontSize, lyricParser } = props;

  const [fontSize, setFontSize] = useState<string>( // 确保 fontSize 有初始值
    getUserPreference("inlineLyricFontSize") ?? "13"
  );
  const [showTranslation, setShowTranslation] =
    useUserPreference("showTranslation");

  const [linkedLyricInfo, setLinkedLyricInfo] = useState<IMedia.IUnique | null>(null); // 明确类型

  const { t } = useTranslation();

  const currentMusicRef = useRef<IMusic.IMusicItem | null>( // 允许 null
    trackPlayer.currentMusic ?? null
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
        setUserPreference("inlineLyricFontSize", `${nVal}`); // 使用 nVal
        setLyricFontSize(`${nVal}`); // 使用 nVal
      }
    }
  }

  async function downloadLyric(fileType: "lrc" | "txt") {
    if (!lyricParser || !currentMusicRef.current) { // 增加检查
      toast.error(t("music_detail.lyric_ctx_download_fail") + ": No lyric or music info");
      return;
    }
    let rawLrc = "";
    if (fileType === "lrc") {
      rawLrc = lyricParser.toString({
        withTimestamp: true,
      });
    } else {
      rawLrc = lyricParser.toString();
    }

    try {
      const result = await dialogUtil.showSaveDialog({
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
        await fsUtil.writeFile(result.filePath, rawLrc, "utf-8");
        toast.success(t("music_detail.lyric_ctx_download_success"));
      }
      // 移除 else throw new Error(); 因为用户取消不应视为错误
    } catch(error) { // 捕获具体错误
      toast.error(t("music_detail.lyric_ctx_download_fail") + `: ${error.message}`);
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
            if (fontSize) { // 确保 fontSize 存在
              setFontSize((prev) => {
                const newFontSize = Math.max(8, +prev - 1); // 确保不小于8
                handleFontSize(newFontSize);
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
          value={fontSize ?? ""} // 提供空字符串作为默认值
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
            if (fontSize) { // 确保 fontSize 存在
              setFontSize((prev) => {
                const newFontSize = Math.min(32, +prev + 1); // 确保不大于32
                handleFontSize(newFontSize);
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
            defaultTitle: currentMusicRef.current?.title, // 安全访问
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
          if (currentMusicRef.current) { // 增加检查
            try {
              await unlinkLyric(currentMusicRef.current);
              if (trackPlayer.isCurrentMusic(currentMusicRef.current)) {
                  trackPlayer.fetchCurrentLyric(true);
              }
              toast.success(t("music_detail.toast_media_lyric_unlinked"));
              setLinkedLyricInfo(null); // 清除关联歌词信息
            } catch {
                // pass
            }
          }
        }}
      >
        {t("music_detail.unlink_media_lyric")}
      </div>
    </>
  );
}