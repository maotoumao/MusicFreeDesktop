import React from "react";
import currentLyricStore from "../store/current-lyric-store";

export default function LyricWindowPage() {
  const lyric = currentLyricStore.useValue();
  console.log("lyricWindowPage");
  console.log(lyric);
  return (
    <>
      <div>{lyric[0]?.lrc}</div>
      <div>{lyric[1]?.lrc}</div>
    </>
  );
}
