import AppHeader from "./components/Header";

import "./app.scss";
import MusicBar from "./components/MusicBar";
import { Outlet } from "react-router";
import PanelComponent from "./components/Panel";

export default function App() {
  return (
    <div className="app-container">
      <AppHeader></AppHeader>
      <div className="body-container">
        <Outlet></Outlet>
        <PanelComponent></PanelComponent>
      </div>
      <MusicBar></MusicBar>
    </div>
  );
}
