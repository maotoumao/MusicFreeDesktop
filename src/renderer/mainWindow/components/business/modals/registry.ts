/**
 * 弹窗注册表对象
 *
 * 独立文件，不 import modalManager，避免循环依赖。
 * modalManager.ts 通过 `import type` 引用此对象推导类型。
 * modals/index.ts 引用此对象执行运行时注册。
 *
 * 添加新弹窗：在下方 import 并加入 modalRegistry 即可。
 */
import ExampleModal from './ExampleModal';
import ConfirmModal from './ConfirmModal';
import PluginInstallModal from './PluginModal/PluginInstallModal';
import PluginImportModal from './PluginModal/PluginImportModal';
import PluginUserVariableModal from './PluginModal/PluginUserVariableModal';
import PluginDescriptionModal from './PluginModal/PluginDescriptionModal';
import PluginSubscriptionModal from './PluginModal/PluginSubscriptionModal';
import PluginSourceRedirectModal from './PluginModal/PluginSourceRedirectModal';
import AddMusicToSheetModal from './AddMusicToSheetModal';
import CreateSheetModal from './CreateSheetModal';
import RenameSheetModal from './RenameSheetModal';
import TextModal from './TextModal';
import SearchLyricModal from './SearchLyricModal';
import ScanFolderModal from './ScanFolderModal';
import ThemeDetailModal from './ThemeDetailModal';
import UpdateModal from './UpdateModal';
import BackupProgressModal from './BackupProgressModal';
import LegacyMigrationModal from './LegacyMigrationModal';

export const modalRegistry = {
    ExampleModal,
    ConfirmModal,
    PluginInstallModal,
    PluginImportModal,
    PluginUserVariableModal,
    PluginDescriptionModal,
    PluginSubscriptionModal,
    PluginSourceRedirectModal,
    AddMusicToSheetModal,
    CreateSheetModal,
    RenameSheetModal,
    TextModal,
    SearchLyricModal,
    ScanFolderModal,
    ThemeDetailModal,
    UpdateModal,
    BackupProgressModal,
    LegacyMigrationModal,
} as const;
