import { useParams } from "react-router-dom";
import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";
import { RequestStateCode } from "@/common/constant";
import MusicSheet, { defaultSheet } from "@/renderer/core/music-sheet";
import { useTranslation } from "react-i18next";

export default function LocalSheet() {
  const { id } = useParams() ?? {};
  const [musicSheet, loading] = MusicSheet.frontend.useMusicSheet(id);
  const { t } = useTranslation();

  const _musicSheet =
    id === defaultSheet.id
      ? {
          ...musicSheet,
          title: t("media.default_favorite_sheet_name"),
        }
      : musicSheet;

  return (
    <MusicSheetlikeView
      hidePlatform
      musicSheet={_musicSheet}
      state={loading}
      musicList={musicSheet?.musicList ?? []}
    ></MusicSheetlikeView>
  );
}
