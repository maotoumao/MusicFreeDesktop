import { Blocks } from 'lucide-react';
import { useNavigate } from 'react-router';
import { RoutePaths } from '../../../routes';
import './index.scss';

export interface PluginFeatureUnavailableProps {
    /** 功能名称，如"排行榜"、"热门歌单" */
    featureName: string;
}

/**
 * PluginFeatureUnavailable — 通用业务组件
 *
 * 当没有已安装插件支持某项功能时显示的全区域占位状态。
 * 提供品牌色 CTA 按钮引导用户前往插件管理页面。
 *
 * 设计稿还原（像素级）：
 *   容器: flex-col, items-center, justify-center, py-112, min-h-360
 *   图标容器: 64×64, rounded-2xl(16px), bg white/4, border white/6
 *   图标: Blocks 28×28, color white/20, strokeWidth 1.5
 *   主文案: 15px, color white/50, font-weight medium, mb-6
 *   副文案: 13px, color white/25, max-w-320, text-center, leading-relaxed
 *   CTA: inline-flex, gap-8, px-20 py-8, rounded-lg(8px), 13px font-medium
 *        bg primary/15, text primary, border primary/20
 *        hover → bg primary/25, border primary/30
 */
export function PluginFeatureUnavailable({ featureName }: PluginFeatureUnavailableProps) {
    const navigate = useNavigate();

    return (
        <div className="plugin-feature-unavailable">
            {/* 图标容器 */}
            <div className="plugin-feature-unavailable__icon-box">
                <Blocks className="plugin-feature-unavailable__icon" strokeWidth={1.5} />
            </div>

            {/* 文案 */}
            <div className="plugin-feature-unavailable__title">
                尚未安装支持「{featureName}」功能的插件
            </div>
            <div className="plugin-feature-unavailable__desc">安装支持此功能的插件后即可使用</div>

            {/* CTA */}
            <button
                type="button"
                className="plugin-feature-unavailable__cta"
                onClick={() => navigate(`/${RoutePaths.PluginManager}`)}
            >
                <Blocks className="plugin-feature-unavailable__cta-icon" />
                前往插件管理
            </button>
        </div>
    );
}

export default PluginFeatureUnavailable;
