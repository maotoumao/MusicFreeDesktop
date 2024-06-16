import { ReactNode, useEffect } from "react";
import { RequestStateCode } from "@/common/constant";
import Body from "./components/Body";
import Header from "./components/Header";
import { initValue, offsetHeightStore } from "./store";
import "./index.scss";

interface IMusicSheetlikeViewProps {
  scrollElement?: HTMLElement;
  musicSheet: IMusic.IMusicSheetItem;
  musicList?: IMusic.IMusicItem[];
  state?: RequestStateCode;
  onLoadMore?: () => void;
  options?: ReactNode;
  /** 是否展示来源tag */
  hidePlatform?: boolean;
}

export default function MusicSheetlikeView(props: IMusicSheetlikeViewProps) {
  const {
    musicSheet,
    musicList,
    state = RequestStateCode.IDLE,
    onLoadMore,
    options,
    hidePlatform,
  } = props;

  useEffect(() => {
    return () => {
      offsetHeightStore.setValue(initValue);
    };
  }, []);

  return (
    <div className="music-sheetlike-view--container">
      <Header
        hidePlatform={hidePlatform}
        musicSheet={musicSheet}
        musicList={musicList ?? []}
      ></Header>
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
