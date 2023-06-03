import Loading from '@/renderer/components/Loading'
import { pluginsStore } from '@/renderer/core/plugin-delegate'
import './index.scss';
import PluginTable from './components/plugin-table';

export default function PluginManagerView() {
    

  return (
    <div className='plugin-manager-view-container'>
        <div className='header'>
          插件管理
        </div>
        <PluginTable></PluginTable>
    </div>
  )
}
