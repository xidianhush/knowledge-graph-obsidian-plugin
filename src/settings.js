// Host settings only; graph/rendering defaults remain in the deterministic pipeline.
const { PluginSettingTab, Setting } = require('obsidian');
const GRAPH_SETTINGS_VERSION = 1;
function graphSettingsDraft(saved = {}) {
  const data = structuredClone(saved);
  data.pipeline ??= {};
  data.pipeline.config ??= {};
  const config = data.pipeline.config;
  config.include ??= ['**']; config.exclude ??= []; config.exclude_notes ??= []; config.remap ??= [];
  config.preview ??= {};
  config.preview.enabled ??= true; config.preview.max_note_chars ??= 0;
  data.settings ??= {};
  data.settings.autoUpdate ??= true; data.settings.debounceMs ??= 350;
  return data;
}
function validateGraphSettings(draft) {
  const data = graphSettingsDraft(draft), cfg = data.pipeline.config;
  const relative = value => typeof value === 'string' && value.trim() &&
    !/^(?:[A-Za-z]:|\/)/.test(value) && !value.split('/').some(p => p === '..' || p === '.');
  for (const key of ['include', 'exclude', 'exclude_notes']) {
    if (!Array.isArray(cfg[key])) throw new Error(key + ' 必须是列表');
    cfg[key] = cfg[key].map(value => typeof value === 'string' ? value.trim().replaceAll('\\', '/') : value);
    if (!cfg[key].every(relative)) throw new Error(key + ' 必须使用库内相对路径，不能包含 . 或 ..');
  }
  if (!cfg.include.length) throw new Error('包含范围不能为空；全库请明确填写 **');
  if (Array.isArray(cfg.remap)) cfg.remap = cfg.remap.map(rule => {
    if (!kgDict(rule)) return rule;
    const normalized = { ...rule };
    for (const key of ['from', 'to']) if (typeof normalized[key] === 'string') normalized[key] = normalized[key].trim().replaceAll('\\', '/');
    return normalized;
  });
  if (!Array.isArray(cfg.remap) || !cfg.remap.every(rule => kgDict(rule) && relative(rule.from) && relative(rule.to))) {
    throw new Error('目录映射必须为含 from / to 相对路径的 JSON 数组');
  }
  if (typeof data.settings.autoUpdate !== 'boolean') throw new Error('自动更新必须为开关值');
  if (!Number.isInteger(data.settings.debounceMs) || data.settings.debounceMs < 100 || data.settings.debounceMs > 10000) {
    throw new Error('防抖时长须为 100–10000 毫秒的整数');
  }
  if (typeof cfg.preview.enabled !== 'boolean') throw new Error('预览必须为开关值');
  if (!Number.isInteger(cfg.preview.max_note_chars) || cfg.preview.max_note_chars < 0 || cfg.preview.max_note_chars > 1000000) {
    throw new Error('预览预算须为 0–1000000 的整数；0 使用默认 60000 字符');
  }
  const validated = pipelineConfig(cfg);
  // Compile globs now, before saving or reading any note.
  selectGraphFiles([], validated);
  data.settingsVersion = GRAPH_SETTINGS_VERSION;
  return data;
}
function graphScopeConfig(plugin) {
  const config = pipelineConfig({ include: ['**'], ...plugin.pipelineSettings.config });
  config.exclude.push('Utilities/API Key.md');
  return config;
}
function graphPathAllowed(plugin, path) {
  if (!path || String(path).replaceAll('\\', '/').toLowerCase() === 'utilities/api key.md') return false;
  try { return selectGraphFiles([{ path }], graphScopeConfig(plugin)).files.length > 0; } catch { return false; }
}

