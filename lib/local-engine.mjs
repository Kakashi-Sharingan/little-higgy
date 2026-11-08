import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA = path.resolve(process.env.LITTLE_HIGGY_DATA_DIR || './little-higgy-data');
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
import { LocalError, imageGraph, validateGraph, validateInput, substitute } from './local-graph.mjs';
export { LocalError, imageGraph, validateGraph, validateInput } from './local-graph.mjs';
export function engineBase() {
  const url = new URL(process.env.COMFYUI_URL || 'http://127.0.0.1:8188');
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new LocalError('COMFYUI_URL must be a local HTTP address, for example http://127.0.0.1:8188.', 503);
  }
  return url.origin;
}
async function comfy(endpoint, init={}) {
  try {
    const res = await fetch(engineBase()+endpoint, {...init, signal: AbortSignal.timeout(20000)});
    if (!res.ok) { const text=await res.text(); throw new LocalError(`ComfyUI returned ${res.status}: ${text.slice(0,350)}`,502); }
    return res;
  } catch(e) {
    if (e instanceof LocalError) throw e;
    throw new LocalError('ComfyUI is not reachable. Start ComfyUI on this computer at http://127.0.0.1:8188, then reconnect.',503);
  }
}
async function json(endpoint, body) {
  return (await comfy(endpoint,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
}
async function setup() { await fs.mkdir(path.join(DATA,'jobs'),{recursive:true}); await fs.mkdir(path.join(DATA,'workflows'),{recursive:true}); }
async function write(file,obj) { await setup();const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(obj,null,2));await fs.rename(temp,file); }
function jobFile(id) { if(!ID.test(id))throw new LocalError('Invalid job ID.');return path.join(DATA,'jobs',id+'.json'); }
async function readJob(id) { try{return JSON.parse(await fs.readFile(jobFile(id),'utf8'));}catch(e){if(e.code==='ENOENT')throw new LocalError('Job not found.',404);throw e;} }
export async function workflows() {
  await setup();const all=[];
  for(const type of ['video','lipsync']) {try{const graph=JSON.parse(await fs.readFile(path.join(DATA,'workflows',type+'.json'),'utf8'));all.push({type,nodes:Object.keys(graph).length});}catch(e){if(e.code!=='ENOENT')throw e;}}
  return all;
}
export async function status() {
  const saved=await workflows();
  try {
    const [stats, info]=await Promise.all([json('/system_stats'),json('/object_info/CheckpointLoaderSimple')]);
    const checkpoints=info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
    return {connected:true,engine:engineBase(),checkpoints,workflows:saved,devices:(stats.devices||[]).map(x=>({name:x.name,type:x.type})),creditBased:false};
  } catch(e) {return {connected:false,engine:engineBase(),checkpoints:[],workflows:saved,message:e.message,creditBased:false};}
}
export async function saveWorkflow(type, graph) {
  if(!['video','lipsync'].includes(type))throw new LocalError('Choose a video or lip-sync workflow.');
  validateGraph(graph);
  await write(path.join(DATA,'workflows',type+'.json'),graph);
  return {ok:true};
}
export async function submit(data){
  const input=validateInput(data);
  if(input.width%64||input.height%64)throw new LocalError('Dimensions must be multiples of 64.');
  let imageName;
  if(input.image){const uploaded=await readUpload(input.image);imageName=uploaded.engineName;}
  let graph;
  if(input.kind==='image'||input.kind==='cinema'){
    const info=await status();if(!info.connected)throw new LocalError(info.message,503);
    if(!info.checkpoints.includes(input.checkpoint))throw new LocalError('Choose an installed SD 1.5 or SDXL checkpoint. Place its file in ComfyUI/models/checkpoints.');
    graph=imageGraph(input,imageName);
  }else{
    let template;try{template=JSON.parse(await fs.readFile(path.join(DATA,'workflows',input.kind+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')throw new LocalError(`Import a local ${input.kind} API workflow in Engine settings first.`);throw e;}
    graph=substitute(template,{prompt:input.prompt,negative_prompt:input.negative,seed:input.seed,width:input.width,height:input.height,frames:input.frames,fps:input.fps,image:imageName||''});
    validateGraph(graph);
    if(JSON.stringify(graph).match(/\{\{\w+\}\}/))throw new LocalError('Workflow contains an unresolved placeholder. Attach its required image or update the workflow.');
    const info=await json('/object_info');for(const node of Object.values(graph)){if(!info[node.class_type])throw new LocalError(`Install the local ComfyUI node ${node.class_type} first.`);if(info[node.class_type].api_node)throw new LocalError('Paid API nodes are not supported.');}
  }
  const id=crypto.randomUUID();
  const result=await json('/prompt',{prompt:graph,client_id:'little-higgy'});
  if(!result.prompt_id)throw new LocalError('ComfyUI did not accept the workflow.',502);
  const record={id,engineId:result.prompt_id,kind:input.kind,prompt:input.prompt,createdAt:new Date().toISOString(),status:'queued',favorite:false,seed:input.seed,width:input.width,height:input.height,model:input.checkpoint||'Local workflow',outputs:[]};
  await write(jobFile(id),record);return record;
}
export async function job(id){
  let record=await readJob(id);if(['completed','failed'].includes(record.status))return record;
  let history;try{history=await json('/history/'+encodeURIComponent(record.engineId));}catch{return record;}
  const run=history[record.engineId];if(!run)return record;
  if(run.status?.status_str==='error'){
    const detail=(run.status.messages||[]).find(x=>x[0]==='execution_error')?.[1];
    record={...record,status:'failed',error:detail?.exception_message||'The local workflow failed. Check the ComfyUI console.'};
  }else{
    const outputs=[];
    for(const node of Object.values(run.outputs||{}))for(const category of ['images','gifs','videos','audio'])for(const item of node[category]||[]){
      if(typeof item.filename==='string')outputs.push({filename:item.filename,subfolder:item.subfolder||'',type:item.type||'output',media: /\.(mp4|webm|mov|mkv)$/i.test(item.filename)?'video':/\.(wav|mp3|flac)$/i.test(item.filename)?'audio':'image'});
    }
    if(outputs.length)record={...record,status:'completed',outputs};
    else if(run.status?.completed)record={...record,status:'failed',error:'Workflow completed without a saved image or video. Add SaveImage, SaveVideo or VHS_VideoCombine.'};
    else record={...record,status:'running'};
  }
  await write(jobFile(id),record);return record;
}
export async function history(){await setup();const all=[];for(const file of await fs.readdir(path.join(DATA,'jobs'))){if(!file.endsWith('.json'))continue;const item=JSON.parse(await fs.readFile(path.join(DATA,'jobs',file),'utf8'));all.push(item);}return all.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
export async function favorite(id,value){const record=await readJob(id);record.favorite=!!value;await write(jobFile(id),record);return record;}
export async function output(id,index){const record=await readJob(id);const media=record.outputs[index];if(!media)throw new LocalError('Output not found.',404);return {response:await comfy('/view?'+new URLSearchParams({filename:media.filename,subfolder:media.subfolder,type:media.type})),filename:media.filename};}
async function readUpload(id){if(!ID.test(id))throw new LocalError('Invalid upload.');try{return JSON.parse(await fs.readFile(path.join(DATA,'upload-'+id+'.json'),'utf8'));}catch{throw new LocalError('Reference image no longer exists. Upload it again.');}}
export async function upload(file){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new LocalError('Choose a PNG, JPEG or WebP image under 20 MB.');
  const id=crypto.randomUUID(),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
  const form=new FormData();form.append('image',file,`little-higgy-${id}.${ext}`);form.append('type','input');form.append('overwrite','false');
  const result=await (await comfy('/upload/image',{method:'POST',body:form})).json();
  if(!result.name)throw new LocalError('ComfyUI did not return an upload name.',502);
  const record={id,engineName:result.subfolder?result.subfolder+'/'+result.name:result.name};
  await write(path.join(DATA,'upload-'+id+'.json'),record);return {id};
}
