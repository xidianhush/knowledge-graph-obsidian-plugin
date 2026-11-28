import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const scripts = [
  'sync_unified_host_disk_check',
  'sync_local_work_disk_check',
  'sync_current_join_disk_check',
  'sync_host_disk_check',
  'sync_private_config_disk_check',
  'sync_lifecycle_disk_check',
  'sync_bootstrap_disk_check',
  'sync_easy_setup_disk_check',
  'layout_upgrade_disk_check',
];
fs.mkdirSync('.local/baseline-convergence', { recursive: true });
const results = [];
for (const [index, name] of scripts.entries()) {
  const r = spawnSync(process.execPath, ['scripts/' + name + '.mjs'], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  fs.writeFileSync(
    '.local/baseline-convergence/disk-' + index + '.log',
    (r.stdout ?? '') + (r.stderr ?? '') + (r.error ? String(r.error) : ''),
  );
  results.push({ command: 'node scripts/' + name + '.mjs', exit: r.status });
  console.log(name + ': ' + r.status);
}
fs.writeFileSync('.local/baseline-convergence/disk-results.json', JSON.stringify(results, null, 2));
if (results.some((r) => r.exit !== 0)) process.exitCode = 1;
