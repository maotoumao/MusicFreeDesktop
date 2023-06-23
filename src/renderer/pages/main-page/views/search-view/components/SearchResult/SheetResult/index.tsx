import { RequestStateCode } from "@/common/constant";
import { memo } from "react";
import "./index.scss";
import useSearch from "../../../hooks/useSearch";
import { useNavigate } from "react-router-dom";
import MusicSheetlikeList from "@/renderer/components/MusicSheetlikeList";

interface IMediaResultProps {
  data: IAlbum.IAlbumItem[];
  state: RequestStateCode;
  pluginHash: string;
}

function SheetResult(props: IMediaResultProps) {
  const { data, state, pluginHash } = props;

  const search = useSearch();
  const navigate = useNavigate();

  return (
    <MusicSheetlikeList
      data={data}
      state={state}
      onLoadMore={() => {
        search(undefined, undefined, "album", pluginHash);
      }}
      onClick={(sheetItem) => {
        navigate(`/main/musicsheet/${sheetItem.platform}/${sheetItem.id}`, {
          state: {
            sheetItem,
          },
        });
      }}
    ></MusicSheetlikeList>
  );
}

export default memo(
  SheetResult,
  (prev, curr) =>
    prev.data === curr.data &&
    prev.state === curr.state &&
    prev.pluginHash === curr.pluginHash
);
