import { useLocation, useMatch, useParams } from "react-router-dom";
import "./index.scss";
import { useEffect, useLayoutEffect, useState } from "react";
import musicSheetStore from "./store/musicSheetStore";
import Header from "./components/Header";
import Loading from "@/renderer/components/Loading";
import Body from "./components/Body";
import { useMusicSheet } from "@/renderer/core/music-sheet/internal/sheets-method";

/**
 * path: /main/musicsheet/platform/id
 *
 * state: {
 *  musicSheet: IMusic.MusicSheetItem
 * }
 *
 */
export default function MusicSheetView() {
  const params = useParams();

  console.log(params);
  const musicSheet = useMusicSheet(params.id);
  console.log(musicSheet, 'ms');

  useEffect(() => {
    const sheetInState = history.state.usr?.musicSheet ?? {};
    musicSheetStore.setValue({
      ...sheetInState,
      platform: params?.platform,
      id: params?.id,
    } as IMusic.IMusicSheetItem);
  }, [params]);
  console.log(musicSheet, "musicsheet");

  return (
    <div className="music-sheet-view-container">
      {musicSheet ? (
        <>
          <Header></Header>
          <div className="divider"></div>
          <Body></Body>
        </>
      ) : (
        <Loading></Loading>
      )}
    </div>
  );
}
