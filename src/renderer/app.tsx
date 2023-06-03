import Header from "./components/Header";

import "./app.scss";
import MusicBar from "./components/MusicBar";
import SideBar from "./components/SideBar";
import MusicDetail from "./components/MusicDetail";
import { Outlet, Router } from "react-router";

export default function App() {
  return (
    <div className="app-container">
      <Header></Header>
      <div className="body-container">
        <Outlet></Outlet>
      </div>
      <MusicBar></MusicBar>
    </div>
  );
}
