#!/usr/bin/env node
/* i18n 静态门禁（UI-A11）。
 *
 * 六项检查：
 *   1. 全部字典装进 node:vm 沙箱后，en / zh 的 key 集合相等，且每个 key 的值非空
 *      （函数值也算有值，只在调用时展开）；
 *   2. 每个域字典文件单独（引擎 + 该文件）加载，检测跨文件重复 key —— kgI18nRegister
 *      是逐 key 赋值，重复 key 会静默覆盖前一个文件；
 *   3. en 值里不含中文字符：静态字符串直接看，函数值按典型 vars 形状抽样调用后再看返回；
 *   4. upstream/template.html 的静态中文必须位于带 data-i18n / data-i18n-html 的元素内，
 *      或位于注释 / <style> / <script> 里，或命中下方显式白名单（运行时会被重写的节点）；
 *   5. 模板里 data-i18n* 引用的 key 必须同时存在于 en 与 zh 字典；
 *   6. src/ 下非 i18n 源码去掉注释后，字符串字面量里不得再有中文，报 file:line；
 *      同一行写 `// i18n-allow: <理由>` 可豁免。
 *
 * 通过：`i18n check: N keys, N template bindings, ok`。
 * 失败：分组摘要 + 每组前若干条明细，退出码 1。
 * 并行开发期其他域的字典/源码未完成时本检查会红，这是预期，不得放宽或跳过。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const HERE_ROOT = fileURLToPath(new URL('../', import.meta.url));
// 仅用于本脚本自身的坏样本自测（node scripts/i18n_check.mjs 时不会设置）。
const ROOT = process.env.I18N_CHECK_ROOT ? path.resolve(process.env.I18N_CHECK_ROOT) : HERE_ROOT;
const ENGINE_FILE = 'src/i18n.js';
const DOMAIN_FILES = ['src/i18n.core.js', 'src/i18n.ui.js', 'src/i18n.hud.js', 'src/i18n.obsidian.js'];
const TEMPLATE_FILE = 'upstream/template.html';
const LOCALES = ['en', 'zh'];
const SRC_ROOT = 'src';

// 中文字符（含中日韩标点、全角符号）；只用于“是否要拦”的判定，不追求 Unicode 全量。
const CJK_CHAR = /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/;

// 模板静态文字白名单：这些节点由 hud 在运行时整块重写，模板里的中文只是兜底，
// 不应该（也不能）靠 data-i18n 覆盖 —— 加了也会被运行时覆盖掉。
const TEMPLATE_TEXT_WHITELIST = [
  {parentId: 'footer', reason: 'hud.js updateStats() 运行时用 kgT("ui.footer", {generated}) 重写 #footer'},
  {parentId: 'legend-toggle', reason: 'hud.js applyLegendCollapsed() 运行时重写 #legend-toggle 文案（收起/展开）'},
];
const TEMPLATE_WHITELIST_IDS = new Set(TEMPLATE_TEXT_WHITELIST.map((entry) => entry.parentId));

const MAX_DETAILS = 8;
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// ---------------------------------------------------------------------------
// 失败收集
// ---------------------------------------------------------------------------
const groups = [];
function fail(groupTitle, message) {
  let group = groups.find((item) => item.title === groupTitle);
  if (!group) {
    group = {title: groupTitle, items: []};
    groups.push(group);
  }
  group.items.push(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// 1/3. 字典加载与取值检查
// ---------------------------------------------------------------------------
function loadDict(files) {
  const context = vm.createContext({});
  for (const file of files) {
    vm.runInContext(read(file), context, {filename: `${file} (i18n vm)`});
  }
  const dict = vm.runInContext('KG_I18N_DICT', context);
  if (!dict || typeof dict !== 'object') throw new Error('沙箱里取不到 KG_I18N_DICT');
  return dict;
}

function valueProblem(value) {
  if (typeof value === 'function') return null;
  if (typeof value !== 'string') return `值必须是字符串或函数，实际是 ${value === null ? 'null' : typeof value}`;
  if (value.trim() === '') return '值为空字符串';
  return null;
}

/** 抽样调用函数值：按字典函数常见的 vars 形状喂两轮代理对象，返回样本字符串或 null。 */
const SAMPLE_PROXIES = [
  new Proxy({}, {get: (target, prop) => (prop === Symbol.toPrimitive ? () => '7' : '7'), has: () => true}),
  new Proxy({}, {get: (target, prop) => (prop === Symbol.toPrimitive ? () => 7 : 7), has: () => true}),
];
function sampleFunction(fn) {
  for (const vars of SAMPLE_PROXIES) {
    try {
      return String(fn(vars));
    } catch (error) {
      // 换一种 vars 形状再试；都不行就跳过（无法抽样不等于有错）。
    }
  }
  return null;
}

