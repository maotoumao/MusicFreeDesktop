import MusicList from "@/renderer/components/MusicList";
import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";
import { useEffect, useState, useTransition } from "react";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import trackPlayer from "@/renderer/core/track-player";
import { showModal } from "@/renderer/components/Modal";

interface IProps {
  musicSheet: IMusic.IMusicSheetItem;
  musicList: IMusic.IMusicItem[];
}
export default function Body(props: IProps) {
  const { musicList = [], musicSheet } = props;

  const [inputSearch, setInputSearch] = useState("");
  const [filterMusicList, setFilterMusicList] = useState<
    IMusic.IMusicItem[] | null
  >(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (inputSearch.trim() === "") {
      setFilterMusicList(null);
    } else {
      startTransition(() => {
        setFilterMusicList(
          musicList.filter(
            (item) =>
              item.title.includes(inputSearch) ||
              item.artist.includes(inputSearch) ||
              item.album?.includes(inputSearch)
          )
        );
      });
    }
  }, [inputSearch]);

  return (
    <div className="music-sheet-view--body-container">
      <div className="operations">
        <div className="buttons">
          <div
            role="button"
            data-disabled={!musicList?.length}
            data-type="primaryButton"
            title="播放全部"
            onClick={() => {
              if (musicList.length) {
                trackPlayer.playMusicWithReplaceQueue(musicList);
              }
            }}
          >
            播放全部
          </div>
          <div
            role="button"
            data-type="normalButton"
            className="add-to-sheet"
            title="添加到歌单"
            onClick={() => {
              showModal("AddMusicToSheet", {
                musicItems: musicList,
              });
            }}
          >
            添加到歌单
          </div>
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
        condition={!isPending || filterMusicList === null}
        falsy={<Loading></Loading>}
      >
        <MusicList
          musicList={filterMusicList ?? musicList}
          localMusicSheetId={musicSheet?.id}
        ></MusicList>
      </Condition>
    </div>
  );
}
