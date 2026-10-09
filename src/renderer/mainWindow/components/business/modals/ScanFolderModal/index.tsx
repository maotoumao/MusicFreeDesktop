/**
 * ScanFolderModal — 扫描本地文件夹弹窗（业务组件）
 *
 * 功能：
 *   - 展示待扫描的文件夹列表（纯本地状态）
 *   - 添加新文件夹（通过系统文件对话框，仅修改本地状态）
 *   - 移除已有文件夹（仅修改本地状态）
 *   - 点击"开始扫描"后，fire-and-forget 提交文件夹列表并关闭弹窗
 *   - 主进程负责计算 diff（增删）并触发扫描
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Folder } from 'lucide-react';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { ScrollArea } from '@renderer/mainWindow/components/ui/ScrollArea';
import { CheckboxGroup } from '@renderer/mainWindow/components/ui/CheckboxGroup';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import localMusic from '@infra/localMusic/renderer';
import systemUtil from '@infra/systemUtil/renderer';
import appConfig from '@infra/appConfig/renderer';
import fsUtil from '@infra/fsUtil/renderer';
import './index.scss';

export interface ScanFolderModalProps {
    close: () => void;
}

/**
 * 规范化路径用于比较：统一正反斜杠为 '\'，去除末尾分隔符，转小写。
 * Windows 文件系统不区分大小写。
 */
function normalizeForCompare(folderPath: string): string {
    return fsUtil.normalizePath(folderPath).toLowerCase();
}

/**
 * 检查路径列表中是否存在父子路径重叠。
 * 返回冲突描述文本，无冲突返回 null。
 */
function checkPathOverlap(
    newPath: string,
    existingPaths: string[],
    t: (key: string, opts?: Record<string, string>) => string,
): string | null {
    const sep = fsUtil.pathSep;
    const newNorm = normalizeForCompare(newPath);
    for (const ep of existingPaths) {
        const existingNorm = normalizeForCompare(ep);
        if (newNorm === existingNorm) {
            return t('local_music.scan_folder_duplicate');
        }
        if (newNorm.startsWith(existingNorm + sep)) {
            return t('local_music.scan_folder_child_overlap', { parent: ep });
        }
        if (existingNorm.startsWith(newNorm + sep)) {
            return t('local_music.scan_folder_parent_overlap', { child: ep });
        }
    }
    return null;
}

export default function ScanFolderModal({ close }: ScanFolderModalProps) {
    const { t } = useTranslation();

    // ── 纯本地文件夹列表状态 ──
    const [folderPaths, setFolderPaths] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterShort, setFilterShort] = useState(() => {
        return (appConfig.getConfigByKey('localMusic.minDurationSec') ?? 0) === 60;
    });

    // ── 初始化：从主进程加载已持久化的文件夹列表 → 拷贝到本地状态 ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const result = await localMusic.getScanFolders();
                if (!cancelled) {
                    setFolderPaths(result.map((f) => f.folderPath));
                }
            } catch (e) {
                console.error('[ScanFolderModal] load folders error:', e);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // ── 添加文件夹（仅修改本地状态） ──
    const handleAddFolder = useCallback(async () => {
        const result = await systemUtil.showOpenDialog({
            properties: ['openDirectory'],
        });
        if (result.canceled || result.filePaths.length === 0) return;

        const next = [...folderPaths];
        for (const fp of result.filePaths) {
            const overlap = checkPathOverlap(fp, next, t);
            if (overlap) {
                showToast(overlap, { type: 'warn' });
                continue;
            }
            next.push(fp);
        }
        setFolderPaths(next);
    }, [folderPaths, t]);

    // ── 移除文件夹（仅修改本地状态） ──
    const handleRemoveFolder = useCallback((folderPath: string) => {
        setFolderPaths((prev) => prev.filter((fp) => fp !== folderPath));
    }, []);

    // ── 开始扫描：fire-and-forget 提交文件夹列表并关闭弹窗 ──
    const handleStartScan = useCallback(() => {
        // 写入配置
        appConfig.setConfig({
            'localMusic.minDurationSec': filterShort ? 60 : 0,
        });
        localMusic.syncScanFolders(folderPaths).catch((e) => {
            console.error('[ScanFolderModal] sync scan error:', e);
            showToast(t('local_music.scan_failed'), { type: 'warn' });
        });
        close();
    }, [folderPaths, filterShort, close, t]);

    return (
        <Modal
            open
            onClose={close}
            title={t('local_music.scan_title')}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={close}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleStartScan}>
                        {t('local_music.start_scan')}
                    </Button>
                </>
            }
        >
            <div className="scan-folder-modal">
                {/* ── 已添加的文件夹列表 ── */}
                <div className="scan-folder-modal__section-label">
                    {t('local_music.selected_folders')}
                </div>

                {folderPaths.length > 0 ? (
                    <ScrollArea className="scan-folder-modal__folder-list">
                        {folderPaths.map((folderPath) => (
                            <div key={folderPath} className="scan-folder-modal__folder-item">
                                <Folder size={16} className="scan-folder-modal__folder-icon" />
                                <span className="scan-folder-modal__folder-path" title={folderPath}>
                                    {folderPath}
                                </span>
                                <button
                                    type="button"
                                    className="scan-folder-modal__remove-btn"
                                    onClick={() => handleRemoveFolder(folderPath)}
                                >
                                    {t('local_music.remove_folder')}
                                </button>
                            </div>
                        ))}
                    </ScrollArea>
                ) : (
                    !loading && (
                        <div className="scan-folder-modal__empty">
                            {t('local_music.scan_empty_desc')}
                        </div>
                    )
                )}

                {/* ── 添加文件夹按钮 ── */}
                <button
                    type="button"
                    className="scan-folder-modal__add-btn"
                    onClick={handleAddFolder}
                >
                    <Plus size={16} />
                    {t('local_music.add_folder')}
                </button>

                {/* ── 扫描选项 ── */}
                <CheckboxGroup
                    value={filterShort ? ['filterShort'] : []}
                    options={[
                        {
                            value: 'filterShort',
                            label: t('local_music.filter_short_audio'),
                        },
                    ]}
                    onChange={(v) => setFilterShort(v.includes('filterShort'))}
                />

                {/* ── 提示文本 ── */}
                <div className="scan-folder-modal__hint">{t('local_music.scan_hint')}</div>
            </div>
        </Modal>
    );
}
