import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import { useTranslation } from "react-i18next";
import { appWindowUtil } from "@shared/utils/renderer";

/** 可选效果：random（每首歌随机轮换）+ 8 个具体效果 */
const effectOptions = [
    "random",
    "bars",
    "oscilloscope",
    "spectrum",
    "particle",
    "geometry",
    "fluid",
    "battery",
    "fireworks",
];

export default function Visualization() {
    const { t } = useTranslation();

    return (
        <div className="setting-view--visualization-container">
            <CheckBoxSettingItem
                label={t("settings.visualization.enable")}
                keyPath="visualization.enabled"
                onChange={(_evt, checked) => {
                    appWindowUtil.setVisualizationWindow(checked);
                }}
            ></CheckBoxSettingItem>
            <ListBoxSettingItem
                keyPath="visualization.effect"
                label={t("settings.visualization.effect")}
                options={effectOptions}
                renderItem={(item) =>
                    t(`settings.visualization.effect.${item}`)
                }
            ></ListBoxSettingItem>
        </div>
    );
}
