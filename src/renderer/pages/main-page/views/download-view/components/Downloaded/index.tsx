import MusicList from "@/renderer/components/MusicList";
import { useDownloadedMusicList } from "@/renderer/core/downloader/downloaded-sheet";
import { useRef } from "react";

export default function Downloaded() {
  const downloadedList = useDownloadedMusicList();
  const musicListContainerRef = useRef<HTMLDivElement>();

  return (
    <div ref={musicListContainerRef}>
      <MusicList
        musicList={downloadedList}
        virtualProps={{
          getScrollElement() {
            return document.querySelector("#page-container");
          },
          offsetHeight: () => musicListContainerRef.current.offsetTop,
        }}
      ></MusicList>
    </div>
  );
}
