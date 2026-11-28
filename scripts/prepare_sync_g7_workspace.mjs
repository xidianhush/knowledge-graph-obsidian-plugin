// Current working source including untracked implementations, never old HEAD.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),base=path.join(root,'.local/sync-016/g7');await fs.mkdir(base,{recursive:true});
const out=await fs.mkdtemp(path.join(base,'workspace-'));
for(const name of ['src','scripts','upstream','prototypes','docs','tests','test','assets','styles.css','package.json','package-lock.json','manifest.json','versions.json','README.md','AGENTS.md','TODO.md','DEVELOPMENT.md']){
 try{await fs.cp(path.join(root,name),path.join(out,name),{recursive:true,errorOnExist:true});}catch(e){if(e.code!=='ENOENT')throw e;}
}
const legacy={};
for(const name of ['main.js','manifest.json','styles.css']){
 const file=path.join(root,'.local/release/0.0.15',name),bytes=await fs.readFile(file);
 legacy[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 await fs.mkdir(path.join(out,'.local/g7-legacy-0.0.15'),{recursive:true});await fs.copyFile(file,path.join(out,'.local/g7-legacy-0.0.15',name),fs.constants.COPYFILE_EXCL);
}
const expected={'main.js':'8801c3a3e5c2d96fcd6d230e8b703eac8472ac815e677e915c81c23249411391','manifest.json':'67f707c580bb80580bffd0c005e719292d887c346883f3c708b440bbd4ae0b43','styles.css':'50e33695e56f27070669d219d9ecf9d64f76e2359f1de1fa38fa42e30a4adb56'};
for(const [name,hash]of Object.entries(expected))if(legacy[name].sha256!==hash)throw Error('legacy-release-mismatch:'+name);
const g5=await fs.readFile(path.join(root,'.local/sync-016/g7/workspace-wliwN1/.local/g7-legacy-g5-main.js'));
if(createHash('sha256').update(g5).digest('hex')!=='97b9e0b6403afe0f897f02f0cc2f45af23a52bcd70fd482d5591c4d7cbcb35f2')throw Error('legacy-g5-mismatch');
await fs.writeFile(path.join(out,'.local/g7-legacy-g5-main.js'),g5,{flag:'wx'});
await fs.writeFile(path.join(out,'G7-WORKSPACE.json'),JSON.stringify({root,out,legacy,scope:'Current source allowlist and exact locally archived 0.0.15 public assets only; no user vault/profile/credentials or accepted evidence copied.'},null,2));
console.log(out);
