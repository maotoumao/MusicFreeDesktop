import { RequestStateCode } from "@/common/constant";
import Body from "./components/Body";
import Header from "./components/Header";

interface IMusicSheetlikeViewProps {
  musicSheet: IMusic.IMusicSheetItem;
  musicList?: IMusic.IMusicItem[];
  state?: RequestStateCode;
  onLoadMore?: () => void;
}

export default function MusicSheetlikeView(props: IMusicSheetlikeViewProps) {
  const { musicSheet, musicList, state = RequestStateCode.IDLE, onLoadMore } = props;
  return (
    <>
      <Header musicSheet={musicSheet} musicList={musicList??[]}></Header>
      <Body
        musicList={musicList ?? []}
        musicSheet={musicSheet}
        state={state}
        onLoadMore={onLoadMore}
      ></Body>
    </>
  );
}
