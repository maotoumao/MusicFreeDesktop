/**
 * appConfig — 默认配置值
 *
 * 提供应用配置的默认值，作为配置加载失败或重置时的回退。
 */
import type { IAppConfig } from '@appTypes/infra/appConfig';

const defaultAppConfig: IAppConfig = {
    '$schema-version': 1,
    'playMusic.whenQualityMissing': 'lower',
    'playMusic.defaultQuality': 'standard',
    'playMusic.clickMusicList': 'replace',
    'playMusic.caseSensitiveInSearch': false,
    'playMusic.playError': 'skip',
    'playMusic.whenDeviceRemoved': 'play',
    'normal.taskbarThumb': 'window',
    'normal.closeBehavior': 'minimize',
    'normal.checkUpdate': true,
    'normal.maxHistoryLength': 30,
    'download.defaultQuality': 'standard',
    'download.whenQualityMissing': 'lower',
    'download.fileNameTemplate': '{artist} - {title}',
    'lyric.enableDesktopLyric': false,
    'lyric.alwaysOnTop': true,
    'lyric.lockLyric': false,
    'lyric.fontData': null,
    'lyric.fontColor': '#ffffff',
    'lyric.strokeColor': '#f5c542',
    'lyric.fontSize': 48,
    'lyric.showTranslation': true,
    'shortCut.enableLocal': true,
    'shortCut.enableGlobal': false,
    // 按键格式与设置页录制的格式一致（空格存为 ' '）
    'shortCut.shortcuts': {
        'play/pause': { local: [' '] },
        'skip-previous': { local: ['CmdOrCtrl', 'ArrowLeft'] },
        'skip-next': { local: ['CmdOrCtrl', 'ArrowRight'] },
        'toggle-desktop-lyric': {},
        'volume-up': {},
        'volume-down': {},
        'like/dislike': {},
        'toggle-minimode': {},
    },
    'download.concurrency': 5,
    'download.interval': 0,
    'download.intervalJitter': 0,
    'normal.musicListHideColumns': ['duration'],
    'backup.resumeBehavior': 'append',
    'normal.language': 'zh-CN',
    'normal.launchAtLogin': false,
    'normal.useCustomTrayMenu': true,
};

export default defaultAppConfig;
