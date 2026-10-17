import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.PREVIEW_URL||'http://localhost:4174/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
for(const [path,outer,inner] of [['','sketch','photo'],['daynight/','night','day']]){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[],bad=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await page.goto(base+path);await page.waitForFunction(()=>window.windowSpike?.state().renderer==='webgl');
 await page.screenshot({path:'tests/'+outer+'.png'});
 assert.equal(await page.locator('body').innerText(),'');
 const client=await context.newCDPSession(page);
 const touch=(type,x,y,timestamp)=>client.send('Input.dispatchTouchEvent',{type,...(timestamp?{timestamp}:{}),touchPoints:type==='touchEnd'?[]:[{x,y,id:1,force:.8,radiusX:4,radiusY:4}]});
 await touch('touchStart',195,430);await page.waitForFunction(()=>window.windowSpike.state().press>.8);
 for(let i=1;i<=7;i++){await touch('touchMove',195+i*9,430-i*7);await page.waitForTimeout(25);}
 assert((await page.evaluate(()=>window.windowSpike.state())).center[0]>225);
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
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
 console.log(path||'sketch:','load, press, drag, rebound, double-tap, replay, responsive and console passed');
 await context.close();
}
await browser.close();
