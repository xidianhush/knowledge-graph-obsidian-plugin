// Snapshot CURRENT tracked and untracked source, never old HEAD or user data.
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),base=path.join(root,'.local/sync-016/g6');await fs.mkdir(base,{recursive:true});
const out=await fs.mkdtemp(path.join(base,'workspace-'));
const names=['src','scripts','upstream','prototypes','docs','tests','test','assets','styles.css','package.json','package-lock.json','manifest.json','versions.json','README.md','AGENTS.md','TODO.md','DEVELOPMENT.md'];
for(const name of names){try{await fs.cp(path.join(root,name),path.join(out,name),{recursive:true,errorOnExist:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
await fs.writeFile(path.join(out,'G6-WORKSPACE.json'),JSON.stringify({root,out,scope:'Current source allowlist, includes untracked source. No .git/.local/profiles/vaults/credentials. Isolated test outputs only.'},null,2));
console.log(out);
