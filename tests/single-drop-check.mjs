import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.PREVIEW_URL||'http://localhost:4181/';
const browser=await chromium.launch({proxy:base.startsWith('https:')&&process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined,executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader',...(process.env.SESSION_CA_SPKI_PIN?['--ignore-certificate-errors-spki-list='+process.env.SESSION_CA_SPKI_PIN]:[])]});
for(const [path,outer,inner] of [['snow/index.html','snowNight','summer']]){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[],bad=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await page.goto(base+path);
 if((await page.title()).includes('External Content Notice')){
  await page.getByRole('button',{name:'Open the page',exact:true}).click();
  errors.length=0;bad.length=0;
 }
 await page.waitForFunction(()=>window.windowSpike?.state().renderer==='webgl');
 await page.screenshot({path:'tests/'+outer+'.png'});
 assert.equal(await page.locator('body').innerText(),'');
 const initial=await page.evaluate(()=>window.windowSpike.state());
 assert(initial.radius*2>=85&&initial.radius*2<=100);
 assert.equal(initial.aspect,1);
 assert.equal(initial.condensation,false);assert.equal(initial.beads.length,0);
 const client=await context.newCDPSession(page);
 const touch=(type,x,y,timestamp)=>client.send('Input.dispatchTouchEvent',{type,...(timestamp?{timestamp}:{}),touchPoints:type==='touchEnd'?[]:[{x,y,id:1,force:.8,radiusX:4,radiusY:4}]});
 await touch('touchStart',280,430);await page.waitForTimeout(100);await touch('touchEnd');
 assert((await page.evaluate(()=>window.windowSpike.state())).press<.03);
 await touch('touchStart',195,430);await page.waitForFunction(()=>window.windowSpike.state().press>.8);
 for(let i=1;i<=8;i++){await touch('touchMove',195+i*10,430-i*7);await page.waitForTimeout(35);}
 assert((await page.evaluate(()=>window.windowSpike.state())).center[0]>245);
 await touch('touchEnd');
 await page.waitForFunction(()=>{const s=window.windowSpike.state();return Math.abs(s.center[0]-195)<1&&Math.abs(s.center[1]-430.44)<1&&s.press<.01;});
 const doubleTap=async()=>{const t=Date.now()/1000;for(const [type,offset] of [['touchStart',0],['touchEnd',.02],['touchStart',.12],['touchEnd',.14]])await touch(type,195,430,t+offset);};
 await doubleTap();await page.waitForFunction(phase=>window.windowSpike.state().phase===phase,inner);assert.equal(await page.evaluate(()=>window.windowSpike.state().open),1);
 await page.screenshot({path:'tests/'+inner+'.png'});
 await doubleTap();await page.waitForFunction(phase=>window.windowSpike.state().phase===phase,outer);
 for(const [width,height] of [[320,568],[430,932],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(160);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert.equal(await page.evaluate(()=>document.body.scrollHeight),height);
 }
 // Lifecycle and WebGL recovery retain a single lens.
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 assert.equal((await page.evaluate(()=>window.windowSpike.state())).beads.length,0);
 await page.evaluate(()=>{const gl=document.getElementById('world').getContext('webgl');window.__lose=gl.getExtension('WEBGL_lose_context');window.__lose?.loseContext();});
 await page.waitForTimeout(150);await page.evaluate(()=>window.__lose?.restoreContext());
 await page.waitForFunction(()=>document.getElementById('world').classList.contains('ready'));
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
 console.log(path||'sketch:','single lens, no extra beads, press, drag, rebound, double-tap, responsive, context recovery and console passed');
 await context.close();
}
// WebGL-unavailable devices keep every reveal and the same interactions usable.
const fallback=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const fp=await fallback.newPage();
await fp.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
await fp.goto(base+'snow/index.html');
if((await fp.title()).includes('External Content Notice'))await fp.getByRole('button',{name:'Open the page',exact:true}).click();
await fp.waitForFunction(()=>window.windowSpike?.state().renderer==='fallback');
assert.equal((await fp.evaluate(()=>window.windowSpike.state())).beads.length,0);
await fp.screenshot({path:'tests/condensation-fallback.png'});
console.log('fallback single lens passed');
await fallback.close();await browser.close();
