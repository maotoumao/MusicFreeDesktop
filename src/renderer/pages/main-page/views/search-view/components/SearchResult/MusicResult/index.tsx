import React, { memo } from "react";
import MusicList from "@/renderer/components/MusicList";

interface IMediaResultProps {
  data: IMusic.IMusicItem[];
}

function MusicResult(props: IMediaResultProps) {
  const { data } = props;

  return <MusicList musicList={data}></MusicList>;
}

export default memo(MusicResult, (prev, curr) => prev.data === curr.data);
