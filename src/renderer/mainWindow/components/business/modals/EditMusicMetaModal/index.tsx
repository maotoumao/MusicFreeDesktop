/**
 * EditMusicMetaModal — 编辑本地歌曲元数据弹窗
 *
 * 允许用户修改本地歌曲的标题、艺术家、专辑字段。
 * 修改后通过 IPC 写入音频文件标签（MP3 支持写入嵌入式标签），
 * 并更新 local_music 数据库记录，触发 LIBRARY_CHANGED 广播刷新 UI。
 */

import { useState, useRef, useCallback, useMemo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import localMusic from '@infra/localMusic/renderer';
import './index.scss';

/** 各字段最大长度 */
const FIELD_MAX_LENGTH = 200;

/** 支持写入嵌入式标签的格式 */
const TAGGABLE_EXTS = new Set(['.mp3']);

/** 从文件路径中提取扩展名 */
function getFileExt(filePath: string): string {
    const idx = filePath.lastIndexOf('.');
    return idx === -1 ? '' : filePath.slice(idx).toLowerCase();
}

export interface EditMusicMetaModalProps {
    close: () => void;
    /** 歌曲文件路径（local_music 的 file_path 主键） */
    filePath: string;
    /** 当前标题 */
    title: string;
    /** 当前艺术家 */
    artist: string;
    /** 当前专辑 */
    album: string;
}

/**
 * EditMusicMetaModal — 编辑歌曲元数据弹窗
 */
export default function EditMusicMetaModal({
    close,
    filePath,
    title: initialTitle,
    artist: initialArtist,
    album: initialAlbum,
}: EditMusicMetaModalProps) {
    const { t } = useTranslation();
    const [title, setTitle] = useState(initialTitle);
    const [artist, setArtist] = useState(initialArtist);
    const [album, setAlbum] = useState(initialAlbum ?? '');
    const [loading, setLoading] = useState(false);
    const submittingRef = useRef(false);

    const fileExt = useMemo(() => getFileExt(filePath), [filePath]);
    const isTagWritable = TAGGABLE_EXTS.has(fileExt);

    const trimmed = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
    };

    const hasChanged =
        trimmed.title !== initialTitle.trim() ||
        trimmed.artist !== initialArtist.trim() ||
        trimmed.album !== (initialAlbum ?? '').trim();

    const canSubmit = trimmed.title.length > 0 && hasChanged && !loading;

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || submittingRef.current) return;
        submittingRef.current = true;

        setLoading(true);
        try {
            const result = await localMusic.updateMusicItemMetadata(filePath, {
                title: trimmed.title,
                artist: trimmed.artist,
                album: trimmed.album,
            });

            if (result.fileTagWritten) {
                showToast(t('local_music.metadata_saved_to_file'));
            } else if (result.tagWarning) {
                showToast(`${t('common.saved')}（${result.tagWarning}）`);
            } else {
                showToast(t('common.saved'));
            }

            close();
        } catch {
            showToast(t('common.save_failed'));
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    }, [canSubmit, filePath, trimmed, close, t]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    return (
        <Modal
            open
            onClose={close}
            title={t('local_music.edit_metadata')}
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={loading}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        loading={loading}
                    >
                        {t('common.confirm')}
                    </Button>
                </>
            }
        >
            {!isTagWritable && (
                <div className="edit-music-meta-modal__hint">
                    {t('local_music.metadata_format_hint', { ext: fileExt })}
                </div>
            )}

            <div className="edit-music-meta-modal__field">
                <label className="edit-music-meta-modal__label">
                    {t('media.title')}
                </label>
                <Input
                    className="edit-music-meta-modal__input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={FIELD_MAX_LENGTH}
                    placeholder={t('media.title')}
                    autoFocus
                />
            </div>

            <div className="edit-music-meta-modal__field">
                <label className="edit-music-meta-modal__label">
                    {t('media.artist')}
                </label>
                <Input
                    className="edit-music-meta-modal__input"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={FIELD_MAX_LENGTH}
                    placeholder={t('media.artist')}
                />
            </div>

            <div className="edit-music-meta-modal__field">
                <label className="edit-music-meta-modal__label">
                    {t('media.album')}
                </label>
                <Input
                    className="edit-music-meta-modal__input"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={FIELD_MAX_LENGTH}
                    placeholder={t('media.album')}
                />
            </div>
        </Modal>
    );
}
