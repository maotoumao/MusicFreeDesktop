import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import { localPluginName, timeStampSymbol } from "@/common/constant";
import MusicSheet from "@renderer/core/music-sheet";
import { getRecentlyPlaylist } from "@renderer/core/recently-playlist";
import { musicDetailShownStore } from "@renderer/components/MusicDetail/store";
import mvPlayerStore, {
    hideMVPlayer,
} from "@renderer/components/Modal/templates/MVPlayer/store";
import { requestLocateMusic } from "./index";

/**
 * 歌词详情层和 MV 播放器都是盖在页面上的全屏覆盖层，
 * 定位要露出歌单页，所以跳转前先把它们收掉。
 */
function closeCoveringLayers() {
    if (mvPlayerStore.getValue()?.visible) {
        hideMVPlayer();
    }
    musicDetailShownStore.setValue(false);
}

/**
 * 定位某首歌所在的歌单：跳过去，歌单列表会自动滚到那首歌并选中它。
 *
 * 查找顺序：本地歌单（同一首歌可能在多个歌单里，取最近加入的那个）→
 * 最近播放 → 都没有就提示。
 *
 * 不处理面板显隐：需要收起面板的入口自己按返回值决定
 * （返回 `true` 表示确实跳转了，`false` 表示只弹了提示）。
 */
export function useLocateMusicInSheet() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return useCallback(
        (musicItem: IMusic.IMusicItem): boolean => {
            const key = getMediaPrimaryKey(musicItem);
            let targetSheet: { id: string; time: number } | null = null;
            MusicSheet.frontend.getAllSheets().forEach((sheet) => {
                const ref = (sheet.musicList ?? []).find(
                    (it) => getMediaPrimaryKey(it) === key,
                );
                if (!ref) {
                    return;
                }
                const time = ref[timeStampSymbol] ?? 0;
                if (!targetSheet || time > targetSheet.time) {
                    targetSheet = { id: sheet.id, time };
                }
            });
            if (targetSheet) {
                closeCoveringLayers();
                requestLocateMusic(musicItem, targetSheet.id);
                navigate(
                    `/main/musicsheet/${encodeURIComponent(
                        localPluginName,
                    )}/${encodeURIComponent(targetSheet.id)}`,
                );
                return true;
            }
            // 不在任何歌单里的话，看看最近播放里有没有
            if (
                getRecentlyPlaylist().some((it) => isSameMedia(it, musicItem))
            ) {
                closeCoveringLayers();
                requestLocateMusic(musicItem, "recently-play");
                navigate("/main/recently_play");
                return true;
            }
            toast.info(t("panel.play_list_locate_not_found"));
            return false;
        },
        [navigate, t],
    );
}
