/**
 * DuplicateMusicModal — 本地音乐去重弹窗（业务组件）
 *
 * 功能：
 *  - 四种去重模式：音纹相似 / 完全相同 / 相同标签 / 相同文件名
 *  - 音纹模式分两步：计算音纹（写磁盘缓存，可复用）与对比（分组展示）
 *  - 结果分组展示，支持试听、定位、勾选、移至回收站
 *  - 音纹两两成组自动识别为版本组（建议保留），支持手动标记/移回
 *  - 会话级状态常驻内存：关弹窗不丢结果与进度，随软件退出释放
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue } from 'jotai/react';
import { Check } from 'lucide-react';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { TabBar } from '@renderer/mainWindow/components/ui/TabBar';
import { Select } from '@renderer/mainWindow/components/ui/Select';
import { StatusPlaceholder } from '@renderer/mainWindow/components/ui/StatusPlaceholder';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import { showModal } from '@renderer/mainWindow/components/ui/Modal/modalManager';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import localMusic from '@infra/localMusic/renderer';
import audioFingerprint from '@infra/audioFingerprint/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import formatDuration from '@common/formatDuration';
import formatFileSize from '@common/formatFileSize';
import { RequestStatus } from '@common/constant';
import {
    runDuplicateScan,
    toScanItems,
    THRESHOLDS,
    type ScanMode,
    type SimilarityLevel,
    type DuplicateGroup,
} from './scan';
import {
    groupsByKeyAtom,
    checkedByKeyAtom,
    scanningAtom,
    uiAtom,
    setScanProgress,
    setScanGroups,
    setScanChecked,
    clearScanResults,
    findAudioRun,
    cancelScan,
    isScanCancelled,
    clearScanCancelled,
} from './store';
import {
    detectVersionReason,
    buildVersionSignature,
} from '@infra/audioFingerprint/common/fingerprint';
import type { VersionReason } from '@infra/audioFingerprint/common/fingerprint';
import './index.scss';

export interface DuplicateMusicModalProps {
    close: () => void;
}

const MODE_LABEL_KEYS: Record<ScanMode, string> = {
    audio: 'duplicate_mode_audio',
    exact: 'duplicate_mode_exact',
    tag: 'duplicate_mode_tag',
    filename: 'duplicate_mode_filename',
};

const LEVEL_LABEL_KEYS: Record<SimilarityLevel, string> = {
    strict: 'duplicate_level_strict',
    standard: 'duplicate_level_standard',
    loose: 'duplicate_level_loose',
};

type TFn = (key: string, opts?: any) => string;

function formatReasonText(t: TFn, reason: VersionReason): string {
    switch (reason.code) {
        case 'keyword':
            return t('local_music.duplicate_reason_keyword', { keyword: reason.keyword ?? '' });
        case 'crosslang':
            return t('local_music.duplicate_reason_crosslang');
        case 'cover':
            return t('local_music.duplicate_reason_cover');
        default:
            return '';
    }
}

function formatFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() ?? filePath;
}

export default function DuplicateMusicModal({ close }: DuplicateMusicModalProps) {
    const { t } = useTranslation();
    const [ui, setUi] = useAtom(uiAtom);
    const { mode, level } = ui;
    const scanState = {
        groupsByKey: useAtomValue(groupsByKeyAtom),
        checkedByKey: useAtomValue(checkedByKeyAtom),
        scanning: useAtomValue(scanningAtom),
    };
    const [binError, setBinError] = useState<string | null>(null);
    const [cacheSize, setCacheSize] = useState('0.0MB');
    const [diskCount, setDiskCount] = useState(0);
    const [manualMarks, setManualMarks] = useState<string[]>([]);
    const [versionOpen, setVersionOpen] = useState(false);

    // ── 派生状态 ──

    const keyFor = (m: ScanMode, lv: SimilarityLevel) =>
        m === 'audio' ? `${m}|${THRESHOLDS[lv]}` : m;
    const currentKey = keyFor(mode, level);
    const groups = scanState.groupsByKey[currentKey] ?? [];
    const checked = new Set(scanState.checkedByKey[currentKey] ?? []);

    const audioRun = findAudioRun();
    const mainProg = mode === 'audio' ? audioRun?.prog : scanState.scanning[currentKey];
    const mainProgKey = mode === 'audio' ? audioRun?.key : currentKey;

    // 版本组拆分（仅音纹模式）：手动标记优先，其次恰好 2 首命中自动规则
    const manualSet = new Set(manualMarks);
    const versionGroups: DuplicateGroup[] = [];
    const manualVersionGroups: DuplicateGroup[] = [];
    const normalGroups: DuplicateGroup[] = [];
    if (mode === 'audio') {
        groups.forEach((g) => {
            if (manualSet.has(buildVersionSignature(g.ids))) manualVersionGroups.push(g);
            else if (g.items.length === 2 && detectVersionReason(g.items[0], g.items[1]))
                versionGroups.push(g);
            else normalGroups.push(g);
        });
    } else {
        normalGroups.push(...groups);
    }

    // ── 指纹缓存占用 ──

    const refreshCacheSize = async () => {
        try {
            const info = await audioFingerprint.getCacheInfo();
            const totalBytes = (info.sizeBytes ?? 0) + (info.marksSizeBytes ?? 0);
            setCacheSize(totalBytes ? formatFileSize(totalBytes) : '0.0MB');
            setDiskCount(info.count ?? 0);
        } catch {
            // 大小读不到只影响展示
        }
    };

    useEffect(() => {
        refreshCacheSize();
        audioFingerprint
            .loadMarks()
            .then((marks) => setManualMarks(marks))
            .catch(() => {
                // 无文件=无标记
            });
    }, []);

    const saveManualMarks = async (marks: string[]) => {
        setManualMarks(marks);
        try {
            await audioFingerprint.saveMarks(marks);
        } catch {
            // 写失败下次重进恢复旧值
        }
    };

    // ── 非音频模式：纯对比 ──

    const startCompare = async () => {
        const key = currentKey;
        if (key in scanState.scanning) return;
        clearScanCancelled(key);
        setBinError(null);
        setScanProgress(key, { done: 0, total: 0, mode, phase: 'compare' });
        try {
            const allSongs = await localMusic.getAllMusicItems();
            const items = toScanItems(allSongs);
            setScanProgress(key, { done: 0, total: items.length, mode, phase: 'compare' });
            const { groups: g } = await runDuplicateScan(
                items,
                mode,
                THRESHOLDS[level],
                (done, total) => {
                    setScanProgress(key, { done, total, mode, phase: 'compare' });
                },
                () => isScanCancelled(key),
            );
            if (!isScanCancelled(key)) setScanGroups(key, g);
        } finally {
            clearScanCancelled(key);
            setScanProgress(key, null);
            refreshCacheSize();
        }
    };

    // ── 音频模式：计算音纹与对比 ──

    const startAudioTask = async (kind: 'compare' | 'compute-new' | 'compute-all') => {
        const running = findAudioRun();
        if (running) {
            showToast(
                t(
                    `local_music.${running.prog.phase === 'compute' ? 'duplicate_audio_busy_compute' : 'duplicate_audio_busy_compare'}`,
                ),
                { type: 'warn' },
            );
            return;
        }
        setBinError(null);
        const bin = await audioFingerprint.checkBinary();
        if (!bin.ok) {
            setBinError(bin.error ?? 'fpcalc missing');
            return;
        }
        const allSongs = await localMusic.getAllMusicItems();
        const list = toScanItems(allSongs);
        const before =
            (await audioFingerprint.getCacheInfo().catch(() => ({ count: 0 }))).count ?? 0;
        let removed = 0;
        if (kind === 'compute-all') {
            await audioFingerprint.clearCache();
            clearScanResults();
            setManualMarks([]);
        }
        if (kind === 'compute-new') {
            // 先清理库里已没有的失效条目，再只算新增
            removed =
                (
                    await audioFingerprint
                        .pruneCache(list.map((it) => it.localPath))
                        .catch(() => ({ removed: 0 }))
                ).removed ?? 0;
        } else if (kind === 'compute-all') {
            removed = before;
        }
        const runKey = kind === 'compare' ? currentKey : 'audio-compute';
        clearScanCancelled(runKey);
        setScanProgress(runKey, {
            done: 0,
            total: list.length,
            mode: 'audio',
            phase: kind === 'compare' ? 'compare' : 'compute',
        });
        try {
            const { groups: g, stats } = await runDuplicateScan(
                list,
                'audio',
                THRESHOLDS[level],
                (done, total) => {
                    setScanProgress(runKey, {
                        done,
                        total,
                        mode: 'audio',
                        phase: kind === 'compare' ? 'compare' : 'compute',
                    });
                },
                () => isScanCancelled(runKey),
            );
            if (isScanCancelled(runKey)) return;
            if (kind === 'compare') {
                setScanGroups(runKey, g);
            } else {
                const after =
                    (await audioFingerprint.getCacheInfo().catch(() => ({ count: 0 }))).count ?? 0;
                showToast(
                    t('local_music.duplicate_compute_report', {
                        computed: stats.computed,
                        hit: stats.hit,
                        added: Math.max(0, after - (before - removed)),
                        removed,
                    }),
                );
            }
        } finally {
            clearScanCancelled(runKey);
            setScanProgress(runKey, null);
            refreshCacheSize();
        }
    };

    const handleClearCache = async () => {
        const running = findAudioRun();
        if (running) {
            showToast(
                t(
                    `local_music.${running.prog.phase === 'compute' ? 'duplicate_audio_busy_compute' : 'duplicate_audio_busy_compare'}`,
                ),
                { type: 'warn' },
            );
            return;
        }
        await audioFingerprint.clearCache();
        clearScanResults();
        setManualMarks([]);
        await refreshCacheSize();
        showToast(t('local_music.duplicate_cache_cleared'));
    };

    // ── 删除（移至回收站） ──

    const handleDelete = (targets: { platform: string; id: string; key: string }[]) => {
        if (!targets.length) return;
        const preview = targets
            .slice(0, 5)
            .map((it) => {
                const found = groups.flatMap((g) => g.items).find((x) => x.key === it.key);
                return found ? formatFileName(found.localPath) : it.key;
            })
            .join('、');
        showModal('ConfirmModal', {
            title: t('local_music.confirm_delete_title'),
            message: t('local_music.confirm_trash_batch_message', { count: targets.length }),
            description: `${preview}${targets.length > 5 ? `…${t('local_music.duplicate_preview_etc', { count: targets.length - 5 })}` : ''}`,
            confirmDanger: true,
            onConfirm: async () => {
                try {
                    await localMusic.deleteItems(targets);
                } catch {
                    showToast(t('local_music.duplicate_delete_failed'), { type: 'warn' });
                    return;
                }
                const gone = new Set(targets.map((it) => it.key));
                const prev = groups;
                setScanGroups(
                    currentKey,
                    prev
                        .map((g) => ({
                            ...g,
                            ids: g.items.filter((it) => !gone.has(it.key)).map((it) => it.key),
                            items: g.items.filter((it) => !gone.has(it.key)),
                        }))
                        .filter((g) => g.items.length > 1),
                );
                setScanChecked(currentKey, []);
                // 顺手清理指纹缓存里的失效条目
                try {
                    const remaining = (await localMusic.getAllMusicItems()).map((m) => {
                        const rec = m as unknown as Record<string, unknown>;
                        return typeof rec.localPath === 'string' ? rec.localPath : '';
                    });
                    await audioFingerprint.pruneCache(remaining);
                } catch {
                    // 缓存清理失败不阻塞删除结果
                }
            },
        });
    };

    // ── 渲染 ──

    const modeTabs = (Object.keys(MODE_LABEL_KEYS) as ScanMode[]).map((m) => ({
        key: m,
        label: t(`local_music.${MODE_LABEL_KEYS[m]}`),
    }));

    return (
        <Modal
            open
            onClose={close}
            title={t('local_music.duplicate_title')}
            size="lg"
            footer={
                <Button variant="secondary" onClick={close}>
                    {t('common.close')}
                </Button>
            }
        >
            <div className="duplicate-music-modal">
                <div className="duplicate-music-modal__toolbar">
                    <TabBar
                        items={modeTabs}
                        activeKey={mode}
                        mode="scroll"
                        onChange={(k) => setUi({ ...ui, mode: k as ScanMode })}
                    />
                </div>
                {mode !== 'audio' && (
                    <div className="duplicate-music-modal__action-row">
                        <Button
                            variant="primary"
                            disabled={currentKey in scanState.scanning}
                            onClick={startCompare}
                        >
                            {t(
                                currentKey in scanState.groupsByKey
                                    ? 'local_music.duplicate_recompare'
                                    : 'local_music.duplicate_compare',
                            )}
                        </Button>
                    </div>
                )}
                {Object.entries(scanState.scanning)
                    .filter(([key]) => key !== currentKey)
                    .map(([key, prog]) => (
                        <div key={key} className="duplicate-music-modal__bg-task">
                            <span>
                                {t(`local_music.${MODE_LABEL_KEYS[prog.mode]}`)}
                                {t(
                                    `local_music.${prog.phase === 'compute' ? 'duplicate_phase_compute' : 'duplicate_phase_compare'}`,
                                )}{' '}
                                {prog.done}/{prog.total}
                            </span>
                            <div className="duplicate-music-modal__bg-bar">
                                <span
                                    style={{
                                        width: `${prog.total ? Math.round((prog.done / prog.total) * 100) : 0}%`,
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                className="duplicate-music-modal__cancel"
                                onClick={() => cancelScan(key)}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    ))}
                {mode === 'audio' && (
                    <>
                    <div className="duplicate-music-modal__audio-row">
                        {diskCount > 0 ? (
                            <>
                                <Button
                                    variant="primary"
                                    disabled={!!findAudioRun()}
                                    onClick={() => startAudioTask('compute-new')}
                                >
                                    {t('local_music.duplicate_compute_new')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={!!findAudioRun()}
                                    onClick={() => startAudioTask('compute-all')}
                                >
                                    {t('local_music.duplicate_compute_all')}
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="primary"
                                disabled={!!findAudioRun()}
                                onClick={() => startAudioTask('compute-new')}
                            >
                                {t('local_music.duplicate_compute')}
                            </Button>
                        )}
                        <span className="duplicate-music-modal__threshold-label">
                            {t('local_music.duplicate_threshold')}
                        </span>
                        <Select
                            value={level}
                            onChange={(val) => setUi({ ...ui, level: val as SimilarityLevel })}
                            options={(Object.keys(LEVEL_LABEL_KEYS) as SimilarityLevel[]).map(
                                (lv) => ({
                                    value: lv,
                                    label: t(`local_music.${LEVEL_LABEL_KEYS[lv]}`),
                                }),
                            )}
                        />
                        <Button
                            variant="primary"
                            disabled={!!findAudioRun()}
                            onClick={() => startAudioTask('compare')}
                        >
                            {t(
                                currentKey in scanState.groupsByKey
                                    ? 'local_music.duplicate_recompare'
                                    : 'local_music.duplicate_compare',
                            )}
                        </Button>
                        <span className="duplicate-music-modal__cache-size">
                            {t('local_music.duplicate_cache_size')}: {cacheSize}
                        </span>
                        <Button variant="secondary" size="sm" onClick={handleClearCache}>
                            {t('local_music.duplicate_clear_cache')}
                        </Button>
                    </div>
                    <div className="duplicate-music-modal__footnote">
                        {t('local_music.duplicate_footnote')}
                    </div>
                    </>
                )}
                {binError && <div className="duplicate-music-modal__error">{binError}</div>}
                {mainProg && (
                    <div className="duplicate-music-modal__progress">
                        <div className="duplicate-music-modal__progress-bar">
                            <span
                                style={{
                                    width: `${mainProg.total ? Math.round((mainProg.done / mainProg.total) * 100) : 0}%`,
                                }}
                            />
                        </div>
                        <span>
                            {t(
                                `local_music.${mainProg.phase === 'compute' ? 'duplicate_phase_compute' : 'duplicate_phase_compare'}`,
                            )}{' '}
                            {mainProg.done}/{mainProg.total}
                        </span>
                        {mainProgKey && (
                            <button
                                type="button"
                                className="duplicate-music-modal__cancel"
                                onClick={() => cancelScan(mainProgKey)}
                            >
                                {t('common.cancel')}
                            </button>
                        )}
                    </div>
                )}
                <div className="duplicate-music-modal__assist">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={normalGroups.length === 0}
                        onClick={() => {
                            const keep = new Set(normalGroups.map((g) => g.ids[0]));
                            const next: string[] = [];
                            normalGroups.forEach((g) => {
                                g.ids.forEach((id) => {
                                    if (!keep.has(id)) next.push(id);
                                });
                            });
                            setScanChecked(currentKey, next);
                        }}
                    >
                        {t('local_music.duplicate_keep_first')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={normalGroups.length === 0}
                        onClick={() => {
                            setScanChecked(
                                currentKey,
                                normalGroups.flatMap((g) => g.ids),
                            );
                        }}
                    >
                        {t('local_music.duplicate_select_all')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={checked.size === 0}
                        onClick={() => setScanChecked(currentKey, [])}
                    >
                        {t('local_music.duplicate_clear_selection')}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        danger
                        disabled={checked.size === 0 || currentKey in scanState.scanning}
                        onClick={() =>
                            handleDelete(
                                [...checked].map((key) => {
                                    const [platform, ...rest] = key.split('+');
                                    return { platform, id: rest.join('+'), key };
                                }),
                            )
                        }
                    >
                        {t('local_music.duplicate_delete')}
                    </Button>
                </div>
                <div className="duplicate-music-modal__results">
                    <div className="duplicate-music-modal__groups">
                        <div className="duplicate-music-modal__groups-header">
                            {t('local_music.duplicate_groups_title', {
                                count: normalGroups.length,
                            })}
                        </div>
                        {normalGroups.length === 0 ? (
                            <StatusPlaceholder
                                status={RequestStatus.Done}
                                isEmpty
                                emptyTitle={t('local_music.duplicate_empty_title')}
                                emptyDescription={t('local_music.duplicate_empty_desc')}
                            />
                        ) : (
                            normalGroups.map((g, gi) => (
                                <div key={gi} className="duplicate-music-modal__group">
                                    <div className="duplicate-music-modal__group-header">
                                        <span>
                                            {t('local_music.duplicate_group_item', {
                                                index: gi + 1,
                                                count: g.items.length,
                                            })}
                                        </span>
                                        <button
                                            type="button"
                                            className="duplicate-music-modal__link-btn"
                                            onClick={() => {
                                                const sig = buildVersionSignature(g.ids);
                                                if (!manualMarks.includes(sig)) {
                                                    saveManualMarks([...manualMarks, sig]);
                                                }
                                            }}
                                        >
                                            {t('local_music.duplicate_mark_version')}
                                        </button>
                                    </div>
                                    {g.items.map((it) => (
                                        <div
                                            key={it.key}
                                            role="button"
                                            className={`duplicate-music-modal__row${checked.has(it.key) ? ' is-selected' : ''}`}
                                            onClick={() => {
                                                const next = new Set(checked);
                                                if (next.has(it.key)) next.delete(it.key);
                                                else next.add(it.key);
                                                setScanChecked(currentKey, [...next]);
                                            }}
                                        >
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={checked.has(it.key)}
                                                className="duplicate-music-modal__checkbox"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const next = new Set(checked);
                                                    if (next.has(it.key)) next.delete(it.key);
                                                    else next.add(it.key);
                                                    setScanChecked(currentKey, [...next]);
                                                }}
                                            >
                                                {checked.has(it.key) && <Check size={14} />}
                                            </button>
                                            <span className="duplicate-music-modal__titles">
                                                <span className="duplicate-music-modal__title-row">
                                                    <span className="duplicate-music-modal__title">
                                                        {it.title} - {it.artist}
                                                    </span>
                                                    <span className="duplicate-music-modal__meta">
                                                        {formatDuration(it.duration)}
                                                    </span>
                                                </span>
                                                <span className="duplicate-music-modal__file-row">
                                                    <span className="duplicate-music-modal__file-name">
                                                        {formatFileName(it.localPath)}
                                                    </span>
                                                    <span className="duplicate-music-modal__meta">
                                                        {it.size !== undefined
                                                            ? formatFileSize(it.size)
                                                            : ''}
                                                    </span>
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                className="duplicate-music-modal__action"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    trackPlayer.playMusic({
                                                        platform: it.key.split('+')[0],
                                                        id: it.key.split('+').slice(1).join('+'),
                                                        title: it.title,
                                                        artist: it.artist,
                                                    } as IMusic.IMusicItem);
                                                }}
                                            >
                                                {t('local_music.duplicate_preview')}
                                            </button>
                                            <button
                                                type="button"
                                                className="duplicate-music-modal__action"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    systemUtil.showItemInFolder(it.localPath);
                                                }}
                                            >
                                                {t('local_music.reveal_in_explorer')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                    {(versionGroups.length > 0 || manualVersionGroups.length > 0) && (
                        <div className="duplicate-music-modal__version-section">
                            <button
                                type="button"
                                className="duplicate-music-modal__version-header"
                                onClick={() => setVersionOpen(!versionOpen)}
                            >
                                <span>
                                    {t('local_music.duplicate_version_title', {
                                        count: versionGroups.length + manualVersionGroups.length,
                                    })}
                                </span>
                                <span>
                                    {versionOpen
                                        ? t('local_music.duplicate_collapse')
                                        : t('local_music.duplicate_expand')}
                                </span>
                            </button>
                            {versionOpen &&
                                versionGroups.map((g, gi) => {
                                    const reason =
                                        g.items.length === 2
                                            ? detectVersionReason(g.items[0], g.items[1])
                                            : null;
                                    return (
                                        <div
                                            key={`v${gi}`}
                                            className="duplicate-music-modal__group"
                                        >
                                            <div className="duplicate-music-modal__group-header">
                                                {t('local_music.duplicate_version_auto', {
                                                    reason: reason
                                                        ? formatReasonText(t, reason)
                                                        : t(
                                                              'local_music.duplicate_version_unknown',
                                                          ),
                                                })}
                                            </div>
                                            {g.items.map((it) => (
                                                <div
                                                    key={it.key}
                                                    className="duplicate-music-modal__row"
                                                >
                                                    <span className="duplicate-music-modal__titles">
                                                        <span className="duplicate-music-modal__title-row">
                                                            <span className="duplicate-music-modal__title">
                                                                {it.title} - {it.artist}
                                                            </span>
                                                            <span className="duplicate-music-modal__meta">
                                                                {formatDuration(it.duration)}
                                                            </span>
                                                        </span>
                                                        <span className="duplicate-music-modal__file-row">
                                                            <span className="duplicate-music-modal__file-name">
                                                                {formatFileName(it.localPath)}
                                                            </span>
                                                            <span className="duplicate-music-modal__meta">
                                                                {it.size !== undefined
                                                                    ? formatFileSize(it.size)
                                                                    : ''}
                                                            </span>
                                                        </span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="duplicate-music-modal__action"
                                                        onClick={() => {
                                                            trackPlayer.playMusic({
                                                                platform: it.key.split('+')[0],
                                                                id: it.key
                                                                    .split('+')
                                                                    .slice(1)
                                                                    .join('+'),
                                                                title: it.title,
                                                                artist: it.artist,
                                                            } as IMusic.IMusicItem);
                                                        }}
                                                    >
                                                        {t('local_music.duplicate_preview')}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            {versionOpen &&
                                manualVersionGroups.map((g, gi) => (
                                    <div key={`m${gi}`} className="duplicate-music-modal__group">
                                        <div className="duplicate-music-modal__group-header">
                                            <span>{t('local_music.duplicate_version_manual')}</span>
                                            <button
                                                type="button"
                                                className="duplicate-music-modal__link-btn"
                                            onClick={() => {
                                                const sig = buildVersionSignature(g.ids);
                                                saveManualMarks(
                                                    manualMarks.filter((s) => s !== sig),
                                                );
                                            }}
                                            >
                                                {t('local_music.duplicate_unmark_version')}
                                            </button>
                                        </div>
                                        {g.items.map((it) => (
                                            <div
                                                key={it.key}
                                                className="duplicate-music-modal__row"
                                            >
                                                <span className="duplicate-music-modal__titles">
                                                    <span className="duplicate-music-modal__title-row">
                                                        <span className="duplicate-music-modal__title">
                                                            {it.title} - {it.artist}
                                                        </span>
                                                        <span className="duplicate-music-modal__meta">
                                                            {formatDuration(it.duration)}
                                                        </span>
                                                    </span>
                                                    <span className="duplicate-music-modal__file-row">
                                                        <span className="duplicate-music-modal__file-name">
                                                            {formatFileName(it.localPath)}
                                                        </span>
                                                        <span className="duplicate-music-modal__meta">
                                                            {it.size !== undefined
                                                                ? formatFileSize(it.size)
                                                                : ''}
                                                        </span>
                                                    </span>
                                                </span>
                                                <button
                                                    type="button"
                                                    className="duplicate-music-modal__action"
                                                    onClick={() => {
                                                        trackPlayer.playMusic({
                                                            platform: it.key.split('+')[0],
                                                            id: it.key
                                                                .split('+')
                                                                .slice(1)
                                                                .join('+'),
                                                            title: it.title,
                                                            artist: it.artist,
                                                        } as IMusic.IMusicItem);
                                                    }}
                                                >
                                                    {t('local_music.duplicate_preview')}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
