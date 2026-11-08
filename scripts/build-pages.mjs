import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

// Static Pages builds use the browser-local ComfyUI adapter. Move server routes
// out of the Next app only while building, restoring them even after failure.
const route=path.resolve('app/api');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'little-higgy-pages-'));
const backup=path.join(temporary,'api');
let moved=false;
try{
 await fs.cp(route,backup,{recursive:true});
 await fs.rm(route,{recursive:true});
 moved=true;
 const next=path.resolve('node_modules/next/dist/bin/next');
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[next,'build'],{stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_LITTLE_HIGGY_PAGES:'1'}});
  child.on('error',reject);child.on('close',resolve);
 });
 if(code!==0)throw new Error(`Static build failed with exit code ${code}`);
 await fs.writeFile('out/.nojekyll','');
}finally{
 if(moved)await fs.cp(backup,route,{recursive:true});
 await fs.rm(temporary,{recursive:true,force:true});
}
