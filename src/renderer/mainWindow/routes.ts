// ============================================================================
// 路由路径常量
// ============================================================================
//
// 所有路由路径统一在此定义，避免硬编码散落在多处。
// Sidebar、router.tsx、编程式导航均从此处引用。

/** 静态路由路径（无动态参数） */
export const RoutePaths = {
    /** 排行榜 */
    Toplist: 'toplist',
    /** 排行榜详情 — 需 :platform */
    ToplistDetail: 'toplist-detail',
    /** 热门歌单推荐 */
    RecommendSheets: 'recommend-sheets',
    /** 搜索 — 需 :query */
    Search: 'search',
    /** 歌单详情（远程） — 需 :platform/:id */
    MusicSheet: 'musicsheet',
    /** 本地歌单详情 — 需 :id */
    LocalSheet: 'local-sheet',
    /** 专辑详情 — 需 :platform/:id */
    Album: 'album',
    /** 艺术家详情 — 需 :platform/:id */
    Artist: 'artist',
    /** 本地音乐 */
    LocalMusic: 'local-music',
    /** 下载管理 */
    Download: 'download',
    /** 最近播放 */
    RecentlyPlayed: 'recently-played',
    /** 插件管理 */
    PluginManager: 'plugin-manager',
    /** 设置 */
    Setting: 'setting',
    /** 主题 */
    Theme: 'theme',
    /** 组件展示（开发用） */
    ComponentShowcase: 'dev/components',
} as const;

export type RoutePath = (typeof RoutePaths)[keyof typeof RoutePaths];

// ── 带参数的路由辅助函数 ──

export function searchRoute(query: string) {
    return `/${RoutePaths.Search}/${encodeURIComponent(query)}`;
}

export function musicSheetRoute(platform: string, id: string) {
    return `/${RoutePaths.MusicSheet}/${encodeURIComponent(platform)}/${encodeURIComponent(id)}`;
}

export function localSheetRoute(id: string) {
    return `/${RoutePaths.LocalSheet}/${encodeURIComponent(id)}`;
}

export function albumRoute(platform: string, id: string) {
    return `/${RoutePaths.Album}/${encodeURIComponent(platform)}/${encodeURIComponent(id)}`;
}

export function artistRoute(platform: string, id: string) {
    return `/${RoutePaths.Artist}/${encodeURIComponent(platform)}/${encodeURIComponent(id)}`;
}

export function toplistDetailRoute(platform: string) {
    return `/${RoutePaths.ToplistDetail}/${encodeURIComponent(platform)}`;
}
