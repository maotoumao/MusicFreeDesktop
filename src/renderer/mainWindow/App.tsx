// ============================================================================
// App — 应用根布局
// ============================================================================
//
// 布局结构:
//   ┌────────────┬──────────────────────────────────┐
//   │  Sidebar   │  TopBar (nav + search)  [winctrls]│
//   │  260px     ├──────────────────────────────────┤
//   │  全高       │  Content / <Outlet />            │
//   │            │  (flex-1, scrollable)            │
//   │            ├──────────────────────────────────┤
//   │            │  PlayerBar (72px, fixed 底部)     │
//   └────────────┴──────────────────────────────────┘
//   PlayerBar 从 sidebar 右侧开始，不覆盖 sidebar

import { Outlet } from 'react-router';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import PlayerBar from './components/layout/PlayerBar';
import QueueDrawer from './components/layout/QueueDrawer';
import FullscreenPlayer from './components/layout/FullscreenPlayer';
import { ToastContainer } from './components/ui/Toast';
import { ModalContainer } from './components/ui/Modal/ModalContainer';
import { ContextMenuContainer } from './components/ui/ContextMenu/ContextMenuContainer';

// 注册业务弹窗 & 右键菜单模板
import './components/business/modals';
import './components/business/contextMenus';

import './App.scss';

export default function App() {
    return (
        <div className="l-app-shell">
            <Sidebar />
            <main className="l-app-shell__main">
                <TopBar />
                <div className="l-app-shell__content">
                    <Outlet />
                </div>
            </main>
            <PlayerBar />
            <QueueDrawer />
            <FullscreenPlayer />
            <ToastContainer />
            <ModalContainer />
            <ContextMenuContainer />
        </div>
    );
}
