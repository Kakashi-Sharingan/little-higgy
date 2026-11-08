// Compatibility adapter for the upstream studio components.
// Little Higgy routes exclusively to its own local ComfyUI bridge.
async function local(route,body){
 const response=await fetch('/api/local/'+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Local generation failed.');return result;
}
async function generate(kind,params){
 const status=await local('status');if(!status.connected)throw new Error(status.message);
 const ratios={'1:1':[512,512],'16:9':[1024,576],'9:16':[576,1024],'4:3':[768,576]};
 const [width,height]=ratios[params.aspect_ratio]||ratios['1:1'];
 const record=await local('generate',{kind,prompt:params.prompt||'',checkpoint:status.checkpoints[0]||'',width,height,...(params.seed>=0?{seed:params.seed}:{}),image:params.image_url||params.images_list?.[0]});
 params.onRequestId?.(record.id);
 for(let i=0;i<1800;i++){await new Promise(resolve=>setTimeout(resolve,2000));const job=await local('jobs/'+record.id);if(job.status==='failed')throw new Error(job.error);if(job.status==='completed')return {...job,url:'/api/local/output/'+job.id+'/0'};}
 throw new Error('Local job is still running. Check ComfyUI and the Little Higgy library.');
}
export const generateImage=(_unused,params)=>generate('image',params);
export const generateI2I=(_unused,params)=>generate('image',params);
export const generateVideo=(_unused,params)=>generate('video',params);
export const generateI2V=(_unused,params)=>generate('video',params);
export const processLipSync=(_unused,params)=>generate('lipsync',params);
export async function uploadFile(_unused,file,onProgress){const form=new FormData();form.append('file',file);onProgress?.(0);const response=await fetch('/api/local/upload',{method:'POST',body:form});const result=await response.json();if(!response.ok)throw new Error(result.error);onProgress?.(100);return result.id;}
