import { Route, Routes } from "react-router-dom";
import "./index.scss";
import SideBar from "./components/SideBar";
import PluginManagerView from "./views/plugin-manager-view";
import MusicSheetView from "./views/music-sheet-view";
import SearchView from "./views/search-view";
import MusicDetail from "@/renderer/components/MusicDetail";
import MusicSheetlikeItem from "@/renderer/components/MusicSheetlikeItem";
import AlbumView from "./views/album-view";
import ArtistView from "./views/artist-view";
import ToplistView from "./views/toplist-view";
import TopListDetailView from "./views/toplist-detail-view";
import RecommendSheetsView from "./views/recommend-sheets-view";
import SettingView from "./views/setting-view";

export default function MainPage() {
  return (
    <>
      <SideBar></SideBar>
      <div className="pages-container" id="page-container">
        <Routes>
          <Route
            path="search/:query"
            element={<SearchView></SearchView>}
          ></Route>
          <Route
            path="plugin-manager-view"
            element={<PluginManagerView></PluginManagerView>}
          ></Route>
          <Route
            path="musicsheet/:platform/:id"
            element={<MusicSheetView></MusicSheetView>}
          ></Route>
          <Route
            path="album/:platform/:id"
            element={<AlbumView></AlbumView>}
          ></Route>
          <Route
            path="artist/:platform/:id"
            element={<ArtistView></ArtistView>}
          ></Route>
          <Route path="toplist" element={<ToplistView></ToplistView>}></Route>
          <Route
            path="toplist-detail/:platform"
            element={<TopListDetailView></TopListDetailView>}
          ></Route>
          <Route
            path="recommend-sheets"
            element={<RecommendSheetsView></RecommendSheetsView>}
          ></Route>
          <Route path="setting" element={<SettingView></SettingView>}></Route>
          <Route
            path="*"
            element={
              <div>
                啥都没有
                <div role="button" data-type="primaryButton">
                  一个按钮
                </div>
                <div role="button" data-type="primaryButton" data-disabled>
                  一个按钮
                </div>
                <MusicSheetlikeItem
                  mediaItem={{
                    title: "专辑啊",
                    platform: "猫头",
                    id: "sd",
                    artist: "小猫咪",
                    // createAt: Date.now(),
                    playCount: 99999,
                  }}
                ></MusicSheetlikeItem>
                <MusicSheetlikeItem
                  mediaItem={{
                    title: "专辑啊",
                    platform: "猫头",
                    id: "sd",
                    artist: "小猫咪",
                    createAt: Date.now(),
                  }}
                ></MusicSheetlikeItem>
                <MusicSheetlikeItem
                  mediaItem={{
                    title: "专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊",
                    platform: "猫头",
                    id: "sd",
                    artist:
                      "小猫咪专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊专辑啊",
                    playCount: 1236,
                    createAt: Date.now(),
                  }}
                ></MusicSheetlikeItem>
              </div>
            }
          ></Route>
        </Routes>
        <MusicDetail></MusicDetail>
      </div>
    </>
  );
}
