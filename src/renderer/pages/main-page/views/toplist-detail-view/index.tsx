import React from "react";
import useTopListDetail from "./hooks/useTopListDetail";
import { useParams } from "react-router-dom";
import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";
import { RequestStateCode } from "@/common/constant";

export default function TopListDetailView() {
  const params = useParams();
  const topListDetail = useTopListDetail(
    history.state?.usr?.toplist,
    params?.platform
  );

  return (
    <MusicSheetlikeView
      musicSheet={topListDetail}
      musicList={topListDetail?.musicList ?? []}
      state={
        topListDetail?.musicList
          ? RequestStateCode.FINISHED
          : RequestStateCode.PENDING_FIRST_PAGE
      }
    />
  );
}
