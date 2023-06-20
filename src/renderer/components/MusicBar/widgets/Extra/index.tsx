import SvgAsset from '@/renderer/components/SvgAsset';
import Evt from '@/renderer/core/events';
import './index.scss'

export default function Extra() {
  return (
    <div className="music-extra">
        <div className="extra-btn">
          <SvgAsset iconName="lyric"></SvgAsset>
        </div>
        <div className="extra-btn">
          <SvgAsset iconName="repeat-song-1"></SvgAsset>
        </div>
        <div
          className="extra-btn"
          role="button"
          onClick={() => {
            Evt.emit("SWITCH_PLAY_LIST");
          }}
        >
          <SvgAsset iconName="playlist"></SvgAsset>
        </div>
        {/* <div className="extra-btn">
          <RepeatSongSvg></RepeatSongSvg>
        </div>
        <div className="extra-btn">
          <ShuffleSvg></ShuffleSvg>
        </div> */}
      </div>
  )
}
