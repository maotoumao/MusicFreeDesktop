/**
 * Deep Link 处理模块
 *
 * 处理 musicfree:// 协议链接，目前支持：
 * - musicfree://install/<pluginUrl> — 安装插件（支持逗号分隔批量安装）
 * - musicfree://install?plugin=<pluginUrl> — 同上（query 参数形式）
 */

import { dialog } from 'electron';
import pluginManager from '@infra/pluginManager/main';
import i18n from '@infra/i18n/main';
import logger from '@infra/logger/main';
import windowManager from '@main/core/windowManager';

/** 初始化完成前到达的链接（macOS 冷启动的 open-url、启动期间的二次启动）先暂存 */
let isReady = false;
const pendingUrls: string[] = [];

/** 窗口创建、infra 初始化完成后调用，处理暂存的链接 */
export function setDeepLinkReady(): void {
    isReady = true;
    for (const url of pendingUrls.splice(0)) handleDeepLink(url);
}

/** 处理 deep link URL；初始化完成前到达的先暂存 */
export function handleDeepLink(url: string): void {
    if (!url) return;
    if (!isReady) {
        pendingUrls.push(url);
        return;
    }

    try {
        const urlObj = new URL(url);
        if (urlObj.protocol === 'musicfree:') {
            handleMusicFreeScheme(urlObj);
        }
    } catch {
        logger.warn('[DeepLink] Invalid URL:', url);
    }
}

async function handleMusicFreeScheme(url: URL): Promise<void> {
    if (url.hostname === 'install') {
        await handleInstall(url);
    }
}

async function handleInstall(url: URL): Promise<void> {
    try {
        const raw = url.pathname.slice(1) || url.searchParams.get('plugin');
        if (!raw) {
            logger.warn('[DeepLink] install: missing plugin URL');
            return;
        }

        // 链接可由任意网页或应用触发：只接受 http(s) 地址，安装前需用户确认
        const pluginUrls = raw
            .split(',')
            .map((part) => toHttpUrl(decodeURIComponent(part).trim()))
            .filter((u): u is string => u !== null);
        if (pluginUrls.length === 0) {
            logger.warn('[DeepLink] install: no http(s) plugin URL');
            return;
        }
        if (!(await confirmInstall(pluginUrls))) {
            logger.info('[DeepLink] install cancelled by user');
            return;
        }
        // 与界面安装一致：等已安装插件加载完，才能正确判断重复与版本
        await pluginManager.whenReady();

        const results = await Promise.allSettled(
            pluginUrls.map((pluginUrl) => pluginManager.installPlugin(pluginUrl)),
        );

        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status === 'fulfilled' && r.value.success) {
                logger.info('[DeepLink] Installed plugin:', pluginUrls[i]);
            } else {
                const reason = r.status === 'rejected' ? r.reason : r.value.message;
                logger.warn('[DeepLink] Failed to install plugin:', pluginUrls[i], reason);
            }
        }
    } catch (e) {
        logger.error('[DeepLink] install error:', e);
    }
}

/** 规范化为 http(s) 地址，其他协议、本地路径和非法地址返回 null */
function toHttpUrl(value: string): string | null {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
            ? parsed.toString()
            : null;
    } catch {
        return null;
    }
}

/** 弹出系统确认框，列出来源地址；默认按钮为取消 */
async function confirmInstall(pluginUrls: string[]): Promise<boolean> {
    const options: Electron.MessageBoxOptions = {
        type: 'warning',
        title: i18n.t('plugin.install_confirm_title'),
        message: i18n.t('plugin.install_confirm_title'),
        // 原生对话框显示纯文本，地址不做 HTML 转义
        detail: i18n.t('plugin.install_confirm_detail', {
            urls: pluginUrls.join('\n'),
            interpolation: { escapeValue: false },
        }),
        buttons: [i18n.t('common.cancel'), i18n.t('common.install')],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
    };
    // 主窗口隐藏时（开机自启收在托盘、迷你模式）不挂在它上面，否则 macOS 上对话框跟着隐藏
    const main = windowManager.__getWindowUnsafe('main');
    const parent = main?.isVisible() ? main : null;
    const { response } = parent
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options);
    return response === 1;
}
