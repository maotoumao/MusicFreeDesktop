"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.initReactI18next = void 0;

var _defaults = require("./defaults.js");

var _i18nInstance = require("./i18nInstance.js");

var initReactI18next = {
  type: '3rdParty',
  init: function init(instance) {
    (0, _defaults.setDefaults)(instance.options.react);
    (0, _i18nInstance.setI18n)(instance);
  }
};
exports.initReactI18next = initReactI18next;