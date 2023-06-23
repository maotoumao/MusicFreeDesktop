import trackPlayer from "@/renderer/core/track-player";
import "./index.scss";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import { useEffect, useRef } from "react";

export default function Lyric() {
  const currentLrc = trackPlayer.useLyric();
  const containerRef = useRef<HTMLDivElement>();

  useEffect(() => {
    if (containerRef.current) {
      const currentIndex = currentLrc?.currentLrc?.index;
      if (currentIndex >= 0) {
        const dom = document.querySelector(`#lyric-item-id-${currentIndex}`) as
          | HTMLDivElement
          | undefined;
        if (dom) {
          const offsetTop = dom.offsetTop - 210 + dom.clientHeight / 2;
          containerRef.current.scrollTo({
            behavior: "smooth",
            top: offsetTop,
          });
        }
      }
    }
  }, [currentLrc?.currentLrc]);

  return (
    <div
      className="lyric-container"
      data-loading={currentLrc === null}
      ref={containerRef}
    >
      {
        <Condition condition={currentLrc !== null} falsy={<Loading></Loading>}>
          <Condition
            condition={currentLrc?.parser}
            falsy={<div className="lyric-item">暂无歌词</div>}
          >
            {currentLrc?.parser?.getLyric?.()?.map((lrc, index) => (
              <div
                key={index}
                className="lyric-item"
                id={`lyric-item-id-${index}`}
                data-highlight={currentLrc?.currentLrc?.index === index}
              >
                {lrc.lrc}
              </div>
            ))}
          </Condition>
        </Condition>
      }
    </div>
  );
}
