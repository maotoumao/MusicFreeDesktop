import { IAppConfig } from "@/common/app-config/type";
import "./index.scss";
import RadioGroupSettingItem from "../../components/RadioGroupSettingItem";
import CheckBoxSettingItem from "../../components/CheckBoxSettingItem";
import { useOutputAudioDevices } from "@/renderer/hooks/useMediaDevices";
import ListBoxSettingItem from "../../components/ListBoxSettingItem";
import rendererAppConfig from "@/common/app-config/renderer";
import trackPlayer from "@/renderer/core/track-player";

interface IProps {
  data: IAppConfig["playMusic"];
}

export default function PlayMusic(props: IProps) {
  const { data = {} as IAppConfig["playMusic"] } = props;

  const audioDevices = useOutputAudioDevices();

  return (
    <div className="setting-view--play-music-container">
      <CheckBoxSettingItem
        keyPath="playMusic.caseSensitiveInSearch"
        checked={data.caseSensitiveInSearch}
        label="歌单内搜索时区分大小写"
      ></CheckBoxSettingItem>
      <RadioGroupSettingItem
        label="默认播放音质"
        keyPath="playMusic.defaultQuality"
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
        label="播放音质缺失时"
        keyPath="playMusic.whenQualityMissing"
        value={data.whenQualityMissing}
        options={[
          {
            value: "lower",
            title: "播放更低音质",
          },
          {
            value: "higher",
            title: "播放更高音质",
          },
        ]}
      ></RadioGroupSettingItem>
      <RadioGroupSettingItem
        label="播放失败时"
        keyPath="playMusic.playError"
        value={data.playError}
        options={[
          {
            value: "pause",
            title: "暂停",
          },
          {
            value: "skip",
            title: "自动播放下一首",
          },
        ]}
      ></RadioGroupSettingItem>
      <RadioGroupSettingItem
        label="双击音乐列表时"
        keyPath="playMusic.clickMusicList"
        value={data.clickMusicList}
        options={[
          {
            value: "normal",
            title: "将目标单曲添加到播放队列",
          },
          {
            value: "replace",
            title: "使用当前音乐列表替换播放队列",
          },
        ]}
      ></RadioGroupSettingItem>
      <ListBoxSettingItem
        label="音频输出设备"
        keyPath="playMusic.audioOutputDevice"
        value={data.audioOutputDevice}
        renderItem={(item) => {
          return item ? item.label : "默认";
        }}
        width={'320px'}
        onChange={async (item) => {
          const result = await trackPlayer.setAudioOutputDevice(item.deviceId);
          if (result) {
            rendererAppConfig.setAppConfigPath(
              "playMusic.audioOutputDevice",
              item.toJSON()
            );
          }
        }}
        options={audioDevices}
      ></ListBoxSettingItem>
    </div>
  );
}
