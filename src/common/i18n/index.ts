import i18n from 'i18next';
import { initReactI18next } from "react-i18next";
import zhHans from './lang/zh-Hans';


i18n.use(initReactI18next).init({
    resources: {
        'zh-Hans': zhHans, 
    },
    lng: 'zh-Hans',
    interpolation: {
        escapeValue: false
    }
});


export default i18n;