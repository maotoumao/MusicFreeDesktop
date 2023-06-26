import { IAppConfig } from '@/common/app-config/type';
import RadioGroupSettingItem from '../../components/RadioGroupSettingItem';
import './index.scss';

interface IProps {
  data: IAppConfig["normal"];
}


export default function Normal(props: IProps) {
  const {data} = props;

  return (
    <div className='setting-view--normal-container'>
      <RadioGroupSettingItem
        label="单击退出按钮时"
        keyPath='normal.closeBehavior'
        value={data?.closeBehavior}
        options={[
          {
            value: "exit",
            title: "退出应用",
          },
          {
            value: "minimize",
            title: "最小化到托盘",
          },
        
        ]}
      ></RadioGroupSettingItem>
    </div>
  )
}
