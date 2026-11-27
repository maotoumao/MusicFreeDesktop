/**
 * pluginManager — getLyric 适配器（主进程）
 *
 * 在主进程中实现多步歌词获取逻辑：
 * 0. 检查 mediaMeta.associatedLyric——用户关联歌词优先
 * 1. 检查 musicItem.rawLrc——已有文本直接返回
 * 2. 读取本地同名 .lrc 文件（含翻译文件 -tr）
 * 3. 调用插件的 getLyric 方法
 * 4. 如果插件无结果但有 lrcUrl，通过 HTTP 获取
 *
 * 此适配器在主进程运行（需要 fs 访问），通过 IPC 向渲染进程暴露。
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { isSameMedia } from '@common/mediaKey';
import type { IMediaMetaProvider } from '@appTypes/infra/mediaMeta';
import type { IMusicItemProvider } from '@appTypes/infra/playlist';

/** getLyric 适配器所需的参数 */
export interface IGetLyricParams {
    musicItem: IMusic.IMusicItem;
}

/** 调用插件方法的函数类型 */
type CallPluginMethodFn = (params: {
    hash?: string;
    platform?: string;
    method: string;
    args: any[];
}) => Promise<any>;

/**
 * 安全地检查路径是否存在且是文件。
 */
function isFile(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

/**
 * 获取歌曲的本地文件路径。
 *
 * 依次尝试：
 * 1. mediaMeta 中的 downloadData.path（已下载歌曲）
 * 2. musicItem.localPath（本地扫描歌曲）
 */
function getLocalPath(musicItem: IMusic.IMusicItem, mediaMeta: IMediaMetaProvider): string | null {
    const downloadData = mediaMeta.getDownloadData(musicItem.platform, String(musicItem.id));
    if (downloadData?.path) return downloadData.path;
    return musicItem.localPath ?? null;
}

/**
 * getLyric 适配器。
 * 按旧版 plugin-methods.ts 的 getLyric 逻辑，依次尝试多种获取方式。
 *
 * @param params 请求参数
 * @param callPluginMethod 调用插件方法的函数
 * @param mediaMeta mediaMeta DI 接口
 * @param musicItemProvider playlist DI 接口
 * @returns 歌词源结果，或 null
 */
export async function getLyricAdapter(
    params: IGetLyricParams,
    callPluginMethod: CallPluginMethodFn,
    mediaMeta: IMediaMetaProvider,
    musicItemProvider: IMusicItemProvider,
): Promise<ILyric.ILyricSource | null> {
    let musicItem = params.musicItem;
    let rawLrc = musicItem.rawLrc;
    let lrcUrl = musicItem.lrc;
    let translation: string | undefined;

    // ─── Step 0: 用户关联歌词优先 ───
    const associated = mediaMeta.getAssociatedLyric(musicItem.platform, String(musicItem.id));
    if (associated) {
        // 0a: 有缓存的歌词文本，直接返回
        if (associated.rawLrc) {
            return {
                rawLrc: associated.rawLrc,
                translation: associated.translation,
            };
        }

        // 0b: 有关联的 musicItem 但无缓存文本，调用其所属插件的 getLyric
        //     自引用保护：关联歌曲不能是自己（避免死循环）
        if (associated.musicItem && !isSameMedia(associated.musicItem, musicItem)) {
            try {
                const linkedSource = await callPluginMethod({
                    platform: associated.musicItem.platform,
                    method: 'getLyric',
                    args: [associated.musicItem],
                });

                if (linkedSource?.rawLrc || linkedSource?.translation) {
                    const linkedRawLrc = linkedSource.rawLrc ?? linkedSource.translation;
                    const linkedTranslation = linkedSource.rawLrc
                        ? linkedSource.translation
                        : undefined;

                    // 回写缓存到 mediaMeta，下次无需再调插件
                    mediaMeta.setMeta(musicItem.platform, String(musicItem.id), {
                        associatedLyric: {
                            musicItem: associated.musicItem,
                            rawLrc: linkedRawLrc,
                            translation: linkedTranslation,
                        },
                    });

                    return {
                        rawLrc: linkedRawLrc,
                        translation: linkedTranslation,
                    };
                }
            } catch {
                // 关联歌词插件调用失败，继续后续步骤
            }
        }
    }

    // ─── Step 1: musicItem 自身已有 rawLrc，直接返回 ───
    if (rawLrc) {
        return {
            rawLrc,
            lrc: lrcUrl,
        };
    }

    // 播放队列等处传入的多是只含展示字段的精简条目，同名歌词文件和插件 getLyric 可能依赖其余字段
    // （如 localPath），用 DB 中的完整数据补全，调用方传入的字段优先
    const raw = musicItemProvider.getRawMusicItem(musicItem.platform, String(musicItem.id));
    if (raw) musicItem = { ...raw, ...musicItem };

    // ─── Step 2: 读取本地同名 .lrc 文件 ───
    const localPath = getLocalPath(musicItem, mediaMeta);
    if (localPath) {
        const fileName = path.parse(localPath).name;
        const lrcPathWithoutExt = path.resolve(localPath, `../${fileName}`);
        const lrcTranslationPathWithoutExt = path.resolve(localPath, `../${fileName}-tr`);
        const exts = ['.lrc', '.LRC', '.txt'];

        for (const ext of exts) {
            const lrcFilePath = lrcPathWithoutExt + ext;
            if (isFile(lrcFilePath)) {
                rawLrc = fs.readFileSync(lrcFilePath, 'utf-8');

                const trFilePath = lrcTranslationPathWithoutExt + ext;
                if (isFile(trFilePath)) {
                    translation = fs.readFileSync(trFilePath, 'utf-8');
                }

                if (rawLrc) {
                    return {
                        rawLrc,
                        translation,
                        lrc: lrcUrl,
                    };
                }
            }
        }
    }

    // ─── Step 3: 调用插件 getLyric ───
    try {
        const lrcSource = await callPluginMethod({
            platform: musicItem.platform,
            method: 'getLyric',
            args: [musicItem],
        });

        rawLrc = lrcSource?.rawLrc;
        lrcUrl = lrcSource?.lrc || lrcUrl;
        translation = lrcSource?.translation;

        if (rawLrc || translation) {
            // 仅有翻译无原文时，将翻译提升为原文
            if (!rawLrc) {
                rawLrc = translation;
                translation = undefined;
            }

            return {
                rawLrc,
                translation,
            };
        }
    } catch {
        // 插件获取歌词失败，继续下一步
    }

    // ─── Step 4: 通过 lrcUrl 远程获取 ───
    if (lrcUrl) {
        try {
            const resp = await axios.get(lrcUrl, { timeout: 5000 });
            rawLrc = resp.data;

            return {
                rawLrc,
                lrc: lrcUrl,
                translation,
            };
        } catch {
            // 远程获取失败
        }
    }

    return null;
}
