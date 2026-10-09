import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Music } from 'lucide-react';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { ScrollArea } from '@renderer/mainWindow/components/ui/ScrollArea';
import { Artwork } from '@renderer/mainWindow/components/ui/Artwork';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import musicSheet, { useMusicSheetList } from '@infra/musicSheet/renderer';
import { DEFAULT_FAVORITE_SHEET_ID } from '@infra/musicSheet/common/constant';
import './index.scss';

export interface AddMusicToSheetModalProps {
    close: () => void;
    /** 要添加的歌曲（支持单曲与多曲） */
    musicItems: IMusic.IMusicItem[];
}

/**
 * AddMusicToSheetModal — 添加歌曲到歌单
 *
 * 列出所有用户歌单（含"我喜欢"），点击即添加并关闭。
 * 顶部"新建歌单"入口：关闭当前弹窗，打开 CreateSheetModal。
 */
export default function AddMusicToSheetModal({ close, musicItems }: AddMusicToSheetModalProps) {
    const { t } = useTranslation();
    const sheets = useMusicSheetList();

    const handleSelectSheet = useCallback(
        (sheetId: string, sheetTitle: string) => {
            musicSheet.addMusicToSheet(musicItems, sheetId);
            showToast(t('playlist.added_to_sheet', { sheet: sheetTitle }));
            close();
        },
        [musicItems, close, t],
    );

    const handleCreateSheet = useCallback(() => {
        close();
        showModal('CreateSheetModal', { initMusicItems: musicItems });
    }, [close, musicItems]);

    return (
        <Modal
            open
            onClose={close}
            title={t('playlist.add_to_sheet_menu')}
            subtitle={t('playlist.selected_count', { count: musicItems.length })}
            size="md"
        >
            <div className="add-music-to-sheet-modal">
                <ScrollArea className="add-music-to-sheet-modal__list">
                    {/* ── 新建歌单 ── */}
                    <button
                        type="button"
                        className="add-music-to-sheet-modal__item add-music-to-sheet-modal__item--create"
                        onClick={handleCreateSheet}
                    >
                        <div className="add-music-to-sheet-modal__item-artwork add-music-to-sheet-modal__item-artwork--create">
                            <Plus size={18} />
                        </div>
                        <span className="add-music-to-sheet-modal__item-title">
                            {t('playlist.create_sheet')}
                        </span>
                    </button>

                    {/* ── 歌单列表 ── */}
                    {sheets.map((sheet) => {
                        const isFavorite = sheet.id === DEFAULT_FAVORITE_SHEET_ID;
                        const displayTitle = isFavorite
                            ? t('media.default_favorite_sheet_name')
                            : sheet.title;

                        return (
                            <button
                                key={sheet.id}
                                type="button"
                                className="add-music-to-sheet-modal__item"
                                onClick={() => handleSelectSheet(sheet.id, displayTitle)}
                            >
                                <Artwork
                                    className="add-music-to-sheet-modal__item-artwork"
                                    src={sheet.artwork ?? sheet.latestArtwork ?? undefined}
                                    rounded="sm"
                                    size="sm"
                                    style={{ width: 36, height: 36 }}
                                />
                                <span className="add-music-to-sheet-modal__item-title">
                                    {displayTitle}
                                </span>
                                <span className="add-music-to-sheet-modal__item-count">
                                    {sheet.worksNum ?? 0}
                                    <Music size={12} />
                                </span>
                            </button>
                        );
                    })}

                    {sheets.length === 0 && (
                        <div className="add-music-to-sheet-modal__empty">
                            {t('status.hint_empty')}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </Modal>
    );
}
