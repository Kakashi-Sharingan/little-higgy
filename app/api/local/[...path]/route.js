import * as engine from '../../../../lib/local-engine.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function failure(error){return Response.json({error:error instanceof engine.LocalError?error.message:'Local operation failed. Check the Little Higgy terminal.'},{status:error.status||500});}
function guard(request){const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==request.headers.get('host'))throw new engine.LocalError('Cross-origin requests are not allowed.',403);}
export async function GET(request,context){try{
 const {path}=await context.params;
 if(path[0]==='status')return Response.json(await engine.status());
 if(path[0]==='jobs'&&path.length===1)return Response.json(await engine.history());
 if(path[0]==='jobs'&&path.length===2)return Response.json(await engine.job(path[1]));
 if(path[0]==='output'&&path.length===3){const {response,filename}=await engine.output(path[1],Number(path[2]));return new Response(response.body,{headers:{'Content-Type':response.headers.get('content-type')||'application/octet-stream','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(filename)}`,'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});}
 return Response.json({error:'Not found'},{status:404});
}catch(e){return failure(e);}}
export async function POST(request,context){try{
 guard(request);const {path}=await context.params;
 if(Number(request.headers.get('content-length'))>21*1024*1024)throw new engine.LocalError('Request is too large.',413);
 if(path[0]==='upload'){const form=await request.formData();return Response.json(await engine.upload(form.get('file')));}
 const data=await request.json();
 if(path[0]==='generate')return Response.json(await engine.submit(data),{status:201});
 if(path[0]==='workflow')return Response.json(await engine.saveWorkflow(data.type,data.graph));
 if(path[0]==='favorite')return Response.json(await engine.favorite(data.id,data.value));
 return Response.json({error:'Not found'},{status:404});
}catch(e){return failure(e);}}
