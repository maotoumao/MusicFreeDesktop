import { useState, useCallback, type MouseEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Artwork } from '../../components/ui/Artwork';
import { Avatar } from '../../components/ui/Avatar';
import { ScrollArea } from '../../components/ui/ScrollArea';
import { ProgressBar } from '../../components/ui/ProgressBar';
import {
    ContextMenu,
    type ContextMenuPosition,
    type ContextMenuEntry,
} from '../../components/ui/ContextMenu';
import { Toggle } from '../../components/ui/Toggle';
import { Select } from '../../components/ui/Select';
import { TabBar } from '../../components/ui/TabBar';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { Chip } from '../../components/ui/Chip';
import { PluginFeatureUnavailable } from '../../components/business/PluginFeatureUnavailable';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { ListFooter } from '../../components/ui/ListFooter';
import { showToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { showModal } from '../../components/ui/Modal/modalManager';
import { showContextMenu } from '../../components/ui/ContextMenu/contextMenuManager';
import { Drawer } from '../../components/ui/Drawer';
import { toggleQueueDrawer } from '../../components/layout/QueueDrawer/queueDrawerState';
import { MusicSheetHeader } from '../../components/ui/MusicSheetHeader';
import { SongToolbar } from '../../components/ui/SongToolbar';
import { SongTable } from '../../components/business/SongTable';
import { FavoriteButton } from '../../components/business/FavoriteButton';
import { DownloadButton } from '../../components/business/DownloadButton';
import { MediaGrid } from '../../components/ui/MediaGrid';
import { RequestStatus } from '@common/constant';
import {
    Music,
    SearchX,
    Play,
    Plus,
    Trash2,
    Search,
    Pause,
    SkipBack,
    SkipForward,
    Heart,
    Settings,
    Check,
    X,
    ChevronDown,
    Music2,
} from 'lucide-react';

import './index.scss';

// 演示常量
// ────────────────────────────────────────────────────────────────────────────

const contextMenuItems: ContextMenuEntry[] = [
    { id: 'play', label: '播放', icon: <Play size={16} /> },
    { id: 'add', label: '添加到歌单', icon: <Plus size={16} /> },
    { type: 'separator' },
    { id: 'delete', label: '删除', icon: <Trash2 size={16} />, danger: true },
];

const selectOptions = [
    { value: 'opt-1', label: '选项 A' },
    { value: 'opt-2', label: '选项 B' },
    { value: 'opt-3', label: '选项 C（禁用）', disabled: true },
    { value: 'opt-4', label: '选项 D' },
];

const tabItems = [
    { key: 'all', label: '全部' },
    { key: 'music', label: '单曲' },
    { key: 'album', label: '专辑' },
    { key: 'artist', label: '艺术家' },
    { key: 'playlist', label: '歌单' },
];

const radioOptions = [
    { value: 'asc', label: '升序' },
    { value: 'desc', label: '降序' },
    { value: 'random', label: '随机' },
];

// ── SongTable mock data ──
const MOCK_SONGS: IMusic.IMusicItemBase[] = Array.from(
    { length: 30 },
    (_, i) =>
        ({
            id: `song-${i}`,
            title: `歌曲标题 ${i + 1}${i === 0 ? ' — 一个比较长的名称来测试截断效果' : ''}`,
            artist: `歌手 ${String.fromCharCode(65 + (i % 26))}`,
            album: `专辑 ${Math.floor(i / 3) + 1}`,
            duration: 180 + Math.floor(Math.random() * 180),
            platform: ['酷狗', 'QQ', '网易'][i % 3],
            // 状态列 mock 数据
            liked: i % 3 === 0,
            downloaded: i % 2 === 0,
        }) as IMusic.IMusicItemBase,
);

// ── MediaGrid mock data ──
const MOCK_ALBUMS: IMusic.IMusicSheetItem[] = Array.from({ length: 12 }, (_, i) => ({
    id: `album-${i}`,
    platform: '本地',
    title: `专辑名称 ${i + 1}`,
    artist: `歌手 ${String.fromCharCode(65 + (i % 26))}`,
}));

// ────────────────────────────────────────────────────────────────────────────
// Page Component
// ────────────────────────────────────────────────────────────────────────────

export default function ComponentShowcasePage() {
    // ── ProgressBar ──
    const [slimValue, setSlimValue] = useState(35);
    const [thickValue, setThickValue] = useState(60);
    const [labeledValue, setLabeledValue] = useState(78);

    // ── ContextMenu ──
    const [ctxPos, setCtxPos] = useState<ContextMenuPosition | null>(null);
    const handleContextMenu = useCallback((e: MouseEvent) => {
        e.preventDefault();
        setCtxPos({ x: e.clientX, y: e.clientY });
    }, []);

    // ── Toggle ──
    const [toggleOn, setToggleOn] = useState(true);
    const [toggleOff, setToggleOff] = useState(false);

    // ── Select ──
    const [selectValue, setSelectValue] = useState('opt-1');

    // ── TabBar ──
    const [activeTab, setActiveTab] = useState('all');

    // ── RadioGroup ──
    const [radioValue, setRadioValue] = useState('asc');

    // ── Chip ──
    const [activeChip, setActiveChip] = useState('all');
    const chipTags = ['全部', '华语', '欧美', '电子', '学习', '治愈'];

    // ── Modal ──
    const [modalOpen, setModalOpen] = useState(false);
    const [modalSize, setModalSize] = useState<'sm' | 'md' | 'lg'>('md');

    // ── Drawer ──
    const [drawerOpen, setDrawerOpen] = useState(false);

    // ── SongToolbar ──
    const [songSearch, setSongSearch] = useState('');

    // ── SongTable ──
    const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());

    return (
        <div className="p-component-showcase">
            <h1 className="p-component-showcase__title">组件展示 Component Showcase</h1>

            {/* ══════════════════════════════════════════════════════════════
                Button
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Button</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Variants</div>
                    <div className="p-component-showcase__row">
                        <Button variant="primary">Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="icon" size="sq">
                            <Plus size={16} />
                        </Button>
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Sizes</div>
                    <div className="p-component-showcase__row">
                        <Button size="sm">Small</Button>
                        <Button size="md">Medium</Button>
                        <Button size="lg">Large</Button>
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">States</div>
                    <div className="p-component-showcase__row">
                        <Button disabled>Disabled</Button>
                        <Button loading>Loading</Button>
                        <Button icon={<Plus size={14} />}>With Icon</Button>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Input
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Input</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">
                        默认 / 带图标 / 可清空 / 错误
                    </div>
                    <div className="p-component-showcase__row--col p-component-showcase__row">
                        <Input placeholder="默认输入框" />
                        <Input placeholder="搜索…" prefix={<Search size={14} />} />
                        <Input placeholder="可清空输入框" allowClear defaultValue="Hello" />
                        <Input placeholder="错误状态" hasError defaultValue="invalid" />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Badge
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Badge</h2>
                <div className="p-component-showcase__row">
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="filled">Filled</Badge>
                    <Badge variant="tint">Tint</Badge>
                    <Badge variant="outline" colorScheme="danger">
                        Danger
                    </Badge>
                    <Badge variant="filled" colorScheme="danger">
                        Danger
                    </Badge>
                    <Badge variant="tint" colorScheme="danger">
                        Danger
                    </Badge>
                    <Badge variant="outline" colorScheme="warn">
                        Warn
                    </Badge>
                    <Badge variant="filled" colorScheme="warn">
                        Warn
                    </Badge>
                    <Badge variant="tint" colorScheme="warn">
                        Warn
                    </Badge>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Artwork & Avatar
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Artwork &amp; Avatar</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Artwork Sizes</div>
                    <div className="p-component-showcase__row">
                        <Artwork size="sm" fallback={<Music size={20} />} />
                        <Artwork size="md" fallback={<Music size={32} />} />
                        <Artwork size="lg" fallback={<Music size={48} />} />
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Avatar Sizes</div>
                    <div className="p-component-showcase__row">
                        <Avatar size="sm" fallback="A" />
                        <Avatar size="md" fallback="B" />
                        <Avatar size="lg" fallback="C" />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                SvgIcon
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Lucide Icons</h2>
                <div className="p-component-showcase__row">
                    <Play size={20} />
                    <Pause size={20} />
                    <SkipBack size={20} />
                    <SkipForward size={20} />
                    <Heart size={20} />
                    <Heart size={20} />
                    <Search size={20} />
                    <Settings size={20} />
                    <Trash2 size={20} />
                    <Plus size={20} />
                    <Check size={20} />
                    <X size={20} />
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                ProgressBar
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">ProgressBar</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Slim (hover 显示 thumb)</div>
                    <div className="p-component-showcase__progress-wrap">
                        <ProgressBar
                            variant="slim"
                            value={slimValue}
                            buffered={slimValue + 20}
                            onChange={setSlimValue}
                        />
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Thick</div>
                    <div className="p-component-showcase__progress-wrap">
                        <ProgressBar variant="thick" value={thickValue} onChange={setThickValue} />
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Labeled (带百分比)</div>
                    <div className="p-component-showcase__progress-wrap">
                        <ProgressBar
                            variant="labeled"
                            value={labeledValue}
                            onChange={setLabeledValue}
                        />
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Non-interactive</div>
                    <div className="p-component-showcase__progress-wrap">
                        <ProgressBar variant="slim" value={50} interactive={false} />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                ContextMenu
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">ContextMenu</h2>
                <div className="p-component-showcase__row">
                    <div
                        className="p-component-showcase__context-trigger"
                        onContextMenu={handleContextMenu}
                    >
                        声明式 — 右键点击此区域
                    </div>
                    <div
                        className="p-component-showcase__context-trigger"
                        onContextMenu={(e) => {
                            e.preventDefault();
                            showContextMenu(
                                'ExampleMenu',
                                { x: e.clientX, y: e.clientY },
                                { itemName: '示例曲目' },
                            );
                        }}
                    >
                        命令式 — 右键点击此区域
                    </div>
                </div>
                {ctxPos && (
                    <ContextMenu
                        visible={!!ctxPos}
                        items={contextMenuItems}
                        position={ctxPos}
                        onClose={() => setCtxPos(null)}
                    />
                )}
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Toggle
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Toggle</h2>
                <div className="p-component-showcase__row">
                    <Toggle checked={toggleOn} onChange={setToggleOn} />
                    <Toggle checked={toggleOff} onChange={setToggleOff} />
                    <Toggle checked disabled />
                    <Toggle disabled />
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Select
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Select</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">默认 / 禁用</div>
                    <div className="p-component-showcase__row">
                        <Select
                            value={selectValue}
                            options={selectOptions}
                            onChange={setSelectValue}
                            placeholder="请选择…"
                        />
                        <Select value="opt-1" options={selectOptions} disabled />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                TabBar
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">TabBar</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Wrap mode</div>
                    <TabBar
                        items={tabItems}
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        mode="wrap"
                    />
                </div>

                <div className="p-component-showcase__spacer" />

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">Scroll mode</div>
                    <TabBar
                        items={[
                            ...tabItems,
                            { key: 'lyric', label: '歌词' },
                            { key: 'mv', label: 'MV' },
                            { key: 'comment', label: '评论' },
                            { key: 'similar', label: '相似推荐' },
                        ]}
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        mode="scroll"
                    />
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                RadioGroup
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">RadioGroup</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">默认 / 禁用</div>
                    <div className="p-component-showcase__row">
                        <RadioGroup
                            value={radioValue}
                            options={radioOptions}
                            onChange={setRadioValue}
                        />
                        <RadioGroup value="asc" options={radioOptions} disabled />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Chip
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Chip</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">筛选标签（单选）</div>
                    <div className="p-component-showcase__row">
                        {chipTags.map((tag) => (
                            <Chip
                                key={tag}
                                label={tag}
                                active={activeChip === tag}
                                onClick={() => setActiveChip(tag)}
                            />
                        ))}
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">带前缀 / 后缀</div>
                    <div className="p-component-showcase__row">
                        <Chip label="默认" active suffix={<ChevronDown size={14} />} />
                        <Chip label="网易云" prefix={<Music2 size={14} />} />
                        <Chip
                            label="可删除"
                            suffix={<X size={14} style={{ cursor: 'pointer' }} />}
                        />
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">禁用</div>
                    <div className="p-component-showcase__row">
                        <Chip label="禁用" disabled />
                        <Chip label="禁用 + 激活" disabled active />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                ScrollArea
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">ScrollArea</h2>
                <ScrollArea orientation="vertical" style={{ height: 120, width: 320 }}>
                    {Array.from({ length: 20 }, (_, i) => (
                        <div
                            key={i}
                            style={{
                                padding: '6px 0',
                                color: 'var(--color-text-secondary)',
                                fontSize: 13,
                            }}
                        >
                            ScrollArea 行 #{i + 1}
                        </div>
                    ))}
                </ScrollArea>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                PluginFeatureUnavailable
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">PluginFeatureUnavailable</h2>
                <PluginFeatureUnavailable featureName="排行榜" />
            </section>

            {/* ══════════════════════════════════════════════════════════════
                StatusPlaceholder
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">StatusPlaceholder</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div>
                        <h3
                            style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 8,
                            }}
                        >
                            Pending（加载中）
                        </h3>
                        <StatusPlaceholder status={RequestStatus.Pending} />
                    </div>
                    <div>
                        <h3
                            style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 8,
                            }}
                        >
                            Error（默认错误态）
                        </h3>
                        <StatusPlaceholder
                            status={RequestStatus.Error}
                            onRetry={() => alert('重试')}
                        />
                    </div>
                    <div>
                        <h3
                            style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 8,
                            }}
                        >
                            Error（自定义文案）
                        </h3>
                        <StatusPlaceholder
                            status={RequestStatus.Error}
                            errorTitle="获取歌单失败"
                            errorDescription="请检查网络连接后重试"
                            onRetry={() => alert('重试')}
                        />
                    </div>
                    <div>
                        <h3
                            style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 8,
                            }}
                        >
                            Done + isEmpty（默认空态）
                        </h3>
                        <StatusPlaceholder status={RequestStatus.Done} isEmpty />
                    </div>
                    <div>
                        <h3
                            style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 8,
                            }}
                        >
                            Done + isEmpty（自定义空态）
                        </h3>
                        <StatusPlaceholder
                            status={RequestStatus.Done}
                            isEmpty
                            emptyIcon={SearchX}
                            emptyTitle="暂无搜索结果"
                            emptyDescription="试试其他关键词或切换插件"
                        />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                ListFooter
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">ListFooter</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                        <h3
                            style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 8,
                            }}
                        >
                            loading
                        </h3>
                        <ListFooter status={RequestStatus.Pending} />
                    </div>
                    <div>
                        <h3
                            style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 8,
                            }}
                        >
                            error
                        </h3>
                        <ListFooter status={RequestStatus.Error} onRetry={() => alert('重试')} />
                    </div>
                    <div>
                        <h3
                            style={{
                                fontSize: 13,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 8,
                            }}
                        >
                            done
                        </h3>
                        <ListFooter status={RequestStatus.Done} />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Toast
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Toast</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">命令式调用</div>
                    <div className="p-component-showcase__row">
                        <Button size="sm" onClick={() => showToast('复制成功')}>
                            Info Toast
                        </Button>
                        <Button
                            size="sm"
                            onClick={() =>
                                showToast('网络异常', {
                                    type: 'warn',
                                    description: '请检查网络连接后重试',
                                })
                            }
                        >
                            Warn Toast
                        </Button>
                        <Button
                            size="sm"
                            onClick={() =>
                                showToast('已添加到歌单', {
                                    actionLabel: '查看',
                                    onAction: () => alert('查看歌单'),
                                })
                            }
                        >
                            带操作 Toast
                        </Button>
                        <Button
                            size="sm"
                            onClick={() =>
                                showToast('不可关闭提示', { closable: false, duration: 2000 })
                            }
                        >
                            无关闭按钮
                        </Button>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Modal
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Modal</h2>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">命令式用法（showModal）</div>
                    <div className="p-component-showcase__row">
                        <Button
                            size="sm"
                            onClick={() =>
                                showModal('ExampleModal', {
                                    title: '命令式弹窗',
                                    content: '通过 showModal("ExampleModal", props) 调用',
                                })
                            }
                        >
                            showModal 命令式
                        </Button>
                    </div>
                </div>

                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">声明式用法（UI Shell）</div>
                    <div className="p-component-showcase__row">
                        <Button
                            size="sm"
                            onClick={() => {
                                setModalSize('sm');
                                setModalOpen(true);
                            }}
                        >
                            Small (400px)
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setModalSize('md');
                                setModalOpen(true);
                            }}
                        >
                            Medium (520px)
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setModalSize('lg');
                                setModalOpen(true);
                            }}
                        >
                            Large (600px)
                        </Button>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                Drawer
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">Drawer</h2>
                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">右侧抽屉面板</div>
                    <div className="p-component-showcase__row">
                        <Button size="sm" onClick={() => setDrawerOpen(true)}>
                            打开 Drawer
                        </Button>
                    </div>
                </div>
                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">
                        播放队列抽屉（QueueDrawer）
                    </div>
                    <div className="p-component-showcase__row">
                        <Button size="sm" onClick={toggleQueueDrawer}>
                            打开 QueueDrawer
                        </Button>
                    </div>
                </div>
            </section>

            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="播放队列">
                <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                    <p>这是 Drawer 的内容区域。</p>
                    <p style={{ marginTop: 8 }}>支持 Escape 键和点击遮罩关闭。</p>
                </div>
            </Drawer>

            {/* ══════════════════════════════════════════════════════════════
                MusicHeader
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">MusicSheetHeader</h2>
                <MusicSheetHeader
                    musicSheet={{
                        id: 'sheet-1',
                        platform: '网易云',
                        title: '每日推荐歌单',
                        description:
                            '根据你的听歌习惯，每日为你推荐30首歌曲。支持多种音乐平台，自动匹配最佳音质。',
                        worksNum: 30,
                    }}
                    actions={
                        <>
                            <Button variant="primary" size="sm" icon={<Play size={14} />}>
                                播放全部
                            </Button>
                            <Button variant="secondary" size="sm">
                                收藏
                            </Button>
                        </>
                    }
                />
            </section>

            {/* ══════════════════════════════════════════════════════════════
                SongToolbar
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">SongToolbar</h2>
                <SongToolbar
                    searchPlaceholder="搜索歌曲…"
                    searchValue={songSearch}
                    onSearchChange={setSongSearch}
                    onPlayAll={() => showToast('播放全部')}
                >
                    <Button variant="ghost" size="sm">
                        下载全部
                    </Button>
                </SongToolbar>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                SongTable
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">SongTable</h2>
                <div className="p-component-showcase__group">
                    <div className="p-component-showcase__group-label">
                        虚拟列表 · 多选 · 右键菜单
                    </div>
                    <SongTable
                        data={MOCK_SONGS}
                        enableSelection
                        selectedIds={selectedSongIds}
                        onSelectionChange={setSelectedSongIds}
                        statusColumn={(item) => (
                            <>
                                <FavoriteButton musicItem={item} size="sm" />
                                <DownloadButton musicItem={item} size="sm" />
                            </>
                        )}
                        onRowDoubleClick={({ item }) => showToast(`双击播放: ${item.title}`)}
                        onRowContextMenu={({ item }, e) => {
                            e.preventDefault();
                            showToast(`右键: ${item.title}`);
                        }}
                    />
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                MediaGrid
               ══════════════════════════════════════════════════════════════ */}
            <section className="p-component-showcase__section">
                <h2 className="p-component-showcase__section-title">MediaGrid</h2>
                <MediaGrid
                    data={MOCK_ALBUMS}
                    onItemClick={(item) => showToast(`点击: ${item.title}`)}
                    onPlayClick={(item) => showToast(`播放: ${item.title}`)}
                    placeholderIcon={<Music size={32} strokeWidth={1.2} />}
                />
            </section>

            {/* Modal 实例 */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="示例弹窗"
                subtitle={`尺寸: ${modalSize}`}
                size={modalSize}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                            取消
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => setModalOpen(false)}>
                            确认
                        </Button>
                    </>
                }
            >
                <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    这是 Modal UI 外壳的声明式演示。业务弹窗通过 showModal(&quot;ModalName&quot;,
                    options) 命令式调用。
                </p>
            </Modal>
        </div>
    );
}
