// Portable synthetic checks. No Obsidian, personal vault or network is required.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const checks=['build','i18n_check','core_check','pipeline_contract_check','settings_check',
  'layout_prototype_check','layout_edit_check','layout_state_check',
  'layout_rename_check','layout_rename_extended_check','layout_incremental_check','layout_compact_check','sync_causal_check','sync_layout_check','sync_author_check','sync_wire_check','sync_reconcile_check','sync_coordinator_check','sync_host_check','sync_private_config_check','sync_lifecycle_check','sync_local_work_check','sync_receive_check','sync_publish_probe_check','sync_connection_catalog_check','sync_auto_publish_check','sync_unified_host_check','sync_unified_candidate_check','sync_settings_check','sync_settings_host_check'];
checks.push('sync_unified_delivery_check');
checks.push('sync_unified_g4_check');
checks.push('sync_structural_convergence_check');
checks.push('sync_structural_completion_check');
checks.push('sync_registry_scope_check');
checks.push('sync_idle_status_check');
checks.push('sync_unified_g5_check');
checks.push('sync_g6_check');
checks.push('sync_g7_check');
checks.push('sync_g8_check');
checks.push('sync_g8_build_check');
checks.push('sync_join_identity_check');
checks.push('sync_current_join_check');
checks.push('sync_bootstrap_check');
checks.push('sync_easy_setup_check');
checks.push('sync_replay_cache_check');
checks.push('layout_upgrade_check');
for(const name of checks)execFileSync(process.execPath,[`scripts/${name}.mjs`],{cwd,stdio:'inherit'});
console.log(`Completed build and ${checks.length-1} synthetic check scripts.`);