class KnowledgeGraphSettingsTab extends PluginSettingTab {
  display() {
    const el = this.containerEl; el.empty(); el.addClass('kg-settings');
    let draft;
    try { draft = graphSettingsDraft(this.plugin.savedData); }
    catch (error) { el.createEl('p', { text: '配置无法载入：' + error.message }); return; }
    const config = draft.pipeline.config;
    el.createEl('h2', { text: '知识图谱设置' });
    el.createEl('p', { text: '编辑后点击“保存并应用”。范围检查只枚举路径，不读取正文。排除始终在读取前执行；Utilities/API Key.md 固定排除。' });
    const message = el.createDiv({ cls: 'kg-settings-message', attr: { role: 'status', 'aria-live': 'polite' } });
    const errors = new Map();
    const field = (key, name, description) => new Setting(el).setName(name).setDesc(description).addTextArea(input => {
      input.inputEl.setAttribute('aria-label', name);
      input.setValue((config[key] || []).join('\n')).onChange(value => { config[key] = value.split(/\r?\n/).map(v => v.trim()).filter(Boolean); });
    });
    field('include', '包含范围', '每行一个规则，例如 课程/**、项目/**。** 表示全库；不能为空。沿用现有匹配规则：* 可跨目录，规则同时匹配完整相对路径和文件名，忽略大小写。');
    field('exclude', '排除范围', '每行一个规则，例如 私密/** 或 草稿.md。排除优先于包含；隐藏目录和 node_modules 等自动跳过。');
    field('exclude_notes', '排除笔记', '每行一个相对路径、去掉 .md 的路径或笔记名；笔记名会排除各目录的同名笔记，此列表区分大小写。');
    new Setting(el).setName('目录映射').setDesc('可选 JSON 数组，例如 [{"from":"课程","to":"学习"}]。只改变图中目录，使用最长前缀；不移动文件。').addTextArea(input => {
      input.inputEl.setAttribute('aria-label', '目录映射');
      input.setValue(JSON.stringify(config.remap, null, 2)).onChange(value => {
        try { config.remap = JSON.parse(value || '[]'); errors.delete('remap'); }
        catch { errors.set('remap', '目录映射不是有效 JSON'); }
      });
    });
    new Setting(el).setName('自动更新').setDesc('响应范围内笔记变动；关闭后仍可用命令或构建状态栏手动重建。').addToggle(input => input.setValue(draft.settings.autoUpdate).onChange(value => { draft.settings.autoUpdate = value; }));
    const number = (name, description, value, update) => new Setting(el).setName(name).setDesc(description).addText(input => {
      input.inputEl.type = 'number'; input.inputEl.setAttribute('aria-label', name);
      input.setValue(String(value)).onChange(value => update(value.trim() ? Number(value) : NaN));
    });
    number('更新防抖（毫秒）', '100–10000；默认 350。连续保存合并为一次完整重建。', draft.settings.debounceMs, value => { draft.settings.debounceMs = value; });
    new Setting(el).setName('原生笔记预览').setDesc('Ctrl + 悬停预览，点击固定。关闭后仍可选中与打开笔记。').addToggle(input => input.setValue(config.preview.enabled).onChange(value => { config.preview.enabled = value; }));
    number('单次预览字符预算', '0 使用默认 60000；可保存最大 1000000。实际预览另受 12000 字符、公式与嵌入数量保护，按完整行截取，可打开全文。', config.preview.max_note_chars, value => { config.preview.max_note_chars = value; });
    const validated = () => { if (errors.size) throw new Error([...errors.values()].join('；')); return validateGraphSettings(draft); };
    const report = error => { message.textContent = error.message; message.dataset.error = 'true'; };
    new Setting(el).setName('应用设置').addButton(button => button.setButtonText('检查范围').onClick(() => {
      try {
        const data = validated(), cfg = pipelineConfig(data.pipeline.config); cfg.exclude.push('Utilities/API Key.md');
        const scan = selectGraphFiles(this.app.vault.getMarkdownFiles().map(file => ({ path: file.path })), cfg);
        message.textContent = '匹配 ' + scan.files.length + ' 篇笔记，排除 ' + scan.stats.excluded + ' 篇（未读取正文）。'; delete message.dataset.error;
      } catch (error) { report(error); }
    })).addButton(button => button.setButtonText('保存并应用').setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        await this.plugin.saveGraphSettings(validated());
        message.textContent = '设置已保存；已打开的当前库图谱已开始按新设置重建。'; delete message.dataset.error;
      } catch (error) { report(error); }
      finally { button.setDisabled(false); }
    })).addButton(button => button.setButtonText('撤销未保存修改').onClick(() => this.display()));
  }
}
