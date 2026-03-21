import type { ContextMenuEntry } from '../../ui/ContextMenu';
import { showToast } from '../../ui/Toast';
import { showModal } from '../../ui/Modal/modalManager';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import {
    RECENTLY_PLAYED_ID,
    removeFromRecentlyPlayed,
} from '@renderer/mainWindow/core/recentlyPlayed';
import musicSheet from '@infra/musicSheet/renderer';
import downloadManager from '@infra/downloadManager/renderer';
import localMusic from '@infra/localMusic/renderer';
import fsUtil from '@infra/fsUtil/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import i18n from '@infra/i18n/renderer';
import { LOCAL_PLUGIN_NAME } from '@common/constant';
import { PLAY_QUEUE_SHEET_ID, DOWNLOADED_SHEET_ID } from '@infra/musicSheet/common/constant';
import {
    Fingerprint,
    User,
    Disc3,
    ListEnd,
    ListPlus,
    ListX,
    Trash2,
    Download,
    FolderOpen,
} from 'lucide-react';

export interface MusicItemMenuContext {
    /** 单曲或多选的歌曲列表 */
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[];
    /**
     * 当前所在歌单 ID，控制"删除"菜单项的显隐：
     *   - undefined → 不在歌单内，不显示删除
     *   - PLAY_QUEUE_SHEET_ID → 播放队列，显示"从播放队列移除"
     *   - 其他 → 用户歌单，显示"从歌单内删除"
     */
    sheetId?: string;
}

/** 复制文本到剪贴板并弹出 toast */
function copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(
        () => showToast(i18n.t('common.copied')),
        () => showToast(i18n.t('common.copied')),
    );
}

/**
 * MusicItemMenu — 歌曲右键菜单模板
 *
 * 支持单曲和多选两种场景：
 *   - 单曲：顶部显示 ID / 作者 / 专辑（点击复制）+ 分割线 + 操作项
 *   - 多选：仅显示操作项（批量操作）
 */
