import MusicList from "@/renderer/components/MusicList";
import "./index.scss";

interface IProps {
  musicList: IMusic.IMusicItem[]
}
export default function Body(props: IProps) {

  const {musicList} = props;

  return (
    <div className="music-sheet-view--body-container">
      <div className="operations">
        Operations
        <input onChange={console.log}></input>
      </div>
      <MusicList musicList={musicList}></MusicList>
    </div>
  );
}
