import { useParams } from "react-router-dom";
import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";
import { RequestStateCode } from "@/common/constant";
import MusicSheet from "@/renderer/core/music-sheet";

export default function LocalSheet() {
  const { id } = useParams() ?? {};
  const [musicSheet, loading] = MusicSheet.frontend.useMusicSheet(id);

  return (
    <MusicSheetlikeView
      musicSheet={musicSheet}
      state={loading}
      musicList={musicSheet?.musicList ?? []}
    ></MusicSheetlikeView>
  );
}
