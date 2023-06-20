import Evt from "@renderer/core/events";
import AnimatedDiv from "../AnimatedDiv";
import "./index.scss";
import { useState } from "react";
import navigatorHook from "@/common/navigator-hook";
import { useCurrentMusic } from "@/renderer/core/track-player/player";

export default function () {
  const [showDetail, setShowDetail] = useState(false);
  const musicItem = useCurrentMusic();

  Evt.use("SHOW_MUSIC_DETAIL", () => {
    setShowDetail(true);
    navigatorHook.setNavigateHook(() => {
      setShowDetail(false);
    });
  });

  return (
    <AnimatedDiv
      showIf={showDetail}
      className="music-detail-container animate__animated"
      mountClassName="animate__slideInUp"
      unmountClassName="animate__slideOutDown"
    >
      <div
        className="background"
        style={{
          backgroundImage: musicItem?.artwork
            ? `url(${musicItem.artwork})`
            : undefined,
        }}
      ></div>
      <button
        onClick={() => {
          setShowDetail(false);
        }}
      >
        dx
      </button>
    </AnimatedDiv>
  );
}
