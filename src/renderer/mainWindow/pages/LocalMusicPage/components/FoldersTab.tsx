/**
 * FoldersTab — 文件夹分类 Tab（树形展开结构）
 *
 * 展示扫描到的文件夹列表，点击展开/折叠。
 * 叶节点展开后内联显示该文件夹下的歌曲列表。
 *
 * 数据源：从 jotai store 同步读取，零 IPC。
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai/react';
import { ChevronDown, Folder } from 'lucide-react';
import { cn } from '@common/cn';
import { RequestStatus } from '@common/constant';
import { SongTable } from '../../../components/business/SongTable';
import { StatusPlaceholder } from '../../../components/ui/StatusPlaceholder';
import { useStatusColumn, useRowContextMenu } from '../shared';
import { filteredLocalMusicAtom, folderListAtom, type FolderAggregation } from '../store';

interface FoldersTabProps {
    isEmpty: boolean;
    searchKeyword: string;
}

export function FoldersTab({ isEmpty, searchKeyword }: FoldersTabProps) {
    const { t } = useTranslation();
    const [expandedFolder, setExpandedFolder] = useState<string | null>(null);

    // ── 从 store 同步读取 ──
    const folders = useAtomValue(folderListAtom);

    // ── 过滤文件夹列表 ──
    const filteredFolders = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return folders;
        return folders.filter((f) => f.folder.toLowerCase().includes(keyword));
    }, [folders, searchKeyword]);

    const toggle = useCallback((folder: string) => {
        setExpandedFolder((prev) => (prev === folder ? null : folder));
    }, []);

    if (isEmpty) {
        return (
            <StatusPlaceholder
                status={RequestStatus.Done}
                isEmpty={isEmpty}
                emptyTitle={t('local_music.empty_title')}
                emptyDescription={t('local_music.empty_desc')}
            />
        );
    }

    return (
        <div className="p-local-music__folders">
            {filteredFolders.map((folder) => (
                <FolderRow
                    key={folder.folder}
                    folder={folder}
                    isExpanded={expandedFolder === folder.folder}
                    onToggle={toggle}
                    searchKeyword={searchKeyword}
                />
            ))}
        </div>
    );
}

// ─── 单个文件夹行 ───

interface FolderRowProps {
    folder: FolderAggregation;
    isExpanded: boolean;
    onToggle: (folder: string) => void;
    searchKeyword: string;
}

function FolderRow({ folder, isExpanded, onToggle, searchKeyword }: FolderRowProps) {
    const { t } = useTranslation();

    // 提取文件夹名（最后一段路径）
    const folderName = useMemo(() => {
        const parts = folder.folder.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || folder.folder;
    }, [folder.folder]);

    return (
        <div className="p-local-music__folder-node">
            <button
                type="button"
                className={cn('p-local-music__folder-row', isExpanded && 'is-expanded')}
                onClick={() => onToggle(folder.folder)}
            >
                <ChevronDown
                    size={14}
                    className={cn('p-local-music__folder-chevron', !isExpanded && 'is-collapsed')}
                />
                <Folder
                    size={18}
                    className={cn('p-local-music__folder-icon', isExpanded && 'is-open')}
                />
                <span className="p-local-music__folder-name" title={folder.folder}>
                    {folderName}
                </span>
                <span className="p-local-music__folder-path" title={folder.folder}>
                    {folder.folder}
                </span>
                <span className="p-local-music__folder-count">
                    {t('local_music.song_count', { count: folder.count })}
                </span>
            </button>

            {isExpanded && <FolderSongList folder={folder.folder} searchKeyword={searchKeyword} />}
        </div>
    );
}

// ─── 文件夹内歌曲列表 ───

function FolderSongList({ folder, searchKeyword }: { folder: string; searchKeyword: string }) {
    const allSongs = useAtomValue(filteredLocalMusicAtom);

    const songsForFolder = useMemo(() => {
        return allSongs.filter((s) => s.folder === folder);
    }, [allSongs, folder]);

    const filteredMusic = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase();
        if (!keyword) return songsForFolder;
        return songsForFolder.filter(
            (item) =>
                item.title.toLowerCase().includes(keyword) ||
                (item.artist ?? '').toLowerCase().includes(keyword) ||
                (item.album ?? '').toLowerCase().includes(keyword),
        );
    }, [songsForFolder, searchKeyword]);

    const handleRowContextMenu = useRowContextMenu();
    const statusColumn = useStatusColumn();

    return (
        <div className="p-local-music__folder-songs">
            <SongTable
                data={filteredMusic}
                requestStatus={RequestStatus.Done}
                onRowContextMenu={handleRowContextMenu}
                statusColumn={statusColumn}
                hideColumns={['platform']}
            />
        </div>
    );
}
