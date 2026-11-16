import ReactDOM from "react-dom/client";
import bootstrap from "./bootstrap";
import VisualizationPage from "../pages";
import { useEffect } from "react";

import "../styles/index.scss";
import WindowDrag from "@shared/window-drag/renderer";

bootstrap().then(() => {
    ReactDOM.createRoot(document.getElementById("root")).render(
        <Root></Root>,
    );
});

function Root() {
    useEffect(() => {
        WindowDrag.injectHandler();
    }, []);

    return <VisualizationPage></VisualizationPage>;
}
