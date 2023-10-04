import { memo } from "react";
import { ISearchLyricResult } from "./hooks/searchResultStore";
import { If } from "@/renderer/components/Condition";
import { RequestStateCode } from "@/common/constant";
import Loading from "@/renderer/components/Loading";
import albumImg from "@/assets/imgs/album-cover.jpg";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import Empty from "@/renderer/components/Empty";
import './searchResult.scss';

interface ISearchResultProps {
  data: ISearchLyricResult;
}

function SearchResult(props: ISearchResultProps) {
  const { data } = props;

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
                    <div className="lyric-item" role="button" onClick={() => {
                        // todo 关联歌词
                    }}>
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
