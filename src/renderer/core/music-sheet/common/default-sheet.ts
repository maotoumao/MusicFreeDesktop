import { localPluginName } from "@/common/constant";
import i18n from "@/common/i18n";

export default {
    id: 'favorite',
    title: i18n.t('default_favorite_sheet_name', {
        ns: 'common'
    }),
    platform: localPluginName,
    musicList: [],
    $$sortIndex: -1
}