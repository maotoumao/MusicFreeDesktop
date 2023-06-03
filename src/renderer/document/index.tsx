import ReactDOM from "react-dom/client";
import App from "../app";
import "./index.css"; // 全局样式
import 'animate.css';
import ModalComponent from "../components/Modal";
import bootstrap from "./bootstrap";

bootstrap();


ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    <App></App>
    <ModalComponent></ModalComponent>
  </>
);
