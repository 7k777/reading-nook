import {beadLayout,waterDistance} from './condensation-layout.js';
const canvas=document.getElementById('world');
const sceneConfig=JSON.parse(document.getElementById('scene-config')?.textContent||'{}');
const condensation=sceneConfig.condensation===true;
const dropAspect=sceneConfig.dropAspect??1.08;
const dropRadius=()=>Math.min(width*(sceneConfig.dropWidthFraction??.265),sceneConfig.maxRadius??108);
const outsidePhase=sceneConfig.outsidePhase||'rain',insidePhase=sceneConfig.insidePhase||'home';
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
const abort=new AbortController(),signal=abort.signal;
const on=(target,event,handler,options={})=>target.addEventListener(event,handler,{...options,signal});
let width=innerWidth,height=innerHeight,dpr=Math.min(devicePixelRatio||1,1.5);
let base=[width*.5,height*.51],home=[...base],target=[...base],center=[...base],velocity=[0,0];
let touch=[...base],press=0,pressV=0,pressTarget=0;
let open=0,openTarget=0,transitionStart=0,transitionFrom=0;
let down=null,lastTap=null,tapTimer=0,raf=0,last=0,lastDraw=0,disposed=false,lost=false;
let program,buffer,textures=[],uniforms={},images,wordCanvas,shaderText,ready=false;
let beads=beadLayout(innerWidth,innerHeight);
let entered=false,moveDistance=0,lastToggle=0;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
function dimensions(){
  width=innerWidth;height=innerHeight;beads=beadLayout(width,height);dpr=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  const moved=[(center[0]-(base?.[0]||width*.5))/width,(center[1]-(base?.[1]||height*.51))/height];
  base=[width*.5,height*.51];home=[...base];
  if(!down){center=[base[0]+moved[0]*width,base[1]+moved[1]*height];target=[...home];}
  if(wordCanvas){makeWords();if(gl&&!lost&&textures[2])upload(textures[2],wordCanvas,2);}
  wake();
}
function makeWords(){
  wordCanvas ||= document.createElement('canvas');
  wordCanvas.width=Math.round(width*dpr);wordCanvas.height=Math.round(height*dpr);
  const c=wordCanvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
  if(sceneConfig.hiddenText===false)return;
  c.font='400 '+Math.min(17,width*.043)+'px -apple-system, BlinkMacSystemFont, "Noto Sans CJK SC", sans-serif';
  c.textAlign='center';c.textBaseline='middle';c.shadowColor='rgba(15,6,0,.95)';c.shadowBlur=12;c.fillStyle='#fff1d9';
  c.fillText(sceneConfig.hiddenText||'灯一直为你亮着。',width*.5,height*.51);
}
function shader(type,source){
  const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(reason);}return s;
}
function upload(texture,source,unit){
  gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
}
function initialize(){
  if(!gl){fallback();return;}
  const vert=shader(gl.VERTEX_SHADER,'attribute vec2 a;varying vec2 v_uv;void main(){v_uv=vec2((a.x+1.0)*.5,(1.0-a.y)*.5);gl_Position=vec4(a,0.0,1.0);}');
  const frag=shader(gl.FRAGMENT_SHADER,shaderText);
  program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
  gl.deleteShader(vert);gl.deleteShader(frag);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  textures=[images[0],images[1],wordCanvas].map((image,i)=>{
    const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);upload(t,image,i);return t;
  });
  for(const name of ['cold','warm','words','screen','image','center','half','touch','velocity','pressure','open','time','rain','grade','roundness','strength','dispersion','drops[0]'])uniforms[name]=gl.getUniformLocation(program,'u_'+name);
  ['cold','warm','words'].forEach((name,i)=>gl.uniform1i(uniforms[name],i));
  gl.uniform1f(uniforms.rain,sceneConfig.rain===false?0:1);
  gl.uniform3f(uniforms.grade,...(sceneConfig.grade||[.69,.83,.96]));
  gl.uniform1f(uniforms.roundness,sceneConfig.roundness??.77);
  gl.uniform1f(uniforms.strength,sceneConfig.strength??1);
  gl.uniform1f(uniforms.dispersion,sceneConfig.dispersion??.95);
  lost=false;ready=true;canvas.dataset.renderer='webgl';canvas.classList.add('ready');wake();
}
function geometry(){
  const e=open;
  const min=dropRadius();
  return {center:[center[0]*(1-e)+width*.5*e,center[1]*(1-e)+height*.5*e],half:[min*(1-e)+width*.68*e,min*dropAspect*(1-e)+height*.68*e]};
}
function draw(t){
  if(!ready||lost)return;
  const g=geometry();
  if(!gl){drawFallback(g);return;}
  gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
  gl.uniform2f(uniforms.screen,width,height);gl.uniform2f(uniforms.image,images[0].width,images[0].height);
  gl.uniform2f(uniforms.center,...g.center);gl.uniform2f(uniforms.half,...g.half);gl.uniform2f(uniforms.touch,...touch);
  gl.uniform2f(uniforms.velocity,...velocity);gl.uniform1f(uniforms.pressure,press);gl.uniform1f(uniforms.open,open);
  if(condensation)gl.uniform4fv(uniforms['drops[0]'],new Float32Array(beads.flat()));
  gl.uniform1f(uniforms.time,reduce.matches?0:t*.001);gl.drawArrays(gl.TRIANGLES,0,6);
}
function wake(){if(!disposed&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);}
function frame(t){
  raf=0;if(disposed||document.hidden)return;
  const dt=Math.min((t-(last||t))/1000,.07);last=t;
  const steps=Math.max(1,Math.ceil(dt/.012)),step=dt/steps;
  for(let n=0;n<steps;n++){
    for(let i=0;i<2;i++){
      velocity[i]+=((target[i]-center[i])*115-velocity[i]*14)*step;center[i]+=velocity[i]*step;
    }
    pressV+=((pressTarget-press)*140-pressV*15)*step;press+=pressV*step;
  }
  if(transitionStart){
    const duration=reduce.matches?400:1450;
    const u=clamp((t-transitionStart)/duration,0,1);
    const ease=u*u*u*(u*(u*6-15)+10);
    open=transitionFrom+(openTarget-transitionFrom)*ease;
    if(u===1){transitionStart=0;lastDraw=0;open=openTarget;entered=openTarget===1;canvas.dataset.phase=entered?insidePhase:outsidePhase;}
  }
  if(t-lastDraw>=1000/40||!lastDraw){draw(t);lastDraw=t;}
  // Rain moves only while outside; a quiet room rests after the transition settles.
  if(!reduce.matches&&open<1||down||transitionStart||Math.hypot(...velocity)>.04||Math.abs(pressTarget-press)>.001)wake();
  canvas.dataset.open=open.toFixed(4);canvas.dataset.press=press.toFixed(3);
}
function toggle(){
  lastToggle=performance.now();
  openTarget=openTarget>.5?0:1;transitionFrom=open;transitionStart=performance.now();
  target=[...home];down=null;pressTarget=0;canvas.dataset.phase=openTarget?'entering':'returning';
  canvas.setAttribute('aria-label',openTarget?(sceneConfig.insideLabel||'正在进入家，双击返回雨夜'):(sceneConfig.outsideLabel||'拖动或按住玻璃，松开回弹；双击进入家'));
  wake();
}
function hit(x,y){
  if(open>.1)return true;
  const half=dropRadius();
  const a=Math.abs(x-center[0]),b=Math.abs(y-center[1]);
  const r=half*(sceneConfig.roundness??.77),qx=Math.max(a-half+r,0),qy=Math.max(b-half*dropAspect+r,0);
  return Math.hypot(qx,qy)<=r+6;
}
on(canvas,'pointerdown',e=>{
  if(e.button!==0||down||!hit(e.clientX,e.clientY))return;
  down={id:e.pointerId,x:e.clientX,y:e.clientY,cx:center[0],cy:center[1],start:e.timeStamp};
  moveDistance=0;touch=[e.clientX,e.clientY];pressTarget=1;canvas.setPointerCapture(e.pointerId);wake();
});
on(canvas,'pointermove',e=>{
  if(!down||down.id!==e.pointerId)return;
  const dx=e.clientX-down.x,dy=e.clientY-down.y;
  moveDistance=Math.max(moveDistance,Math.hypot(dx,dy));touch=[e.clientX,e.clientY];
  if(open<.1){
    target=[clamp(down.cx+dx,50,width-50),clamp(down.cy+dy,70,height-70)];
  }
  wake();
});
function end(e){
  if(!down||down.id!==e.pointerId)return;
  const now=e.timeStamp,tap=e.type==='pointerup'&&moveDistance<12&&now-down.start<450;
  down=null;pressTarget=0;target=[...home];
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(tap){
    if(lastTap&&now-lastTap.time<400&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<40){lastTap=null;toggle();}
    else lastTap={time:now,x:e.clientX,y:e.clientY};
  }else lastTap=null;
  wake();
}
on(canvas,'pointerup',end);on(canvas,'pointercancel',end);on(canvas,'lostpointercapture',end);
on(canvas,'dblclick',e=>{e.preventDefault();if(performance.now()-lastToggle>600&&hit(e.clientX,e.clientY))toggle();});
on(canvas,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}if(e.key==='Escape'&&openTarget)toggle();});
on(window,'resize',dimensions,{passive:true});on(window,'orientationchange',dimensions);
on(window,'blur',()=>{down=null;target=[...home];pressTarget=0;wake();});
on(document,'visibilitychange',()=>{
  cancelAnimationFrame(raf);raf=0;last=lastDraw=0;down=null;pressTarget=0;target=[...home];
  if(!document.hidden){if(transitionStart){transitionFrom=open;transitionStart=performance.now();}dimensions();wake();}
});
on(canvas,'webglcontextlost',e=>{e.preventDefault();lost=true;ready=false;canvas.classList.remove('ready');});
on(canvas,'webglcontextrestored',()=>{try{initialize();}catch{canvas.dataset.renderer='unavailable';}});
on(window,'pagehide',e=>{
  if(e.persisted)return;
  disposed=true;cancelAnimationFrame(raf);clearTimeout(tapTimer);abort.abort();
  if(gl){textures.forEach(t=>gl.deleteTexture(t));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}
});
function fallback(){
  // Honest degraded rendering: an image reveal with no claim of optical refraction.
  ready=true;canvas.dataset.renderer='fallback';canvas.classList.add('ready');wake();
}
function drawFallback(g){
  const c=canvas.getContext('2d');if(!c)return;c.setTransform(dpr,0,0,dpr,0,0);
  const image=(im)=>{const scale=Math.max(width/im.width,height/im.height),w=im.width*scale,h=im.height*scale;c.drawImage(im,(width-w)/2,(height-h)/2,w,h);};
  if(open>.99){image(images[1]);c.drawImage(wordCanvas,0,0,width,height);return;}
  image(images[0]);c.save();
  c.beginPath();if(condensation&&open<.95)for(const [x,y,r,aspect] of beads){c.moveTo(x+r,y);c.ellipse(x,y,r,r*aspect,0,0,Math.PI*2);}
  c.roundRect(g.center[0]-g.half[0],g.center[1]-g.half[1],g.half[0]*2,g.half[1]*2,Math.min(...g.half)*(sceneConfig.roundness??.77));c.clip();
  image(images[1]);c.drawImage(wordCanvas,0,0,width,height);c.restore();
}
async function start(){
  try{
    const data=await Promise.all([loadImage(sceneConfig.outside||'./assets/cold.webp'),loadImage(sceneConfig.inside||'./assets/warm.webp'),fetch(sceneConfig.shader||'./glass.frag').then(r=>{if(!r.ok)throw Error('shader');return r.text();}),document.fonts.ready]);
    images=data.slice(0,2);shaderText=data[2];makeWords();dimensions();initialize();
  }catch(error){canvas.dataset.renderer='unavailable';canvas.setAttribute('aria-label','雨夜场景，当前设备无法显示光学交互');}
}
start();
// Read-only QA state, no controls or debug text are displayed in the experience.
Object.defineProperty(window,'windowSpike',{value:{state:()=>({center:[...center],target:[...target],velocity:[...velocity],press,open,phase:canvas.dataset.phase||outsidePhase,renderer:canvas.dataset.renderer,radius:dropRadius(),aspect:dropAspect,condensation,beads:condensation?beads.map(b=>[...b]):[]}),distance:(x,y)=>waterDistance(x,y,center,dropRadius(),beads),project:(x,y)=>({x:x/width,y:y/height})}});
