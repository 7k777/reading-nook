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
  // Only positive linear deformation is allowed: the contact boundary remains
  // an ellipse at rest, while pressed, and throughout a drag. No pointed tail.
  float stretch=clamp(length(u_velocity)/2200.0,0.0,.08)*moving;
  p-=direction*dot(p,direction)*stretch;
  vec2 pressScale=vec2(1.0+u_pressure*.12*moving,1.0-u_pressure*.07*moving);
  vec2 q=p/(axes*pressScale);
  float l=max(length(q),.0001);
  float r=min(axes.x,axes.y);
  Water w;
  w.d=(l-1.0)*r;
  vec2 gradient=q/(axes*pressScale);
  w.grad=gradient/max(length(gradient),.00001);
  w.anchor=anchor;w.local=q;w.r=r;
  return w;
}
vec2 photoUv(vec2 uv){return (uv-u_frame.xy)/u_frame.zw;}
// Perspective shafts from one sun behind the upper-right ridge. Each Gaussian
// is a gap in the canopy, widening with distance; smooth density drifts slowly.
float shaft(vec2 p,float slope,float width,float power){
  vec2 origin=vec2(.94,.12);
  float y=p.y-origin.y;
  float x=p.x-origin.x-slope*y;
  float w=width*(.10+max(y,0.0));
  return exp(-x*x/(w*w))*power;
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float scattering(vec2 p){
  if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0)return 0.0;
  float beams=shaft(p,-1.48,.038,.70)+shaft(p,-1.10,.070,.86)
    +shaft(p,-.79,.025,.54)+shaft(p,-.51,.055,.63)+shaft(p,-.23,.022,.35);
  float density=.64+.36*noise(vec2(p.x*7.0+u_time*.035,p.y*6.0-u_time*.025));
  float gate=smoothstep(.12,.23,p.y)*(1.0-smoothstep(.53,.78,p.y));
  float extinction=exp(-max(p.y-.22,0.0)*1.7);
  return clamp(beams*density*gate*extinction*.64,0.0,.60);
}
vec3 airColor=vec3(1.0,.96,.85);
vec3 warm(vec2 uv){
 vec2 p=photoUv(uv);
 if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0)return vec3(.090196,.137255,.20);
 vec3 photo=texture2D(u_warm,p).rgb;
 photo=mix(photo,airColor,scattering(p));
 vec4 secret=texture2D(u_words,clamp(uv,.001,.999));
 return mix(photo,secret.rgb,secret.a);
}
void droplet(){
  vec2 px=v_uv*u_screen;
  if(u_open>.999){vec2 ripple=vec2(sin(v_uv.y*19.0-u_time*5.0),cos(v_uv.x*15.0+u_time*4.0))*u_pulse*.0018;gl_FragColor=vec4(warm(v_uv+ripple),1.0);return;}
  float rest=1.0-u_open;
  vec2 axes=u_half;
  Water w=bead(px,u_center,axes,u_time*.52,rest);
  // The unmodified exterior is a native browser image beneath this transparent canvas.
  // Expansion keeps a smooth convex contour; surface optics carry the motion.

  // A droplet has a raised cap, a contact shadow on the glass, and a small caustic.
  // Shadow is displaced down-right rather than painted as a dark outline.
  Water shadowShape=bead(px-vec2(.35,.9)*rest,u_center,axes,u_time*.52,rest);
  float shadow=exp(-pow(max(shadowShape.d,0.0)/6.5,2.0))*.032*rest;
  if(w.d>18.0){gl_FragColor=vec4(vec3(0.0),shadow);return;}
  vec2 normal=w.grad/max(length(w.grad),.0001);
  float depth=max(-w.d,0.0);
  vec2 local=w.local;
  float rho=min(length(local),.999);
  // A wetted aspherical cap: broad contact footprint, low centre and a curved
  // meniscus. Analytic derivatives produce the 3-D normal; no sphere is rendered.
  float support=max(1.0-dot(local,local),.001);
  float height=.30*(1.0-u_pressure*.32)*(1.0-u_open*.80);
  float exponent=.65;
  float gravity=1.0+.20*local.y;
  float profile=pow(support,exponent);
  float thickness=height*w.r*profile*gravity;
  vec2 dh=-2.0*height*w.r*exponent*pow(support,exponent-1.0)*local*gravity;
  dh.y+=height*w.r*profile*.20;
  vec3 N=normalize(vec3(-dh/axes,1.0));
  N=normalize(N+vec3(-u_velocity*.00006,0.0)*rest);
  // Snell refraction through water, n=1.333. The virtual image plane behind the
  // glass lets the curved cap continuously magnify the whole underlying surface.
  vec3 ray=refract(vec3(0.0,0.0,-1.0),N,1.0/1.333);
  float opticalDistance=thickness+w.r*.65*rest;
  vec2 offset=ray.xy/max(-ray.z,.15)*opticalDistance*u_strength*rest*rest;
  offset+=vec2(sin(px.y*.023+u_time*.45),cos(px.x*.019-u_time*.37))*.20*rest;
  offset*=mix(.10,1.0,smoothstep(0.0,4.5,depth));
  vec2 uv=v_uv+offset/u_screen;
  float edge=exp(-depth/max(1.3,w.r*.075));
  vec2 fringe=normal*edge*u_dispersion*rest/u_screen;
  vec3 inside=vec3(warm(uv+fringe).r,warm(uv).g,warm(uv-fringe).b);
  vec3 reflected=reflect(vec3(0.0,0.0,-1.0),N);
  // Two localized light cues on the curved meniscus leave the centre clear.
  // Broad white environment tint made earlier iterations read as an air bubble.
  vec3 light=normalize(vec3(-.48,-.62,.68));
  float glint=pow(max(dot(reflected,light),0.0),140.0);
  float pinLight=pow(max(dot(reflected,normalize(vec3(.40,-.55,.75))),0.0),220.0);
  float streak=exp(-pow(abs((reflected.x+.43)/.12),2.0)-pow(abs((reflected.y+.60)/.30),2.0))*smoothstep(.05,.35,reflected.z);
  float lowerRight=max(dot(normal,normalize(vec2(.46,.89))),0.0);
  inside*=1.0-edge*pow(lowerRight,5.0)*.045*rest;
  inside=mix(inside,vec3(.97,.99,1.0),clamp(glint*.78+streak*.22+pinLight*.34,0.0,.88)*rest);
  // A thin directional contact line keeps the droplet findable without a white ring.
  inside+=vec3(.74,.88,1.0)*u_discovery*.025*exp(-dot(local,local)*2.5);
  float caustic=exp(-pow(abs((w.d-2.8)/1.25),2.0))*pow(lowerRight,9.0)*.025*rest;
  float outsideAlpha=shadow+caustic*(1.0-shadow);
  vec3 outsideColor=vec3(.64,.82,1.0)*caustic*(1.0-shadow);
  float mask=1.0-smoothstep(-1.2,.7,w.d);
  float expanded=smoothstep(.94,1.0,u_open);
  float alpha=mix(mask+(1.0-mask)*outsideAlpha,1.0,expanded);
  // Premultiplied output: optical pixels and their shadow alone cover the photo.
  vec3 color=mix(inside*mask+outsideColor*(1.0-mask),warm(v_uv),expanded);
  float rim=exp(-pow(abs((w.d+.15)/.65),2.0));
  float upperLeft=pow(max(dot(normal,normalize(vec2(-.62,-.78))),0.0),5.0);
  float rimAlpha=rim*(.23+.53*upperLeft+.18*pow(lowerRight,4.0))*rest;
  vec3 rimColor=mix(warm(v_uv)*.30,vec3(.95,.99,1.0),upperLeft);
  color=color*(1.0-rimAlpha)+rimColor*rimAlpha;
  alpha=alpha+rimAlpha*(1.0-alpha);
  gl_FragColor=vec4(color,alpha);
}

void main(){
  droplet();
  vec4 water=gl_FragColor;
  vec2 p=photoUv(v_uv);
  float light=scattering(p);
  // Dust is visible only inside illuminated air. Particle centres stay away
  // from cell boundaries, so one sample is continuous without a costly 3x3 loop.
  vec2 field=p*vec2(55.0,74.0)+vec2(u_time*.08,-u_time*.16);
  vec2 cell=floor(field);
  float seed=hash(cell);
  vec2 at=cell+.15+.70*vec2(hash(cell+3.1),hash(cell+9.7));
  vec2 delta=field-at;
  float r=mix(.025,.065,seed);
  float dust=exp(-dot(delta,delta)/(r*r))*step(.90,seed);
  float a=clamp(light+dust*min(light*5.0,.7),0.0,.70);
  // Composite luminous air below the refractive cap. Its interior samples the
  // same photo-space light field through Snell optics rather than a CSS overlay.
  gl_FragColor=vec4(water.rgb+airColor*a*(1.0-water.a),water.a+a*(1.0-water.a));
}
