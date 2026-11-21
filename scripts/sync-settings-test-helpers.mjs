// Existing production settings validation exercised by isolated sync tests.
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({structuredClone,console,require:()=>({PluginSettingTab:class{},Setting:class{}})});
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
vm.runInContext(['src/i18n.js','src/i18n.obsidian.js','src/pipeline/defaults.js','src/pipeline/input.js','src/settings.js'].map(read).join('\n')+'\nthis.api={validateGraphSettings};',context);
export const validateTestSettings=value=>JSON.parse(JSON.stringify(context.api.validateGraphSettings(structuredClone(value))));
