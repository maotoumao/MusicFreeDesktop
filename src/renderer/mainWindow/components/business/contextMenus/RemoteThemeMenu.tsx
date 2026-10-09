import type { ContextMenuEntry } from '../../ui/ContextMenu';
import { showModal } from '../../ui/Modal/modalManager';
import systemUtil from '@infra/systemUtil/renderer';
import i18n from '@infra/i18n/renderer';
import { ExternalLink, Eye, Download, Palette } from 'lucide-react';

export interface RemoteThemeMenuContext {
    /** 主题名称 */
    name: string;
    /** 主题作者 */
    author?: string;
    /** 作者主页 URL */
    authorUrl?: string;
    /** 主题描述 */
    description?: string;
    /** 主题版本 */
    version?: string;
    /** 预览图 URL 或 #hex */
    preview?: string;
    /** 安装回调 */
    onInstall: () => void | Promise<void>;
    /** 安装按钮文案 */
    installLabel: string;
    /** 是否需要下载 */
    needsDownload?: boolean;
    /** 仅下载回调（可选，提供时显示仅下载菜单项） */
    onDownloadOnly?: () => void | Promise<void>;
    /** 仅下载按钮文案（可选，默认“下载”） */
    downloadOnlyLabel?: string;
}

/**
 * RemoteThemeMenu — 远程主题右键菜单模板
 *
 * 提供查看作者主页、预览、下载安装操作。
 */
export function RemoteThemeMenu(ctx: RemoteThemeMenuContext): ContextMenuEntry[] {
    const {
        name,
        author,
        authorUrl,
        description,
        version,
        preview,
        onInstall,
        installLabel,
        needsDownload,
        onDownloadOnly,
        downloadOnlyLabel,
    } = ctx;
    const entries: ContextMenuEntry[] = [];

    // 查看作者（有 authorUrl 时显示）
    if (authorUrl) {
        entries.push({
            id: 'view-author',
            icon: <ExternalLink />,
            label: i18n.t('theme.view_author'),
            onClick() {
                systemUtil.openExternal(authorUrl);
            },
        });
    }

    // 预览
    entries.push({
        id: 'preview',
        icon: <Eye />,
        label: i18n.t('theme.preview'),
        onClick() {
            showModal('ThemeDetailModal', {
                name,
                author,
                authorUrl,
                description,
                version,
                preview,
                onInstall,
                installLabel,
                needsDownload: needsDownload ?? !!onDownloadOnly,
                ...(onDownloadOnly && {
                    onDownloadOnly,
                    downloadOnlyLabel: downloadOnlyLabel || i18n.t('theme.download_only'),
                }),
            });
        },
    });

    // 下载/安装
    entries.push({ type: 'separator' });
    entries.push({
        id: 'install',
        icon: needsDownload ? <Download /> : <Palette />,
        label: installLabel,
        onClick() {
            onInstall();
        },
    });

    // 仅下载
    if (onDownloadOnly) {
        entries.push({
            id: 'download-only',
            icon: <Download />,
            label: downloadOnlyLabel || i18n.t('theme.download_only'),
            onClick() {
                onDownloadOnly();
            },
        });
    }

    return entries;
}
