import { localPluginName } from "@/common/constant";
import { i18n } from "@/shared/i18n/renderer";

export default {
  id: "favorite",
  title: i18n.t("media.default_favorite_sheet_name"),
  platform: localPluginName,
  musicList: [],
  $$sortIndex: -1,
  $sortIndex: -1,
};
