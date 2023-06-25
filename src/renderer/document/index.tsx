import ReactDOM from "react-dom/client";
import App from "../app";
import "animate.css";
import ModalComponent from "../components/Modal";
import bootstrap from "./bootstrap";
import { HashRouter, Route, Routes, useNavigate } from "react-router-dom";
import MainPage from "../pages/main-page";
import { ContextMenuComponent } from "../components/ContextMenu";
import { ToastContainer } from "react-toastify";

import "@/common/i18n";

import "rc-slider/assets/index.css";
import "react-toastify/dist/ReactToastify.css";
import "./index.css"; // 全局样式
import "./index.scss";
import { toastDuration } from "@/common/constant";
import { useEffect } from "react";
import Evt from "../core/events";
import { ipcRendererOn } from "@/common/ipc-util/renderer";

bootstrap().then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(<Root></Root>);
});

function Root() {
  return (
    <>
      <HashRouter>
        <NavigateListener></NavigateListener>
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

function NavigateListener(): null {
  const navigate = useNavigate();

  useEffect(() => {
    const navigateCallback = (url: string, payload?: any) => {
      if (url.startsWith("evt://")) {
        const evtName = url.slice(6);
        if (evtName !== "NAVIGATE") {
          Evt.emit(evtName as any, payload);
        }
      } else {
        navigate(url, {
          state: payload,
        });
      }
    };
    // Evt.on('NAVIGATE', navigateCallback);
    ipcRendererOn("navigate", (args) => {
      if (typeof args === "string") {
        navigateCallback(args);
      } else {
        navigateCallback(args.url, args.payload);
      }
    });
  }, []);

  return null;
}
