/**
 * Electron i18n: loads backend/i18n/*.json (UTF-8)
 */
const fs = require('fs');
const path = require('path');

const LANG = process.env.FINDWAY_LANG || 'zh-CN';
const stringsPath = path.join(__dirname, '..', 'backend', 'i18n', `${LANG}.json`);

let strings = {};
try {
  strings = JSON.parse(fs.readFileSync(stringsPath, 'utf8'));
} catch (err) {
  console.warn('[i18n] failed to load', stringsPath, err.message);
}

function t(key, params = {}) {
  let text = strings[key] ?? key;
  for (const [name, value] of Object.entries(params)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

module.exports = { t };
