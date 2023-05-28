import Evt from "@/events";
import "./index.scss";
import { useState } from "react";

const baseId = "music-bar--play-list";

export default function PlayList() {
  const [show, setShow] = useState(false);

  Evt.use("SWITCH_PLAY_LIST", (payload) => {
    if (!payload) {
      setShow((_) => !_);
    } else {
      setShow((_) => payload.show);
    }
  });

  return show ? (
      <div
        id={baseId}
        className="music-bar--play-list-container"
        role="button"
        onClick={(e) => {
          console.log(e);
          if ((e.target as HTMLElement)?.id === baseId) {
            setShow(false);
          }
        }}
      >
        <div className="content-container animate__animated animate__slideInRight"></div>
      </div>
  ) : null;
}
