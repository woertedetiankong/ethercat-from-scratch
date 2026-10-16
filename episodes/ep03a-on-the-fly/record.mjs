// Render index.html frame by frame in headless Chrome and mux with narration.wav → video.mp4 (1920×1080, 30 fps).
// Deterministic: frames come from render(t), not from real-time playback, so slow machines give the same video.
import { chromium } from 'playwright-core';
import { spawn } from 'child_process';
const exe=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b=await chromium.launch({executablePath:exe});
const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+process.cwd()+'/index.html?record');
await p.evaluate(()=>ready);
const total=await p.evaluate(()=>TL.total), fps=30, N=Math.ceil(total*fps), BATCH=20;
const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-i','narration.wav',
 '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','video.mp4'],{stdio:['pipe','inherit','inherit']});
const done=new Promise(r=>ff.on('close',r));
const write=buf=>new Promise(r=>ff.stdin.write(buf)?r():ff.stdin.once('drain',r));
const t0=Date.now();
for(let f=0;f<N;f+=BATCH){
  const urls=await p.evaluate(([f0,n,fps])=>{const o=[];for(let i=0;i<n;i++){render((f0+i)/fps);o.push(cv.toDataURL('image/jpeg',.95));}return o;},[f,Math.min(BATCH,N-f),fps]);
  for(const u of urls) await write(Buffer.from(u.slice(u.indexOf(',')+1),'base64'));
  if(f%600===0) console.log(`frame ${f}/${N}  ${((Date.now()-t0)/1000).toFixed(0)}s`);
}
ff.stdin.end(); await done; await b.close(); console.log('done',N,'frames');
