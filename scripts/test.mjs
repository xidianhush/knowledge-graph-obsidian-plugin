// Portable synthetic checks. No Obsidian, personal vault or network is required.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const checks=['build','i18n_check','core_check','pipeline_contract_check','settings_check',
  'layout_prototype_check','layout_edit_check','layout_state_check',
  'layout_rename_check','layout_rename_extended_check','layout_incremental_check','layout_compact_check'];
for(const name of checks)execFileSync(process.execPath,[`scripts/${name}.mjs`],{cwd,stdio:'inherit'});
console.log(`Completed build and ${checks.length-1} synthetic check scripts.`);
