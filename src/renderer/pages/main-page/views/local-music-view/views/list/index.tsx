import MusicList from "@/renderer/components/MusicList";
import localMusicListStore from "@/renderer/core/local-music/store";

export default function ListView() {
  const localMusicList = localMusicListStore.useValue();

  return (
    <MusicList
    containerStyle={{
        marginTop: "12px"
    }}
      musicList={localMusicList}
      virtualProps={{
        fallbackRenderCount: -1,
      }}
    ></MusicList>
  );
}
