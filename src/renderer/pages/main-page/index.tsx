import { Route, Routes } from "react-router-dom";
import "./index.scss";
// import MusicDetail from "../components/MusicDetail";
import SideBar from "@/renderer/components/SideBar";
import PluginManagerView from "./views/plugin-manager-view";

export default function MainPage() {
  return (
    <>
      <SideBar></SideBar>
      <div className="pages-container">
        <Routes >
          <Route path="plugin-manager-view" element={<PluginManagerView></PluginManagerView>}></Route>
          <Route path="*" element={<div>dsdsds</div>}></Route>
        </Routes>
      </div>
    </>
  );
}
