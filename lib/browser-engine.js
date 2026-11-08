'use client';
// GitHub Pages has no backend. This adapter talks only to the visitor's local
// ComfyUI installation. History and workflow metadata stay in this browser.
import { imageGraph, validateGraph, validateInput, substitute } from './local-graph.mjs';
const BASE='http://127.0.0.1:8188';
const KEY='little-higgy:pages:v1';
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{"jobs":[],"workflows":{},"uploads":{}}');}catch{throw new Error('Local browser storage is unavailable. Allow site storage or run the Windows edition.');}}
function save(state){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{throw new Error('Could not save local browser history. Free site storage or use the Windows edition.');}}
async function comfy(route,init={}){
 let response;
 try{response=await fetch(BASE+route,{...init,signal:AbortSignal.timeout(20000)});}catch{throw new Error('Cannot reach local ComfyUI. Start it on port 8188 with this site’s CORS origin allowed, then permit local-network access if your browser asks.');}
 if(!response.ok){const text=await response.text();throw new Error(`ComfyUI ${response.status}: ${text.slice(0,300)}`);}return response;
}
async function json(route,body){return (await comfy(route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();}
function getJob(state,id){const job=state.jobs.find(x=>x.id===id);if(!job)throw new Error('Job not found in this browser.');return job;}
export function browserMediaUrl(job,index=0){const item=job.outputs[index];return BASE+'/view?'+new URLSearchParams({filename:item.filename,subfolder:item.subfolder||'',type:item.type||'output'});}
export async function browserUpload(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('Choose a PNG, JPEG or WebP under 20 MB.');
 const id=crypto.randomUUID();const form=new FormData();form.append('image',file,'little-higgy-'+id+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type]));form.append('type','input');form.append('overwrite','false');
 const result=await (await comfy('/upload/image',{method:'POST',body:form})).json();if(!result.name)throw new Error('ComfyUI did not return an image filename.');
 const state=load();state.uploads[id]=result.subfolder?result.subfolder+'/'+result.name:result.name;save(state);return {id};
}
export async function browserApi(route,body){
 if(route==='status'){
  const state=load();const workflows=Object.entries(state.workflows).map(([type,graph])=>({type,nodes:Object.keys(graph).length}));
  try{const [stats,info]=await Promise.all([json('/system_stats'),json('/object_info/CheckpointLoaderSimple')]);return {connected:true,engine:BASE,checkpoints:info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]||[],workflows,devices:stats.devices||[],creditBased:false};}
  catch(e){return {connected:false,engine:BASE,checkpoints:[],workflows,creditBased:false,message:e.message};}
 }
 const state=load();
 if(route==='jobs')return [...state.jobs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 if(route==='favorite'){const job=getJob(state,body.id);job.favorite=!!body.value;save(state);return job;}
 if(route==='workflow'){if(!['video','lipsync'].includes(body.type))throw new Error('Unsupported workflow type.');state.workflows[body.type]=validateGraph(body.graph);save(state);return {ok:true};}
 if(route==='generate'){
  const input=validateInput(body);if(input.width%64||input.height%64)throw new Error('Dimensions must be multiples of 64.');
  const imageName=input.image?state.uploads[input.image]:undefined;if(input.image&&!imageName)throw new Error('Reference image expired. Upload it again.');
  let graph;
  if(['image','cinema'].includes(input.kind)){
   const info=await json('/object_info/CheckpointLoaderSimple');const checkpoints=info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]||[];
   if(!checkpoints.includes(input.checkpoint))throw new Error('Choose an installed SD 1.5 or SDXL checkpoint.');graph=imageGraph(input,imageName);
  }else{
   const template=state.workflows[input.kind];if(!template)throw new Error('Import a compatible local workflow in Engine settings first.');
   graph=substitute(template,{prompt:input.prompt,negative_prompt:input.negative,seed:input.seed,width:input.width,height:input.height,frames:input.frames,fps:input.fps,image:imageName||''});validateGraph(graph);
   if(/\{\{\w+\}\}/.test(JSON.stringify(graph)))throw new Error('Workflow has unresolved placeholders. Attach its reference or update the workflow.');
   const info=await json('/object_info');for(const node of Object.values(graph)){if(!info[node.class_type])throw new Error(`Install the local ${node.class_type} node first.`);if(info[node.class_type].api_node)throw new Error('Paid API nodes are not supported.');}
  }
  const result=await json('/prompt',{prompt:graph,client_id:'little-higgy-pages'});if(!result.prompt_id)throw new Error('ComfyUI did not accept the workflow.');
  const job={id:crypto.randomUUID(),engineId:result.prompt_id,kind:input.kind,prompt:input.prompt,createdAt:new Date().toISOString(),status:'queued',favorite:false,seed:input.seed,width:input.width,height:input.height,model:input.checkpoint||'Local workflow',outputs:[]};
  const latest=load();latest.jobs.unshift(job);save(latest);return job;
 }
 if(route.startsWith('jobs/')){
  const job=getJob(state,route.slice(5));if(['completed','failed'].includes(job.status))return job;
  let history;try{history=await json('/history/'+encodeURIComponent(job.engineId));}catch{return job;}
  const run=history[job.engineId];if(!run)return job;
  if(run.status?.status_str==='error'){job.status='failed';job.error=(run.status.messages||[]).find(x=>x[0]==='execution_error')?.[1]?.exception_message||'Local generation failed. Check ComfyUI.';}
  else{
   const outputs=[];for(const node of Object.values(run.outputs||{}))for(const category of ['images','gifs','videos','audio'])for(const item of node[category]||[])if(item.filename)outputs.push({filename:item.filename,subfolder:item.subfolder||'',type:item.type||'output',media:/\.(mp4|webm|mov|mkv)$/i.test(item.filename)?'video':/\.(wav|mp3|flac)$/i.test(item.filename)?'audio':'image'});
   if(outputs.length){job.status='completed';job.outputs=outputs;}else if(run.status?.completed){job.status='failed';job.error='Workflow completed without saved media. Add an output-saving node.';}else job.status='running';
  }
  const latest=load();const index=latest.jobs.findIndex(x=>x.id===job.id);if(index!==-1){job.favorite=latest.jobs[index].favorite;latest.jobs[index]=job;}save(latest);return job;
 }
 throw new Error('Unsupported local operation.');
}
