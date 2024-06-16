import ReactDOM from "react-dom/client";
import App from "../app";
import "animate.css";
import ModalComponent from "../components/Modal";
import bootstrap from "./bootstrap";
import { HashRouter, Route, Routes } from "react-router-dom";
import MainPage from "../pages/main-page";
import { ContextMenuComponent } from "../components/ContextMenu";
import { ToastContainer } from "react-toastify";

import "rc-slider/assets/index.css";
import "react-toastify/dist/ReactToastify.css";
import "./index.css"; // 全局样式
import "./index.scss";
import { toastDuration } from "@/common/constant";
import useBootstrap from "./useBootstrap";

bootstrap().then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(<Root></Root>);
});

function Root() {
  return (
    <>
      <HashRouter>
        <BootstrapComponent></BootstrapComponent>
        <Routes>
          <Route path="/" element={<App></App>}>
            <Route path="main/*" element={<MainPage></MainPage>}></Route>
            <Route path="*" element={<MainPage></MainPage>}></Route>
          </Route>
        </Routes>
      </HashRouter>
      <ModalComponent></ModalComponent>
      <ContextMenuComponent></ContextMenuComponent>
      <ToastContainer
        draggable={false}
        closeOnClick={false}
        limit={5}
        pauseOnFocusLoss={false}
        hideProgressBar
        autoClose={toastDuration.short}
        newestOnTop
      ></ToastContainer>
    </>
  );
}

function BootstrapComponent(): null {
  useBootstrap();

  return null;
}
