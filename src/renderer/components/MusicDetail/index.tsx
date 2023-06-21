import Evt from "@renderer/core/events";
import AnimatedDiv from "../AnimatedDiv";
import "./index.scss";
import { useState } from "react";
import navigatorHook from "@/common/navigator-hook";
import { useCurrentMusic } from "@/renderer/core/track-player/player";
import Store from "@/common/store";

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
      

    </AnimatedDiv>
  );
}
