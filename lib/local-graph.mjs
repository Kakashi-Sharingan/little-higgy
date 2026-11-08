const LOCAL_NODES = new Set(`CheckpointLoaderSimple CLIPTextEncode EmptyLatentImage KSampler VAEDecode VAEEncode LoadImage SaveImage PreviewImage ImageScale ImageScaleBy ImageBatch RepeatLatentBatch LatentUpscale LatentUpscaleBy LoraLoader LoraLoaderModelOnly CLIPSetLastLayer ControlNetLoader ControlNetApplyAdvanced CLIPVisionLoader CLIPVisionEncode UNETLoader DualCLIPLoader TripleCLIPLoader CLIPLoader VAELoader ModelSamplingSD3 ModelSamplingFlux ModelSamplingAuraFlow FluxGuidance EmptySD3LatentImage ConditioningZeroOut ConditioningCombine ConditioningConcat ConditioningSetTimestepRange VAEDecodeTiled VAEEncodeTiled WanImageToVideo WanFirstLastFrameToVideo WanVaceToVideo EmptyHunyuanLatentVideo EmptyLTXVLatentVideo LTXVConditioning CreateVideo SaveVideo GetVideoComponents VideoLinearCFGGuidance VideoCombine VHS_VideoCombine VHS_LoadVideo VHS_LoadVideoPath VHS_LoadImages LoadVideo ImageFromBatch ImagePadForOutpaint SetLatentNoiseMask InpaintModelConditioning SaveAnimatedWEBP SaveAnimatedPNG `.split(' ').filter(Boolean));
LOCAL_NODES.add('RIFE VFI'); LOCAL_NODES.add('FILM VFI');
export class LocalError extends Error { constructor(message, status=400) { super(message); this.status=status; } }

export function imageGraph(input, imageName) {
  const {prompt,negative='',checkpoint,width,height,steps=20,cfg=7,seed}=input;
  const graph={
    '1':{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:checkpoint}},
    '2':{class_type:'CLIPTextEncode',inputs:{text:prompt,clip:['1',1]}},
    '3':{class_type:'CLIPTextEncode',inputs:{text:negative,clip:['1',1]}},
    '4':{class_type:'EmptyLatentImage',inputs:{width,height,batch_size:1}},
    '5':{class_type:'KSampler',inputs:{seed,steps,cfg,sampler_name:'euler',scheduler:'normal',denoise:imageName?0.7:1,model:['1',0],positive:['2',0],negative:['3',0],latent_image:imageName?['8',0]:['4',0]}},
    '6':{class_type:'VAEDecode',inputs:{samples:['5',0],vae:['1',2]}},
    '7':{class_type:'SaveImage',inputs:{filename_prefix:'LittleHiggy',images:['6',0]}},
  };
  if(imageName){graph['9']={class_type:'LoadImage',inputs:{image:imageName}};graph['10']={class_type:'ImageScale',inputs:{image:['9',0],upscale_method:'lanczos',width,height,crop:'disabled'}};graph['8']={class_type:'VAEEncode',inputs:{pixels:['10',0],vae:['1',2]}};delete graph['4'];}
  return graph;
}
export function validateGraph(graph) {
  if(!graph || Array.isArray(graph) || typeof graph!=='object' || graph.nodes)throw new LocalError('Export the workflow in ComfyUI API format, not the canvas workflow format.');
  const nodes=Object.values(graph);if(!nodes.length||nodes.length>200)throw new LocalError('Workflows must contain 1–200 nodes.');
  for(const node of nodes){
    if(!node || !LOCAL_NODES.has(node.class_type))throw new LocalError(`Unsupported local node: ${node?.class_type||'unknown'}. Cloud/API nodes are not enabled.`);
    if(!node.inputs||typeof node.inputs!=='object')throw new LocalError('Each node needs inputs.');
    for(const [key,value] of Object.entries(node.inputs)){
      if(/api.?key|token|secret|endpoint|url/i.test(key)||typeof value==='string'&&/https?:\/\//i.test(value))throw new LocalError('This local-only build does not allow credentials or network URLs in workflows.');
    }
  }
  return graph;
}

export function substitute(value,vars){
  if(typeof value==='string'){
    const match=value.match(/^\{\{(\w+)\}\}$/);if(match&&Object.hasOwn(vars,match[1]))return vars[match[1]];
    return value.replace(/\{\{(\w+)\}\}/g,(all,key)=>Object.hasOwn(vars,key)?String(vars[key]):all);
  }
  if(Array.isArray(value))return value.map(x=>substitute(x,vars));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,substitute(v,vars)]));
  return value;
}
export function validateInput(data) {
  if(!data||!['image','cinema','video','lipsync'].includes(data.kind))throw new LocalError('Choose a studio.');
  if(typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>6000)throw new LocalError('Enter a prompt of 1–6000 characters.');
  const n=(key,min,max,fallback)=>{const v=data[key]??fallback;if(!Number.isInteger(v)||v<min||v>max)throw new LocalError(`Invalid ${key}.`);return v;};
  return {kind:data.kind,prompt:data.prompt.trim(),negative:typeof data.negative==='string'?data.negative.slice(0,3000):'',checkpoint:typeof data.checkpoint==='string'?data.checkpoint:'',width:n('width',256,1536,512),height:n('height',256,1536,512),steps:n('steps',1,60,20),cfg:n('cfg',1,20,7),seed:n('seed',0,2147483647,Math.floor(Math.random()*2147483647)),frames:n('frames',1,241,49),fps:n('fps',1,60,16),image:typeof data.image==='string'?data.image:null};
}
