import trackPlayer from "../core/track-player";
import "./styles/fallback.scss";

interface IProps {
    error: Error,
    resetErrorBoundary: (...args: any[]) => void,
}

export default function Fallback(props: IProps) {
    const { error, resetErrorBoundary } = props;

    return (
        <div className="fallback-container" role="alert">
            <div className="fallback-content">
                <div className="fallback-title">
                    出现问题啦...
                </div>

                <div className="fallback-actions">
                    <button
                        className="reset-button"
                        onClick={resetErrorBoundary}
                    >
                        重置配置项和播放器状态
                    </button>
                </div>

                <div className="fallback-description">
                    请点击上方【重置配置项】按钮尝试修复，如果还有问题请将错误信息反馈到 GitHub 或发送到公众号【一只猫头猫】
                </div>

                <div className="fallback-section">
                    <div className="section-title">歌曲信息</div>
                    <div className="section-content">
                        <pre className="music-info">
                            {JSON.stringify(trackPlayer.currentMusic, null, 2)}
                        </pre>
                    </div>
                </div>

                <div className="fallback-section">
                    <div className="section-title">错误信息</div>
                    <div className="section-content">
                        <pre className="error-message">
                            {error.message}
                        </pre>
                        {error.stack && (
                            <pre className="error-message" style={{ marginTop: 8 }}>
                                {error.stack}
                            </pre>
                        )}
                    </div>
                </div>


            </div>
        </div>
    );
}
