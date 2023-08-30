import MusicList from "@/renderer/components/MusicList";
import Downloader from "@/renderer/core/downloader";
import MusicSheet from "@/renderer/core/music-sheet";
import React from "react";

export default function Downloaded() {
  // const downloadedMusic = MusicSheet.addDownloadedMusic
  const downloadedList = Downloader.useDownloadedMusicList();


  return (
    <div>
      <MusicList musicList={downloadedList}></MusicList>
    </div>
  );
}
