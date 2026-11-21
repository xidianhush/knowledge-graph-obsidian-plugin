// Release/default build must include exactly the host being accepted.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {graphHostBundle} from './build.mjs';
import {buildKnowledgeMapUnifiedCandidate} from './build_sync_a3_probe.mjs';
const expected=buildKnowledgeMapUnifiedCandidate(process.cwd(),graphHostBundle);
assert.equal(await fs.readFile('dist/main.js','utf8'),expected.main,'Default build must equal unified candidate, not recovery-only host');
console.log(JSON.stringify({pass:true,main:expected.pluginMainSha256,scope:'Default/CI entry equals accepted unified host generator'}));
