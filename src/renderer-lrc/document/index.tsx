import ReactDOM from "react-dom/client";
import "animate.css";

import bootstrap from "./bootstrap";
import { HashRouter, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import "@/common/i18n";

import "rc-slider/assets/index.css";
import "react-toastify/dist/ReactToastify.css";
import "./index.css"; // 全局样式
import "./index.scss";
import { toastDuration } from "@/common/constant";
import useBootstrap from "./useBootstrap";
import LyricWindowPage from "../pages";

bootstrap().then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(<Root></Root>);
});

function Root() {
  return <LyricWindowPage></LyricWindowPage>;
}

// function BootstrapComponent(): null {
//   useBootstrap();

//   return null;
// }
