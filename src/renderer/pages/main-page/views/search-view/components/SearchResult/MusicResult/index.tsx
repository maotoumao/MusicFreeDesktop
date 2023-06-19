import React from 'react'
import MusicList from '@/renderer/components/MusicList';

interface IMediaResultProps {
    data: IMusic.IMusicItem[]

}

export default function MusicResult(props: IMediaResultProps) {
    const {data} = props;

  return (
    <MusicList musicList={data}></MusicList>
  )
}
