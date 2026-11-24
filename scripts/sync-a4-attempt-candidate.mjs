import {attemptDirectory, inspectAttempts, makeAttempt} from './sync-a4-attempt-prototype.mjs';

export const probeId = 'knowledge-map-sync-a4-attempt';
export const vaultName = role => 'Knowledge Map A4 Attempt ' + role;
export const roles = ['PC', 'iPad'];
export const rounds = [
  {fixture: 'child', sender: 'PC', label: '后继先到'},
  {fixture: 'partial', sender: 'iPad', label: '截断正文'},
  {fixture: 'retry', sender: 'iPad', label: '完整重试'},
  {fixture: 'rival', sender: 'PC', label: '同 ID 不同正文'},
];

export async function sha256(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(hash));
}

export function toHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function makeFixtures(suite, ids, tokens) {
  const [parent, child] = ids;
  const operation = (id, note, parents = []) => ({
    protocol: 2, layoutSchema: 3, vault: suite, id, parents,
    changes: [{group: JSON.stringify(['note', note + '.md', '']), value: null}],
    structures: {},
  });
  const original = operation(parent, '甲');
  const [childFile, partial, retry, rival] = await Promise.all([
    makeAttempt(suite, operation(child, '甲', [parent]), tokens[0]),
    makeAttempt(suite, original, tokens[1]),
    makeAttempt(suite, original, tokens[2]),
    makeAttempt(suite, operation(parent, '乙'), tokens[3]),
  ]);
  // End after the first byte of 甲, preserving an exact prefix of the complete UTF-8 body.
  const split = partial.bytes.findIndex(byte => byte >= 0xe0) + 1;
  return {child: childFile, partial: {...partial, bytes: partial.bytes.slice(0, split)}, retry, rival};
}

export async function inspectSnapshot(suite, entries) {
  const result = await inspectAttempts({
    list: () => [...entries.keys()],
    read(name, budget) {
      const bytes = entries.get(name);
      if (bytes && bytes.length > budget) throw Error('snapshot-byte-budget');
      return bytes;
    },
  }, suite);
  return {
    transportReady: result.transportReady,
    blockers: result.blockers,
    superseded: result.superseded,
    ready: result.index.ready.map(op => op.id),
    pending: result.index.pending,
    quarantined: result.index.quarantined,
    issues: result.index.issues,
  };
}

export function expectedResult(round, fixtures, [parent, child]) {
  return {
    transportReady: round !== 2,
    blockers: round === 2 ? [{name: fixtures.partial.name, reason: 'unverified-bytes'}] : [],
    superseded: round >= 3 ? [fixtures.partial.name] : [],
    ready: round === 3 ? [parent, child] : [],
    pending: [1, 2, 4].includes(round) ? [{id: child, reason: 'missing-or-cyclic-dependency', missing: [parent]}] : [],
    quarantined: round === 4 ? [parent] : [],
    issues: [],
  };
}

export function matchesRound(round, entries, result, fixtures, ids) {
  const expected = rounds.slice(0, round).map(({fixture}) => fixtures[fixture]);
  return entries.size === expected.length &&
    expected.every(({name, bytes}) => {
      const actual = entries.get(name);
      return actual?.length === bytes.length && bytes.every((byte, i) => actual[i] === byte);
    }) && JSON.stringify(result) === JSON.stringify(expectedResult(round, fixtures, ids));
}

export {attemptDirectory};
