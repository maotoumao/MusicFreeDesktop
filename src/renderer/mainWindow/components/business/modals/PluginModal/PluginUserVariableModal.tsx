import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@renderer/mainWindow/components/ui/Modal';
import { Button } from '@renderer/mainWindow/components/ui/Button';
import { Input } from '@renderer/mainWindow/components/ui/Input';
import { showToast } from '@renderer/mainWindow/components/ui/Toast';
import pluginManager from '@infra/pluginManager/renderer';
import { usePluginMeta } from '@infra/pluginManager/renderer/hooks';
import './index.scss';

interface PluginUserVariableModalProps {
    close: () => void;
    plugin: IPlugin.IPluginDelegate;
}

/**
 * PluginUserVariableModal — 用户变量编辑弹窗
 *
 * 根据插件声明的 userVariables 渲染 key-value 编辑列表。
 */
export default function PluginUserVariableModal({ close, plugin }: PluginUserVariableModalProps) {
    const { t } = useTranslation();
    const allPluginMeta = usePluginMeta();

    // 初始化变量值：先从 pluginMeta 中取存储的值
    const initialValues = useMemo(() => {
        const stored = allPluginMeta[plugin.hash]?.userVariables ?? {};
        const values: Record<string, string> = {};
        for (const v of plugin.userVariables ?? []) {
            values[v.key] = stored[v.key] ?? '';
        }
        return values;
    }, [plugin.hash, plugin.userVariables, allPluginMeta]);

    const [values, setValues] = useState<Record<string, string>>(initialValues);
    const [saving, setSaving] = useState(false);

    const handleChange = useCallback((key: string, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            await pluginManager.setPluginMeta(plugin.hash, { userVariables: values });
            showToast(t('plugin.user_variable_success'));
            close();
        } catch {
            showToast(t('plugin.update_failed'), { type: 'warn' });
        } finally {
            setSaving(false);
        }
    }, [plugin.hash, values, close, t]);

    return (
        <Modal
            open
            onClose={close}
            title={`${t('plugin.prop_user_variable')} · ${plugin.platform}`}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={saving}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                        {t('common.confirm')}
                    </Button>
                </>
            }
        >
            <div className="plugin-modal__variables">
                <div className="plugin-modal__var-list">
                    {(plugin.userVariables ?? []).map((variable) => (
                        <div key={variable.key} className="plugin-modal__var-row">
                            <label className="plugin-modal__var-label">
                                {variable.name ?? variable.key}
                                {variable.hint && (
                                    <span className="plugin-modal__var-hint">{variable.hint}</span>
                                )}
                            </label>
                            <Input
                                placeholder={variable.hint ?? variable.key}
                                value={values[variable.key] ?? ''}
                                onChange={(e) => handleChange(variable.key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
