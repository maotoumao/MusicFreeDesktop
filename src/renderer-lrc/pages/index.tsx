import currentLyricStore from "../store/current-lyric-store";
import "./index.scss";

export default function LyricWindowPage() {
  const lyric = currentLyricStore.useValue();
  console.log("lyricWindowPage");
  console.log(lyric);
  return (
    <div className="lyric-window-container" onMouseOver={() => {
        console.log("mouse over");
    }}>
      <div className="lyric-window-content-container">
        <div className="lyric-text-row">{lyric[0]?.lrc ?? "暂无歌词"}</div>
      </div>
    </div>
  );
}
