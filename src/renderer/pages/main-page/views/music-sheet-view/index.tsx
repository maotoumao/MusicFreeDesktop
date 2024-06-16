import { useParams } from "react-router-dom";
import { localPluginName } from "@/common/constant";
import LocalSheet from "./local-sheet";
import RemoteSheet from "./remote-sheet";

import "./index.scss";

/**
 * path: /main/musicsheet/platform/id
 *
 * state: {
 *  musicSheet: IMusic.MusicSheetItem
 * }
 *
 */
export default function MusicSheetView() {
  const { platform } = useParams() ?? {};

  return (
    <div id="page-container" className="page-container">
      {platform === localPluginName ? (
        <LocalSheet></LocalSheet>
      ) : (
        <RemoteSheet></RemoteSheet>
      )}
    </div>
  );
}
