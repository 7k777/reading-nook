precision highp float;
varying vec2 v_uv;
uniform sampler2D u_cold;
uniform sampler2D u_warm;
uniform sampler2D u_words;
uniform vec2 u_screen;
uniform vec2 u_image;
uniform vec2 u_center;
uniform vec2 u_half;
uniform vec2 u_touch;
uniform vec2 u_velocity;
uniform float u_pressure;
uniform float u_open;
uniform float u_time;
uniform float u_rain;
uniform vec3 u_grade;
uniform float u_roundness;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float sdf(vec2 p){
  vec2 axis=u_velocity/max(length(u_velocity),1.0);
  float speed=clamp(length(u_velocity)/1500.0,0.0,.16)*(1.0-u_open);
  p-=axis*dot(p,axis)*speed;
  vec2 delta=p-(u_touch-u_center);
  float press=u_pressure*(1.0-u_open);
  float influence=exp(-dot(delta,delta)/6500.0);
  p-=delta*influence*press*.19;
  p/=vec2(1.0+press*.07,1.0-press*.055);
  float radius=min(u_half.x,u_half.y)*mix(u_roundness,.15,u_open);
  vec2 q=abs(p)-u_half+radius;
  float d=min(max(q.x,q.y),0.0)+length(max(q,0.0))-radius;
  float a=atan(p.y,p.x);
  float breathing=sin(a*3.0+u_time*.68)*1.0+sin(a*2.0-u_time*.43)*.7;
  float flowing=sin(a*3.0+u_open*8.0)*sin(u_open*3.14159)*17.0;
  return d+(breathing*(1.0-u_open)+flowing);
}
vec2 cover(vec2 uv){
  float a=u_screen.x/u_screen.y,b=u_image.x/u_image.y;
  vec2 scale=a>b?vec2(1.0,b/a):vec2(a/b,1.0);
  return (uv-.5)*scale+.5;
}
vec3 coldAt(vec2 uv){return texture2D(u_cold,clamp(cover(uv),.001,.999)).rgb;}
vec3 warmAt(vec2 uv){return texture2D(u_warm,clamp(cover(uv),.001,.999)).rgb;}
void main(){
  vec2 pixel=v_uv*u_screen;
  vec2 p=pixel-u_center;
  float d=sdf(p);
  float mask=1.0-smoothstep(-1.1,1.0,d);
  // The exterior remains in screen space, independent of the glass position.
  // Small flowing rivulets move the ACTUAL image coordinates, not an overlay.
  vec2 drizzle=vec2(0.0);
  if(u_rain>.5){
    vec2 cell=floor(v_uv*vec2(26.0,8.0));
    float seed=hash(cell);
    vec2 q=fract(v_uv*vec2(26.0,8.0))-vec2(.5,fract(u_time*.055+seed));
    q.x+=sin(q.y*8.0+seed*9.0)*.025;
    float drop=exp(-dot(q*vec2(30.0,5.0),q*vec2(30.0,5.0)))*step(.57,seed);
    drizzle=vec2(q.x*drop*.033,q.y*drop*.012)*(1.0-u_open);
  }
  vec3 outside=coldAt(v_uv+drizzle)*u_grade;
  // Most screen pixels are outside the lens: skip warm sampling and SDF normals.
  if(d>20.0&&u_open<.98){
    gl_FragColor=vec4(outside*(1.0-exp(-d/12.0)*.18*(1.0-u_open)),1.0);
    return;
  }
  // Distance-field normals and a continuous lens field change both texture lookups.
  vec2 gradient=vec2(sdf(p+vec2(.7,0.0))-sdf(p-vec2(.7,0.0)),sdf(p+vec2(0.0,.7))-sdf(p-vec2(0.0,.7)));
  vec2 normal=gradient/max(length(gradient),.0001);
  vec2 n=p/u_half;
  float radial=length(n);
  float bevel=exp(-max(-d,0.0)/15.0);
  float rest=1.0-u_open;
  vec2 lens=n*(4.0+radial*radial*13.0)+normal*bevel*25.0;
  vec2 wave=vec2(sin(p.y*.022+u_time*.8),cos(p.x*.018-u_time*.67))*1.6;
  vec2 touchDelta=p-(u_touch-u_center);
  float touchInfluence=exp(-dot(touchDelta,touchDelta)/8000.0);
  vec2 pressing=touchDelta*u_pressure*.35*touchInfluence;
  vec2 offset=(lens+wave+pressing-u_velocity*.012)*rest*rest;
  vec2 sampleUv=v_uv+offset/u_screen;
  vec2 chroma=normal*bevel*.95/u_screen*rest;
  vec3 inside=vec3(warmAt(sampleUv+chroma).r,warmAt(sampleUv).g,warmAt(sampleUv-chroma).b);
  // A separate, stationary text texture lives in the warm world. It is also refracted.
  vec4 words=texture2D(u_words,clamp(sampleUv,.001,.999));
  inside=mix(inside,words.rgb,words.a);
  inside*=1.0-bevel*.07*rest;
  float angle=atan(normal.y,normal.x);
  float upperLeft=exp(-pow((angle+2.38)/.64,2.0));
  float lowerRight=exp(-pow((angle-.76)/.65,2.0));
  float hairline=exp(-pow((d+1.0)/.85,2.0));
  float innerGlint=exp(-pow((d+4.0)/2.4,2.0));
  float glint=(hairline*(upperLeft*.60+lowerRight*.34)+innerGlint*.055)*rest;
  inside=mix(inside,vec3(.97,.88,.72),glint);
  float shadow=exp(-max(d,0.0)/12.0)*step(0.0,d)*.18*rest;
  vec3 color=mix(outside*(1.0-shadow),inside,mask);
  // At the end the warm room is revealed without residual lens warping or border.
  color=mix(color,inside,smoothstep(.985,1.0,u_open));
  float noise=(hash(pixel+fract(u_time)*.01)-.5)*.004;
  gl_FragColor=vec4(color+noise,1.0);
}
