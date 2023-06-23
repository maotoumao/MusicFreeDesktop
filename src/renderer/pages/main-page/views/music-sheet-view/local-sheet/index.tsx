import { useParams } from "react-router-dom";
import { useMusicSheet } from "@/renderer/core/music-sheet/internal/sheets-method";
import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";

export default function LocalSheet() {
  const { id } = useParams() ?? {};
  const musicSheet = useMusicSheet(id);

  return (
    <MusicSheetlikeView
      musicSheet={musicSheet}
      musicList={musicSheet?.musicList ?? []}
    ></MusicSheetlikeView>
  );
}
