import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, encodeGraphPayload } from '../dist/pipeline.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'.local/pipeline-golden'), report=[];
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
function differences(a,b,p='$',out=[]){
  if(typeof a==='number'&&typeof b==='number'){
    // Rounded output can differ by one final decimal unit when libm differs.
    // Geometry threshold is tighter than the 1e-4 minimum radius; other numeric
    // values are compared relative to magnitude, never to node counts/ids.
    const geometric=/\.(x|y|r)$/.test(p),tol=geometric?1.01e-9:1e-10*Math.max(1,Math.abs(a),Math.abs(b));
    if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>tol)out.push({path:p,expected:a,actual:b});return out;
  }
  if(a===b)return out;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){out.push({path:p,expected:a,actual:b});return out;}
  if(Array.isArray(a)!==Array.isArray(b)){out.push({path:p,expected:'array/object',actual:'type mismatch'});return out;}
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  for(const key of keys){if(!Object.hasOwn(a,key)||!Object.hasOwn(b,key))out.push({path:p+'.'+key,expected:a[key],actual:b[key]});else differences(a[key],b[key],p+'.'+key,out);}
  return out;
}
for(const item of manifest.fixtures){
  const fixture=JSON.parse(fs.readFileSync(path.join(dir,item.name+'.json'),'utf8'));
  const before=JSON.stringify(fixture.input);const start=performance.now();
  const actual=buildGraph(fixture.input),elapsed=performance.now()-start;
  const diff=differences(fixture.expected,actual);
  differences(fixture.encoded,encodeGraphPayload(actual),'$.encoded',diff);
  if(JSON.stringify(fixture.input)!==before)diff.push({path:'input',reason:'mutated'});
  const again=buildGraph({...fixture.input,files:[...fixture.input.files].reverse()});
  if(JSON.stringify(again)!==JSON.stringify(actual))diff.push({path:'determinism',reason:'input file enumeration changed output'});
  fs.writeFileSync(path.join(dir,item.name+'.actual.json'),JSON.stringify(actual));
  const row={name:item.name,nodes:actual.nodes.length,edges:actual.edges.length,milliseconds:Math.round(elapsed),differences:diff.length,first:diff.slice(0,8)};
  report.push(row);console.log(JSON.stringify(row));
}
fs.mkdirSync(path.join(root,'.local/evidence'),{recursive:true});
fs.writeFileSync(path.join(root,'.local/evidence/pipeline-golden-results.json'),JSON.stringify(report,null,2));
if(report.some(r=>r.differences))process.exitCode=1;
else console.log('PIPELINE_GOLDEN_RESULT '+JSON.stringify({fixtures:report.length,errors:[]}));
