/** @typedef {{experience:string,recovery:string,published:string,activeBranch:string,runtimeVersion:string,syncMode:string}} BaselineRecord */
/** Validate explicit identities rather than guessing from folder names or HEAD.
 * @param {BaselineRecord} value
 */
export function validateBaselineRecord(value) {
  for (const key of /** @type {const} */ (['experience', 'recovery', 'published']))
    if (!/^[a-f0-9]{40}$/.test(value[key]))
      throw Error('baseline requires immutable commit: ' + key);
  if (value.activeBranch !== 'codex/baseline-convergence') throw Error('unexpected active branch');
  if (value.runtimeVersion !== '0.0.17' || value.syncMode !== 'one-switch')
    throw Error('unexpected product baseline');
}
