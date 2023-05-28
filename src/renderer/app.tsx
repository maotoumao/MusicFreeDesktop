import Page from "./pages";
import Header from "./components/Header";

import "./app.scss";
import MusicBar from "./components/MusicBar";
import SideBar from "./components/SideBar";
import MusicDetail from "./components/MusicDetail";

export default function App() {
  return (
    <div className="app-container">
      <Header></Header>
      <div className="body-container">
        <SideBar></SideBar>
        <Page></Page>
        <MusicDetail></MusicDetail>
      </div>
      <MusicBar></MusicBar>
    </div>
  );
}
