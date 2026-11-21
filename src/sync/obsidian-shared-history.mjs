import {CAUSAL_PROTOTYPE_LIMITS} from './causal-prototype.mjs';

const encoder = new TextEncoder();

export function sharedOperationDirectory(vault) {
  if (typeof vault !== 'string' || !/^[a-f0-9]{32}$/.test(vault)) throw Error('history-vault');
  return `Knowledge Map Sync/v2/${vault}/ops`;
}

export function createReadOnlyLayoutHistory(adapter, vault, message = code => code) {
  const directory = sharedOperationDirectory(vault);
  const prefix = directory + '/';
  function check(condition, code) { if (!condition) throw Error(message(code)); }
  function inScope(name) {
    return typeof name === 'string' && name.startsWith(prefix) &&
      /^[^./\\:\u0000-\u001f\u007f][^/\\:\u0000-\u001f\u007f]{0,239}\.json$/i.test(name.slice(prefix.length));
  }
  return {
    async list(path) {
      check(path === directory, 'historyScope');
      check((await adapter.stat(path))?.type === 'folder', 'historyMissing');
      const {files, folders} = await adapter.list(path);
      check(!folders.length, 'historyScope');
      const json = files.filter(name => /\.json$/i.test(name));
      check(json.every(inScope) && new Set(json).size === json.length, 'historyScope');
      return json;
    },
    async read(path, limit) {
      check(inScope(path), 'historyScope');
      check(Number.isSafeInteger(limit) && limit >= 0 && limit <= CAUSAL_PROTOTYPE_LIMITS.recordBytes, 'size');
      const stat = await adapter.stat(path);
      if (!stat) return null;
      check(stat.type === 'file' && Number.isSafeInteger(stat.size) && stat.size >= 0 && stat.size <= limit, 'size');
      const text = await adapter.read(path);
      check(typeof text === 'string' && encoder.encode(text).length <= limit, 'size');
      return text;
    },
    create() { throw Error(message('historyReadOnly')); },
  };
}
