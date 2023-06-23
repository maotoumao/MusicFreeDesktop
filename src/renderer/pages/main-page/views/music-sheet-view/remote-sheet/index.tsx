import React from 'react'
import { useParams } from 'react-router-dom';
import usePluginSheetMusicList from './hooks/usePluginSheetMusicList';
import MusicSheetlikeView from '@/renderer/components/MusicSheetlikeView';

export default function RemoteSheet() {
    const {platform, id} = useParams() ?? {};

    const [state, sheetItem, musicList, getSheetDetail] =
        usePluginSheetMusicList({
            ...(history.state?.usr?.sheetItem ?? {}),
            platform,
            id
        } as IMusic.IMusicSheetItem);
    return (
        <MusicSheetlikeView
            musicSheet={sheetItem}
            musicList={musicList}
            state={state}
            onLoadMore={() => {
                getSheetDetail()
            }}
        />
    );

  return (
    <div>RemoteSheet</div>
  )
}
