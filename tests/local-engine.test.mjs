import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const data=await fs.mkdtemp(path.join(os.tmpdir(),'little-higgy-test-'));
process.env.LITTLE_HIGGY_DATA_DIR=data;
const prompts=[];
let terminal=false;
const server=http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const send=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(req.url==='/system_stats')return send({devices:[{name:'Test CPU',type:'cpu'}]});
 if(req.url==='/object_info/CheckpointLoaderSimple')return send({CheckpointLoaderSimple:{input:{required:{ckpt_name:[['test-sd15.safetensors']]}}}});
 if(req.url==='/object_info')return send({SaveVideo:{api_node:false},CLIPTextEncode:{api_node:false}});
 if(req.url==='/prompt'){prompts.push(JSON.parse(Buffer.concat(chunks)));return send({prompt_id:'test-'+prompts.length});}
 if(req.url.startsWith('/history/')){
  const id=req.url.split('/').at(-1);
  if(id==='test-3')return send({[id]:{status:{status_str:'error',messages:[['execution_error',{exception_message:'Insufficient local GPU memory'}]]}}});
  return send(terminal?{[id]:{status:{completed:true},outputs:{'7':{images:[{filename:'test.png',subfolder:'',type:'output'}]}}}}:{});
 }
 if(req.url==='/upload/image')return send({name:'test-reference.png',subfolder:'little-higgy'});
 if(req.url.startsWith('/view?')){res.writeHead(200,{'Content-Type':'image/png'});return res.end(Buffer.from([137,80,78,71]));}
 send({error:'unexpected request'},404);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
process.env.COMFYUI_URL=`http://127.0.0.1:${server.address().port}`;
const engine=await import('../lib/local-engine.mjs');
test.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(data,{recursive:true,force:true});});

test('local engine lists installed checkpoints without a provider key',async()=>{
 const result=await engine.status();assert.equal(result.connected,true);assert.equal(result.creditBased,false);assert.deepEqual(result.checkpoints,['test-sd15.safetensors']);
});
test('paid remote engines and credential-bearing URLs are rejected',()=>{
 const previous=process.env.COMFYUI_URL;
 try{for(const bad of ['https://api.kie.ai','http://127.0.0.1:8188/?key=secret','http://user:pass@localhost:8188']){process.env.COMFYUI_URL=bad;assert.throws(()=>engine.engineBase(),/local HTTP/);}}
 finally{process.env.COMFYUI_URL=previous;}
});
test('image workflow uses SD checkpoint, actual prompt and deterministic seed',()=>{
 const g=engine.imageGraph({prompt:'a forest',checkpoint:'test.safetensors',width:512,height:768,steps:22,cfg:6,seed:123});
 assert.equal(g['1'].inputs.ckpt_name,'test.safetensors');assert.equal(g['2'].inputs.text,'a forest');assert.equal(g['5'].inputs.seed,123);assert.equal(g['4'].inputs.height,768);
 const edit=engine.imageGraph({prompt:'a forest',checkpoint:'test.safetensors',width:512,height:512,seed:123},'local.png');
 assert.equal(edit['9'].inputs.image,'local.png');assert.deepEqual(edit['5'].inputs.latent_image,['8',0]);assert.equal(edit['5'].inputs.denoise,.7);assert.equal(edit['4'],undefined);
});
test('workflow import rejects canvas JSON, cloud nodes and credentials',async()=>{
 assert.throws(()=>engine.validateGraph({nodes:[]}),/API format/);
 assert.throws(()=>engine.validateGraph({'1':{class_type:'PaidCloudAPI',inputs:{}}}),/Unsupported/);
 assert.throws(()=>engine.validateGraph({'1':{class_type:'SaveImage',inputs:{api_key:'secret'}}}),/credentials/);
 assert.throws(()=>engine.validateGraph({'1':{class_type:'CLIPTextEncode',inputs:{text:'https://api.example.com'}}}),/credentials/);
});
test('submit, pending poll, completed poll, favorites and output use local HTTP',async()=>{
 const record=await engine.submit({kind:'image',prompt:'a quiet forest',checkpoint:'test-sd15.safetensors',seed:99});
 assert.equal(record.status,'queued');assert.equal(prompts.length,1);assert.equal(prompts[0].prompt['5'].inputs.seed,99);
 assert.equal((await engine.job(record.id)).status,'queued');
 terminal=true;const done=await engine.job(record.id);assert.equal(done.status,'completed');assert.equal(done.outputs[0].filename,'test.png');
 await engine.favorite(record.id,true);assert.equal((await engine.history())[0].favorite,true);
 const media=await engine.output(record.id,0);assert.equal(media.response.headers.get('content-type'),'image/png');assert.equal((await media.response.arrayBuffer()).byteLength,4);
 await assert.rejects(()=>engine.output(record.id,99),/not found/);
});
test('imported workflow substitutes typed placeholders before submitting',async()=>{
 await engine.saveWorkflow('video',{'1':{class_type:'CLIPTextEncode',inputs:{text:'{{prompt}}',seed:'{{seed}}'}},'2':{class_type:'SaveVideo',inputs:{filename_prefix:'LittleHiggy'}}});
 const record=await engine.submit({kind:'video',prompt:'sunrise',seed:42});assert.equal(record.kind,'video');assert.equal(prompts[1].prompt['1'].inputs.text,'sunrise');assert.equal(prompts[1].prompt['1'].inputs.seed,42);
});
test('local engine failure is terminal and exposes useful failure state',async()=>{
 const record=await engine.submit({kind:'image',prompt:'test',checkpoint:'test-sd15.safetensors'});
 const result=await engine.job(record.id);assert.equal(result.status,'failed');assert.match(result.error,/GPU memory/);
});
test('invalid input and absent model do not submit jobs',async()=>{
 const count=prompts.length;
 await assert.rejects(()=>engine.submit({kind:'image',prompt:'',checkpoint:'test-sd15.safetensors'}),/prompt/);
 await assert.rejects(()=>engine.submit({kind:'image',prompt:'x',width:513}),/multiples/);
 await assert.rejects(()=>engine.submit({kind:'image',prompt:'x',checkpoint:'paid-model'}),/installed/);
 await assert.rejects(()=>engine.job('../outside'),/Invalid job ID/);
 assert.equal(prompts.length,count);
});
test('reference uploads are local and invalid uploads are rejected',async()=>{
 const ref=await engine.upload(new File(['test-fixture'],'input.png',{type:'image/png'}));assert.match(ref.id,/^[a-z0-9-]+$/);
 await assert.rejects(()=>engine.upload(new File(['x'],'bad.exe',{type:'application/octet-stream'})),/PNG/);
});
