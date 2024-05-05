import { memo } from "react";
import { ISearchLyricResult } from "./hooks/searchResultStore";
import { If } from "@/renderer/components/Condition";
import { RequestStateCode } from "@/common/constant";
import Loading from "@/renderer/components/Loading";
import albumImg from "@/assets/imgs/album-cover.jpg";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import Empty from "@/renderer/components/Empty";
import "./searchResult.scss";
import { linkLyric } from "@/renderer/core/link-lyric";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import { getCurrentMusic } from "@/renderer/core/track-player/player";
import trackPlayerEventsEmitter from "@/renderer/core/track-player/event";
import { TrackPlayerEvent } from "@/renderer/core/track-player/enum";
import { toast } from "react-toastify";
import { hideModal } from "../..";
import { useTranslation } from "react-i18next";

interface ISearchResultProps {
  data: ISearchLyricResult;
  musicItem?: IMusic.IMusicItem;
}

function SearchResult(props: ISearchResultProps) {
  const { data, musicItem } = props;

  const {t} = useTranslation(); 

  return (
    <div className="search-result-container">
      <If
        condition={
          data?.state && data.state & RequestStateCode.PENDING_FIRST_PAGE
        }
      >
        <If.Truthy>
          <Loading></Loading>
        </If.Truthy>
        <If.Falsy>
          <div className="search-result-falsy-container">
            {
              <If condition={data?.data?.length}>
                <If.Truthy>
                  {(data?.data ?? []).map((it) => (
                    <div
                      className="lyric-item"
                      key={getMediaPrimaryKey(it)}
                      role="button"
                      onClick={async () => {
                        if (musicItem) {
                          try {
                            await linkLyric(musicItem, it);
                            if (isSameMedia(getCurrentMusic(), musicItem)) {
                              trackPlayerEventsEmitter.emit(
                                TrackPlayerEvent.NeedRefreshLyric,
                                true
                              );
                            }
                            toast.success(t("modal.media_lyric_linked"));
                            hideModal();
                          } catch (e) {
                            toast.error(`${t("modal.media_lyric_link_failed")} ${e?.message ?? e}`);
                          }
                        }
                      }}
                    >
                      <img
                        src={it.artwork ?? albumImg}
                        onError={setFallbackAlbum}
                      ></img>
                      <div className="lyric-info">
                        <div className="title">{it.title}</div>
                        <div className="artist">{it.artist}</div>
                      </div>
                    </div>
                  ))}
                </If.Truthy>
                <If.Falsy>
                  <Empty></Empty>
                </If.Falsy>
              </If>
            }
          </div>
        </If.Falsy>
      </If>
    </div>
  );
}

export default memo(SearchResult, (prev, curr) => prev.data === curr.data);