export function MusicItemMenu(ctx: MusicItemMenuContext): ContextMenuEntry[] {
    const { musicItems, sheetId } = ctx;
    const items = Array.isArray(musicItems) ? musicItems : [musicItems];
    const isSingle = items.length === 1;

    const entries: ContextMenuEntry[] = [];

    // ── 信息头（仅单曲） ──
    if (isSingle) {
        const singleItem = items[0];

        entries.push({
            id: 'info-id',
            icon: <Fingerprint />,
            label: `ID: ${singleItem.platform}@${singleItem.id}`,
            onClick: () => {
                copyToClipboard(`${singleItem.platform}@${singleItem.id}`);
            },
        });

        entries.push({
            id: 'info-artist',
            icon: <User />,
            label: `${i18n.t('media.artist')}: ${singleItem.artist || i18n.t('media.unknown_artist')}`,
            onClick: () => {
                copyToClipboard(singleItem.artist || '');
            },
        });

        if (singleItem.album) {
            entries.push({
                id: 'info-album',
                icon: <Disc3 />,
                label: `${i18n.t('media.album')}: ${singleItem.album}`,
                onClick: () => {
                    copyToClipboard(singleItem.album ?? '');
                },
            });
        }

        entries.push({ type: 'separator' });
    }

    // ── 下一首播放 ──
    entries.push({
        id: 'play-next',
        icon: <ListEnd />,
        label: i18n.t('playback.next_play'),
        onClick: () => {
            trackPlayer.addNext(items);
            showToast(i18n.t('playback.added_to_next'));
        },
    });

    // ── 添加到歌单 ──
    entries.push({
        id: 'add-to-sheet',
        icon: <ListPlus />,
        label: i18n.t('playlist.add_to_sheet_menu'),
        onClick: () => {
            showModal('AddMusicToSheetModal', { musicItems: items });
        },
    });

    // ── 从歌单内删除（仅在用户歌单内，排除特殊歌单） ──
    if (
        sheetId &&
        sheetId !== PLAY_QUEUE_SHEET_ID &&
        sheetId !== RECENTLY_PLAYED_ID &&
        sheetId !== DOWNLOADED_SHEET_ID
    ) {
        entries.push({
            id: 'remove-from-sheet',
            icon: <Trash2 />,
            label: i18n.t('playlist.remove_from_sheet'),
            danger: true,
            onClick: () => {
                musicSheet.removeMusicFromSheet(items, sheetId);
            },
        });
    }

    // ── 从播放队列移除 ──
    if (sheetId === PLAY_QUEUE_SHEET_ID) {
        entries.push({
            id: 'remove-from-queue',
            icon: <Trash2 />,
            label: i18n.t('playback.remove_from_queue'),
            danger: true,
            onClick: () => {
                trackPlayer.removeMusic(items);
            },
        });
    }

    // ── 从最近播放移除 ──
    if (sheetId === RECENTLY_PLAYED_ID) {
        entries.push({
            id: 'remove-from-recently-played',
            icon: <Trash2 />,
            label: i18n.t('history.remove'),
            danger: true,
            onClick: () => {
                removeFromRecentlyPlayed(items);
            },
        });
    }

    // ── 已下载 / 本地歌曲操作（打开文件夹 + 删除下载记录）——仅单曲 ──
    if (isSingle) {
        const singleItem = items[0];
        const downloaded = downloadManager.isDownloaded(singleItem);

        const isLocal = downloaded?.path || singleItem.platform === LOCAL_PLUGIN_NAME;

        if (isLocal) {
            entries.push({
                id: 'reveal-in-explorer',
                icon: <FolderOpen />,
                label: i18n.t('download.reveal_in_explorer'),
                onClick: async () => {
                    let localFilePath: string | null = null;

                    try {
                        if (downloaded?.path) {
                            localFilePath = downloaded.path;
                        } else if (singleItem.platform === LOCAL_PLUGIN_NAME) {
                            // 获取raw
                            if (
                                typeof singleItem.url === 'string' &&
                                singleItem.url.startsWith('file:')
                            ) {
                                localFilePath = fsUtil.fileUrlToPath(singleItem.url);
                            } else {
                                const rawItem = await musicSheet.getRawMusicItem(
                                    singleItem.platform,
                                    singleItem.id,
                                );
                                if (
                                    rawItem &&
                                    typeof rawItem.url === 'string' &&
                                    rawItem.url.startsWith('file:')
                                ) {
                                    localFilePath = fsUtil.fileUrlToPath(rawItem.url);
                                }
                            }
                        }

                        if (localFilePath) {
                            const ok = await systemUtil.showItemInFolder(localFilePath);
                            if (!ok) {
                                showToast(i18n.t('local_music.reveal_fail'));
                            }
                        } else {
                            throw new Error('No local file path found');
                        }
                    } catch {
                        showToast(i18n.t('local_music.reveal_fail'));
                    }
                },
            });
        }

        if (downloaded && sheetId === DOWNLOADED_SHEET_ID) {
            // 删除下载记录（保留本地文件）—— 仅在下载歌单中显示
            entries.push({
                id: 'remove-download-record',
                icon: <ListX />,
                label: i18n.t('download.remove_record'),
                onClick: () => {
                    downloadManager.removeDownload(
                        singleItem.platform,
                        String(singleItem.id),
                        false,
                    );
                },
            });
        }

        if (downloaded) {
            // 删除已下载的本地文件（同时删除下载记录）
            entries.push({
                id: 'delete-local-file',
                icon: <Trash2 />,
                label: i18n.t('local_music.delete_file'),
                danger: true,
                onClick: () => {
                    showModal('ConfirmModal', {
                        title: i18n.t('local_music.confirm_delete_title'),
                        message: i18n.t('local_music.confirm_delete_message'),
                        confirmDanger: true,
                        onConfirm: () => {
                            downloadManager.removeDownload(
                                singleItem.platform,
                                String(singleItem.id),
                                true,
                            );
                        },
                    });
                },
            });
        }
    }

    // ── 删除纯本地文件（支持批量，移至回收站 + 从所有歌单移除 + 从播放队列移除） ──
    // 仅当选中项全部为本地歌曲时显示
    {
        const allLocal = items.every((item) => item.platform === LOCAL_PLUGIN_NAME);

        if (allLocal) {
            entries.push({
                id: 'delete-local-music',
                icon: <Trash2 />,
                label: i18n.t('local_music.delete_file'),
                danger: true,
                onClick: () => {
                    const message =
                        items.length === 1
                            ? i18n.t('local_music.confirm_trash_message')
                            : i18n.t('local_music.confirm_trash_batch_message', {
                                  count: items.length,
                              });

                    showModal('ConfirmModal', {
                        title: i18n.t('local_music.confirm_delete_title'),
                        message,
                        confirmDanger: true,
                        onConfirm: async () => {
                            await localMusic.deleteItems(items);
                            musicSheet.removeFromAllSheets(items);
                            trackPlayer.removeMusic(items);
                        },
                    });
                },
            });
        }
    }

    // ── 下载（全部已下载时隐藏，部分已下载时过滤） ──
    {
        const notDownloaded = items.filter(
            (item) =>
                downloadManager.isDownloaded(item) === null && item.platform !== LOCAL_PLUGIN_NAME,
        );

        if (notDownloaded.length > 0) {
            entries.push({
                id: 'download',
                icon: <Download />,
                label: i18n.t('common.download'),
                onClick: () => {
                    downloadManager.addTasksBatch({ musicItems: notDownloaded });
                },
            });
        }
    }

    return entries;
}
