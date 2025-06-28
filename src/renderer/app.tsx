import AppHeader from "./components/Header";

import "./app.scss";
import MusicBar from "./components/MusicBar";
import { Outlet } from "react-router";
import PanelComponent from "./components/Panel";
import MusicDetail from "@renderer/components/MusicDetail";

export default function App() {
    return (
        <div className="app-container">
            <AppHeader></AppHeader>
            <div className="body-container">
                <Outlet></Outlet>
                <PanelComponent></PanelComponent>
            </div>
            <MusicDetail></MusicDetail>
            <MusicBar></MusicBar>
        </div>
    );
}
