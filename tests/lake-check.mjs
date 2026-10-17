import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('/opt/codex/cua_node/lib/node_modules/sharp');
const base=process.env.PREVIEW_URL||'http://localhost:4195/';
const browser=await chromium.launch({proxy:base.startsWith('https:')&&process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined,executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader',...(process.env.SESSION_CA_SPKI_PIN?['--ignore-certificate-errors-spki-list='+process.env.SESSION_CA_SPKI_PIN]:[])]});
async function visit(page,errors=[]){
 await page.goto(base+'lake/index.html');
 if((await page.title()).includes('External Content Notice')){await page.getByRole('button',{name:'Open the page',exact:true}).click();errors.length=0;}
 await page.waitForFunction(()=>window.windowSpike?.state().renderer==='webgl');
}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await visit(page,errors);
 assert.equal(await page.locator('body').innerText(),'');
 const start=await page.evaluate(()=>window.windowSpike.state()),[hx,hy]=start.center;
 assert(start.radius>=40&&start.radius<=48);assert.equal(start.aspect,1);
 assert.equal(start.pixelRatio,2);assert.deepEqual(start.surface,[780,1688]);
 assert.equal(await page.evaluate(()=>document.querySelector("#world").getContext("webgl").getContextAttributes().alpha),true);
 const shot=await page.screenshot({path:'tests/lake-initial.png'});
 assert.equal(start.secrets.length,3);
 assert(start.secrets.every(s=>s.uv[1]>.55),'secrets live only in the reflection');
 // Baseline pixels let us verify that a hidden moon appears only under the lens.
 const sample=async(buffer,x,y)=>{const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});let peak=0;for(let dy=-20;dy<=20;dy++)for(let dx=-20;dx<=20;dx++){const i=(Math.round((y+dy)*2)*info.width+Math.round((x+dx)*2))*3;peak=Math.max(peak,(data[i]+data[i+1]+data[i+2])/3);}return peak;};
 const moon=start.secrets.find(s=>s.id==='moon').screen;
 const before=await sample(shot,...moon);
 const client=await context.newCDPSession(page);
 const touch=(type,x,y,timestamp)=>client.send('Input.dispatchTouchEvent',{type,...(timestamp?{timestamp}:{}),touchPoints:type==='touchEnd'?[]:[{x,y,id:1,force:.8,radiusX:4,radiusY:4}]});
 await touch('touchStart',hx,hy);await page.waitForFunction(()=>window.windowSpike.state().press>.8);
 await page.waitForFunction(()=>window.windowSpike.state().found.includes('letter'));
 // Sweep across both reflected Easter eggs, keeping a real touch captured.
 for(const secret of start.secrets.filter(s=>s.id!=='letter')){
  const current=await page.evaluate(()=>window.windowSpike.state().target);
  for(let i=1;i<=10;i++){await touch('touchMove',current[0]+(secret.screen[0]-current[0])*i/10,current[1]+(secret.screen[1]-current[1])*i/10);await page.waitForTimeout(20);}
  await page.waitForFunction(id=>window.windowSpike.state().found.includes(id),secret.id);
 }
 await page.screenshot({path:'tests/lake-boat.png'});
 for(let i=1;i<=12;i++){const b=start.secrets.find(s=>s.id==='boat').screen;await touch('touchMove',b[0]+(moon[0]-b[0])*i/12,b[1]+(moon[1]-b[1])*i/12);await page.waitForTimeout(25);}
 await page.waitForFunction(([x,y])=>{const c=window.windowSpike.state().center;return Math.hypot(c[0]-x,c[1]-y)<1;},moon);
 const moonShot=await page.screenshot({path:'tests/lake-moon.png'});
 const after=await sample(moonShot,...moon);
 assert(after-before>60,'moon really appears under the lens');
 assert.equal((await page.evaluate(()=>window.windowSpike.state())).found.length,3);
 await touch('touchEnd');
 await page.waitForFunction(([x,y])=>{const s=window.windowSpike.state();return Math.abs(s.center[0]-x)<1&&Math.abs(s.center[1]-y)<1&&s.press<.01;},[hx,hy]);
 // Record the rendered geometry through the whole transition, including contraction.
 await page.evaluate(()=>{window.__trace=[];window.__traceOn=true;const sample=()=>{if(!window.__traceOn)return;const s=window.windowSpike.state();window.__trace.push({open:s.open,squeeze:s.squeeze,stage:s.stage,r:s.geometry.half[0]});requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 const doubleTap=async()=>{const t=Date.now()/1000;for(const [type,offset] of [['touchStart',0],['touchEnd',.02],['touchStart',.12],['touchEnd',.14]])await touch(type,hx,hy,t+offset);};
 await doubleTap();await page.waitForFunction(()=>window.windowSpike.state().phase==='reflection');
 const trace=await page.evaluate(()=>{window.__traceOn=false;return window.__trace;});
 assert(trace.some(s=>s.stage==='gathering'&&s.r<start.radius*.95),'visible contraction before reveal');
 assert(trace.some(s=>s.stage==='blooming'&&s.open>.1&&s.open<.95),'continuous liquid expansion');
 assert(trace.some(s=>s.stage==='settling'),'settling stage');
 await page.screenshot({path:'tests/lake-summer.png'});
 assert.equal((await page.evaluate(()=>window.windowSpike.state())).open,1);
 await doubleTap();await page.waitForFunction(()=>window.windowSpike.state().phase==='lake');
 for(const [width,height] of [[320,568],[430,932],[844,390],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal(await page.evaluate(()=>document.body.scrollHeight),height);
 }
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));document.dispatchEvent(new Event('visibilitychange'));const gl=document.getElementById('world').getContext('webgl');window.__lose=gl.getExtension('WEBGL_lose_context');window.__lose?.loseContext();});
 await page.waitForTimeout(150);await page.evaluate(()=>window.__lose?.restoreContext());
 await page.waitForFunction(()=>document.getElementById('world').classList.contains('ready'));
 assert.deepEqual(errors,[]);
 await page.reload();await page.waitForFunction(()=>window.windowSpike?.state().renderer==='webgl');
 assert.equal((await page.evaluate(()=>window.windowSpike.state())).found.length,3,'discoveries survive refresh');
 console.log('PASS: original photo, three hidden reflection secrets, actual touch discoveries, rendered moon reveal, rebound, expansion, responsive, context recovery, local persistence, clean console');
 await context.close();
 const retina=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
 const retinaPage=await retina.newPage();await visit(retinaPage);
 const rs=await retinaPage.evaluate(()=>window.windowSpike.state());assert.equal(rs.pixelRatio,3);assert.deepEqual(rs.surface,[1170,2532]);await retina.close();
 console.log('PASS: native photo exterior, full 2x and 3x rendering');
 const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const rp=await reduced.newPage();await visit(rp);await rp.locator('#world').focus();await rp.keyboard.press('Enter');await rp.waitForFunction(()=>window.windowSpike.state().phase==='reflection');assert.equal(await rp.evaluate(()=>window.windowSpike.state().squeeze),0);await reduced.close();
 const fallback=await browser.newContext({viewport:{width:390,height:844}}),fp=await fallback.newPage();
 await fp.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
 await fp.goto(base+'lake/index.html');if((await fp.title()).includes('External Content Notice'))await fp.getByRole('button',{name:'Open the page',exact:true}).click();
 await fp.waitForFunction(()=>window.windowSpike?.state().renderer==='fallback');await fp.locator('#world').focus();await fp.keyboard.press('Enter');await fp.waitForFunction(()=>window.windowSpike.state().phase==='reflection');await fp.screenshot({path:'tests/lake-fallback.png'});await fallback.close();
 console.log('PASS: reduced-motion, keyboard, no-WebGL fallback reveal');
}finally{await browser.close();}
