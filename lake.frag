precision highp float;
varying vec2 v_uv;
uniform sampler2D u_cold,u_warm,u_words;
uniform vec2 u_screen,u_image,u_center,u_half,u_touch,u_velocity;
uniform vec4 u_frame;
uniform float u_pressure,u_open,u_time,u_strength,u_dispersion,u_pulse,u_discovery;
uniform vec3 u_grade;
struct Water {float d;vec2 grad;vec2 anchor;vec2 local;float r;};
Water bead(vec2 pixel,vec2 anchor,vec2 axes,float phase,float moving){
  vec2 p=pixel-anchor;
  vec2 direction=u_velocity/max(length(u_velocity),1.0);
  float stretch=clamp(length(u_velocity)/1800.0,0.0,.19)*moving;
  p-=direction*dot(p,direction)*stretch;
  // A pinned contact footprint sags slightly under gravity. During drag its rear
  // narrows into a soft tail; it is not the silhouette of a floating sphere.
  float r0=min(axes.x,axes.y);
  float sag=clamp(p.y/max(axes.y,1.0),-1.0,1.0);
  p.x/=1.0+.075*sag*moving;
  p.y/=1.0+.055*moving;
  vec2 side=vec2(-direction.y,direction.x);
  float trailing=clamp(-dot(p,direction)/max(r0,1.0),0.0,1.0);
  p+=side*dot(p,side)*trailing*clamp(length(u_velocity)/650.0,0.0,1.0)*.30*moving;
  vec2 pressScale=vec2(1.0+u_pressure*.20*moving,1.0-u_pressure*.12*moving);
  vec2 q=p/(axes*pressScale);
  float l=max(length(q),.0001);
  float r=min(axes.x,axes.y);
  vec2 unit=q/l;
  float edge=(unit.x*unit.y*.4+unit.x*(unit.x*unit.x-.5)*.5)*smoothstep(4.0,18.0,r);
  Water w;
  w.d=(l-1.0)*r+edge;
  vec2 gradient=q/(axes*pressScale);
  w.grad=gradient/max(length(gradient),.00001);
  w.anchor=anchor;w.local=q;w.r=r;
  return w;
}
vec2 photoUv(vec2 uv){return (uv-u_frame.xy)/u_frame.zw;}
vec3 warm(vec2 uv){
 vec2 p=photoUv(uv);
 if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0)return vec3(.090196,.137255,.20);
 vec3 photo=texture2D(u_warm,p).rgb;
 vec4 secret=texture2D(u_words,clamp(uv,.001,.999));
 return mix(photo,secret.rgb,secret.a);
}
void main(){
  vec2 px=v_uv*u_screen;
  if(u_open>.999){vec2 ripple=vec2(sin(v_uv.y*19.0-u_time*5.0),cos(v_uv.x*15.0+u_time*4.0))*u_pulse*.0018;gl_FragColor=vec4(warm(v_uv+ripple),1.0);return;}
  float rest=1.0-u_open;
  vec2 axes=u_half;
  Water w=bead(px,u_center,axes,u_time*.52,rest);
  // The unmodified exterior is a native browser image beneath this transparent canvas.
  // A liquid front, not a geometric scale-up: travelling lobes settle as it expands.
  float angle=atan((px-u_center).y,(px-u_center).x);
  w.d+=(sin(angle*3.0-u_open*9.0)*7.0+sin(angle*5.0+u_open*6.0)*3.0)*sin(u_open*3.14159265);

  // A droplet has a raised cap, a contact shadow on the glass, and a small caustic.
  // Shadow is displaced down-right rather than painted as a dark outline.
  Water shadowShape=bead(px-vec2(.35,.9)*rest,u_center,axes,u_time*.52,rest);
  float shadow=exp(-pow(max(shadowShape.d,0.0)/6.5,2.0))*.032*rest;
  if(w.d>18.0){gl_FragColor=vec4(vec3(0.0),shadow);return;}
  vec2 normal=w.grad/max(length(w.grad),.0001);
  float depth=max(-w.d,0.0);
  vec2 local=w.local;
  float rho=min(length(local),.999);
  // Spherical-cap height field: press lowers the dome, while the footprint spreads.
  float capHeight=.47*(1.0-u_pressure*.34)*(1.0-u_open*.80);
  float sphereRadius=(1.0+capHeight*capHeight)/(2.0*capHeight);
  float z=sqrt(max(sphereRadius*sphereRadius-rho*rho,.0001));
  float thickness=max(z+capHeight-sphereRadius,0.0)*w.r;
  vec3 N=normalize(vec3(local/sphereRadius,z/sphereRadius));
  N=normalize(N+vec3(-u_velocity*.00010,0.0)*rest);
  // Snell refraction through water, n=1.333. The virtual image plane behind the
  // glass lets the curved cap continuously magnify the whole underlying surface.
  vec3 ray=refract(vec3(0.0,0.0,-1.0),N,1.0/1.333);
  float opticalDistance=thickness+w.r*.92*rest;
  vec2 offset=ray.xy/max(-ray.z,.15)*opticalDistance*u_strength*rest*rest;
  offset+=vec2(sin(px.y*.023+u_time*.45),cos(px.x*.019-u_time*.37))*.20*rest;
  offset*=mix(.10,1.0,smoothstep(0.0,8.5,depth));
  vec2 uv=v_uv+offset/u_screen;
  float edge=exp(-depth/max(1.3,w.r*.075));
  vec2 fringe=normal*edge*u_dispersion*rest/u_screen;
  vec3 inside=vec3(warm(uv+fringe).r,warm(uv).g,warm(uv-fringe).b);
  vec3 reflected=reflect(vec3(0.0,0.0,-1.0),N);
  float fresnel=.0204+.9796*pow(1.0-max(N.z,0.0),5.0);
  // An elongated soft window reflects as a curved streak on the cap. A tighter
  // glint rides the same 3-D normal and moves when pressure or velocity changes.
  float softbox=exp(-pow((reflected.x+.46)/.22,4.0)-pow((reflected.y+.48)/.49,4.0))*smoothstep(.10,.42,reflected.z);
  vec3 light=normalize(vec3(-.48,-.62,.68));
  float glint=pow(max(dot(reflected,light),0.0),155.0);
  float lowerRight=max(dot(normal,normalize(vec2(.46,.89))),0.0);
  inside*=1.0-edge*pow(lowerRight,4.0)*.035*rest;
  float reflection=clamp(fresnel*.25+softbox*.13+glint*.64,0.0,.88)*rest;
  inside=mix(inside,vec3(.94,.98,1.0),reflection);
  // No circumferential rim: depth comes from the cap and local reflections.
  inside+=vec3(.74,.88,1.0)*u_discovery*.025*exp(-dot(local,local)*2.5);
  float caustic=exp(-pow((w.d-2.8)/1.25,2.0))*pow(lowerRight,9.0)*.025*rest;
  float outsideAlpha=shadow+caustic*(1.0-shadow);
  vec3 outsideColor=vec3(.64,.82,1.0)*caustic*(1.0-shadow);
  float mask=1.0-smoothstep(-6.5,1.5,w.d);
  float expanded=smoothstep(.94,1.0,u_open);
  float alpha=mix(mask+(1.0-mask)*outsideAlpha,1.0,expanded);
  // Premultiplied output: optical pixels and their shadow alone cover the photo.
  vec3 color=mix(inside*mask+outsideColor*(1.0-mask),warm(v_uv),expanded);
  gl_FragColor=vec4(color,alpha);
}
