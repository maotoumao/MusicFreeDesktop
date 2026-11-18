import { setDefaults } from './defaults.js';
import { setI18n } from './i18nInstance.js';
export var initReactI18next = {
  type: '3rdParty',
  init: function init(instance) {
    setDefaults(instance.options.react);
    setI18n(instance);
  }
};