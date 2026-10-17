import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const sharp=createRequire(import.meta.url)('/opt/codex/cua_node/lib/node_modules/sharp');
const base=process.env.PREVIEW_URL||'http://localhost:4202/';
const b=await chromium.launch({proxy:base.startsWith('https:')&&process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined,executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader',...(process.env.SESSION_CA_SPKI_PIN?['--ignore-certificate-errors-spki-list='+process.env.SESSION_CA_SPKI_PIN]:[])]});
try{const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const p=await c.newPage();await p.goto(base+'lake/index.html');if((await p.title()).includes('External Content Notice'))await p.getByRole('button',{name:'Open the page',exact:true}).click();await p.waitForFunction(()=>window.windowSpike?.state().renderer==='webgl'&&getComputedStyle(document.querySelector('#world')).opacity==='1');
 const s=await p.evaluate(()=>window.windowSpike.state());await p.evaluate(()=>{document.documentElement.style.background='transparent';document.body.style.background='transparent';});
 const {data,info}=await sharp(await p.screenshot({omitBackground:true})).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const rowWidth=y=>{let first=-1,last=-1;const yy=Math.round(y*2);for(let x=0;x<info.width;x++){if(data[(yy*info.width+x)*4+3]>150){if(first<0)first=x;last=x;}}return (last-first+1)/2;};
 const top=rowWidth(s.center[1]-s.radius*.65),bottom=rowWidth(s.center[1]+s.radius*.65),middle=rowWidth(s.center[1]);
 console.log({top,bottom,middle,topToMiddle:top/middle,bottomToMiddle:bottom/middle});
 assert(Math.abs(top-bottom)<3,'rounded outline must not pinch into a pointed top');assert(top/middle>.65&&bottom/middle>.65,'both ends must retain elliptical shoulders');console.log('PASS: rendered outline has rounded, symmetric shoulders');
}finally{await b.close();}
