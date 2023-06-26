import { ipcRendererOn, ipcRendererSend } from "@/common/ipc-util/renderer";
import React, { useEffect } from "react";

export default function LocalMusicView() {
  useEffect(() => {
    ipcRendererSend("add-watch-dir", ["F://CloudMusic"]);
    ipcRendererOn("sync-local-music", (items) => {
      console.log(items, 'local!!!');
    });
  }, []);

  return <div>LocalMusicView</div>;
}
