/** IPC 通道 */
export const IPC = {
    // ─── App ───
    EXIT_APP: '@infra/system-util/exit-app',
    GET_CACHE_SIZE: '@infra/system-util/get-cache-size',
    CLEAR_CACHE: '@infra/system-util/clear-cache',
    CHECK_UPDATE: '@infra/system-util/check-update',

    // ─── Window ───
    MINIMIZE_WINDOW: '@infra/system-util/minimize-window',
    SHOW_MAIN_WINDOW: '@infra/system-util/show-main-window',
    TOGGLE_MAXIMIZE: '@infra/system-util/toggle-maximize',
    TOGGLE_VISIBLE: '@infra/system-util/toggle-visible',
    IGNORE_MOUSE_EVENT: '@infra/system-util/ignore-mouse-event',
    ENTER_MINIMODE: '@infra/system-util/enter-minimode',
    EXIT_MINIMODE: '@infra/system-util/exit-minimode',
    TOGGLE_MINIMODE: '@infra/system-util/toggle-minimode',

    // ─── Shell ───
    OPEN_EXTERNAL: '@infra/system-util/open-external',
    OPEN_PATH: '@infra/system-util/open-path',
    SHOW_ITEM_IN_FOLDER: '@infra/system-util/show-item-in-folder',

    // ─── Dialog ───
    SHOW_OPEN_DIALOG: '@infra/system-util/show-open-dialog',
    SHOW_SAVE_DIALOG: '@infra/system-util/show-save-dialog',
} as const;

// ─── Update Sources ───

/** 版本检查源列表（按优先级排列） */
export const UPDATE_SOURCES = [
    'http://musicfree.v1v.fun/version/desktop.json',
    'https://gitee.com/maotoumao/MusicFreeDesktop/raw/master/release/version.json',
    'https://cdn.jsdelivr.net/gh/maotoumao/MusicFreeDesktop@master/release/version.json',
    'https://gh-proxy.org/https://raw.githubusercontent.com/maotoumao/MusicFreeDesktop/master/release/version.json',
    'https://raw.githubusercontent.com/maotoumao/MusicFreeDesktop/master/release/version.json',
    'https://hk.gh-proxy.org/https://raw.githubusercontent.com/maotoumao/MusicFreeDesktop/master/release/version.json',
    'https://cdn.gh-proxy.org/https://raw.githubusercontent.com/maotoumao/MusicFreeDesktop/master/release/version.json',
];

/** contextBridge key */
export const CONTEXT_BRIDGE_KEY = '@infra/system-util';
