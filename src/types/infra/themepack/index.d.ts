/**
 * config.json 的原始结构（不含运行时字段）。
 *
 * 主题包中 `@/` 会被替换为主题包根目录的绝对路径。
 */
export interface IThemePackConfig {
    /** 主题名称 */
    name: string;
    /** 预览图，`@/imgs/preview.png` 或 `#hex` 纯色 */
    preview?: string;
    /** BlurHash 编码串，仅在有 iframe 时作为占位背景 */
    blurHash?: string;
    /** 缩略图 `@/imgs/thumb.png` */
    thumb?: string;
    /** 主题更新来源 URL */
    srcUrl?: string;
    /** 主题作者 */
    author?: string;
    /** 主题作者主页 URL */
    authorUrl?: string;
    /** 版本号 */
    version?: string;
    /** 主题描述 */
    description?: string;
    /** 背景 iframe，目前仅支持 app 级别 */
    iframe?: {
        app: string; // `@/iframes/app.html` 或 `https://...`
    };
}

/**
 * 运行时主题包数据（在 IThemePackConfig 基础上附加路径和 hash）。
 */
export interface IThemePack extends IThemePackConfig {
    /** 主题包根目录绝对路径（config.json 所在目录） */
    path: string;
    /** 基于 config.json 内容的 MD5 hash，用作唯一标识 */
    hash: string;
    /** 是否为内置主题（不可卸载、不可更新） */
    builtin?: boolean;
}

/**
 * localStorage 中缓存的主题数据（infra 内部使用）。
 */
export interface IThemePackCache {
    /** 主题包根目录路径，用于校验有效性 */
    path: string;
    /** config.json 的 MD5 hash，用于检测是否变更 */
    hash: string;
    /** 已替换别名后的 CSS 内容 */
    css: string;
    /** BlurHash 编码串（仅 iframe 主题有） */
    blurHash: string | null;
    /** 是否包含 iframe */
    hasIframe: boolean;
}
