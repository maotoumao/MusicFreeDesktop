import { useEffect, useState } from "react";
import { hideModal } from "../..";
import Base from "../Base";
import "./index.scss";
import Condition from "@/renderer/components/Condition";
import classNames from "@/renderer/utils/classnames";
import SvgAsset from "@/renderer/components/SvgAsset";
import useSearchLyric from "./hooks/useSearchLyric";
import { useStore } from "@/common/store";
import searchResultStore from "./hooks/searchResultStore";
import { getSearchablePlugins } from "@/renderer/core/plugin-delegate";
import { Tab } from "@headlessui/react";
import Loading from "@/renderer/components/Loading";

interface IProps {
    defaultTitle?: string;
    defaultExtra?: boolean;
}

export default function SearchLyric(props: IProps) {
    const { defaultTitle } = props;

    const [inputSearch, setInputSearch] = useState(defaultTitle ?? '');

    const searchLyric = useSearchLyric();
    const searchResults = searchResultStore.useValue();

    const availablePlugins = getSearchablePlugins('lyric');

    useEffect(() => {
        if (inputSearch) {
            searchLyric(inputSearch);
        }
    }, []);


    return (
        <Base defaultClose withBlur={false}>
            <div className="modal--search-lyric-container shadow backdrop-color">
                <Base.Header>
                    <div className="search-lyric-input-container">
                        <input className="search-lyric-input" placeholder="搜索歌词" value={inputSearch} onChange={evt => {
                            setInputSearch(evt.target.value);
                        }} onKeyDown={(key) => {
                            if (key.key === "Enter") {
                                searchLyric(inputSearch);
                            }
                        }}></input>
                        <div className="search-lyric-search" role="button" onClick={() => {
                            searchLyric(inputSearch);
                        }}>
                            <SvgAsset iconName='magnifying-glass'></SvgAsset>
                        </div>
                    </div>
                </Base.Header>
                <Tab.Group>
                    <Tab.List className="tab-list-container">
                        {availablePlugins.map((plugin) => (
                            <Tab key={plugin.hash} as="div" className="tab-list-item">
                                {plugin.platform}
                            </Tab>
                        ))}
                    </Tab.List>
                    <Tab.Panels className={"tab-panels-container"}>
                        {availablePlugins.map((plugin) => (
                            <Tab.Panel className="tab-panel-container" key={plugin.hash}>
                                
                            </Tab.Panel>
                        ))}
                    </Tab.Panels>
                </Tab.Group>
            </div>
        </Base>
    );
}
