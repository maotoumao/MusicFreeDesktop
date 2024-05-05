import MusicList from "@/renderer/components/MusicList";
import localMusicListStore from "@/renderer/core/local-music/store";

interface IProps {
  localMusicList: IMusic.IMusicItem[];
}

export default function ListView(props: IProps) {
  const { localMusicList } = props;

  return (
    <MusicList
      containerStyle={{
        marginTop: "12px",
      }}
      musicList={localMusicList}
      virtualProps={{
        fallbackRenderCount: 40,
        getScrollElement() {
            return document.querySelector("#page-container");
        },
        offsetHeight: 102
      }}
    ></MusicList>
  );
}
