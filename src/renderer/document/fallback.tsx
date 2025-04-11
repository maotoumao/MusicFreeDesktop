import trackPlayer from "../core/track-player";

interface IProps {
    error: Error,
    resetErrorBoundary: (...args: any[]) => void,
}

export default function Fallback(props: IProps) {
    const { error, resetErrorBoundary } = props;

    return <div role='alert' style={{
        margin: 24
    }}>
        <div>出现问题啦...</div>
        <div>请点击右下角【重置配置项】按钮尝试修复，如果还有问题请将错误信息反馈到github或发送到公众号【一只猫头猫】</div>
        <div>歌曲信息</div>
        <pre>{JSON.stringify(trackPlayer.currentMusic)}</pre>
        <div>错误信息：</div>
        <pre style={{ color: "red" }}>{error.message}</pre>
        <pre style={{ color: "red" }}>{error.stack}</pre>
        <div role='button' style={{
            position: "fixed",
            right: 48,
            bottom: 48,
            background: "red",
            color: "white",
            padding: 16,
        }} onClick={resetErrorBoundary}>重置配置项和播放器状态</div>
    </div>
}
