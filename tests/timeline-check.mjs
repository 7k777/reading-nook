import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('/opt/codex/cua_node/lib/node_modules/sharp');
const base=process.env.PREVIEW_URL||'http://localhost:4190/';
const browser=await chromium.launch({proxy:base.startsWith('https:')&&process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined,executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader',...(process.env.SESSION_CA_SPKI_PIN?['--ignore-certificate-errors-spki-list='+process.env.SESSION_CA_SPKI_PIN]:[])]});
async function visit(page){
 await page.goto(base+'timeline/index.html');
 if((await page.title()).includes('External Content Notice'))await page.getByRole('button',{name:'Open the page',exact:true}).click();
 await page.waitForFunction(()=>window.windowSpike?.state().renderer==='webgl');
}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await visit(page);
 assert.equal(await page.locator('body').innerText(),'');
 const start=await page.evaluate(()=>window.windowSpike.state()),[hx,hy]=start.center;
 assert(start.radius>=40&&start.radius<=48);assert.equal(start.aspect,1);
 const shot=await page.screenshot({path:'tests/timeline-initial.png'});
 // The initial reveal is an orange blossom, the surrounding room remains cold blue.
 const rgb=await sharp(shot).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const pixel=(x,y)=>{const i=(Math.round(y*2)*rgb.info.width+Math.round(x*2))*3;return [...rgb.data.subarray(i,i+3)];};
 const flower=pixel(hx,hy),wall=pixel(80,280);
 assert(flower[0]>flower[2]*1.25,'orange flower visible in initial lens');
 assert(wall[2]>wall[0],'exterior stays blue');
 const client=await context.newCDPSession(page);
 const touch=(type,x,y,timestamp)=>client.send('Input.dispatchTouchEvent',{type,...(timestamp?{timestamp}:{}),touchPoints:type==='touchEnd'?[]:[{x,y,id:1,force:.8,radiusX:4,radiusY:4}]});
 await touch('touchStart',hx,hy);await page.waitForFunction(()=>window.windowSpike.state().press>.8);
 for(let i=1;i<=8;i++){await touch('touchMove',hx-80*i/8,hy-110*i/8);await page.waitForTimeout(25);}
 await page.waitForFunction(x=>window.windowSpike.state().center[0]<x,hx-60);
 await page.screenshot({path:'tests/timeline-drag.png'});await touch('touchEnd');
 await page.waitForFunction(([x,y])=>{const s=window.windowSpike.state();return Math.abs(s.center[0]-x)<1&&Math.abs(s.center[1]-y)<1&&s.press<.01;},[hx,hy]);
 // Record the rendered geometry through the whole transition, including contraction.
 await page.evaluate(()=>{window.__trace=[];window.__traceOn=true;const sample=()=>{if(!window.__traceOn)return;const s=window.windowSpike.state();window.__trace.push({open:s.open,squeeze:s.squeeze,stage:s.stage,r:s.geometry.half[0]});requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 const doubleTap=async()=>{const t=Date.now()/1000;for(const [type,offset] of [['touchStart',0],['touchEnd',.02],['touchStart',.12],['touchEnd',.14]])await touch(type,hx,hy,t+offset);};
 await doubleTap();await page.waitForFunction(()=>window.windowSpike.state().phase==='summerRoom');
 const trace=await page.evaluate(()=>{window.__traceOn=false;return window.__trace;});
 assert(trace.some(s=>s.stage==='gathering'&&s.r<start.radius*.95),'visible contraction before reveal');
 assert(trace.some(s=>s.stage==='blooming'&&s.open>.1&&s.open<.95),'continuous liquid expansion');
 assert(trace.some(s=>s.stage==='settling'),'settling stage');
 await page.screenshot({path:'tests/timeline-summer.png'});
 assert.equal((await page.evaluate(()=>window.windowSpike.state())).open,1);
 await doubleTap();await page.waitForFunction(()=>window.windowSpike.state().phase==='rainRoom');
 for(const [width,height] of [[320,568],[430,932],[844,390],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal(await page.evaluate(()=>document.body.scrollHeight),height);
 }
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));document.dispatchEvent(new Event('visibilitychange'));const gl=document.getElementById('world').getContext('webgl');window.__lose=gl.getExtension('WEBGL_lose_context');window.__lose?.loseContext();});
 await page.waitForTimeout(150);await page.evaluate(()=>window.__lose?.restoreContext());
 await page.waitForFunction(()=>document.getElementById('world').classList.contains('ready'));
 assert.deepEqual(errors,[]);
 console.log('PASS: initial coral flower / blue room, touch press-drag-rebound, gather-expand-settle, reverse, viewport, context recovery, clean console');
 await context.close();
 const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const rp=await reduced.newPage();await visit(rp);await rp.locator('#world').focus();await rp.keyboard.press('Enter');await rp.waitForFunction(()=>window.windowSpike.state().phase==='summerRoom');assert.equal(await rp.evaluate(()=>window.windowSpike.state().squeeze),0);await reduced.close();
 const fallback=await browser.newContext({viewport:{width:390,height:844}}),fp=await fallback.newPage();
 await fp.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
 await fp.goto(base+'timeline/index.html');if((await fp.title()).includes('External Content Notice'))await fp.getByRole('button',{name:'Open the page',exact:true}).click();
 await fp.waitForFunction(()=>window.windowSpike?.state().renderer==='fallback');await fp.locator('#world').focus();await fp.keyboard.press('Enter');await fp.waitForFunction(()=>window.windowSpike.state().phase==='summerRoom');await fp.screenshot({path:'tests/timeline-fallback.png'});await fallback.close();
 console.log('PASS: reduced-motion, keyboard, no-WebGL fallback reveal');
}finally{await browser.close();}
