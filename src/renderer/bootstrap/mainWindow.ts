/**
 * 主窗口 Renderer 初始化
 *
 * 按依赖顺序 setup 所有主窗口需要的 infra 模块。
 *
 * 初始化顺序:
 *   1. appConfig（最先，其他模块可能依赖配置）
 *   2. 并行: i18n + themepack + requestForwarder + pluginManager
 *   3. shortCut（依赖 appConfig + appSync）
 */
import './global.scss';

import appConfig from '@infra/appConfig/renderer';
import i18n from '@infra/i18n/renderer';
import themePack from '@infra/themepack/renderer';
import requestForwarder from '@infra/requestForwarder/renderer';
import pluginManager from '@infra/pluginManager/renderer';
import shortCut from '@infra/shortCut/renderer';
import appSync from '@infra/appSync/renderer/main';
import musicSheet from '@infra/musicSheet/renderer';
import mediaMeta from '@infra/mediaMeta/renderer';
import downloadManager from '@infra/downloadManager/renderer';
import localMusic from '@infra/localMusic/renderer';
import trackPlayer from '@renderer/mainWindow/core/trackPlayer';
import { runPostBootstrapTasks } from './postBootstrap';
import { setupCommandHandlers } from '@renderer/mainWindow/core/commandHandlers';
import { syncKV } from '@renderer/common/kvStore';

// TODO(v1.1.0): Remove this function and its call in bootstrapMainWindow
function migrateLegacyKVKeys(): void {
    const legacy = localStorage.getItem('currentMusic');
    if (legacy === null) return;

    if (syncKV.get('player.currentMusic') === null) {
        try {
            syncKV.set('player.currentMusic', JSON.parse(legacy));
        } catch {
            // 旧数据格式异常，丢弃
        }
    }

    localStorage.removeItem('currentMusic');
}

export default async function bootstrapMainWindow(): Promise<void> {
    // Phase 1: appConfig 必须最先初始化
    await appConfig.setup();

    // Phase 1.5: 旧版 localStorage key 迁移（同步，须在 trackPlayer.setup 之前）
    // TODO(v1.1.0): Remove this call
    migrateLegacyKVKeys();

    // Phase 2: 无相互依赖的模块并行初始化
    await Promise.all([
        i18n.setup(),
        themePack.setup(),
        requestForwarder.setup(),
        pluginManager.setup(),
        musicSheet.setup(),
        mediaMeta.setup(),
        downloadManager.setup(),
        localMusic.setup(),
    ]);

    // Phase 3: 依赖 appConfig + appSync 的模块
    shortCut.setup({
        appConfig,
        appSync,
    });

    // Phase 4: trackPlayer 依赖 pluginManager + musicSheet（恢复状态时需要获取音源）
    await trackPlayer.setup();

    // Phase 5: 非播放器相关的 command handler
    setupCommandHandlers();

    // Phase 6: 启动后副作用（自动更新插件、检查软件更新），不阻塞 UI
    runPostBootstrapTasks();
}
