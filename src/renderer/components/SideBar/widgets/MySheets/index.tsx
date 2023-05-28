import React from 'react'
import './index.scss';
import ListItem from '../ListItem';

export default function index() {
  return (
    <div className='side-bar-container--my-sheets'>
        <div className='divider'></div>
        <div className='title'>我的歌单</div>
        <ListItem iconName="heart-outline" title='我喜欢'></ListItem>
        <ListItem iconName="musical-note" title='歌单1'></ListItem>
        <ListItem iconName="musical-note" title='歌单2'></ListItem>
        <ListItem iconName="musical-note" title='歌单3'></ListItem>
        <ListItem iconName="musical-note" title='歌单4'></ListItem>
        <ListItem iconName="musical-note" title='歌单1'></ListItem>
        <ListItem iconName="musical-note" title='歌单2歌单2歌单2歌单2歌单2歌单2歌单2歌单2歌单2歌单2歌单2歌单2'></ListItem>
        <ListItem iconName="musical-note" title='歌单3'></ListItem>
        <ListItem iconName="musical-note" title='歌单4'></ListItem>
        <ListItem iconName="musical-note" title='歌单1'></ListItem>
        <ListItem iconName="musical-note" title='歌单2'></ListItem>
        <ListItem iconName="musical-note" title='歌单3'></ListItem>
        <ListItem iconName="musical-note" title='歌单4'></ListItem>
        <ListItem iconName="musical-note" title='歌单1'></ListItem>
        <ListItem iconName="musical-note" title='歌单2'></ListItem>
        <ListItem iconName="musical-note" title='歌单3'></ListItem>
        <ListItem iconName="musical-note" title='歌单4'></ListItem>

    </div>
  )
}
