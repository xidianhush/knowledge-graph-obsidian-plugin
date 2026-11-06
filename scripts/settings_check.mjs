import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const notices = [];
const context = vm.createContext({ structuredClone, console, module: {},
  require: () => ({ Plugin: class {}, ItemView: class {}, PluginSettingTab: class {}, Setting: class {},
    Notice: class { constructor(message) { notices.push(message); } }, moment: { locale: () => 'en' } }) });
vm.runInContext(['src/i18n.js','src/i18n.obsidian.js','src/pipeline/defaults.js','src/pipeline/input.js','src/settings.js','src/plugin.js'].map(read).join('\n')
  + '\nthis.api={graphSettingsDraft,validateGraphSettings,graphPathAllowed,kgT,kgI18nPreference};', context);
const { graphSettingsDraft, validateGraphSettings, graphPathAllowed, kgT, kgI18nPreference } = context.api;
const legacy = { unrelated: { keep: 42 }, pipeline: { config: { include: ['Course/**'], layout: { padding: 1.3 }, preview: { total_chars_budget: 1234 } }, annotations: { manual: 1 }, candidates: { accepted: [1] } } };
const original = JSON.stringify(legacy), migrated = validateGraphSettings(legacy);
assert.equal(JSON.stringify(legacy), original);
assert.equal(migrated.settingsVersion, 1); assert.equal(migrated.settings.debounceMs, 350); assert.equal(migrated.settings.autoUpdate, true);
assert.equal(migrated.pipeline.config.preview.max_note_chars, 0); assert.equal(migrated.pipeline.config.preview.enabled, true);
assert.equal(migrated.unrelated.keep, 42); assert.equal(migrated.pipeline.config.layout.padding, 1.3);
assert.equal(migrated.pipeline.config.preview.total_chars_budget, 1234);
assert.equal(JSON.stringify(migrated.pipeline.annotations), JSON.stringify(legacy.pipeline.annotations));
assert.equal(JSON.stringify(migrated.pipeline.candidates), JSON.stringify(legacy.pipeline.candidates));
for (const patch of [{ include: [] }, { include: ['../outside'] }, { exclude: ['D:\\secret'] }, { include: ['[z-a]'] }, { exclude_notes: [23] }, { remap: [{ from: '..', to: 'X' }] }, { preview: { max_note_chars: -1 } }, { preview: { enabled: 'false' } }]) {
  const data = graphSettingsDraft(); Object.assign(data.pipeline.config, patch); assert.throws(() => validateGraphSettings(data));
}
for (const n of [0, 99, 10001, 1.5, NaN]) { const d=graphSettingsDraft(); d.settings.debounceMs=n; assert.throws(()=>validateGraphSettings(d)); }
const normalized=graphSettingsDraft(); normalized.pipeline.config.include=[' Course\\** '];
assert.equal(validateGraphSettings(normalized).pipeline.config.include[0], 'Course/**');
normalized.pipeline.config.remap=[{from:'Course\\Sub',to:'Mapped\\Sub'}];
assert.equal(validateGraphSettings(normalized).pipeline.config.remap[0].from,'Course/Sub');
normalized.pipeline.config.remap=[{from:'..\\outside',to:'X'}];
assert.throws(()=>validateGraphSettings(normalized));
assert.equal(graphPathAllowed({pipelineSettings:{config:{include:['**']}}}, 'UTILITIES/API KEY.MD'),false);
assert.equal(graphPathAllowed({pipelineSettings:{config:{include:['Course/**']}}},'Other/A.md'),false);
const plugin = new context.module.exports(); plugin.savedData = migrated; plugin.pipelineSettings = migrated.pipeline; plugin.graphSettings = migrated.settings;
plugin.settingsSaveQueue=Promise.resolve(); let applied=0; plugin.app={workspace:{getLeavesOfType:()=>[{view:{applySettings(){applied++;}}}]}};
plugin.saveData=async()=>{throw new Error('disk full');};
const changed=graphSettingsDraft(migrated); changed.settings.autoUpdate=false;
await assert.rejects(plugin.saveGraphSettings(changed),/disk full/);
assert.equal(plugin.graphSettings.autoUpdate,true); assert.equal(applied,0);
const writes=[]; plugin.saveData=async data=>{writes.push(data.settings.debounceMs);};
const second=graphSettingsDraft(changed); second.settings.debounceMs=500;
await Promise.all([plugin.saveGraphSettings(changed),plugin.saveGraphSettings(second)]);
assert.deepEqual(writes,[350,500]); assert.equal(plugin.graphSettings.autoUpdate,false); assert.equal(plugin.graphSettings.debounceMs,500); assert.equal(applied,2);
// UI language: auto default, only auto/zh/en accepted, save switches dictionaries and surfaces.
assert.equal(graphSettingsDraft().settings.language, 'auto');
assert.equal(migrated.settings.language, 'auto');
const invalidLanguage = graphSettingsDraft();
invalidLanguage.settings.language = 'fr';
assert.throws(() => validateGraphSettings(invalidLanguage));
assert.equal(kgI18nPreference(), 'auto');
const switched = graphSettingsDraft(plugin.savedData);
switched.settings.language = 'zh';
await plugin.saveGraphSettings(switched);
assert.equal(plugin.savedData.settings.language, 'zh');
assert.equal(kgI18nPreference(), 'zh');
assert.equal(kgT('settings.title'), '知识图谱设置');
assert.ok(notices.some(message => message.includes('语言已应用')));
assert.equal(applied, 3);
console.log('SETTINGS_CHECK: legacy defaults, preservation, validation, exclusions, language switch, save failure and serialized persistence passed');
