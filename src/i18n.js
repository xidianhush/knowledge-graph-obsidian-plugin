/* 运行时双语引擎（UI-A11）。
 *
 * 构建期按顺序拼接进同一作用域：本文件最先（main.js / graph-core.mjs / browser.mjs
 * 都含它），随后是各域字典 src/i18n.<domain>.js，最后才是使用 t() 的业务源码。
 * 因此这里只能使用普通顶层声明，不能 require/import，也不能在加载期碰 document。
 *
 * 约定：
 *  - 字典按域注册：kgI18nRegister('en', { 'hud.subtitle': '...' })。key 用 `域.用途`。
 *  - 字符串里用 {name} 占位，kgT(key, vars) 代入；字典值也可以是 (vars) => string
 *    函数，用于英文单复数等必须改语序/词形的场景（中日文用普通字符串即可）。
 *  - 当前语言 = 优先级：globalThis.__KG_LOCALE__（测试/截图注入）> 设置项（auto/zh/en）
 *    > auto 时取插件用 moment.locale() 报告的应用语言 > 默认 en。
 *  - data-i18n="key" 写 textContent；data-i18n-html="key" 写 innerHTML（值必须是我们
 *    自己的可信常量）；data-i18n-<attr>="key" 写同名 HTML 属性，例如
 *    data-i18n-title / data-i18n-aria-label / data-i18n-placeholder。
 */
const KG_I18N_LOCALES = ['en', 'zh'];
const KG_I18N_FALLBACK = 'en';
const KG_I18N_DICT = { en: Object.create(null), zh: Object.create(null) };
const KG_I18N_LISTENERS = [];
const KG_I18N_ROOTS = [];
let kgI18nPreferenceValue = 'auto';
let kgI18nAutoValue = 'en';
let kgI18nCurrentValue = 'en';

function kgI18nNormalize(locale) {
  const value = String(locale || '').trim().toLowerCase();
  if (value === 'zh' || value.startsWith('zh-') || value.startsWith('zh_')) return 'zh';
  if (value === 'auto') return 'auto';
  return 'en';
}

function kgI18nDetect() {
  const injected = typeof globalThis !== 'undefined' ? globalThis.__KG_LOCALE__ : null;
  if (injected) return kgI18nNormalize(injected);
  if (kgI18nPreferenceValue === 'auto') return kgI18nAutoValue;
  return kgI18nNormalize(kgI18nPreferenceValue);
}

function kgI18nRegister(locale, dict) {
  const target = KG_I18N_DICT[kgI18nNormalize(locale)];
  if (!target || !dict) return;
  for (const key of Object.keys(dict)) target[key] = dict[key];
}

/** Obsidian 侧在 onload/设置保存后把 moment.locale() 报进来；Node 与浏览器直开时为 en。 */
function kgI18nSetAutoLocale(locale) {
  const next = kgI18nNormalize(locale) === 'zh' ? 'zh' : 'en';
  if (next === kgI18nAutoValue) return;
  kgI18nAutoValue = next;
  kgI18nRefresh();
}

/** 'auto' | 'zh' | 'en'，来自插件设置。 */
function kgI18nSetPreference(preference) {
  const next = kgI18nNormalize(preference);
  if (next === kgI18nPreferenceValue) return;
  kgI18nPreferenceValue = next;
  kgI18nRefresh();
}

function kgI18nPreference() { return kgI18nPreferenceValue; }
function kgI18nLocale() { return kgI18nCurrentValue; }

function kgT(key, vars) {
  let value = KG_I18N_DICT[kgI18nCurrentValue] ? KG_I18N_DICT[kgI18nCurrentValue][key] : undefined;
  if (value === undefined || value === null) value = KG_I18N_DICT[KG_I18N_FALLBACK][key];
  if (value === undefined || value === null) return String(key);
  if (typeof value === 'function') return String(value(vars || {}));
  const text = String(value);
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined || vars[name] === null ? match : String(vars[name])));
}

/** 翻译 root 子树里所有 data-i18n*，并把 root 登记为语言切换时要重刷的根。 */
function kgI18nApply(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return root;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = kgT(el.getAttribute('data-i18n'));
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = kgT(el.getAttribute('data-i18n-html'));
  const target = root.querySelectorAll('[data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder]');
  for (const el of target) {
    for (const name of el.getAttributeNames()) {
      if (!name.startsWith('data-i18n-') || name === 'data-i18n' || name === 'data-i18n-html') continue;
      el.setAttribute(name.slice('data-i18n-'.length), kgT(el.getAttribute(name)));
    }
  }
  return root;
}

function kgI18nAttach(root) {
  if (!root) return () => {};
  KG_I18N_ROOTS.push(root);
  kgI18nApply(root);
  return () => {
    const index = KG_I18N_ROOTS.indexOf(root);
    if (index >= 0) KG_I18N_ROOTS.splice(index, 1);
  };
}

/** 语言变化监听：视图重建、画布重绘、动态 DOM 重填都挂这里。 */
function kgI18nOnChange(listener) {
  if (typeof listener !== 'function') return () => {};
  KG_I18N_LISTENERS.push(listener);
  return () => {
    const index = KG_I18N_LISTENERS.indexOf(listener);
    if (index >= 0) KG_I18N_LISTENERS.splice(index, 1);
  };
}

function kgI18nRefresh() {
  const next = kgI18nDetect();
  const changed = next !== kgI18nCurrentValue;
  kgI18nCurrentValue = next;
  if (!changed) return;
  for (const root of KG_I18N_ROOTS.slice()) kgI18nApply(root);
  for (const listener of KG_I18N_LISTENERS.slice()) {
    try { listener(next); } catch (error) { /* 一处失败不能拖垮其余界面 */ }
  }
}

kgI18nRefresh();
