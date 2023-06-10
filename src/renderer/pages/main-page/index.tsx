import { Route, Routes } from "react-router-dom";
import "./index.scss";
// import MusicDetail from "../components/MusicDetail";
import SideBar from "./components/SideBar";
import PluginManagerView from "./views/plugin-manager-view";
import MusicSheetView from "./views/music-sheet-view";
import SearchView from "./views/search-view";

export default function MainPage() {
  return (
    <>
      <SideBar></SideBar>
      <div className="pages-container">
        <Routes>
          <Route
            path="plugin-manager-view"
            element={<PluginManagerView></PluginManagerView>}
          ></Route>
          <Route
            path="musicsheet/:platform/:id"
            element={<MusicSheetView></MusicSheetView>}
          ></Route>
          <Route
            path="search/:query"
            element={<SearchView></SearchView>}
          ></Route>
          <Route path="*" element={<div>啥都没有
            <div role="button" data-type="primaryButton">一个按钮</div>
            <div role="button" data-type="primaryButton" data-disabled>一个按钮</div>


          </div>}></Route>
        </Routes>
      </div>
    </>
  );
}
