import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {
  inspectSnapshot, makeFixtures, matchesRound, probeId, roles, rounds, vaultName,
} from './sync-a4-attempt-candidate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const randomId = () => randomBytes(16).toString('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const source = file => fs.readFile(path.join(root, file), 'utf8');
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const [command, ...args] = process.argv.slice(2);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (command === 'verify') await verify(...args);
  else await prepare();
}

async function prepare() {
  const base = path.join(root, '.local/sync-016/a4/native');
  await fs.mkdir(base, {recursive: true});
  const out = await fs.mkdtemp(path.join(base, 'attempt-'));
  const suite = randomId();
  const ids = [randomId(), randomId()];
  const tokens = Array.from({length: rounds.length}, randomId);
  const remote = '/KM-A4-' + suite.slice(0, 8);
  const fixtures = await makeFixtures(suite, ids, tokens);
  const entries = new Map();
  for (const [i, {fixture}] of rounds.entries()) {
    const {name, bytes} = fixtures[fixture];
    entries.set(name, bytes);
    assert.equal(matchesRound(i + 1, entries, await inspectSnapshot(suite, entries), fixtures, ids), true);
  }

  const {main, modules} = await buildAttemptProbe({suite, ids, tokens});
  const manifest = {
    id: probeId, name: 'Knowledge Map A4 Attempt Probe', version: '0.1.0', minAppVersion: '1.8.7',
    description: 'Isolated synthetic file transport experiment.', author: 'Hush', isDesktopOnly: false,
  };
  const guide = (await source('docs/SYNC_A4_ATTEMPT_TEST_GUIDE.md')).replaceAll('{{REMOTE}}', remote);
  const paths = {};
  for (const role of roles) {
    const vault = paths[role] = path.join(out, vaultName(role));
    const plugin = '.obsidian/plugins/' + probeId + '/';
    const files = {
      'START-HERE.md': guide,
      '.obsidian/app.json': json({safeMode: false}),
      '.obsidian/community-plugins.json': json([probeId]),
      '.obsidian/core-plugins.json': json(['file-explorer', 'command-palette']),
      [plugin + 'manifest.json']: json(manifest),
      [plugin + 'main.js']: main,
      [plugin + 'data.json']: json({suite, role, checkpoints: [], seeds: []}),
    };
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(vault, relative);
      await fs.mkdir(path.dirname(file), {recursive: true});
      await fs.writeFile(file, content);
    }
  }
  const preparation = {
    out, paths, remote, suite, ids, tokens, modules, buildSha256: sha(main),
    fixtures: Object.fromEntries(Object.entries(fixtures).map(([key, {name, bytes}]) =>
      [key, {name, size: bytes.length, sha256: sha(bytes)}])),
  };
  await fs.writeFile(path.join(out, 'preparation.json'), json(preparation));
  console.log(json(preparation));
}

export async function buildAttemptProbe(config, entryFile = 'scripts/sync-a4-attempt-candidate.mjs',
    footerFile = 'scripts/sync-a4-attempt-probe.js') {
  const modules = {};
  const factories = new Map();
  async function add(file) {
    if (factories.has(file)) return;
    factories.set(file, null);
    const original = await source(file);
    modules[file] = sha(original);
    const imports = [...original.matchAll(/^import \{([^}]+)\} from '([./a-z0-9-]+\.mjs)';$/gm)];
    let code = original;
    for (const [line, names, specifier] of imports) {
      const dependency = path.posix.join(path.posix.dirname(file), specifier);
      await add(dependency);
      code = code.replace(line, 'const {' + names.replace(/\bas\b/g, ':') +
        '} = loadProbeModule(' + JSON.stringify(dependency) + ');');
    }
    const exported = [];
    code = code.replace(/^export (?=(?:async )?(?:function|const) (\w+))/gm, (_, name) => {
      exported.push(name);
      return '';
    }).replace(/^export \{(\w+)\};$/gm, (_, name) => {
      exported.push(name);
      return '';
    });
    factories.set(file, '() => {\n' + code + '\nreturn {' + exported.join(',') + '};\n}');
  }
  await add(entryFile);
  const footer = await source(footerFile);
  modules[footerFile] = sha(footer);
  const declarations = Array.from(factories, ([file, factory]) => JSON.stringify(file) + ': ' + factory).join(',\n');
  const main = 'const factories = {\n' + declarations + '\n};\nconst loaded = new Map();\n' +
    'function loadProbeModule(file) { if (!loaded.has(file)) loaded.set(file, factories[file]()); return loaded.get(file); }\n' +
    'const PROBE_BUILD = ' + JSON.stringify(config) + ';\n' + footer;
  new vm.Script(main, {filename: footerFile});
  return {main, modules};
}

