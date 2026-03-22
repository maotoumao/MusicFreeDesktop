/**
 * CustomTrayMenu - Native Windows tray menu module
 *
 * A C++ Node-API addon that renders a custom tray context menu
 * using Direct2D with Windows 11 Fluent Design (Acrylic backdrop,
 * rounded corners, Segoe UI Variable font).
 *
 * Features:
 * - "Now Playing" header with cover art, title, artist
 * - 5 media control buttons: Like, Prev, Play/Pause, Next, PlayMode
 * - Customizable menu items with icons, checked state, destructive style
 * - System backdrop effects (Acrylic/Mica) with Win10 fallback
 * - Per-Monitor DPI awareness
 */

import type { RepeatMode } from '@common/constant';

declare module '@main/native_modules/CustomTrayMenu/CustomTrayMenu.node' {
    export interface SystemCapabilities {
        /** Whether acrylic/blur backdrop is supported */
        acrylic: boolean;
        /** Whether native DWM rounded corners are supported (Win11) */
        roundedCorners: boolean;
        /** OS version string, e.g. "10.0.22631" */
        osVersion: string;
    }

    export interface InitResult {
        success: boolean;
        error?: string;
        capabilities: SystemCapabilities;
    }

    export interface NowPlayingInfo {
        /** Song title */
        title: string;
        /** Artist name */
        artist: string;
        /** Cover art as BGRA32 raw pixel Buffer */
        coverBuffer?: Buffer;
        /** Cover image width in pixels */
        coverWidth?: number;
        /** Cover image height in pixels */
        coverHeight?: number;
        /** Whether the track is currently playing */
        isPlaying: boolean;
        /** Whether the track is liked/favorited */
        isLiked: boolean;
        /** Repeat/shuffle mode: "queue-repeat" | "loop" | "shuffle" */
        playMode?: RepeatMode;
        /**
         * Tooltip texts for the 5 media control buttons.
         * Order: [Like, Prev, Play/Pause, Next, PlayMode]
         * If omitted, no tooltips are shown.
         */
        buttonTooltips?: [string, string, string, string, string];
    }

    export interface MenuItem {
        /** Unique identifier for this menu item */
        id: string;
        /** Display label text */
        label: string;
        /** Icon as BGRA32 raw pixel Buffer */
        iconBuffer?: Buffer;
        /** Icon width in pixels */
        iconWidth?: number;
        /** Icon height in pixels */
        iconHeight?: number;
        /** Whether the item shows a checked status dot */
        checked?: boolean;
        /** Whether the item uses destructive (red) styling */
        isDestructive?: boolean;
        /** Whether the item is interactive (default: true) */
        enabled?: boolean;
        /** Whether the item is rendered (default: true) */
        visible?: boolean;
    }

    export interface SeparatorItem {
        type: 'separator';
    }

    export type MenuItemOrSeparator = MenuItem | SeparatorItem;

    /** Callback event names */
    export type TrayMenuEvent =
        | 'LIKE'
        | 'PREV'
        | 'PLAY_PAUSE'
        | 'NEXT'
        | 'PLAY_MODE'
        | 'NOW_PLAYING_CLICKED'
        | 'MENU_CLICKED'
        | 'ERROR';

    export interface MenuClickedPayload {
        menuId: string;
    }

    export interface ErrorPayload {
        code: string;
        message: string;
    }

    export type EventPayload = MenuClickedPayload | ErrorPayload | Record<string, never>;

    export type EventCallback = (event: TrayMenuEvent, payload: EventPayload) => void;

    /**
     * Initialize the native tray menu module.
     * Creates a hidden popup window and UI thread.
     * Must be called before any other function.
     *
     * @param callback - Event callback for user interactions
     * @returns Initialization result with system capabilities
     */
    export function initialize(callback: EventCallback): InitResult;

    /**
     * Update the "Now Playing" header section.
     * Can be called repeatedly to reflect playback state changes.
     *
     * @param info - Current playback information
     */
    export function updateNowPlaying(info: NowPlayingInfo): void;

    /**
     * Set the menu items displayed below the media controls.
     * Replaces all existing items.
     *
     * @param items - Array of menu items and separators
     */
    export function setMenuItems(items: MenuItemOrSeparator[]): void;

    /**
     * Show the menu at the specified tray icon position.
     * The menu automatically positions itself relative to the taskbar.
     */
    export function showAt(): void;

    /**
     * Hide the menu if currently visible.
     */
    export function hide(): void;

    /**
     * Destroy the menu window and release all resources.
     * Should be called on app quit.
     */
    export function destroy(): void;
}
