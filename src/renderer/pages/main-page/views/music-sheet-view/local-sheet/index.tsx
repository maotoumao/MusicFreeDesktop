import React from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import { useMusicSheet } from "@/renderer/core/music-sheet/internal/sheets-method";
import Body from "../components/Body";

export default function LocalSheet() {
  const { platform, id } = useParams() ?? {};
  const musicSheet = useMusicSheet(id);

  return (
    <>
      <Header musicSheet={musicSheet}></Header>
      <Body musicList={musicSheet?.musicList ?? []}></Body>
    </>
  );
}
