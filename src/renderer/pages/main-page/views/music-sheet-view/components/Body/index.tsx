import MusicList from "@/renderer/components/MusicList";
import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";
import { useEffect, useState, useTransition } from "react";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import trackPlayer from "@/renderer/core/track-player";

interface IProps {
  musicList: IMusic.IMusicItem[];
}
export default function Body(props: IProps) {
  const { musicList = [] } = props;

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
            onClick={() => {
              if (musicList.length) {
                trackPlayer.playMusicWithReplaceQueue(musicList);
              }
            }}
          >
            播放全部
          </div>
          <div role="button" data-type="normalButton" className="add-to-sheet">
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
        <MusicList musicList={filterMusicList ?? musicList}></MusicList>
      </Condition>
    </div>
  );
}
