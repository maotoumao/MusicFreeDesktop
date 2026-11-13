/**
 * DuplicateMusicModal — 本地音乐去重弹窗（业务组件）
 *
 * 功能：
 *  - 四种去重模式：音纹相似 / 完全相同 / 相同标签 / 相同文件名
 *  - 音纹模式：计算音纹（写磁盘缓存，可复用）后自动对比并分组
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
    type ScanItem,
    type SimilarityLevel,
    type DuplicateGroup,
} from './scan';
import {
    groupsByKeyAtom,
    checkedByKeyAtom,
    scanningAtom,
    uiAtom,
    unseenTabsAtom,
    setScanProgress,
    setScanGroups,
    setScanChecked,
    clearScanResults,
    findAudioRun,
    cancelScan,
    isScanCancelled,
    clearScanCancelled,
    markTabUnseen,
    clearTabUnseen,
    getScanUi,
    type FingerprintScanProgress,
} from './store';
import {
    detectVersionReason,
    buildVersionSignature,
} from '@infra/audioFingerprint/common/fingerprint';
import type { VersionReason } from '@infra/audioFingerprint/common/fingerprint';
import DuplicateMiniPlayer from './MiniPlayer';
import { usePreviewPlayer } from './usePreviewPlayer';
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

/** 进度条百分比：按当前阶段自身进度展示，阶段切换（计算 → 对比）时重置 */
function scanProgressPercent(prog: FingerprintScanProgress): number {
    if (!prog.total) return 0;
    return (prog.done / prog.total) * 100;
}

/** 进度行文案：音纹任务用完整的阶段名（计算音纹 / 对比文件），其他模式沿用「模式 + 阶段」 */
function formatProgressLabel(t: TFn, prog: FingerprintScanProgress): string {
    if (prog.mode === 'audio')
        return t(
            `local_music.${prog.phase === 'compute' ? 'duplicate_phase_audio_compute' : 'duplicate_phase_audio_compare'}`,
        );
    return `${t(`local_music.${MODE_LABEL_KEYS[prog.mode]}`)}${t(
        `local_music.${prog.phase === 'compute' ? 'duplicate_phase_compute' : 'duplicate_phase_compare'}`,
    )}`;
}

