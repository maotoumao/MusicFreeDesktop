import "./index.scss";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import Downloader from "@/renderer/core/downloader";
import PathSettingItem from "../../components/PathSettingItem";
import {useTranslation} from "react-i18next";


const concurrencyList = Array(20)
    .fill(0)
    .map((_, index) => index + 1);


export default function Download() {
    const {t} = useTranslation();

    return (
        <div className="setting-view--download-container">
            <PathSettingItem
                keyPath="download.path"
                label={t("settings.download.download_folder")}
            ></PathSettingItem>
            <ListBoxSettingItem
                keyPath="download.concurrency"
                options={concurrencyList}
                onChange={(_evt, newConfig) => {
                    Downloader.setConcurrency(newConfig);
                }}
                label={t("settings.download.max_concurrency")}
            ></ListBoxSettingItem>
            <RadioGroupSettingItem
                label={t("settings.download.default_download_quality")}
                keyPath="download.defaultQuality"
                options={[
                    "low",
                    "standard",
                    "high",
                    "super"
                ]}
                renderItem={(item) => t("media.music_quality_" + item)}
            ></RadioGroupSettingItem>
            <RadioGroupSettingItem
                label={t("settings.download.when_quality_missing")}
                keyPath="download.whenQualityMissing"
                options={[
                    "lower",
                    "higher"
                ]}
                renderItem={(item) => t("settings.download.download_" + item + "_quality_version")}

            ></RadioGroupSettingItem>
        </div>
    );
}
