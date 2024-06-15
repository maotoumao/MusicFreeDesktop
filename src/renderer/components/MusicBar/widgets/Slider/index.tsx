import { useEffect, useRef, useState } from "react";
import "./index.scss";
import trackPlayer from "@/renderer/core/track-player";

export default function Slider() {
  const [seekPercent, _setSeekPercent] = useState<number | null>(null);
  const seekPercentRef = useRef<number | null>(null);
  const { currentTime, duration } = trackPlayer.useProgress();
  const isPressedRef = useRef(false);

  function setSeekPercent(value: number | null) {
    _setSeekPercent(value);
    seekPercentRef.current = value;
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isPressedRef.current) {
        setSeekPercent(Math.max(0, Math.min(1, e.clientX / window.innerWidth)));
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (isPressedRef.current) {
        isPressedRef.current = false;
        const realProgress = trackPlayer.getProgress();
        trackPlayer.seekTo(realProgress.duration * seekPercentRef.current);
        setSeekPercent(null);
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  return (
    <div
      className="music-bar--slider-container"
      onMouseDown={(e) => {
        if (isFinite(duration) && duration) {
          isPressedRef.current = true;
        }
      }}
      onClick={(e) => {
        if (isFinite(duration) && duration) {
          trackPlayer.seekTo((duration * e.clientX) / window.innerWidth);
        }
      }}
    >
      <div className="bar"></div>
      <div
        className="active-bar"
        style={{
          transform: `translateX(${
            seekPercent !== null
              ? seekPercent * 100
              : duration === 0
              ? 0
              : !isFinite(duration) || isNaN(duration)
              ? 0
              : (currentTime / duration) * 100
          }%)`,
        }}
      ></div>
    </div>
  );
}
