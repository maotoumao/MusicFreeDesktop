import { createHashRouter, Navigate } from 'react-router';
import App from './App';
import { localSheetRoute, RoutePaths } from './routes';
import { DEFAULT_FAVORITE_SHEET_ID } from '@infra/musicSheet/common/constant';

import SearchPage from './pages/SearchPage';
import ToplistPage from './pages/ToplistPage';
import ToplistDetailPage from './pages/ToplistDetailPage';
import RecommendSheetsPage from './pages/RecommendSheetsPage';
import LocalSheetPage from './pages/LocalSheetPage';
import SheetPage from './pages/SheetPage';
import AlbumPage from './pages/AlbumPage';
import ArtistPage from './pages/ArtistPage';
import LocalMusicPage from './pages/LocalMusicPage';
import DownloadPage from './pages/DownloadPage';
import RecentlyPlayedPage from './pages/RecentlyPlayedPage';
import PluginManagerPage from './pages/PluginManagerPage';
import SettingPage from './pages/SettingPage';
import ThemePage from './pages/ThemePage';
import NotFoundPage from './pages/NotFoundPage';

const router = createHashRouter([
    {
        path: '/',
        Component: App,
        children: [
            // ── 首屏：跳转到「我喜欢」歌单 ──
            {
                index: true,
                element: <Navigate to={localSheetRoute(DEFAULT_FAVORITE_SHEET_ID)} replace />,
            },

            // ── 搜索 ──
            {
                path: `${RoutePaths.Search}/:query`,
                Component: SearchPage,
            },

            // ── 在线 ──
            {
                path: RoutePaths.Toplist,
                Component: ToplistPage,
            },
            {
                path: `${RoutePaths.ToplistDetail}/:platform`,
                Component: ToplistDetailPage,
            },
            {
                path: RoutePaths.RecommendSheets,
                Component: RecommendSheetsPage,
            },

            // ── 详情页 ──
            {
                path: `${RoutePaths.LocalSheet}/:id`,
                Component: LocalSheetPage,
            },
            {
                path: `${RoutePaths.MusicSheet}/:platform/:id`,
                Component: SheetPage,
            },
            {
                path: `${RoutePaths.Album}/:platform/:id`,
                Component: AlbumPage,
            },
            {
                path: `${RoutePaths.Artist}/:platform/:id`,
                Component: ArtistPage,
            },

            // ── 本地 ──
            {
                path: RoutePaths.LocalMusic,
                Component: LocalMusicPage,
            },
            {
                path: RoutePaths.Download,
                Component: DownloadPage,
            },
            {
                path: RoutePaths.RecentlyPlayed,
                Component: RecentlyPlayedPage,
            },

            // ── 工具 ──
            {
                path: RoutePaths.PluginManager,
                Component: PluginManagerPage,
            },
            {
                path: RoutePaths.Setting,
                Component: SettingPage,
            },
            {
                path: RoutePaths.Theme,
                Component: ThemePage,
            },
            // ── 开发工具（仅 dev 模式） ──
            ...(__DEV__
                ? [
                      {
                          path: RoutePaths.ComponentShowcase,
                          lazy: () =>
                              import('./pages/ComponentShowcasePage').then((m) => ({
                                  Component: m.default,
                              })),
                      },
                  ]
                : []),

            // ── 兜底 ──
            {
                path: '*',
                Component: NotFoundPage,
            },
        ],
    },
]);

export default router;
