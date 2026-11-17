import { defaultFont } from "@/common/constant";
import { IAppConfig } from "@/types/app-config";

const _defaultAppConfig: IAppConfig =  {
    "$schema-version": 1,
    "playMusic.whenQualityMissing": "lower",
    "playMusic.defaultQuality": "standard",
    "playMusic.clickMusicList": "replace",
    "playMusic.caseSensitiveInSearch": false,
    "playMusic.playError": "skip",
    "playMusic.whenDeviceRemoved": "play",
    "normal.taskbarThumb": "window",
    "normal.alwaysOnTop": false,
    "normal.closeBehavior": "minimize",
    "normal.checkUpdate": true,
    "normal.checkPrerelease": false,
    "normal.maxHistoryLength": 30,
    "download.defaultQuality": "standard",
    "download.whenQualityMissing": "lower",
    "lyric.enableDesktopLyric": false,
    "lyric.alwaysOnTop": false,
    "lyric.lockLyric": false,
    "lyric.fontData": defaultFont,
    "lyric.fontColor": "#fff",
    "lyric.strokeColor": "#b48f1d",
    "lyric.fontSize": 54,
    "lyric.smartSearch.enabled": true,
    "lyric.smartSearch.autoApplyThreshold": 0.8,
    "lyric.recognition.token": "",
    "shortCut.enableLocal": true,
    "shortCut.enableGlobal": false,
    "shortCut.shortcuts": {
        "skip-previous": { local: ["Up"], global: null },
        "skip-next": { local: ["Down"], global: null },
        "seek-backward": { local: ["Left"], global: null },
        "seek-forward": { local: ["Right"], global: null },
    },
    "download.concurrency": 5,
    "normal.musicListColumnsShown": [],
    "backup.resumeBehavior": "append",
    "normal.language": "zh-CN",
    "visualization.enabled": false,
    "visualization.effect": "random",
};


export default _defaultAppConfig;