let dict;
try {
  dict = loadDict([ENGINE_FILE, ...DOMAIN_FILES]);
} catch (error) {
  console.error(`i18n check failed: 字典无法加载到 vm 沙箱 — ${error.message}`);
  process.exit(1);
}
const en = dict.en || {};
const zh = dict.zh || {};
const enKeys = new Set(Object.keys(en));
const zhKeys = new Set(Object.keys(zh));

for (const key of enKeys) if (!zhKeys.has(key)) fail('en/zh key 集合', `zh 缺 key: ${key}`);
for (const key of zhKeys) if (!enKeys.has(key)) fail('en/zh key 集合', `en 缺 key: ${key}`);

for (const locale of LOCALES) {
  const table = locale === 'en' ? en : zh;
  for (const key of Object.keys(table)) {
    const problem = valueProblem(table[key]);
    if (problem) fail(`${locale} 字典取值`, `${key} — ${problem}`);
  }
}

for (const key of Object.keys(en)) {
  const value = en[key];
  if (typeof value === 'string') {
    if (CJK_CHAR.test(value)) fail('en 值含中文', `${key} — ${snippet(value)}`);
  } else if (typeof value === 'function') {
    const sampled = sampleFunction(value);
    if (sampled !== null && CJK_CHAR.test(sampled)) fail('en 函数返回含中文', `${key} — ${snippet(sampled)}`);
  }
}

// ---------------------------------------------------------------------------
// 2. 跨文件重复 key（每个域文件单独加载）
// ---------------------------------------------------------------------------
const owners = new Map(); // `${locale}\u0000${key}` -> Set(file)
for (const file of DOMAIN_FILES) {
  let local;
  try {
    local = loadDict([ENGINE_FILE, file]);
  } catch (error) {
    fail('字典文件单独加载', `${file} — ${error.message}`);
    continue;
  }
  for (const locale of LOCALES) {
    for (const key of Object.keys(local[locale] || {})) {
      const bucket = `${locale}\u0000${key}`;
      if (!owners.has(bucket)) owners.set(bucket, new Set());
      owners.get(bucket).add(file);
    }
  }
}
for (const [bucket, files] of owners) {
  if (files.size <= 1) continue;
  const [locale, key] = bucket.split('\u0000');
  fail('跨文件重复 key', `${key} (${locale}) — ${[...files].join(' + ')}，后加载的会静默覆盖前面的`);
}

