import ReactDOM from "react-dom/client";
import App from "../app";
import "animate.css";
import ModalComponent from "../components/Modal";
import bootstrap from "./bootstrap";
import { HashRouter, Route, Routes } from "react-router-dom";
import MainPage from "../pages/main-page";

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import "./index.css"; // 全局样式
import './index.scss';

bootstrap();

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App></App>}>
          <Route path="main/*" element={<MainPage></MainPage>}></Route>
          <Route path="*" element={<MainPage></MainPage>}></Route>
        </Route>
      </Routes>
    </HashRouter>
    <ModalComponent></ModalComponent>
  </>
);