async function verify(preparationFile, pcVault, pcReport, ipadReport, relayMode) {
  const {suite, ids, tokens, buildSha256} = await readJson(preparationFile);
  const fixtures = await makeFixtures(suite, ids, tokens);
  const pc = await readJson(pcReport);
  const ipad = await readJson(ipadReport);
  const reports = [];
  for (const [role, report] of [['PC', pc], ['iPad', ipad]]) {
    assert.equal(report.suite, suite);
    assert.equal(report.role, role);
    assert.equal(report.buildSha256, buildSha256);
    assert.equal(report.version, 1);
    const expectedSeeds = rounds.flatMap(({fixture, sender}, i) => sender === role ? [[i + 1, fixtures[fixture]]] : []);
    const seedsMatch = report.seeds.length === expectedSeeds.length && expectedSeeds.every(([round, {name, bytes}], i) => {
      const seed = report.seeds[i];
      return seed.round === round && seed.name === name && seed.size === bytes.length && seed.sha256 === sha(bytes);
    });
    const checkpoints = [];
    for (const checkpoint of [...report.checkpoints, report.final]) {
      const entries = new Map();
      const files = [];
      for (const row of checkpoint.files ?? []) {
        if (row.kind !== 'file') {
          files.push(row);
          continue;
        }
        assert.match(row.hex, /^(?:[0-9a-f]{2})*$/);
        const bytes = Buffer.from(row.hex, 'hex');
        assert.equal(row.size, bytes.length);
        assert.equal(row.sha256, sha(bytes));
        assert.equal(entries.has(row.name), false);
        entries.set(row.name, bytes);
        files.push({name: row.name, size: bytes.length, sha256: sha(bytes)});
      }
      if (checkpoint.error) {
        checkpoints.push({round: checkpoint.round, pass: false, error: checkpoint.error, files});
        continue;
      }
      const result = await inspectSnapshot(suite, entries);
      assert.deepEqual(checkpoint.result, result);
      const pass = files.length === entries.size && matchesRound(checkpoint.round, entries, result, fixtures, ids);
      assert.equal(checkpoint.pass, pass);
      checkpoints.push({round: checkpoint.round, pass, files, result});
    }
    const expectedRounds = [0, ...rounds.flatMap(({sender}, i) => sender !== role ? [i + 1] : [])];
    const lastForRound = round => checkpoints.slice(0, -1).findLast(check => check.round === round);
    const deviceMatches = report.mobile === (role === 'iPad' && relayMode !== '--windows-local-relay');
    const pass = seedsMatch && deviceMatches &&
      expectedRounds.every(round => lastForRound(round)?.pass) && checkpoints.at(-1)?.pass;
    reports.push({role, obsidian: report.obsidian, mobile: report.mobile, nutstore: report.nutstore,
      seedsMatch, deviceMatches, pass, checkpoints});
  }
  const expected = Object.values(fixtures).sort((a, b) => a.name.localeCompare(b.name));
  const dir = path.posix.dirname(expected[0].name);
  const names = await fs.readdir(path.join(pcVault, dir)).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const pcDisk = [];
  for (const filename of names) {
    const name = dir + '/' + filename;
    const file = path.join(pcVault, name);
    const stat = await fs.lstat(file);
    pcDisk.push(stat.isFile() && stat.size <= 4096 ? {name, size: stat.size, sha256: sha(await fs.readFile(file))} :
      {name, size: stat.size, kind: 'skipped'});
  }
  const expectedDisk = expected.map(({name, bytes}) => ({name, size: bytes.length, sha256: sha(bytes)}));
  const diskMatches = json(pcDisk.sort((a, b) => a.name.localeCompare(b.name))) === json(expectedDisk);
  const installedBuild = await fs.readFile(path.join(pcVault, '.obsidian/plugins', probeId, 'main.js'));
  const pcBuildMatches = sha(installedBuild) === buildSha256;
  const pass = pcBuildMatches && diskMatches && reports.every(report => report.pass);
  console.log(json({suite, pass, relayMode: relayMode ?? 'device-receipts', reports, diskMatches, pcBuildMatches, pcDisk}));
  if (!pass) process.exitCode = 1;
}
