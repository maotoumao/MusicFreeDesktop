import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { RequestStatus } from '@common/constant';
import { Artwork } from '../../components/ui/Artwork';
import { StatusPlaceholder } from '../../components/ui/StatusPlaceholder';
import { toplistDetailRoute } from '../../routes';
import { useTopLists } from './useTopLists';
import './index.scss';

interface ToplistBodyProps {
    /** 当前插件 hash */
    pluginHash: string;
    /** 当前插件 platform */
    pluginPlatform: string;
}

/**
 * ToplistBody — 单个插件的排行榜卡片网格
 *
 * 按分组（IMusicSheetGroupItem）展示榜单卡片；
 * 卡片采用纵向布局：封面 + 标题 header + 预览占位文字。
 * 点击卡片跳转到排行榜详情页。
 */
export function ToplistBody({ pluginHash, pluginPlatform }: ToplistBodyProps) {
    const { t } = useTranslation();
    const { status, data, fetch, retry, syncFromCache } = useTopLists(pluginHash);
    const navigate = useNavigate();

    useEffect(() => {
        syncFromCache();
        fetch();
    }, [pluginHash]);

    const handleCardClick = useCallback(
        (item: IMusic.IMusicSheetItem) => {
            navigate(toplistDetailRoute(pluginPlatform), {
                state: {
                    topListItem: {
                        ...item,
                        platform: pluginPlatform,
                    },
                },
            });
        },
        [navigate, pluginPlatform],
    );

    // 加载中 / 错误 / 空态
    if (data.length === 0) {
        if (status === RequestStatus.Pending || status === RequestStatus.Idle) {
            return <StatusPlaceholder status={RequestStatus.Pending} />;
        }
        if (status === RequestStatus.Error) {
            return (
                <StatusPlaceholder
                    status={RequestStatus.Error}
                    errorTitle={t('toplist.load_error')}
                    onRetry={retry}
                />
            );
        }
        if (status === RequestStatus.Done) {
            return (
                <StatusPlaceholder
                    status={RequestStatus.Done}
                    isEmpty
                    emptyTitle={t('toplist.empty')}
                />
            );
        }
    }

    return (
        <div className="p-toplist__body">
            {data.map((group, groupIdx) => (
                <div className="p-toplist__group" key={groupIdx}>
                    {group.title && <h3 className="p-toplist__group-title">{group.title}</h3>}
                    <div className="p-toplist__grid">
                        {(group.data ?? []).map((item) => (
                            <button
                                type="button"
                                key={item.id}
                                className="p-toplist__card"
                                onClick={() => handleCardClick(item)}
                            >
                                <div className="p-toplist__card-header">
                                    <div className="p-toplist__card-cover">
                                        <Artwork
                                            src={item.artwork}
                                            alt={item.title}
                                            size="sm"
                                            rounded="sm"
                                        />
                                    </div>
                                    <div className="p-toplist__card-title" title={item.title}>
                                        {item.title}
                                    </div>
                                </div>
                                <div className="p-toplist__card-preview">
                                    {t('toplist.click_to_view')}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
