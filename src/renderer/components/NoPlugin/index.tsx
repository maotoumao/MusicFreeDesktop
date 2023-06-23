import { Link } from 'react-router-dom';
import './index.scss';


interface INoPluginProps {
    supportMethod?: string;
    height?: number | string;
}

export default function NoPlugin(props: INoPluginProps) {
  return (
    <div className='no-plugin-container' style={{
      height: props.height
    }}>
        <span>你还没有安装{props?.supportMethod ? <>支持 <span className='highlight'>{props.supportMethod}</span> 功能的</> : ''}插件~</span>
        <span>先去<Link to={'/main/plugin-manager-view'}>插件管理</Link> 安装插件吧~</span>
    </div>
  )
}
