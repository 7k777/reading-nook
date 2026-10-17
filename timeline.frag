precision highp float;
varying vec2 v_uv;
uniform sampler2D u_cold,u_warm;
uniform vec2 u_screen,u_image,u_center,u_half,u_touch,u_velocity;
uniform float u_pressure,u_open,u_time,u_strength,u_dispersion,u_pulse;
uniform vec3 u_grade;
struct Water {float d;vec2 grad;vec2 anchor;float r;};
Water bead(vec2 pixel,vec2 anchor,vec2 axes,float phase,float moving){
  vec2 p=pixel-anchor;
  vec2 direction=u_velocity/max(length(u_velocity),1.0);
  float stretch=clamp(length(u_velocity)/1800.0,0.0,.19)*moving;
  p-=direction*dot(p,direction)*stretch;
  vec2 pressScale=vec2(1.0+u_pressure*.13*moving,1.0-u_pressure*.075*moving);
  vec2 q=p/(axes*pressScale);
  float l=max(length(q),.0001);
  float r=min(axes.x,axes.y);
  vec2 unit=q/l;
  float edge=(unit.x*unit.y*.4+unit.x*(unit.x*unit.x-.5)*.5)*smoothstep(4.0,18.0,r);
  Water w;
  w.d=(l-1.0)*r+edge;
  vec2 gradient=q/(axes*pressScale);
  w.grad=gradient/max(length(gradient),.00001);
  w.anchor=anchor;w.r=r;
  return w;
}
vec2 cover(vec2 uv){
  float a=u_screen.x/u_screen.y,b=u_image.x/u_image.y;
  vec2 s=a>b?vec2(1.0,b/a):vec2(a/b,1.0);
  return clamp((uv-.5)*s+.5,.001,.999);
}
vec3 cold(vec2 uv){return texture2D(u_cold,cover(uv)).rgb*u_grade;}
vec3 warm(vec2 uv){return texture2D(u_warm,cover(uv)).rgb;}
void main(){
  vec2 px=v_uv*u_screen;
  if(u_open>.999){vec2 ripple=vec2(sin(v_uv.y*19.0-u_time*5.0),cos(v_uv.x*15.0+u_time*4.0))*u_pulse*.0018;gl_FragColor=vec4(warm(v_uv+ripple),1.0);return;}
  float rest=1.0-u_open;
  vec2 axes=u_half;
  Water w=bead(px,u_center,axes,u_time*.52,rest);
  vec3 outside=cold(v_uv);
  // A liquid front, not a geometric scale-up: travelling lobes settle as it expands.
  float angle=atan((px-u_center).y,(px-u_center).x);
  w.d+=(sin(angle*3.0-u_open*9.0)*7.0+sin(angle*5.0+u_open*6.0)*3.0)*sin(u_open*3.14159265);

  float shadow=exp(-max(w.d,0.0)/3.5)*.16*rest;
  if(w.d>5.0){gl_FragColor=vec4(outside*(1.0-shadow),1.0);return;}
  vec2 normal=w.grad/max(length(w.grad),.0001);
  float depth=max(-w.d,0.0);
  float bevel=exp(-depth/max(2.0,w.r*.14));
  vec2 local=(px-w.anchor)/max(w.r,1.0);
  float radial=clamp(length(local),0.0,1.2);
  // Convex lens: sample towards its centre (magnification), then bend at meniscus.
  vec2 bulge=-(px-w.anchor)*(.28-.08*radial*radial);
  vec2 meniscus=-normal*bevel*min(w.r*.26,13.0);
  vec2 wave=vec2(sin(px.y*.023+u_time*.52),cos(px.x*.019-u_time*.43))*.32;
  vec2 offset=(bulge+meniscus+wave-u_velocity*.006)*rest*rest*u_strength;
  vec2 uv=v_uv+offset/u_screen;
  vec2 fringe=normal*bevel*u_dispersion*rest/u_screen;
  vec3 inside=vec3(warm(uv+fringe).r,warm(uv).g,warm(uv-fringe).b);
  // Reflections and a directional wet rim, never a white ring.
  float light=max(dot(normal,normalize(vec2(-.65,-.76))),0.0);
  float dark=max(dot(normal,normalize(vec2(.5,.86))),0.0);
  float rim=exp(-pow((w.d+1.0)/.72,2.0));
  float glint=pow(light,7.0)*rim*.62*rest;
  inside*=1.0-bevel*(.06+dark*.13)*rest;
  inside=mix(inside,vec3(.85,.94,1.0),glint);
  float spec=exp(-dot(local-vec2(-.29,-.43),local-vec2(-.29,-.43))*105.0)*.11*rest;
  inside+=vec3(.80,.91,1.0)*spec;
  float mask=1.0-smoothstep(-.8,.75,w.d);
  vec3 result=mix(outside*(1.0-shadow),inside,mask);
  gl_FragColor=vec4(mix(result,warm(v_uv),smoothstep(.94,1.0,u_open)),1.0);
}