export default function DuplicateMusicModal({ close }: DuplicateMusicModalProps) {
    const { t } = useTranslation();
    const [ui, setUi] = useAtom(uiAtom);
    const { mode, level } = ui;
    const preview = usePreviewPlayer();
    const scanState = {
        groupsByKey: useAtomValue(groupsByKeyAtom),
        checkedByKey: useAtomValue(checkedByKeyAtom),
        scanning: useAtomValue(scanningAtom),
    };
    const [binError, setBinError] = useState<string | null>(null);
    const [cacheSize, setCacheSize] = useState('0.0MB');
    const [manualMarks, setManualMarks] = useState<string[]>([]);
    const [versionOpen, setVersionOpen] = useState(false);
    // 删除就地确认：记录处于确认态的结果 key，避免弹全局确认框打断列表
    const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ── 派生状态 ──

    const keyFor = (m: ScanMode, lv: SimilarityLevel) =>
        m === 'audio' ? `${m}|${THRESHOLDS[lv]}` : m;
    const currentKey = keyFor(mode, level);
    const groups = scanState.groupsByKey[currentKey] ?? [];
    const checked = new Set(scanState.checkedByKey[currentKey] ?? []);
    // 试听队列 = 当前标签去重结果里的全部歌曲；仅轮内播放，不碰外部歌单
    const previewTracks = groups.flatMap((g) => g.items);
    const previewingKey = preview.state.current?.key ?? null;
    // 当前 tab 处于删除确认态且有选中项时才显示内联确认条
    const isDeleteConfirming = deleteConfirmKey === currentKey && checked.size > 0;
    // 音纹对比阶段：结果区显示"发现即展示"的提示，而不是"暂无重复"
    const isAudioComparing =
        mode === 'audio' && scanState.scanning[currentKey]?.phase === 'compare';

    const audioRun = findAudioRun();
    // 当前 tab 对应的任务 key（音纹 tab 优先跟随音纹任务）
    const mainProgKey = mode === 'audio' ? audioRun?.key : currentKey;
    // 所有进行中的任务放在同一区域展示：统一按启动先后排序，最新启动的追加在最下面
    const runningTasks = Object.entries(scanState.scanning).sort(
        ([, a], [, b]) => (a.startedAt ?? 0) - (b.startedAt ?? 0),
    );

    // 版本组拆分：手动标记在所有模式生效；自动识别（恰好 2 首命中版本规则）仅音纹模式
    const manualSet = new Set(manualMarks);
    const versionGroups: DuplicateGroup[] = [];
    const manualVersionGroups: DuplicateGroup[] = [];
    const normalGroups: DuplicateGroup[] = [];
    groups.forEach((g) => {
        if (manualSet.has(buildVersionSignature(g.ids))) manualVersionGroups.push(g);
        else if (
            mode === 'audio' &&
            g.items.length === 2 &&
            detectVersionReason(g.items[0], g.items[1])
        )
            versionGroups.push(g);
        else normalGroups.push(g);
    });

    // ── 指纹缓存占用 ──

    const refreshCacheSize = async () => {
        try {
            const info = await audioFingerprint.getCacheInfo();
            const totalBytes = (info.sizeBytes ?? 0) + (info.marksSizeBytes ?? 0);
            setCacheSize(totalBytes ? formatFileSize(totalBytes) : '0.0MB');
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

    const unseenTabs = useAtomValue(unseenTabsAtom);

    // 看到哪个 tab 就清掉它的红点；切换 tab 时退出删除确认态
    useEffect(() => {
        clearTabUnseen(mode);
        setDeleteConfirmKey(null);
    }, [mode]);

    // 当前结果列表切换（标签或音纹阈值）时清空本轮试听歌单
    useEffect(() => {
        preview.stop();
    }, [currentKey, preview.stop]);

    const saveManualMarks = async (marks: string[]) => {
        setManualMarks(marks);
        try {
            await audioFingerprint.saveMarks(marks);
        } catch {
            // 写失败下次重进恢复旧值
        }
    };

    // ── 试听：使用去重列表自己的播放队列，不读写外部歌单 ──

    const previewMusic = (item: ScanItem) => {
        preview.play(item, previewTracks);
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
            if (!isScanCancelled(key)) {
                setScanGroups(key, g);
                // 跑完时人不在这个 tab 就标红点
                if (getScanUi().mode !== mode) markTabUnseen(mode);
            }
        } finally {
            clearScanCancelled(key);
            setScanProgress(key, null);
            refreshCacheSize();
        }
    };

    // ── 音频模式：计算音纹并直接对比出结果 ──

    const startAudioTask = async () => {
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
        // 先清理库里已没有的失效条目，再只算新增
        const removed =
            (
                await audioFingerprint
                    .pruneCache(list.map((it) => it.localPath))
                    .catch(() => ({ removed: 0 }))
            ).removed ?? 0;
        const runKey = currentKey;
        clearScanCancelled(runKey);
        setScanProgress(runKey, {
            done: 0,
            total: list.length,
            mode: 'audio',
            phase: 'compute',
        });
        let discovered: DuplicateGroup[] = [];
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
                        phase: 'compute',
                    });
                },
                () => isScanCancelled(runKey),
                {
                    onCompareStart: (total) => {
                        // 进入对比阶段：清掉上一轮结果，随后每发现一组追加一组
                        discovered = [];
                        setScanGroups(runKey, []);
                        setScanProgress(runKey, {
                            done: 0,
                            total,
                            mode: 'audio',
                            phase: 'compare',
                        });
                    },
                    onCompareProgress: (done, total) => {
                        setScanProgress(runKey, {
                            done,
                            total,
                            mode: 'audio',
                            phase: 'compare',
                        });
                    },
                    onGroup: (indices) => {
                        discovered = [
                            ...discovered,
                            {
                                ids: indices.map((k) => list[k].key),
                                items: indices.map((k) => list[k]),
                            },
                        ];
                        setScanGroups(runKey, discovered);
                    },
                },
            );
            if (isScanCancelled(runKey)) return;
            setScanGroups(runKey, g);
            if (getScanUi().mode !== 'audio') markTabUnseen('audio');
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
        setDeleteConfirmKey(null);
        preview.stop();
        await refreshCacheSize();
        showToast(t('local_music.duplicate_cache_cleared'));
    };

    // ── 删除（移至回收站）：列表内两步确认，不弹全局弹窗 ──

    const handleDeleteSelected = async () => {
        if (deleting) return;
        const targetKeys = [...checked];
        if (!targetKeys.length) return;
        const runKey = currentKey;
        const prevGroups = groups;
        const targets = targetKeys.map((key) => {
            const [platform, ...rest] = key.split('+');
            return { platform, id: rest.join('+'), key };
        });
        setDeleting(true);
        try {
            await localMusic.deleteItems(targets);
        } catch {
            showToast(t('local_music.duplicate_delete_failed'), { type: 'warn' });
            return;
        } finally {
            setDeleting(false);
        }
        // 原地更新当前列表：只移除已删除项，不重新渲染整个结果
        const gone = new Set(targetKeys);
        setScanGroups(
            runKey,
            prevGroups
                .map((g) => ({
                    ...g,
                    ids: g.items.filter((it) => !gone.has(it.key)).map((it) => it.key),
                    items: g.items.filter((it) => !gone.has(it.key)),
                }))
                .filter((g) => g.items.length > 1),
        );
        setScanChecked(runKey, []);
        setDeleteConfirmKey(null);
        // 同步试听队列：删到当前曲目时自动切下一首，其余情况不打断播放
        preview.removeItems(gone);
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
    };

    // ── 渲染 ──

    const modeTabs = (Object.keys(MODE_LABEL_KEYS) as ScanMode[]).map((m) => ({
        key: m,
        label: t(`local_music.${MODE_LABEL_KEYS[m]}`),
        icon: unseenTabs.includes(m) ? (
            <span className="duplicate-music-modal__tab-dot" />
        ) : undefined,
    }));

    return (
        <Modal
            open
            onClose={close}
            title={t('local_music.duplicate_title')}
            size="lg"
            footer={
                <div className="duplicate-music-modal__footer">
                    <DuplicateMiniPlayer
                        state={preview.state}
                        onToggle={preview.toggle}
                        onNext={preview.next}
                        onSeek={preview.seekTo}
                    />
                    <Button variant="secondary" onClick={close}>
                        {t('common.close')}
                    </Button>
                </div>
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
                {/* 进行中的任务：固定在 Tab 行下方，切换 tab 位置完全不变 */}
                {runningTasks.length > 0 && (
                    <div className="duplicate-music-modal__tasks">
                        {runningTasks.map(([key, prog]) => (
                            <div
                                key={key}
                                className={`duplicate-music-modal__progress${
                                    key === mainProgKey ? '' : ' is-background'
                                }`}
                            >
                                <span className="duplicate-music-modal__progress-label">
                                    {formatProgressLabel(t, prog)} {prog.done}/{prog.total}
                                </span>
                                <div className="duplicate-music-modal__progress-bar">
                                    <span
                                        style={{
                                            width: `${Math.round(scanProgressPercent(prog))}%`,
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
                    </div>
                )}
                {mode !== 'audio' && (
                    <div className="duplicate-music-modal__action-row">
                        <Button
                            variant="primary"
                            disabled={currentKey in scanState.scanning || deleting}
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
                {mode === 'audio' && (
                    <div className="duplicate-music-modal__audio-row">
                        <Button
                            variant="primary"
                            disabled={!!findAudioRun() || deleting}
                            onClick={() => startAudioTask()}
                        >
                            {t('local_music.duplicate_compute')}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={deleting}
                            onClick={handleClearCache}
                        >
                            {t('local_music.duplicate_clear_cache')}
                        </Button>
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
                    </div>
                )}
                {mode === 'audio' && (
                    <div className="duplicate-music-modal__footnote">
                        <span>
                            {t('local_music.duplicate_cache_size')}: {cacheSize}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{t('local_music.duplicate_footnote')}</span>
                    </div>
                )}
                {binError && <div className="duplicate-music-modal__error">{binError}</div>}
                {isDeleteConfirming ? (
                    <div className="duplicate-music-modal__delete-confirm" role="alert">
                        <span className="duplicate-music-modal__delete-confirm-text">
                            {t('local_music.duplicate_delete_confirm_text', {
                                count: checked.size,
                            })}
                        </span>
                        <Button
                            className="duplicate-music-modal__delete-confirm-btn"
                            variant="secondary"
                            size="sm"
                            disabled={deleting}
                            onClick={() => setDeleteConfirmKey(null)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            className="duplicate-music-modal__delete-confirm-btn"
                            variant="primary"
                            size="sm"
                            danger
                            loading={deleting}
                            disabled={currentKey in scanState.scanning}
                            onClick={handleDeleteSelected}
                        >
                            {t('local_music.duplicate_delete_confirm_action')}
                        </Button>
                    </div>
                ) : (
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
                            disabled={
                                checked.size === 0 || currentKey in scanState.scanning || deleting
                            }
                            onClick={() => setDeleteConfirmKey(currentKey)}
                        >
                            {t('local_music.duplicate_delete')}
                        </Button>
                    </div>
                )}
                <div className="duplicate-music-modal__results">
                    <div className="duplicate-music-modal__groups">
                        <div className="duplicate-music-modal__groups-header">
                            {t('local_music.duplicate_groups_title', {
                                count: normalGroups.length,
                            })}
                        </div>
                        {normalGroups.length === 0 ? (
                            isAudioComparing ? (
                                <div className="duplicate-music-modal__compare-hint">
                                    {t('local_music.duplicate_compare_hint')}
                                </div>
                            ) : (
                                <StatusPlaceholder
                                    status={RequestStatus.Done}
                                    isEmpty
                                    emptyTitle={t('local_music.duplicate_empty_title')}
                                    emptyDescription={t('local_music.duplicate_empty_desc')}
                                />
                            )
                        ) : (
                            normalGroups.map((g, gi) => (
                                <div key={g.ids.join('|')} className="duplicate-music-modal__group">
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
                                                // 标记后组会移到下方版本区，自动展开让用户看到结果
                                                setVersionOpen(true);
                                            }}
                                        >
                                            {t('local_music.duplicate_mark_version')}
                                        </button>
                                    </div>
                                    {g.items.map((it) => (
                                        <div
                                            key={it.key}
                                            role="button"
                                            className={`duplicate-music-modal__row${checked.has(it.key) ? ' is-selected' : ''}${
                                                isDeleteConfirming && checked.has(it.key)
                                                    ? ' is-pending-delete'
                                                    : ''
                                            }${previewingKey === it.key ? ' is-previewing' : ''}`}
                                            onClick={() => {
                                                if (deleting) return;
                                                // 确认态下改动勾选即退出确认，避免误删目标变化
                                                if (isDeleteConfirming) setDeleteConfirmKey(null);
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
                                                disabled={deleting}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (deleting) return;
                                                    if (isDeleteConfirming)
                                                        setDeleteConfirmKey(null);
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
                                                    previewMusic(it);
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
                                                    className={`duplicate-music-modal__row${previewingKey === it.key ? ' is-previewing' : ''}`}
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
                                                            previewMusic(it);
                                                        }}
                                                    >
                                                        {t('local_music.duplicate_preview')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="duplicate-music-modal__action"
                                                        onClick={() => {
                                                            systemUtil.showItemInFolder(
                                                                it.localPath,
                                                            );
                                                        }}
                                                    >
                                                        {t('local_music.reveal_in_explorer')}
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
                                                className={`duplicate-music-modal__row${previewingKey === it.key ? ' is-previewing' : ''}`}
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
                                                        previewMusic(it);
                                                    }}
                                                >
                                                    {t('local_music.duplicate_preview')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="duplicate-music-modal__action"
                                                    onClick={() => {
                                                        systemUtil.showItemInFolder(it.localPath);
                                                    }}
                                                >
                                                    {t('local_music.reveal_in_explorer')}
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
