import Evt from "@renderer/core/events";
import AnimatedDiv from "../AnimatedDiv";
import "./index.scss";
import { useState } from "react";

export default function () {
  const [showDetail, setShowDetail] = useState(false);

  Evt.use("SHOW_MUSIC_DETAIL", () => {
    setShowDetail(true);
  });

  return (
    <AnimatedDiv
      showIf={showDetail}
      className="music-detail-container animate__animated"
      mountClassName="animate__slideInUp"
      unmountClassName="animate__slideOutDown"
    >
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
