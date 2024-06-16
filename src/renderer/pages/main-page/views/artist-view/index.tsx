import { useParams } from "react-router-dom";
import Header from "./components/Header";
import "./index.scss";
import { useEffect, useMemo } from "react";
import Body from "./components/Body";
import { initQueryResult, queryResultStore } from "./store";

export default function ArtistView() {
  const params = useParams();

  const artistItem = useMemo(() => {
    const artistInState = history.state.usr?.artistItem ?? {};

    return {
      ...artistInState,
      platform: params?.platform,
      id: params?.id,
    } as IArtist.IArtistItem;
  }, [params?.platform, params?.id]);

  useEffect(() => {
    return () => {
      queryResultStore.setValue(initQueryResult);
    };
  });

  return (
    <div id="page-container" className="page-container artist-view--container">
      <Header artistItem={artistItem}></Header>
      <Body artistItem={artistItem}></Body>
    </div>
  );
}
