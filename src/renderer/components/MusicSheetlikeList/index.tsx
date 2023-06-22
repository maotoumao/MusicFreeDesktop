import { RequestStateCode } from "@/common/constant";
import { memo } from "react";
import "./index.scss";
import BottomLoadingState from "@/renderer/components/BottomLoadingState";
import MusicSheetlikeItem from "@/renderer/components/MusicSheetlikeItem";
import Condition from "../Condition";
import Empty from "../Empty";

interface IMusicSheetlikeListProps {
  data: IMusic.IMusicSheetItem[];
  state: RequestStateCode;
  onLoadMore?: () => void;
  onClick?: (mediaItem: IMusic.IMusicSheetItem) => void;
}

function MusicSheetlikeList(props: IMusicSheetlikeListProps) {
  const { data = [], state, onLoadMore, onClick } = props;

  return (
    <div className="music-sheet-like-list--container">
      <Condition condition={data.length !== 0} falsy={<Empty></Empty>}>
        <div className="music-sheet-like-list--body">
          {data.map((mediaItem, index) => {
            return (
              <MusicSheetlikeItem
                onClick={() => {
                  onClick?.(mediaItem);
                }}
                mediaItem={mediaItem}
                key={index}
              ></MusicSheetlikeItem>
            );
          })}
        </div>
      </Condition>
      <Condition condition={data.length !== 0}>
        <BottomLoadingState
          state={state}
          onLoadMore={onLoadMore}
        ></BottomLoadingState>
      </Condition>
    </div>
  );
}

export default memo(
  MusicSheetlikeList,
  (prev, curr) => prev.data === curr.data && prev.state === curr.state
);
