import AnimatedDiv from "../AnimatedDiv";
import "./index.scss";
import albumImg from "@/assets/imgs/album-cover.jpg";
import Tag from "../Tag";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import Header from "./widgets/Header";
import Lyric from "./widgets/Lyric";
import Condition from "../Condition";
import { useTranslation } from "react-i18next";
import { useCurrentMusic } from "@renderer/core/track-player/hooks";
import { useEffect } from "react";
import { musicDetailShownStore } from "@renderer/components/MusicDetail/store";

export const isMusicDetailShown = musicDetailShownStore.getValue;
export const useMusicDetailShown = musicDetailShownStore.useValue;

function MusicDetail() {
  const musicItem = useCurrentMusic();
  const musicDetailShown = musicDetailShownStore.useValue();

  const { t } = useTranslation();

  useEffect(() => {
    const escHandler = (evt: KeyboardEvent) => {
      if (evt.code === "Escape") {
        evt.preventDefault();
        musicDetailShownStore.setValue(false);
      }
    };
    window.addEventListener("keydown", escHandler);

    return () => {
      window.removeEventListener("keydown", escHandler);
    }
  }, []);


  return (
    <AnimatedDiv
      showIf={musicDetailShown}
      className="music-detail--container animate__animated background-color"
      mountClassName="animate__slideInUp"
      unmountClassName="animate__slideOutDown"
      onAnimationEnd={() => {
        // hack logic: https://github.com/electron/electron/issues/32341
        // force reflow to refresh drag region
        setTimeout(() => {
          document.body.style.width = "0";
          document.body.getBoundingClientRect();
          document.body.style.width = "";
        }, 200);
      }}
    >
      <div
        className="music-detail-background"
        style={{
          backgroundImage: `url(${musicItem?.artwork ?? albumImg})`,
        }}
      ></div>
      <Header></Header>
      <div className="music-title" title={musicItem?.title}>
        {musicItem?.title || t("media.unknown_title")}
      </div>
      <div className="music-info">
        <span>
          <Condition condition={musicItem?.artist}>
            {musicItem?.artist}
          </Condition>
          <Condition condition={musicItem?.album}>
            {" "}
            - {musicItem?.album}
          </Condition>
        </span>
        {musicItem?.platform ? <Tag fill>{musicItem.platform}</Tag> : null}
      </div>
      <div className="music-body">
        <div className="music-album-options">
          <img
            className="music-album shadow"
            onError={setFallbackAlbum}
            src={musicItem?.artwork ?? albumImg}
          ></img>
        </div>

        <Lyric></Lyric>
      </div>
    </AnimatedDiv>
  );
}

MusicDetail.show = () => {
  musicDetailShownStore.setValue(true);
}

MusicDetail.hide = () => {
  musicDetailShownStore.setValue(false);
}

export default MusicDetail;
