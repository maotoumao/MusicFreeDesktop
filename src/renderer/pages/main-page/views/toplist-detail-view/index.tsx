import useTopListDetail from "./hooks/useTopListDetail";
import { useParams } from "react-router-dom";
import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";

export default function TopListDetailView() {
  const params = useParams();
  const [topListDetail, state, loadMore] = useTopListDetail(
    history.state?.usr?.toplist,
    params?.platform
  );

  return (
    <div id="page-container" className="page-container">
      <MusicSheetlikeView
        musicSheet={topListDetail}
        musicList={topListDetail?.musicList ?? []}
        state={state}
        onLoadMore={loadMore}
      />
    </div>
  );
}
