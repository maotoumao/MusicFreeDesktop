import type { ReactNode } from 'react';

interface SettingsCardProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    children?: ReactNode;
}

/**
 * SettingsCard — 设置页内部卡片容器
 *
 * 对应设计稿中的 rounded-2xl border bg 卡片。
 * 仅在 SettingPage 内使用，不暴露为全局组件。
 */
export function SettingsCard({ title, subtitle, action, children }: SettingsCardProps) {
    return (
        <div className="p-setting__card">
            <div className="p-setting__card-header">
                <div className="p-setting__card-header-text">
                    <div className="p-setting__card-title">{title}</div>
                    {subtitle && <div className="p-setting__card-subtitle">{subtitle}</div>}
                </div>
                {action && <div className="p-setting__card-header-action">{action}</div>}
            </div>
            <div className="p-setting__card-body">{children}</div>
        </div>
    );
}
