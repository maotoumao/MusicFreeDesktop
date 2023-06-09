import {
  getSupportedPlugin,
  useSupportedPlugin,
} from "@/renderer/core/plugin-delegate";
import { useEffect } from "react";
import { useMatch } from "react-router-dom";
import "./index.scss";
import NoPlugin from "@/renderer/components/NoPlugin";
import { Tab } from "@headlessui/react";
import { supportedMediaType } from "@/common/constant";
import { useTranslation } from "react-i18next";
import MusicList from "@/renderer/components/MusicList";

const p = [
  {
    supportedMethod: [
      "search",
      "getMediaSource",
      "getAlbumInfo",
      "getArtistWorks",
      "getTopLists",
      "getTopListDetail",
      "importMusicSheet",
    ],
    platform: "bilibili",
    appVersion: ">=0.0",
    version: "0.1.5",
    defaultSearchType: "album",
    cacheControl: "no-cache",
    srcUrl:
      "https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/bilibili/index.js",
    primaryKey: ["id", "aid", "bvid", "cid"],
    hints: {
      importMusicSheet: [
        "bilibili 移动端：APP点击我的，空间，右上角分享，复制链接，浏览器打开切换桌面版网站，点击播放全部视频，复制链接",
        "bilibili H5/PC端：复制收藏夹URL，或者直接输入ID即可",
        "非公开收藏夹无法导入，编辑收藏夹改为公开即可",
        "导入时间和歌单大小有关，请耐心等待",
      ],
    },
    hash: "eb3c1729c966aad0411c9a34e10c620c76f1dab740172dbc3c35370423f78a93",
    path: "F:\\\\Projects\\\\desktop-programs\\\\musicfree-desktop\\\\plugins\\\\bilibili.js",
  },
  {
    supportedMethod: [
      "getMediaSource",
      "search",
      "getAlbumInfo",
      "getArtistWorks",
      "getLyric",
      "importMusicSheet",
      "getTopLists",
      "getTopListDetail",
      "getRecommendSheetTags",
      "getRecommendSheetsByTag",
      "getMusicSheetInfo",
    ],
    platform: "咪咕",
    version: "0.1.1",
    appVersion: ">0.1.0-alpha.0",
    hints: {
      importMusicSheet: [
        "咪咕APP：自建歌单-分享-复制链接，直接粘贴即可",
        "H5/PC端：复制URL并粘贴，或者直接输入纯数字歌单ID即可",
        "导入过程中会过滤掉所有VIP/试听/收费音乐，导入时间和歌单大小有关，请耐心等待",
      ],
    },
    primaryKey: ["id", "copyrightId"],
    cacheControl: "no-cache",
    srcUrl:
      "https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/migu/index.js",
    hash: "e5a1e261bc153a128de686162ba7e475726569d11dd89cd16a3847773b1fe93a",
    path: "F:\\\\Projects\\\\desktop-programs\\\\musicfree-desktop\\\\plugins\\\\migu.js",
  },
];

const musicItem = {
  id: "1001",
  platform: "猫头猫",
  artist: "猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫猫头猫",
  title: "今天猫头猫没有写代码啊啊啊啊啊啊啊啊啊",
  album: "小猫咪",
  artwork: "http://i.giphy.com/l46Cs36c9HrHMExoc.gif",
  url: "xxx",
  duration: 1200,
};

export default function SearchView() {
  const match = useMatch("/main/search/:query");
  const query = match?.params?.query;

  // const plugins = useSupportedPlugin("search");
  const plugins = p;

  const { t } = useTranslation();

  useEffect(() => {
    console.log(getSupportedPlugin("search"));
    console.log(plugins, JSON.stringify(getSupportedPlugin("search")));
  }, [query]);

  console.log(plugins, plugins.length, getSupportedPlugin("search"));

  return (
    <div className="search-view-container">
      <div className="search-header">
        <span className="highlight">「{query}」</span>的搜索结果
      </div>
      {plugins.length ? (
        <Tab.Group>
          <Tab.List className="tab-list-container">
            {supportedMediaType.map((type) => (
              <Tab key={type} as="div" className="tab-list-item">
                {t(type)}
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels className={'tab-panels-container'}>
            <Tab.Panel className={'tab-panel-container'}>
              <MusicList
                musicList={[
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                  musicItem,
                ]}
              ></MusicList>
            </Tab.Panel>
            <Tab.Panel>Content 2</Tab.Panel>
            <Tab.Panel>Content 3</Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      ) : (
        <NoPlugin supportMethod="搜索"></NoPlugin>
      )}
    </div>
  );
}
