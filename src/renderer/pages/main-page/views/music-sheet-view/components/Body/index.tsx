import MusicList from "@/renderer/components/MusicList";
import "./index.scss";

export default function Body() {
  return (
    <div className="music-sheet-view--body-container">
      <div className="operations">
        Operations
        <input></input>
      </div>
      <MusicList musicList={[]}></MusicList>
    </div>
  );
}
