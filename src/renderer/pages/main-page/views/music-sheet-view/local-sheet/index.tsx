import { useParams } from "react-router-dom";
import { useMusicSheet } from "@/renderer/core/music-sheet/internal/sheets-method";
import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";
import { RequestStateCode } from "@/common/constant";

export default function LocalSheet() {
  const { id } = useParams() ?? {};
  const [musicSheet, loading] = useMusicSheet(id);

  return (
    <MusicSheetlikeView
      musicSheet={musicSheet}
      state={loading ? RequestStateCode.LOADING : RequestStateCode.FINISHED}
      musicList={musicSheet?.musicList ?? []}
    ></MusicSheetlikeView>
  );
}
