import type { ReactNode } from 'react';

interface SettingRowProps {
    /** 设置项标签 */
    label: string;
    /** 设置项描述 */
    description?: string;
    /** 右侧控件 */
    control: ReactNode;
}

/**
 * SettingRow — 设置项单行
 *
 * 设计稿: grid-cols-[220px_1fr] gap-6, 左侧文本 + 右侧控件。
 */
export function SettingRow({ label, description, control }: SettingRowProps) {
    return (
        <div className="p-setting__row">
            <div>
                <div className="p-setting__row-label">{label}</div>
                {description && <div className="p-setting__row-desc">{description}</div>}
            </div>
            <div className="p-setting__row-control">{control}</div>
        </div>
    );
}
