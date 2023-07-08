import { RequestStateCode } from "@/common/constant";
import Body from "./components/Body";
import Header from "./components/Header";

import "./index.scss";
import { ReactNode, useEffect } from "react";
import { initValue, offsetHeightStore } from "./store";

interface IMusicSheetlikeViewProps {
  scrollElement?: HTMLElement;
  musicSheet: IMusic.IMusicSheetItem;
  musicList?: IMusic.IMusicItem[];
  state?: RequestStateCode;
  onLoadMore?: () => void;
  options?: ReactNode;
}

export default function MusicSheetlikeView(props: IMusicSheetlikeViewProps) {
  const {
    musicSheet,
    musicList,
    state = RequestStateCode.IDLE,
    onLoadMore,
    options,
  } = props;

  useEffect(() => {
    return () => {
      offsetHeightStore.setValue(initValue);
    };
  }, []);

  return (
    <div className="music-sheetlike-view--container">
      <Header musicSheet={musicSheet} musicList={musicList ?? []}></Header>
      <Body
        musicList={musicList ?? []}
        musicSheet={musicSheet}
        state={state}
        onLoadMore={onLoadMore}
        options={options}
      ></Body>
    </div>
  );
}
