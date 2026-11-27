/**
 * 播放本地文件 / 文件夹（拖入窗口、系统「打开方式」）
 *
 * 通过内建本地插件解析为本地歌曲，插到当前歌曲之后并播放第一首。
 * 文件夹只读取其中的音频文件，不递归子文件夹（与插件「导入歌单」一致）。
 */
import i18n from '@infra/i18n/renderer';
import { LOCAL_PLUGIN_NAME, SUPPORTED_AUDIO_EXTS } from '@common/constant';
import fsUtil from '@infra/fsUtil/renderer';
import pluginManager from '@infra/pluginManager/renderer';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import trackPlayer from './trackPlayer';

function extOf(filePath: string): string {
    const dot = filePath.lastIndexOf('.');
    return dot < 0 ? '' : filePath.slice(dot).toLowerCase();
}

export async function playLocalFiles(paths: string[]): Promise<void> {
    const items: IMusic.IMusicItem[] = [];
    for (const filePath of paths) {
        if (await fsUtil.isFile(filePath)) {
            if (!SUPPORTED_AUDIO_EXTS.has(extOf(filePath))) continue;
            const item = await pluginManager.callPluginMethod({
                platform: LOCAL_PLUGIN_NAME,
                method: 'importMusicItem',
                args: [filePath],
            });
            if (item) items.push(item);
        } else if (await fsUtil.isFolder(filePath)) {
            const folderItems = await pluginManager.callPluginMethod({
                platform: LOCAL_PLUGIN_NAME,
                method: 'importPlaylist',
                args: [filePath],
            });
            if (Array.isArray(folderItems)) items.push(...folderItems);
        }
    }

    if (items.length === 0) {
        showToast(i18n.t('local_music.no_playable_files'), { type: 'warn' });
        return;
    }
    trackPlayer.addNext(items);
    await trackPlayer.playMusic(items[0]);
}
