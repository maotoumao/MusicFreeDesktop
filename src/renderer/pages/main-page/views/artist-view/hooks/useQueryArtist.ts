import { produce } from "immer";
import { useCallback } from "react";
import { RequestStateCode } from "@/common/constant";
import { queryResultStore } from "../store";
import PluginManager from "@shared/plugin-manager/renderer";

const setQueryResults = queryResultStore.setValue;

export default function useQueryArtist() {
  const queryResults = queryResultStore.useValue();

  const queryArtist = useCallback(
    async (
      artist: IArtist.IArtistItem,
      page?: number,
      type: IArtist.ArtistMediaType = "music"
    ) => {
      const prevResult = queryResults[type];
      if (
        prevResult?.state & RequestStateCode.PENDING_FIRST_PAGE ||
        prevResult?.state === RequestStateCode.FINISHED ||
        page <= prevResult.page
      ) {
        return;
      }
      page = page ?? (prevResult.page ?? 0) + 1;
      try {
        setQueryResults(
          produce((draft) => {
            draft[type].state =
              page === 1
                ? RequestStateCode.PENDING_FIRST_PAGE
                : RequestStateCode.PENDING_REST_PAGE;
          })
        );
        const result = await PluginManager.callPluginDelegateMethod(
          artist,
          "getArtistWorks",
          artist,
          page,
          type
        );

        setQueryResults(
          produce((draft) => {
            draft[type].page = page;
            draft[type].state =
              result?.isEnd === false
                ? RequestStateCode.PARTLY_DONE
                : RequestStateCode.FINISHED;
            draft[type].data = (draft[type].data ?? [] as any[]).concat(
              result?.data ?? []
            );
          })
        );
      } catch (e) {
        setQueryResults(
          produce((draft) => {
            draft[type].state = page === 1 ? RequestStateCode.FINISHED : RequestStateCode.PARTLY_DONE;
          })
        );
      }
    },
    [queryResults]
  );

  return queryArtist;
}
