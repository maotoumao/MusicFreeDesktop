import "./index.scss";

/**
 * 可视化窗口页面。
 *
 * 窗口是纯被动的：只有一块 canvas（+ 降级时的一行提示文字），
 * 没有任何交互控件——开关与效果选择都在主窗口里做。
 */
export default function VisualizationPage() {
    return (
        <div className="visualization-page">
            <canvas className="visualization-canvas"></canvas>
        </div>
    );
}
