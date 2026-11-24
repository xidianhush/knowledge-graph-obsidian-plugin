import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {attemptDirectory, inspectAttempts, makeAttempt} from './sync-a4-attempt-prototype.mjs';
import {CAUSAL_PROTOTYPE_LIMITS as limits} from '../src/sync/causal-prototype.mjs';

const [mode, sharedPath, outbox, count] = process.argv.slice(2);
if (mode === 'worker') {
  const bytes = await fs.readFile(outbox);
  const file = await fs.open(sharedPath, 'w');
  try {
    await file.writeFile(bytes.subarray(0, Number(count)));
    await file.sync();
  } finally {
    await file.close();
  }
  console.log('ready');
  setInterval(() => {}, 1000);
} else {
  await run();
}

async function run() {
  const base = path.resolve('.local/sync-016/a4');
  await fs.mkdir(base, {recursive: true});
  const output = await fs.mkdtemp(path.join(base, 'attempt-design-'));
  const checks = [];
  const vault = 'a'.repeat(32);
  const id = n => n.toString(16).padStart(32, '0');
  const nonce = () => randomBytes(16).toString('hex');
  const group = name => JSON.stringify(['note', name + '.md', '']);
  const operation = (n, note, parents = []) => ({
    protocol: 2, layoutSchema: 3, vault, id: id(n), parents: parents.map(id),
    changes: [{group: group(note), value: null}], structures: {},
  });

  async function test(label, exercise) {
    const root = await fs.mkdtemp(path.join(output, 'case-'));
    const absolute = name => path.join(root, name);
    const dir = attemptDirectory(vault);
    await fs.mkdir(absolute(dir), {recursive: true});
    const store = {
      async list() { return (await fs.readdir(absolute(dir))).map(name => dir + '/' + name); },
      async read(name, budget) {
        const stat = await fs.stat(absolute(name));
        if (stat.size > budget) throw Error('fixture-read-budget');
        return fs.readFile(absolute(name));
      },
    };
    const inspect = () => inspectAttempts(store, vault);
    const put = (file, bytes = file.bytes) => fs.writeFile(absolute(file.name), bytes);
    try {
      const detail = await exercise({inspect, absolute, put, store});
      checks.push({label, ...detail});
    } catch (error) {
      await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({checks, failed: label, error: String(error.stack)}, null, 2));
      throw error;
    }
  }
  const attempt = (op, token = nonce()) => makeAttempt(vault, op, token);
  const ready = result => result.index.ready.map(op => op.id);
  const original = operation(1, '甲');
  const rival = operation(1, '乙');
  const successor = operation(2, '甲', [1]);

  await test('Same logical ID, different full body: both bytes survive and the descendant waits', async ({inspect, absolute, put}) => {
    const token = nonce();
    const a = await attempt(original, token);
    const b = await attempt(rival, token);
    const child = await attempt(successor);
    assert.notEqual(a.name, b.name);
    await Promise.all([a, b, child].map(file => put(file)));
    const result = await inspect();
    assert.deepEqual(result.blockers, []);
    assert.deepEqual(result.index.quarantined, [id(1)]);
    assert.equal(result.index.pending.length, 1);
    assert.deepEqual(ready(result), []);
    assert.deepEqual(await fs.readFile(absolute(a.name)), Buffer.from(a.bytes));
    assert.deepEqual(await fs.readFile(absolute(b.name)), Buffer.from(b.bytes));
  });

  await test('Two physical attempts for the same canonical body remain one logical operation', async ({inspect, put}) => {
    const a = await attempt(original);
    const b = await attempt(Object.fromEntries(Object.entries(original).reverse()));
    assert.notEqual(a.name, b.name);
    assert.deepEqual(a.bytes, b.bytes);
    await Promise.all([put(a), put(b)]);
    const result = await inspect();
    assert.deepEqual(result.blockers, []);
    assert.deepEqual(result.index.issues, []);
    assert.deepEqual(ready(result), [id(1)]);
  });

  await test('A terminated writer leaves an incomplete UTF-8 file; retry from the same outbox recovers without replacing it', async ({inspect, absolute, put}) => {
    const a = await attempt(original);
    const local = absolute('private-outbox.json');
    const split = a.bytes.findIndex(byte => byte >= 0xe0) + 1;
    assert.ok(split > 1 && split < a.bytes.length);
    await fs.writeFile(local, a.bytes);
    const pid = await stopWriter(absolute(a.name), local, split);
    const prefix = await fs.readFile(absolute(a.name));
    assert.deepEqual(prefix, Buffer.from(a.bytes.slice(0, split)));
    await put(await attempt(successor));
    const before = await inspect();
    assert.equal(before.transportReady, false);
    assert.deepEqual(ready(before), []);
    assert.equal(before.index.pending.length, 1);
    assert.equal(before.blockers[0].reason, 'unverified-bytes');
    const b = await attempt(JSON.parse(await fs.readFile(local, 'utf8')));
    assert.notEqual(a.name, b.name);
    await put(b);
    const after = await inspect();
    assert.equal(after.transportReady, true);
    assert.deepEqual(after.blockers, []);
    assert.deepEqual(after.superseded, [a.name]);
    assert.deepEqual(ready(after), [id(1), id(2)]);
    assert.deepEqual(await fs.readFile(absolute(a.name)), prefix);
    return {pid, interruptedAtByte: split};
  });

  await test('A complete attempt survives a killed writer and is recognized by a new scan', async ({inspect, absolute}) => {
    const a = await attempt(original);
    const local = absolute('private-outbox.json');
    await fs.writeFile(local, a.bytes);
    const pid = await stopWriter(absolute(a.name), local, a.bytes.length);
    const result = await inspect();
    assert.deepEqual(result.blockers, []);
    assert.deepEqual(ready(result), [id(1)]);
    return {pid};
  });

  await test('A complete retry cannot cover arbitrary corruption or an incomplete competing body', async ({inspect, put}) => {
    const a = await attempt(original);
    const b = await attempt(original);
    const c = await attempt(rival);
    const bad = a.bytes.slice(0, 6);
    bad[2] ^= 1;
    await put(a, bad);
    await put(b);
    await put(c, c.bytes.slice(0, 6));
    const result = await inspect();
    assert.equal(result.transportReady, false);
    assert.deepEqual(ready(result), [id(1)]);
    assert.deepEqual(result.superseded, []);
    assert.equal(result.blockers.length, 2);
    assert.ok(result.blockers.every(blocker => blocker.reason === 'unverified-bytes'));
  });

  await test('Names, canonical encoding and logical vault are verified independently of the hash', async ({inspect, put, absolute}) => {
    const a = await attempt(original);
    const pretty = Buffer.from(JSON.stringify(original, null, 2));
    const foreign = Buffer.from(JSON.stringify({...original, vault: 'b'.repeat(32)}));
    const replaceHash = (name, bytes) => name.replace(/\.[a-f0-9]{64}\./, '.' + createHash('sha256').update(bytes).digest('hex') + '.');
    await put({...a, name: replaceHash(a.name, pretty)}, pretty);
    await put({...a, name: replaceHash(a.name, foreign)}, foreign);
    await put({...a, name: a.name.replace('/' + id(1) + '.', '/' + id(2) + '.')});
    await fs.writeFile(absolute(attemptDirectory(vault) + '/unknown-conflict.json'), a.bytes);
    const result = await inspect();
    assert.deepEqual(ready(result), []);
    assert.equal(result.blockers.filter(row => row.reason === 'invalid-complete-body').length, 3);
    assert.equal(result.blockers.filter(row => row.reason === 'unknown-file-name').length, 1);
  });

  await test('Unstable listings and file budgets fail closed before an oversized read', async ({store, inspect, put}) => {
    const a = await attempt(original);
    const vanished = await inspectAttempts({list: () => [a.name], read: () => null}, vault);
    assert.equal(vanished.blockers[0].reason, 'file-vanished');
    await assert.rejects(inspectAttempts({list: () => [a.name, a.name]}, vault), /duplicate-listing/);
    await assert.rejects(inspectAttempts({list: () => Array(limits.operations + 1).fill(a.name)}, vault), /file-budget/);
    await put(a, Buffer.alloc(limits.recordBytes + 1));
    await assert.rejects(inspect(), /fixture-read-budget/);
    assert.equal((await store.list()).length, 1);
  });

  await test('Negative control: an overwrite-capable writer still replaces a forced identical physical path', async ({absolute, inspect, put}) => {
    const a = await attempt(original);
    const competingBytes = Buffer.from('independent bytes at the exact path');
    const local = absolute('private-outbox.json');
    await fs.writeFile(local, a.bytes);
    await put(a, competingBytes);
    assert.deepEqual(await fs.readFile(absolute(a.name)), competingBytes);
    const pid = await stopWriter(absolute(a.name), local, a.bytes.length);
    assert.deepEqual(await fs.readFile(absolute(a.name)), Buffer.from(a.bytes));
    assert.deepEqual(ready(await inspect()), [id(1)]);
    return {pid, strictNoReplace: false};
  });

  const evidence = path.join(output, 'verification.json');
  await fs.writeFile(evidence, JSON.stringify({checks, strictNoReplace: false, platform: process.platform, node: process.version}, null, 2));
  console.log(checks.length + ' attempt-transport cases: ' + evidence);
}

async function stopWriter(target, outbox, length) {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'worker', target, outbox, String(length)],
    {windowsHide: true, stdio: ['ignore', 'pipe', 'inherit']});
  const exit = once(child, 'exit');
  try {
    const [message] = await Promise.race([
      once(child.stdout, 'data'),
      exit.then(() => { throw Error('worker exited before writing'); }),
      sleep(5000, null, {ref: false}).then(() => { throw Error('worker did not report a write'); }),
    ]);
    assert.equal(message.toString().trim(), 'ready');
    assert.equal(child.kill('SIGKILL'), true);
    const [code, signal] = await exit;
    assert.equal(code, null);
    assert.equal(signal, 'SIGKILL');
    return child.pid;
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}
