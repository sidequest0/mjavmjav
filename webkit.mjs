import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire('/crew/agent/work/7178ea079fc7822f/package.json');
const { chromium, webkit, devices, expect } = require('@playwright/test');
const dir='/crew/agent/state/job18-evidence';
const result={startedAt:new Date().toISOString(), commit:'e580755201ba5fe2b47b3cd3105f9a0d0e067ae0', events:[]};
const mark=(event,data={})=>{const row={event,at:new Date().toISOString(),...data};result.events.push(row);console.log(JSON.stringify(row));writeFileSync(`${dir}/webkit-results.json`,JSON.stringify(result,null,2));};
const browsers=[], contexts=[];
async function phone(engine, profile, label, file) {
 const b=await engine.launch({args: engine===chromium?['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-video-capture=${file}`]:[]});browsers.push(b);
 const c=await b.newContext({...devices[profile],recordVideo:{dir:`${dir}/webkit-raw`,size:{width:412,height:850}}});contexts.push(c);
 await c.addInitScript(()=>{window.evidencePeers=[];const PC=window.RTCPeerConnection;window.RTCPeerConnection=class extends PC {constructor(config){super(config);window.evidencePeers.push(this)}};window.evidenceDoc=crypto.randomUUID();});
 if(engine===webkit) await c.grantPermissions(['camera'],{origin:'http://127.0.0.1:8791'});
 const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>mark('page-error',{label,message:e.message}));
 await p.goto('http://127.0.0.1:8791/nearby');await expect(p.locator('#offline-ready')).toContainText('Saved for offline play');await p.waitForFunction(()=>navigator.serviceWorker.controller);
 await c.route('**/*',r=>new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());await p.reload();await expect(p.locator('#make-code')).toBeVisible();
 mark('cached-reload',{label,version:b.version(),profile});return {b,c,p,file,label,video:p.video()};
}
try {
 const android=await phone(chromium,'Pixel 7','Android Chromium',`${dir}/webkit-reply.y4m`);
 const iphone=await phone(webkit,'iPhone 15','iPhone WebKit');
 result.nativeCamera=await iphone.p.evaluate(async()=>{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});const tracks=stream.getTracks();const settings=tracks.map(t=>({label:t.label,settings:t.getSettings()}));tracks.forEach(t=>t.stop());return {settings,ended:tracks.every(t=>t.readyState==='ended')};});
 mark('native-webkit-camera',result.nativeCamera);expect(result.nativeCamera.ended).toBe(true);
 await android.p.locator('#make-code').click();await expect(android.p.locator('#pair-qr')).toBeVisible();
 const qr='data:image/png;base64,'+(await android.p.locator('#pair-qr').screenshot()).toString('base64');
 // WebKit has no Chromium --use-file-for-fake-video-capture equivalent. Feed the QR as a canvas stream only for its scanner/UI check, after exercising native permission/acquire/stop above.
 await iphone.p.evaluate(async(url)=>{const img=new Image();img.src=url;await img.decode();window.webKitCameraStreams=[];navigator.mediaDevices.getUserMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=960;canvas.height=960;const ctx=canvas.getContext('2d');const draw=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,960,960);ctx.drawImage(img,160,160,640,640)};draw();const stream=canvas.captureStream(10);const timer=setInterval(draw,100);for(const t of stream.getTracks()){const stop=t.stop.bind(t);t.stop=()=>{clearInterval(timer);stop()}}window.webKitCameraStreams.push(stream);return stream;};},qr);
 await iphone.p.locator('#scan-code').click();await expect(iphone.p.locator('#pair-qr')).toBeVisible();
 expect(await iphone.p.evaluate(()=>window.webKitCameraStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
 expect(await iphone.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await iphone.p.screenshot({path:`${dir}/webkit-iphone-reply.png`});mark('webkit-scanner-decoded-offer-displayed-reply',{camera:'canvas stream containing other browser displayed-size QR; native WebKit camera separately acquired and stopped',noHorizontalOverflow:true});
 await iphone.p.locator('#pair-qr').screenshot({path:`${dir}/webkit-reply.png`});
 execFileSync('ffmpeg',['-loglevel','error','-y','-i',`${dir}/webkit-reply.png`,'-vf','scale=960:960:flags=neighbor','-pix_fmt','yuv420p','-r','10','-frames:v','1',android.file]);
 await android.p.locator('#scan-code').click();
 const gathered=[];for(const side of [android,iphone])gathered.push(await side.p.evaluate(()=>({iceServers:window.evidencePeers.at(-1).getConfiguration().iceServers,candidates:window.evidencePeers.at(-1).localDescription.sdp.split('\r\n').filter(x=>x.startsWith('a=candidate:')).map(x=>({type:x.match(/typ (\S+)/)?.[1],mdns:x.includes('.local')}))})));
 for(const side of [android,iphone])await expect(side.p.locator('#pair-status')).toHaveText('Two nearby cats connected.',{timeout:30000});
 mark('mixed-connection-open',{gathered,result:'Actual Chromium-WebKit data channel opened in two separate browser processes in this image.'});
 for(const side of [android,iphone])await side.p.locator('#nearby-play').click();
 for(let turn=1;turn<=3;turn++){
  await expect(android.p.locator('#bonk-status')).toContainText(`Turn ${turn}/8`,{timeout:12000});
  for(const [side,cell]of[[android,35],[iphone,0]]){await side.p.locator('#bonk-throw').click();await side.p.locator(`#bonk-map button[data-cell="${cell}"]`).click();await side.p.locator('#bonk-lock').click();await expect(side.p.locator('#bonk-lock')).toHaveText('plan locked ✓');}
  await expect(android.p.locator('#bonk-status')).toHaveText('The fish have landed.',{timeout:12000});
 }
 for(const side of [android,iphone])await expect(side.p.locator('#round-status')).toContainText('Round over. Both cats got bonked!',{timeout:6000});
 mark('mixed-full-game-complete');
 await iphone.p.evaluate(()=>window.evidencePeers.at(-1).close());
 for(const side of [android,iphone])await expect(side.p.locator('#pair-status')).toContainText('Connection dropped',{timeout:15000});
 mark('mixed-real-drop-both-shown');
 for(const side of [android,iphone]){await side.p.locator('#pair-again').click();await expect(side.p.locator('#make-code')).toBeVisible();}
 await iphone.p.locator('#make-code').click();await expect(iphone.p.locator('#pair-qr')).toBeVisible();
 const box=await iphone.p.locator('#pair-qr').boundingBox();expect(box.width).toBeLessThanOrEqual(393);expect(box.width).toBeGreaterThan(270);
 await iphone.p.screenshot({path:`${dir}/webkit-iphone-offer.png`});mark('webkit-reset-and-offer',{qrWidth:box.width});
 for(const side of [android,iphone])await side.c.close();
 await android.video.saveAs(`${dir}/webkit-android.webm`);await iphone.video.saveAs(`${dir}/webkit-iphone.webm`);
 result.ok=true;mark('webkit-complete');
} catch(e){mark('failure',{message:e.stack});process.exitCode=1;}
finally{for(const c of contexts)await c.close().catch(()=>{});for(const b of browsers)await b.close().catch(()=>{});writeFileSync(`${dir}/webkit-results.json`,JSON.stringify(result,null,2));}
