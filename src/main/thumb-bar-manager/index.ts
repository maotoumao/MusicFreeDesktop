import {BrowserWindow, nativeImage} from "electron";
import getResourcePath from "@/utils/main/get-resource-path";
import {t} from "@shared/i18n/main";
import {sendCommand} from "@shared/player-command-sync/main";
import {PlayerState, ResourceName} from "@/common/constant";
import asyncMemoize from "@/utils/common/async-memoize";
import fs from "fs/promises";
import logger from "@shared/logger/main";
import axios from "axios";

/**
 * 设置缩略图按钮
 * @param window 当前窗口
 * @param isPlaying 当前是否正在播放音乐
 */
function setThumbBarButtons(window: BrowserWindow, isPlaying?: boolean) {
    if (!window) {
        return;
    }

    window.setThumbarButtons([
        {
            icon: nativeImage.createFromPath(getResourcePath(ResourceName.SKIP_LEFT_ICON)),
            tooltip: t("main.previous_music"),
            click() {
                sendCommand("SkipToPrevious");
            },
        },
        {
            icon: nativeImage.createFromPath(
                getResourcePath(isPlaying ? ResourceName.PAUSE_ICON : ResourceName.PLAY_ICON)
            ),
            tooltip: isPlaying
                ? t("media.music_state_pause")
                : t("media.music_state_play"),
            click() {
                sendCommand(
                    "SetPlayerState",
                    isPlaying ? PlayerState.Paused : PlayerState.Playing
                );
            },
        },
        {
            icon: nativeImage.createFromPath(getResourcePath(ResourceName.SKIP_RIGHT_ICON)),
            tooltip: t("main.next_music"),
            click() {
                sendCommand("SkipToNext");
            },
        },
    ]);

}


// 获取默认的图片
const getDefaultAlbumCoverImage = asyncMemoize(async () => {
    return await fs.readFile((getResourcePath(ResourceName.DEFAULT_ALBUM_COVER_IMAGE)));
})

let hookedFlag = false;

/**
 * 设置缩略图
 * @param window 窗口
 * @param src 图片url
 */
async function setThumbImage(window: BrowserWindow, src: string) {
    if (!window) {
        return;
    }

    // only support windows
    if (process.platform !== "win32") {
        return;
    }

    try {
        const hwnd = window.getNativeWindowHandle().readBigUInt64LE(0);

        const taskBarThumbManager = (await import("@native/TaskbarThumbnailManager/TaskbarThumbnailManager.node")).default;

        if (!hookedFlag) {
            taskBarThumbManager.config(hwnd);
            hookedFlag = true;
        }

        let buffer: Buffer;
        if (!src) {
            buffer = await getDefaultAlbumCoverImage();
        } else if (src.startsWith("http")) {
            try {
                buffer = (
                    await axios.get(src, {
                        responseType: "arraybuffer",
                    })
                ).data;
            } catch {
                buffer = await getDefaultAlbumCoverImage();
            }
        } else if (src.startsWith("data:image")) {
            buffer = Buffer.from(src.split(";base64,").pop(), "base64");
        } else {
            buffer = await getDefaultAlbumCoverImage();
        }

        const size = 106;

        const sharp = (await import("sharp")).default;
        const result = await sharp(buffer)
            .resize(size, size, {
                fit: "cover",
            })
            .png()
            .ensureAlpha(1)
            .raw()
            .toBuffer({
                resolveWithObject: true,
            });

        taskBarThumbManager.sendIconicRepresentation(
            hwnd,
            {
                width: size,
                height: size,
            },
            result.data
        );
    } catch (ex) {
        logger.logError("Fail to setThumbImage", ex);
    }


}


const ThumbBarManager = {
    setThumbBarButtons,
    setThumbImage
};

export default ThumbBarManager;
