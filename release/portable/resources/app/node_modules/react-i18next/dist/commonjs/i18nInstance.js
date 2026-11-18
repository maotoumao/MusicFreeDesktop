"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setI18n = setI18n;
exports.getI18n = getI18n;
var i18nInstance;

function setI18n(instance) {
  i18nInstance = instance;
}

function getI18n() {
  return i18nInstance;
}