// Normalized anchors, radius at 390 CSS pixels, vertical aspect. Deliberate clusters,
// not random dots: small beads join into irregular wet patches with breathing space.
export const BEADS=Object.freeze([
 [.16,.16,12,1.13],[.195,.19,20,1.16],
 [.77,.245,23,1.15],[.813,.281,12,1.24],
 [.235,.397,18,1.06],[.29,.43,24,1.17],
 [.79,.56,16,1.18],[.815,.598,23,1.19],
 [.165,.742,24,1.15],[.208,.778,14,1.24],
 [.69,.858,22,1.15],[.73,.889,13,1.10],
 [.47,.10,5,1.05],[.89,.405,6,1.22],
 [.10,.58,5,1.12],[.52,.725,7,1.16],
 [.37,.91,4,1.06],[.64,.355,7,1.09],
 [.34,.27,3,1.10],[.92,.81,4,1.14]
].map(Object.freeze));
export function beadLayout(width,height){
 const scale=Math.min(width/390,height/700,1.35);
 return BEADS.map(([x,y,r,aspect])=>[x*width,y*height,r*scale,aspect]);
}
// Same smooth union as the shader, for interaction verification and fallbacks.
export function waterDistance(x,y,center,radius,beads){
 let d=Math.hypot(x-center[0],y-center[1])-radius,r=radius;
 for(const [cx,cy,br,aspect] of beads){
  const b=(Math.hypot((x-cx)/br,(y-cy)/(br*aspect))-1)*br;
  const k=Math.min(r,br)*.68+3.5;
  const h=Math.min(1,Math.max(0,.5+.5*(b-d)/k));
  d=b*(1-h)+d*h-k*h*(1-h);r=br*(1-h)+r*h;
 }
 return d;
}