// ---------------------------------------------------------------------------
// 4/5. 模板静态中文与 data-i18n* 绑定
// ---------------------------------------------------------------------------
function makeLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** 把注释 / <style> / <script> 抹成空格（保留换行），让偏移量与行号不变。 */
function maskTemplate(text) {
  const chars = Array.from(text);
  const blank = (from, to) => {
    for (let i = from; i < to; i++) if (chars[i] !== '\n') chars[i] = ' ';
  };
  const lower = text.toLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const candidates = [
      {at: text.indexOf('<!--', cursor), kind: 'comment'},
      {at: lower.indexOf('<style', cursor), kind: 'style'},
      {at: lower.indexOf('<script', cursor), kind: 'script'},
    ].filter((item) => item.at >= 0);
    if (candidates.length === 0) break;
    const next = candidates.reduce((a, b) => (a.at <= b.at ? a : b));
    if (next.kind === 'comment') {
      const end = text.indexOf('-->', next.at + 4);
      const stop = end < 0 ? text.length : end + 3;
      blank(next.at, stop);
      cursor = stop;
      continue;
    }
    if (next.kind === 'style') {
      // <style> 里没有嵌套标签，直接找到闭合标签。
      const close = lower.indexOf('</style', next.at);
      const stop = close < 0 ? text.length : lower.indexOf('>', close) + 1;
      blank(next.at, stop);
      cursor = stop;
      continue;
    }
    // <script>：JS 字符串里可能出现 "</script"，但要注入的模板只有占位注释，按首个闭合处理。
    const close = lower.indexOf('</script', next.at);
    const stop = close < 0 ? text.length : lower.indexOf('>', close) + 1;
    blank(next.at, stop);
    cursor = stop;
  }
  return chars.join('');
}

