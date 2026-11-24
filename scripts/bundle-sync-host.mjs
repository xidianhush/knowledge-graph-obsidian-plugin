import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

export function buildKnowledgeMapUnified(root, host) {
  return bundleSyncHost(root, { host, unified: true });
}

export function bundleSyncHost(
  root,
  { replay = false, host, candidate, receive = false, attemptSuite = null, unified = false } = {},
) {
  const graphHost = typeof host === 'string',
    recovery = graphHost && !receive && !unified;
  const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
  const provenance = [],
    factories = new Map();
  const read = (file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    provenance.push({ file, sha256: hash(source) });
    return source;
  };
  // The probe runs the existing modules in Obsidian's CommonJS entrypoint.
  // Support only the named imports/exports used by these local sources.
  function add(file) {
    if (factories.has(file)) return;
    factories.set(file, null);
    const exports = [];
    const dependency = (specifier) => {
      if (!/^\.\/[a-z0-9-]+\.mjs$/.test(specifier))
        throw Error('Unexpected probe import: ' + specifier);
      const target = path.posix.join(path.posix.dirname(file), specifier);
      add(target);
      return JSON.stringify(target);
    };
    const source = read(file)
      .replace(
        /^import \{([^}]+)\} from '([^']+)';/gm,
        (_, names, specifier) =>
          'const {' +
          names.replace(/\bas\b/g, ':') +
          '}=loadProbeModule(' +
          dependency(specifier) +
          ');',
      )
      .replace(
        /await import\('([^']+)'\)/g,
        (_, specifier) => 'loadProbeModule(' + dependency(specifier) + ')',
      )
      .replace(/^export (?=(?:async )?(?:function|const) (\w+))/gm, (_, name) => {
        exports.push(name);
        return '';
      })
      .replace(/^export \{([^}]+)\};\s*$/gm, (_, names) => {
        exports.push(...names.split(',').map((name) => name.trim()));
        return '';
      });
    factories.set(file, '()=>{\n' + source + '\nreturn {' + exports.join(',') + '};\n}');
  }
  for (const name of [
    'local-work',
    'connection-lifecycle',
    'settings-coordinator',
    'private-config',
    'persistence',
    'obsidian-host',
    'indexeddb-store',
    'private-store-budget',
  ])
    add('src/sync/' + name + '-prototype.mjs');
  if (graphHost) {
    if (unified) {
      add('src/sync/obsidian-unified-host.mjs');
      add('src/sync/obsidian-layout-receiver.mjs');
      add('src/sync/obsidian-sync-settings.mjs');
      add('src/sync/obsidian-easy-settings.mjs');
    }
    add('src/sync/obsidian-shared-history.mjs');
    if (receive) {
      add('src/sync/obsidian-layout-receiver.mjs');
      add('src/sync/obsidian-conflict-review.mjs');
      add('src/sync/obsidian-onboarding-review.mjs');
    }
    if (attemptSuite) add('src/sync/attempt-history-prototype.mjs');
    factories.set(
      'knowledge-map-host',
      '()=>{\nconst module={exports:{}};\n' +
        host +
        '\n' +
        read(receive || unified ? 'src/i18n.receive.js' : 'src/i18n.recovery.js') +
        (unified ? '\n' + read('src/i18n.sync.js') : '') +
        '\nreturn {BasePlugin:module.exports,buildVaultGraph,decodeGraphPayload,createLayoutModel,createLayoutStore,validateGraphSettings,t:kgT' +
        (unified
          ? ',applyCandidateData(plugin,data){data=validateGraphSettings(data);const changed=JSON.stringify([plugin.savedData?.settings,plugin.savedData?.pipeline])!==JSON.stringify([data.settings,data.pipeline]);plugin.savedData=data;plugin.pipelineSettings=data.pipeline;plugin.graphSettings=data.settings;kgI18nSetPreference(data.settings?.language??"auto");if(changed){plugin.layoutEpoch=(plugin.layoutEpoch??0)+1;for(const leaf of plugin.app.workspace?.getLeavesOfType?.("knowledge-graph-vault-view")??[]){leaf.view.graph?.renderer.cancelInteraction();void leaf.view.applySettings();}if(plugin.settingTab?.containerEl?.isConnected)plugin.settingTab.display();}}'
          : '') +
        '};\n}',
    );
  } else {
    for (const file of ['dist/graph-core.mjs', 'dist/pipeline.mjs']) add(file);
    const settings = [
      'src/i18n.js',
      'src/i18n.obsidian.js',
      'src/pipeline/defaults.js',
      'src/pipeline/input.js',
      'src/settings.js',
    ];
    factories.set(
      'probe-settings',
      '()=>{\n' + settings.map(read).join('\n') + '\nreturn {validateGraphSettings};\n}',
    );
  }
  const footerName = unified
    ? 'unified'
    : receive
      ? 'receive'
      : recovery
        ? 'recovery'
        : replay
          ? 'replay'
          : 'local-work';
  const footerFile = graphHost
    ? 'src/sync/obsidian-' + footerName + '-entry.js'
    : 'scripts/sync-a3-native-probe/' + footerName + '.js';
  const footer = fs.readFileSync(path.join(root, footerFile), 'utf8');
  const build = {
    version: unified ? 6 : receive ? 5 : recovery ? 4 : replay ? 3 : 2,
    modules: provenance,
    footerSha256: hash(footer),
    ...(graphHost ? { graphHostSha256: hash(host) } : {}),
  };
  const declarations = Array.from(
    factories,
    ([file, factory]) => JSON.stringify(file) + ':' + factory,
  ).join(',\n');
  const main =
    'const factories={' +
    declarations +
    '};\nconst loaded=new Map();\n' +
    'function loadProbeModule(file){if(!loaded.has(file))loaded.set(file,factories[file]());return loaded.get(file);}\n' +
    'const PROBE_BUILD=' +
    JSON.stringify(build) +
    ';\n' +
    (recovery ? 'const RECOVERY_CANDIDATE=' + candidate + ';\n' : '') +
    (receive ? 'const ATTEMPT_SUITE=' + JSON.stringify(attemptSuite) + ';\n' : '') +
    footer;
  new vm.Script(main, { filename: 'sync-' + footerName + '-probe.js' });
  return { main, build, provenance, pluginMainSha256: hash(main) };
}
