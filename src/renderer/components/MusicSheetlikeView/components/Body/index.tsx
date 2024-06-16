import MusicList from "@/renderer/components/MusicList";
import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";
import { ReactNode, useEffect, useState, useTransition } from "react";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import trackPlayer from "@/renderer/core/track-player";
import { showModal } from "@/renderer/components/Modal";
import { RequestStateCode, localPluginName } from "@/common/constant";
import { offsetHeightStore } from "../../store";
import MusicSheet from "@/renderer/core/music-sheet";
import { getAppConfigPath } from "@/shared/app-config/renderer";
import { useTranslation } from "react-i18next";

interface IProps {
  musicSheet: IMusic.IMusicSheetItem;
  musicList: IMusic.IMusicItem[];
  state?: RequestStateCode;
  onLoadMore?: () => void;
  options?: ReactNode;
}
export default function Body(props: IProps) {
  const { musicList = [], musicSheet, state, onLoadMore, options } = props;

  const [inputSearch, setInputSearch] = useState("");
  const [filterMusicList, setFilterMusicList] = useState<
    IMusic.IMusicItem[] | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const { t } = useTranslation();

  useEffect(() => {
    if (inputSearch.trim() === "") {
      setFilterMusicList(null);
    } else {
      startTransition(() => {
        const caseSensitive = getAppConfigPath(
          "playMusic.caseSensitiveInSearch"
        );
        if (caseSensitive) {
          setFilterMusicList(
            musicList.filter(
              (item) =>
                item.title?.includes(inputSearch) ||
                item.artist?.includes(inputSearch) ||
                item.album?.includes(inputSearch)
            )
          );
        } else {
          const searchText = inputSearch.toLocaleLowerCase();
          setFilterMusicList(
            musicList.filter(
              (item) =>
                item.title?.toLocaleLowerCase()?.includes(searchText) ||
                item.artist?.toLocaleLowerCase()?.includes(searchText) ||
                item.album?.toLocaleLowerCase()?.includes(searchText)
            )
          );
        }
      });
    }
  }, [inputSearch]);

  useEffect(() => {
    setInputSearch("");
  }, [musicSheet?.id]);

  return (
    <div className="music-sheetlike-view--body-container">
      <div className="operations">
        <div className="buttons">
          <div
            role="button"
            className="option-button"
            data-disabled={!musicList?.length}
            data-type="primaryButton"
            title={t("music_sheet_like_view.play_all")}
            onClick={() => {
              if (musicList.length) {
                trackPlayer.playMusicWithReplaceQueue(musicList);
              }
            }}
          >
            <SvgAsset iconName="play"></SvgAsset>
            <span>{t("music_sheet_like_view.play_all")}</span>
          </div>
          <div
            role="button"
            data-type="normalButton"
            data-disabled={!musicList?.length}
            className="add-to-sheet option-button"
            title={t("music_sheet_like_view.add_to_sheet")}
            onClick={() => {
              showModal("AddMusicToSheet", {
                musicItems: musicList,
              });
            }}
          >
            <SvgAsset iconName="plus"></SvgAsset>
            <span>{t("music_sheet_like_view.add_to_sheet")}</span>
          </div>
          {options}
        </div>
        <div className="search-in-music-list-container">
          <input
            spellCheck={false}
            onChange={(evt) => {
              setInputSearch(evt.target.value);
            }}
            value={inputSearch}
            className="search-in-music-list"
          ></input>
          <SvgAsset iconName="magnifying-glass" size={16}></SvgAsset>
        </div>
      </div>
      <Condition
        condition={
          (!isPending || filterMusicList === null) &&
          state !== RequestStateCode.PENDING_FIRST_PAGE
        }
        falsy={<Loading></Loading>}
      >
        <MusicList
          musicList={filterMusicList ?? musicList}
          // getAllMusicItems={() => musicList} // TODO: 过滤歌曲
          musicSheet={musicSheet}
          state={state}
          onPageChange={onLoadMore}
          virtualProps={{
            getScrollElement() {
              return document.querySelector("#page-container");
            },
            offsetHeight: () => offsetHeightStore.getValue(),
          }}
          enableDrag={musicSheet?.platform === localPluginName}
          onDragEnd={(newData) => {
            if (musicSheet?.platform === localPluginName && musicSheet?.id) {
              MusicSheet.frontend.updateSheetMusicOrder(musicSheet.id, newData);
            }
          }}
        ></MusicList>
      </Condition>
    </div>
  );
}
