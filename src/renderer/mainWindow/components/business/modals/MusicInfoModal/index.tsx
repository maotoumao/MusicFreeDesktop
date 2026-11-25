/**
 * MusicInfoModal — 本地歌曲只读信息：标签与文件、编码参数
 */
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import formatAudioFormat from '@common/formatAudioFormat';
import formatDuration from '@common/formatDuration';
import formatFileSize from '@common/formatFileSize';
import type { IAudioFormat } from '@appTypes/infra/localMusic';
import './index.scss';

export interface MusicInfoModalProps {
    close: () => void;
    musicItem: IMusic.IMusicItem;
}

export default function MusicInfoModal({ close, musicItem }: MusicInfoModalProps) {
    const { t } = useTranslation();
    const format = musicItem.audioFormat as IAudioFormat | undefined;
    const fileSize = musicItem.fileSize as number | null | undefined;

    const rows: Array<[string, string | number | undefined | null]> = [
        [t('media.title'), musicItem.title],
        [t('media.artist'), musicItem.artist],
        [t('media.album'), musicItem.album],
        [t('media.duration'), musicItem.duration ? formatDuration(musicItem.duration) : null],
        [t('media.quality'), format ? formatAudioFormat(format) : null],
        [t('media.bitrate'), format?.bitrate ? `${Math.round(format.bitrate / 1000)} kbps` : null],
        [t('media.sample_rate'), format?.sampleRate ? `${format.sampleRate} Hz` : null],
        [t('media.bit_depth'), format?.bitsPerSample ? `${format.bitsPerSample} bit` : null],
        [t('media.channels'), format?.channels],
        [t('media.file_size'), fileSize ? formatFileSize(fileSize) : null],
        [t('media.file_path'), musicItem.localPath],
    ];

    return (
        <Modal open onClose={close} title={t('local_music.music_info')} size="sm">
            <dl className="b-music-info-modal">
                {rows.map(([label, value]) => (
                    <div key={label} className="b-music-info-modal__row">
                        <dt className="b-music-info-modal__label">{label}</dt>
                        <dd className="b-music-info-modal__value">{value || '-'}</dd>
                    </div>
                ))}
            </dl>
        </Modal>
    );
}
