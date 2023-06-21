import Evt from "@renderer/core/events";
import AnimatedDiv from "../AnimatedDiv";
import "./index.scss";
import albumImg from "@/assets/imgs/album-cover.jpg";
import navigatorHook from "@/common/navigator-hook";
import { useCurrentMusic } from "@/renderer/core/track-player/player";
import Store from "@/common/store";
import Tag from "../Tag";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import Lyric from "./widgets/Lyric";

export const musicDetailShownStore = new Store(false);

export default function () {
  const musicItem = useCurrentMusic();
  const musicDetailShown = musicDetailShownStore.useValue();

  Evt.use("SHOW_MUSIC_DETAIL", () => {
    musicDetailShownStore.setValue(true);
    navigatorHook.setNavigateHook(() => {
      musicDetailShownStore.setValue(false);
    });
  });

  Evt.use("HIDE_MUSIC_DETAIL", () => {
    musicDetailShownStore.setValue(false);
  });

  return (
    <AnimatedDiv
      showIf={musicDetailShown}
      className="music-detail-container animate__animated"
      mountClassName="animate__slideInUp"
      unmountClassName="animate__slideOutDown"
    >
      <div
        className="music-background"
        style={{
          backgroundImage: `url(${musicItem?.artwork ?? albumImg})`,
        }}
      ></div>
      <div className="music-title" title={musicItem?.title}>
        {musicItem?.title}
      </div>
      <div className="music-info">
        <span>
          {musicItem?.artist} - {musicItem?.album}
        </span>
        <Tag fill>{musicItem?.platform}</Tag>
      </div>
      <div className="music-body">
        <img
          className="music-album"
          onError={setFallbackAlbum}
          src={musicItem?.artwork}
        ></img>
        <Lyric></Lyric>
      </div>
    </AnimatedDiv>
  );
}
