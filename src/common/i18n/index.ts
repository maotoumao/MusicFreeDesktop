import i18n from 'i18next';
import zhCN from './lang/zh-CN';
import enUS from './lang/en-US';
import { isRenderer } from '../is-renderer';

if (isRenderer()) {
    const {initReactI18next} = require('react-i18next');

    i18n.use(initReactI18next);
}


i18n.init({
    resources: {
        'zh-CN': zhCN, 
        'en-US': enUS
    },
    lng: 'en-US',
});



export default i18n;