function tagEnd(text, start) {
  let quote = null;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function parseTag(raw) {
  const match = /^<\s*([a-zA-Z][^\s/>]*)/.exec(raw);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const attrs = new Map();
  const body = raw.slice(match[0].length, raw.endsWith('>') ? raw.length - 1 : raw.length);
  const pattern = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let hit;
  while ((hit = pattern.exec(body)) !== null) {
    const attr = hit[1].toLowerCase();
    const value = hit[3] !== undefined ? hit[3] : hit[4] !== undefined ? hit[4] : hit[5] !== undefined ? hit[5] : '';
    if (!attrs.has(attr)) attrs.set(attr, value);
  }
  return {name, attrs, selfClosing: /\/\s*>$/.test(raw)};
}

const I18N_ATTR = /^data-i18n(-[a-z-]+)?$/;
let bindingCount = 0;
let template;
try {
  template = read(TEMPLATE_FILE);
} catch (error) {
  fail('模板读取', `${TEMPLATE_FILE} — ${error.message}`);
}
if (template) {
  const lineOf = makeLineIndex(template);
  const masked = maskTemplate(template);
  const stack = []; // {name, attrs, covered}
  let cursor = 0;
  while (cursor < masked.length) {
    if (masked[cursor] !== '<') {
      let nextTag = masked.indexOf('<', cursor);
      if (nextTag < 0) nextTag = masked.length;
      const textNode = masked.slice(cursor, nextTag);
      if (CJK_CHAR.test(textNode)) {
        const parent = stack[stack.length - 1] || null;
        const covered = parent ? parent.covered : false;
        const whitelisted = stack.some((item) => {
          const id = item.attrs.get('id');
          return id && TEMPLATE_WHITELIST_IDS.has(id);
        });
        if (!covered && !whitelisted) {
          fail('模板静态中文未绑定', `${TEMPLATE_FILE}:${lineOf(cursor)} — ${snippet(textNode)}`);
        }
      }
      cursor = nextTag;
      continue;
    }
    const end = tagEnd(masked, cursor);
    if (end < 0) break;
    const raw = masked.slice(cursor, end + 1);
    const line = lineOf(cursor);
    cursor = end + 1;
    if (/^<\s*\//.test(raw)) {
      stack.pop();
      continue;
    }
    if (/^<\s*[!?]/.test(raw)) continue;
    const parsed = parseTag(raw);
    if (!parsed) continue;
    const {name, attrs, selfClosing} = parsed;

    for (const [attr, value] of attrs) {
      if (I18N_ATTR.test(attr)) {
        bindingCount++;
        const key = value.trim();
        if (key === '') {
          fail('模板绑定 key', `${TEMPLATE_FILE}:${line} <${name} ${attr}> 的 key 为空`);
        } else {
          if (!enKeys.has(key)) fail('模板引用了不存在的 key', `${TEMPLATE_FILE}:${line} ${key} — en 字典没有`);
          if (!zhKeys.has(key)) fail('模板引用了不存在的 key', `${TEMPLATE_FILE}:${line} ${key} — zh 字典没有`);
          if (CJK_CHAR.test(key) && (enKeys.has(key) || zhKeys.has(key))) {
            fail('模板绑定 key', `${TEMPLATE_FILE}:${line} ${attr}="${key}" 看起来是文案不是 key`);
          }
        }
        continue;
      }
      // 静态属性里的中文：title / aria-label / placeholder 必须由同元素的 data-i18n-<attr> 覆盖。
      if (!CJK_CHAR.test(value)) continue;
      if (attr === 'title' || attr === 'aria-label' || attr === 'placeholder') {
        if (!attrs.has(`data-i18n-${attr}`)) {
          fail('模板属性中文未绑定', `${TEMPLATE_FILE}:${line} ${attr}="${snippet(value)}"（缺 data-i18n-${attr}）`);
        }
      } else if (!attrs.has('data-i18n') && !attrs.has('data-i18n-html')) {
        fail('模板属性中文未绑定', `${TEMPLATE_FILE}:${line} ${attr}="${snippet(value)}" — 该属性无法用 data-i18n-* 覆盖，请改写文案`);
      }
    }

    const covers = attrs.has('data-i18n') || attrs.has('data-i18n-html');
    const parentCovered = stack.length > 0 ? stack[stack.length - 1].covered : false;
    if (!selfClosing && !VOID_TAGS.has(name)) {
      stack.push({name, attrs, covered: covers || parentCovered});
    }
  }
}

// ---------------------------------------------------------------------------
// 6. src/ 非 i18n 源码里的中文字符串字面量
// ---------------------------------------------------------------------------
function walkSources(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkSources(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const REGEX_PREFIX_CHARS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_PREFIX_WORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'else', 'do', 'yield', 'await', 'instanceof']);

/** 斜杠是正则字面量还是除号：看左侧最近的非空白字符/关键字（够用的启发式）。 */
function regexAllowed(source, index) {
  let back = index - 1;
  while (back >= 0 && /\s/.test(source[back])) back--;
  if (back < 0) return true;
  const prev = source[back];
  if (REGEX_PREFIX_CHARS.has(prev)) return true;
  if (!/[A-Za-z0-9_$]/.test(prev)) return false;
  let wordStart = back;
  while (wordStart >= 0 && /[A-Za-z0-9_$]/.test(source[wordStart])) wordStart--;
  return REGEX_PREFIX_WORDS.has(source.slice(wordStart + 1, back + 1));
}

/** 代码态的一步：进注释 / 字符串 / 模板 / 正则，或推进一个字符。 */
function stepCode(source, index, stack, top) {
  const ch = source[index];
  if (ch === '/' && source[index + 1] === '/') {
    stack.push({type: 'line'});
    return index + 2;
  }
  if (ch === '/' && source[index + 1] === '*') {
    stack.push({type: 'block'});
    return index + 2;
  }
  if (ch === '/') {
    if (regexAllowed(source, index)) stack.push({type: 'regex', charClass: false});
    return index + 1;
  }
  if (ch === "'") {
    stack.push({type: 'string', quote: "'"});
    return index + 1;
  }
  if (ch === '"') {
    stack.push({type: 'string', quote: '"'});
    return index + 1;
  }
  if (ch === '`') {
    stack.push({type: 'template'});
    return index + 1;
  }
  if (top && top.type === 'expr') {
    if (ch === '{') {
      top.depth++;
      return index + 1;
    }
    if (ch === '}') {
      if (top.depth === 0) stack.pop();
      else top.depth--;
      return index + 1;
    }
  }
  return index + 1;
}

/** 去掉注释后，把每个字符串 / 模板字面量里的中文位置报出来（按行去重）。 */
function findCjkLiterals(source) {
  const hits = new Map(); // line -> snippet line
  const rawLines = source.split('\n');
  const stack = [{type: 'code'}];
  let i = 0;
  let line = 1;
  const record = (at) => {
    if (hits.has(line)) return;
    const raw = rawLines[line - 1] || '';
    hits.set(line, raw);
  };
  while (i < source.length) {
    const top = stack[stack.length - 1];
    const ch = source[i];
    if (ch === '\n') {
      line++;
      i++;
      if (top.type === 'line') stack.pop();
      continue;
    }
    switch (top.type) {
      case 'line':
        i++;
        break;
      case 'block':
        if (ch === '*' && source[i + 1] === '/') {
          stack.pop();
          i += 2;
        } else {
          i++;
        }
        break;
      case 'string': {
        if (ch === '\\') {
          if (source[i + 1] === '\n') line++;
          i += 2;
        } else if (ch === top.quote) {
          stack.pop();
          i++;
        } else {
          if (CJK_CHAR.test(ch)) record(i);
          i++;
        }
        break;
      }
      case 'template':
        if (ch === '\\') {
          if (source[i + 1] === '\n') line++;
          i += 2;
        } else if (ch === '`') {
          stack.pop();
          i++;
        } else if (ch === '$' && source[i + 1] === '{') {
          stack.push({type: 'expr', depth: 0});
          i += 2;
        } else {
          if (CJK_CHAR.test(ch)) record(i);
          i++;
        }
        break;
      case 'regex':
        // 正则字面量里可能有引号，必须整段跳过；字符类里的斜杠不结束字面量。
        if (ch === '\\') {
          if (source[i + 1] === '\n') line++;
          i += 2;
        } else if (ch === '[') {
          top.charClass = true;
          i++;
        } else if (ch === ']') {
          top.charClass = false;
          i++;
        } else if (ch === '/' && !top.charClass) {
          stack.pop();
          i++;
        } else {
          i++;
        }
        break;
      case 'expr':
      case 'code':
      default:
        i = stepCode(source, i, stack, top);
        break;
    }
  }
  return {hits, balanced: stack.length === 1 && stack[0].type === 'code'};
}

let sourceFiles = [];
try {
  sourceFiles = walkSources(path.join(ROOT, SRC_ROOT));
} catch (error) {
  fail('src 目录读取', `${SRC_ROOT} — ${error.message}`);
}
for (const full of sourceFiles) {
  const rel = path.relative(ROOT, full).split(path.sep).join('/');
  if (/^src\/i18n(\.[a-z0-9_-]+)?\.js$/.test(rel)) continue; // 引擎与字典本身，中文是数据/注释
  const source = fs.readFileSync(full, 'utf8');
  const scan = findCjkLiterals(source);
  if (!scan.balanced) {
    fail('src 源码静态扫描', `${rel} — 扫描结束时仍停在注释/字符串/模板/正则里，无法保证漏检，请检查该文件的写法`);
  }
  for (const [line, raw] of scan.hits) {
    if (raw.includes('// i18n-allow:')) continue; // 同行白名单（如上游数据里的中文常量）
    fail('src 源码含中文字符串', `${rel}:${line} — ${snippet(raw)}`);
  }
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
function snippet(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 140);
}

const issueCount = groups.reduce((sum, group) => sum + group.items.length, 0);
if (issueCount === 0) {
  console.log(`i18n check: ${enKeys.size} keys, ${bindingCount} template bindings, ok`);
  process.exit(0);
}

console.error(`i18n check failed: ${groups.length} problem group(s), ${issueCount} issue(s)`);
for (const group of groups) {
  console.error(`  [${group.title}] ${group.items.length}`);
  for (const item of group.items.slice(0, MAX_DETAILS)) console.error(`    - ${item}`);
  if (group.items.length > MAX_DETAILS) console.error(`    … 还有 ${group.items.length - MAX_DETAILS} 条`);
}
process.exit(1);
