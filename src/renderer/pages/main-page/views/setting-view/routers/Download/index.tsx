import { IAppConfig } from "@/shared/app-config/type";
import "./index.scss";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import Downloader from "@/renderer/core/downloader";
import PathSettingItem from "../../components/PathSettingItem";
import { setAppConfigPath } from "@/shared/app-config/renderer";
import { useTranslation } from "react-i18next";

interface IProps {
  data: IAppConfig["download"];
}

const concurrencyList = Array(20)
  .fill(0)
  .map((_, index) => index + 1);
export default function Download(props: IProps) {
  const { data } = props;
  const { t } = useTranslation();

  return (
    <div className="setting-view--download-container">
      <PathSettingItem
        keyPath="download.path"
        value={data.path}
        label={t("settings.download.download_folder")}
      ></PathSettingItem>
      <ListBoxSettingItem
        keyPath="download.concurrency"
        value={data.concurrency}
        options={concurrencyList}
        onChange={(newVal) => {
          Downloader.setDownloadingConcurrency(newVal);
          setAppConfigPath("download.concurrency", newVal);
        }}
        label={t("settings.download.max_concurrency")}
      ></ListBoxSettingItem>
      <RadioGroupSettingItem
        label={t("settings.download.default_download_quality")}
        keyPath="download.defaultQuality"
        value={data?.defaultQuality}
        options={[
          {
            value: "low",
            title: t("media.music_quality_low"),
          },
          {
            value: "standard",
            title: t("media.music_quality_standard"),
          },
          {
            value: "high",
            title: t("media.music_quality_high"),
          },
          {
            value: "super",
            title: t("media.music_quality_super"),
          },
        ]}
      ></RadioGroupSettingItem>
      <RadioGroupSettingItem
        label={t("settings.download.when_quality_missing")}
        keyPath="download.whenQualityMissing"
        value={data.whenQualityMissing}
        options={[
          {
            value: "lower",
            title: t("settings.download.download_lower_quality_version"),
          },
          {
            value: "higher",
            title: t("settings.download.download_higher_quality_version"),
          },
        ]}
      ></RadioGroupSettingItem>
    </div>
  );
}
