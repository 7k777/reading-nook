import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('/opt/codex/cua_node/lib/node_modules/sharp');
const base=process.env.PREVIEW_URL||'http://localhost:4205/';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,proxy:base.startsWith('https:')&&process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined,args:['--no-sandbox','--enable-unsafe-swiftshader',...(process.env.SESSION_CA_SPKI_PIN?['--ignore-certificate-errors-spki-list='+process.env.SESSION_CA_SPKI_PIN]:[])]});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'tyndall/');
 if((await page.title()).includes('External Content Notice')){await page.getByRole('button',{name:'Open the page',exact:true}).click();errors.length=0;}
 await page.waitForFunction(()=>window.windowSpike?.state().renderer==='webgl');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('canvas')).opacity==='1');
 assert.equal(await page.locator('body').innerText(),'');
 const s=await page.evaluate(()=>window.windowSpike.state());assert.equal(s.aspect,1);assert(s.radius<36);assert.deepEqual(s.frame.size,[390,520]);
 const original=await page.screenshot({path:'tests/tyndall-initial.png'});
 await page.evaluate(()=>document.querySelector('canvas').style.visibility='hidden');
 const native=await page.screenshot();await page.evaluate(()=>document.querySelector('canvas').style.visibility='visible');
 const raw=async b=>(await sharp(b).removeAlpha().raw().toBuffer());
 const a=await raw(original),b=await raw(native);
 let brighter=0,marginDiff=0;
 for(let y=0;y<844;y++)for(let x=0;x<390;x++){
  const i=(y*390+x)*3,d=a[i]+a[i+1]+a[i+2]-b[i]-b[i+1]-b[i+2];
  if(y<160||y>685)marginDiff+=Math.abs(d);
  if(y>270&&y<550&&d>25)brighter++;
 }
 assert(brighter>1000,'light shafts visibly illuminate the photograph');assert.equal(marginDiff,0,'light does not leak into letterbox margins');
 const cdp=await context.newCDPSession(page);
 const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,force:.8}]});
 await touch('touchStart',...s.center);await page.waitForFunction(()=>window.windowSpike.state().press>.7);
 await touch('touchMove',s.center[0]+35,s.center[1]-150);
 await page.waitForFunction(y=>window.windowSpike.state().center[1]<y-100,s.center[1]);
 await touch('touchEnd');await page.waitForFunction(home=>{const s=window.windowSpike.state();return Math.hypot(s.center[0]-home[0],s.center[1]-home[1])<1&&s.press<.01;},s.center);
 await page.locator('canvas').dblclick({position:{x:s.center[0],y:s.center[1]}});await page.waitForFunction(()=>window.windowSpike.state().open===1);
 await page.locator('canvas').dblclick();await page.waitForFunction(()=>window.windowSpike.state().open===0);
 for(const [width,height] of [[844,390],[390,844]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);}
 assert.equal(await page.evaluate(()=>document.querySelector('canvas').getContext('webgl').getError()),0);assert.deepEqual(errors,[]);
 await context.close();
 const retina=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,reducedMotion:'reduce'});
 const rp=await retina.newPage();await rp.goto(base+'tyndall/');
 if((await rp.title()).includes('External Content Notice'))await rp.getByRole('button',{name:'Open the page',exact:true}).click();
 await rp.waitForFunction(()=>window.windowSpike?.state().renderer==='webgl');assert.deepEqual(await rp.evaluate(()=>window.windowSpike.state().surface),[1170,2532]);await retina.close();
 console.log('PASS: visible light, no margin leakage, actual touch deformation/drag/rebound, double-click expansion/return, responsive layout, 3x resolution, reduced motion, no console or GL errors');
}finally{await browser.close();}
