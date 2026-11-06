// Host settings only; graph/rendering defaults remain in the deterministic pipeline.
const { PluginSettingTab, Setting } = require('obsidian');
const GRAPH_SETTINGS_VERSION = 1;
const GRAPH_SETTINGS_LANGUAGES = ['auto', 'zh', 'en'];
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
  // 0.0.13 data.json has no language field; treating it as auto keeps old data valid.
  data.settings.language ??= 'auto';
  return data;
}
function validateGraphSettings(draft) {
  const data = graphSettingsDraft(draft), cfg = data.pipeline.config;
  const relative = value => typeof value === 'string' && value.trim() &&
    !/^(?:[A-Za-z]:|\/)/.test(value) && !value.split('/').some(p => p === '..' || p === '.');
  for (const key of ['include', 'exclude', 'exclude_notes']) {
    if (!Array.isArray(cfg[key])) throw new Error(kgT('settings.validate.list', { field: key }));
    cfg[key] = cfg[key].map(value => typeof value === 'string' ? value.trim().replaceAll('\\', '/') : value);
    if (!cfg[key].every(relative)) throw new Error(kgT('settings.validate.relative', { field: key }));
  }
  if (!cfg.include.length) throw new Error(kgT('settings.validate.includeEmpty'));
  if (Array.isArray(cfg.remap)) cfg.remap = cfg.remap.map(rule => {
    if (!kgDict(rule)) return rule;
    const normalized = { ...rule };
    for (const key of ['from', 'to']) if (typeof normalized[key] === 'string') normalized[key] = normalized[key].trim().replaceAll('\\', '/');
    return normalized;
  });
  if (!Array.isArray(cfg.remap) || !cfg.remap.every(rule => kgDict(rule) && relative(rule.from) && relative(rule.to))) {
    throw new Error(kgT('settings.validate.remap'));
  }
  if (typeof data.settings.autoUpdate !== 'boolean') throw new Error(kgT('settings.validate.autoUpdate'));
  if (!Number.isInteger(data.settings.debounceMs) || data.settings.debounceMs < 100 || data.settings.debounceMs > 10000) {
    throw new Error(kgT('settings.validate.debounce'));
  }
  if (!GRAPH_SETTINGS_LANGUAGES.includes(data.settings.language)) throw new Error(kgT('settings.validate.language'));
  if (typeof cfg.preview.enabled !== 'boolean') throw new Error(kgT('settings.validate.preview'));
  if (!Number.isInteger(cfg.preview.max_note_chars) || cfg.preview.max_note_chars < 0 || cfg.preview.max_note_chars > 1000000) {
    throw new Error(kgT('settings.validate.previewBudget'));
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
    catch (error) { el.createEl('p', { text: kgT('settings.loadFailed', { message: error.message }) }); return; }
    const config = draft.pipeline.config;
    el.createEl('h2', { text: kgT('settings.title') });
    el.createEl('p', { text: kgT('settings.intro') });
    const message = el.createDiv({ cls: 'kg-settings-message', attr: { role: 'status', 'aria-live': 'polite' } });
    const errors = new Map();
    // UI language lives here so the rest of the tab can be re-rendered in place.
    new Setting(el)
      .setName(kgT('settings.language.name'))
      .setDesc(kgT('settings.language.desc'))
      .addDropdown(dropdown => dropdown
        .addOption('auto', kgT('settings.language.auto'))
        .addOption('zh', kgT('settings.language.zh'))
        .addOption('en', kgT('settings.language.en'))
        .setValue(draft.settings.language)
        .onChange(value => { draft.settings.language = value; }));
    const field = (key, name, description) => new Setting(el).setName(name).setDesc(description).addTextArea(input => {
      input.inputEl.setAttribute('aria-label', name);
      input.setValue((config[key] || []).join('\n')).onChange(value => { config[key] = value.split(/\r?\n/).map(v => v.trim()).filter(Boolean); });
    });
    field('include', kgT('settings.include.name'), kgT('settings.include.desc'));
    field('exclude', kgT('settings.exclude.name'), kgT('settings.exclude.desc'));
    field('exclude_notes', kgT('settings.excludeNotes.name'), kgT('settings.excludeNotes.desc'));
    new Setting(el).setName(kgT('settings.remap.name')).setDesc(kgT('settings.remap.desc')).addTextArea(input => {
      input.inputEl.setAttribute('aria-label', kgT('settings.remap.name'));
      input.setValue(JSON.stringify(config.remap, null, 2)).onChange(value => {
        try { config.remap = JSON.parse(value || '[]'); errors.delete('remap'); }
        catch { errors.set('remap', kgT('settings.remap.invalid')); }
      });
    });
    new Setting(el).setName(kgT('settings.autoUpdate.name')).setDesc(kgT('settings.autoUpdate.desc')).addToggle(input => input.setValue(draft.settings.autoUpdate).onChange(value => { draft.settings.autoUpdate = value; }));
    const number = (name, description, value, update) => new Setting(el).setName(name).setDesc(description).addText(input => {
      input.inputEl.type = 'number'; input.inputEl.setAttribute('aria-label', name);
      input.setValue(String(value)).onChange(value => update(value.trim() ? Number(value) : NaN));
    });
    number(kgT('settings.debounce.name'), kgT('settings.debounce.desc'), draft.settings.debounceMs, value => { draft.settings.debounceMs = value; });
    new Setting(el).setName(kgT('settings.preview.name')).setDesc(kgT('settings.preview.desc')).addToggle(input => input.setValue(config.preview.enabled).onChange(value => { config.preview.enabled = value; }));
    number(kgT('settings.previewBudget.name'), kgT('settings.previewBudget.desc'), config.preview.max_note_chars, value => { config.preview.max_note_chars = value; });
    const validated = () => { if (errors.size) throw new Error([...errors.values()].join(kgT('settings.validate.joinSeparator'))); return validateGraphSettings(draft); };
    const report = error => { message.textContent = error.message; message.dataset.error = 'true'; };
    new Setting(el).setName(kgT('settings.apply.name')).addButton(button => button.setButtonText(kgT('settings.apply.check')).onClick(() => {
      try {
        const data = validated(), cfg = pipelineConfig(data.pipeline.config); cfg.exclude.push('Utilities/API Key.md');
        const scan = selectGraphFiles(this.app.vault.getMarkdownFiles().map(file => ({ path: file.path })), cfg);
        message.textContent = kgT('settings.apply.scanResult', { matched: scan.files.length, excluded: scan.stats.excluded }); delete message.dataset.error;
      } catch (error) { report(error); }
    })).addButton(button => button.setButtonText(kgT('settings.apply.save')).setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        await this.plugin.saveGraphSettings(validated());
        message.textContent = kgT('settings.apply.saved'); delete message.dataset.error;
      } catch (error) { report(error); }
      finally { button.setDisabled(false); }
    })).addButton(button => button.setButtonText(kgT('settings.apply.revert')).onClick(() => this.display()));
  }
}
