import { IAppConfig } from "@/shared/app-config/type";
import "./index.scss";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import Downloader from "@/renderer/core/downloader";
import PathSettingItem from "../../components/PathSettingItem";
import { setAppConfigPath } from "@/shared/app-config/renderer";

interface IProps {
  data: IAppConfig["download"];
}

const concurrencyList = Array(20)
  .fill(0)
  .map((_, index) => index + 1);
export default function Download(props: IProps) {
  const { data } = props;

  return (
    <div className="setting-view--download-container">
      <PathSettingItem keyPath='download.path' value={data.path} label="下载目录"></PathSettingItem>
      <ListBoxSettingItem
        keyPath="download.concurrency"
        value={data.concurrency}
        options={concurrencyList}
        onChange={(newVal) => {
          Downloader.setDownloadingConcurrency(newVal);
          setAppConfigPath("download.concurrency", newVal);
        }}
        label="最多同时下载歌曲数"
      ></ListBoxSettingItem>
      <RadioGroupSettingItem
        label="默认下载音质"
        keyPath="download.defaultQuality"
        value={data?.defaultQuality}
        options={[
          {
            value: "low",
            title: "低音质",
          },
          {
            value: "standard",
            title: "标准音质",
          },
          {
            value: "high",
            title: "高音质",
          },
          {
            value: "super",
            title: "超高音质",
          },
        ]}
      ></RadioGroupSettingItem>
      <RadioGroupSettingItem
        label="下载音质缺失时"
        keyPath="download.whenQualityMissing"
        value={data.whenQualityMissing}
        options={[
          {
            value: "lower",
            title: "下载更低音质",
          },
          {
            value: "higher",
            title: "下载更高音质",
          },
        ]}
      ></RadioGroupSettingItem>
    </div>
  );
}
