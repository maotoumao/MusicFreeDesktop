import { Route, Routes } from "react-router-dom";
import "./index.scss";
// import MusicDetail from "../components/MusicDetail";
import SideBar from "./components/SideBar";
import PluginManagerView from "./views/plugin-manager-view";
import MysheetView from "./views/my-sheet-view";
import SearchView from "./views/search-view";

export default function MainPage() {
  return (
    <>
      <SideBar></SideBar>
      <div className="pages-container">
        <Routes >
          <Route path="plugin-manager-view" element={<PluginManagerView></PluginManagerView>}></Route>
          <Route path="mysheet/:id" element={<MysheetView></MysheetView>}></Route>
          <Route path="search/:query" element={<SearchView></SearchView>}></Route>
          <Route path="*" element={<div>dsdsds</div>}></Route>
        </Routes>
      </div>
    </>
  );
}
