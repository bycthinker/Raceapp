'use strict';
const $=id=>document.getElementById(id), sheet=$('sheet'), layer=$('drawing'), lib=RaceAtelier;
const uid=()=> 'perso-'+crypto.randomUUID();
const fresh=()=>({id:uid(),name:'Mon circuit',width:4,points:[],closed:false});
let draft=fresh(),mode='pen',selected=-1,gesture=null,history=[],dirty=false;
const distance=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
function mark(){history.push(JSON.stringify(draft));if(history.length>60)history.shift();dirty=true}
function hint(t){$('hint').textContent=t}
function point(e){const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(sheet.getScreenCTM().inverse());return [Math.max(3,Math.min(93,pt.x)),Math.max(3,Math.min(61,pt.y))].map(v=>Math.round(v*20)/20)}
function path(points,closed){return points.length?'M'+points.map(p=>p.slice(0,2).join(',')).join(' L')+(closed?' Z':''):''}
function svg(tag,attrs){const el=document.createElementNS(sheet.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);layer.append(el)}
function redraw(){
  layer.replaceChildren();
  let pts=draft.points,closed=draft.closed;
  if(gesture?.raw)pts=pts.concat(gesture.raw);
  if(closed)try{pts=lib.shape(draft)}catch{}
  const d=path(pts,closed);
  svg('path',{d,fill:'none',stroke:'#284f46','stroke-width':draft.width,'stroke-linecap':'round','stroke-linejoin':closed?'miter':'round','stroke-miterlimit':3,opacity:'.83'});
  svg('path',{d,fill:'none',stroke:'#d1dfbc','stroke-width':.11,'stroke-dasharray':'.48 .48'});
  if(mode==='edit'&&closed)draft.points.forEach(([cx,cy],i)=>svg('circle',{cx,cy,r:selected===i?.55:.38,fill:selected===i?'#fa9c37':'#f5ffcd',stroke:'#193f36','stroke-width':.12}));
  if(closed && !gesture){
    try{
      const {finish}=lib.build(draft);
      svg('line',{x1:finish.at,x2:finish.at,y1:finish.min,y2:finish.max,stroke:'#f4edd2','stroke-width':.38,'stroke-dasharray':'.45 .28'});
    }catch{}
  }
  if(pts.length&&!closed)svg('circle',{cx:pts[0][0],cy:pts[0][1],r:.65,fill:'#f5ad48'});
  $('pen').setAttribute('aria-pressed',mode==='pen');$('edit').setAttribute('aria-pressed',mode==='edit');
  $('undo').disabled=!history.length;$('close').disabled=closed||draft.points.length<3;
  $('edit').disabled=!closed;$('pen').disabled=closed;$('save').disabled=$('test').disabled=!closed;
  $('round').disabled=!closed||selected<0;$('round').value=selected<0?65:Math.round(draft.points[selected][2]*100);
  $('roundVal').textContent=selected<0?'—':$('round').value+' %';
  $('width').value=draft.width;$('widthVal').textContent=draft.width.toLocaleString('fr')+' cases';
}
function simplify(pts,tolerance){
  if(pts.length<=2)return pts;
  const keep=new Set([0,pts.length-1]),stack=[[0,pts.length-1]];
  while(stack.length){const [a,b]=stack.pop(),p=pts[a],q=pts[b],x=q[0]-p[0],y=q[1]-p[1],len=x*x+y*y;
    let far=-1,best=tolerance;
    for(let i=a+1;i<b;i++){const r=pts[i],t=len?Math.max(0,Math.min(1,((r[0]-p[0])*x+(r[1]-p[1])*y)/len)):0;
      const err=Math.hypot(r[0]-p[0]-t*x,r[1]-p[1]-t*y);if(err>best){best=err;far=i}}
    if(far>=0){keep.add(far);stack.push([a,far],[far,b])}
  }
  return [...keep].sort((a,b)=>a-b).map(i=>pts[i]);
}
function closeLoop(){
  const p=draft.points;if(p.length<3)return;
  if(p.length>3&&distance(p[0],p.at(-1))<1.4)p.pop();
  draft.closed=true;mode='edit';selected=-1;redraw();hint('Touche un point pour régler son arrondi. Fais-le glisser pour déplacer le virage.');
}
sheet.onpointerdown=e=>{
  if(gesture||e.button!==0)return;
  const p=point(e);
  if(mode==='edit'){
    let nearest=-1,best=2.2;draft.points.forEach((v,i)=>{const n=distance(p,v);if(n<best){nearest=i;best=n}});
    selected=nearest;if(nearest<0){redraw();return}
    mark();gesture={id:e.pointerId,drag:nearest,origin:p,original:[...draft.points[nearest]]};
    hint('Vers 0 %, le virage devient pointu. Vers 100 %, il s’arrondit.');
  }else{
    if(draft.points.length&&distance(p,draft.points.at(-1))>3){hint('Reprends au bout du trait ou clique sur « Fermer la boucle ».');return}
    mark();gesture={id:e.pointerId,raw:[p]};
  }
  sheet.setPointerCapture(e.pointerId);redraw();
};
sheet.onpointermove=e=>{
  if(gesture?.id!==e.pointerId)return;
  const p=point(e);
  if(gesture.raw){if(distance(p,gesture.raw.at(-1))>.24)gesture.raw.push(p)}
  else{const {original,origin,drag}=gesture;draft.points[drag]=[Math.max(3,Math.min(93,original[0]+p[0]-origin[0])),Math.max(3,Math.min(61,original[1]+p[1]-origin[1])),original[2]]}
  redraw();
};
sheet.onpointerup=e=>{
  if(gesture?.id!==e.pointerId)return;
  if(gesture.raw){
    const p=point(e);if(distance(p,gesture.raw.at(-1))>.15)gesture.raw.push(p);
    const raw=simplify(gesture.raw,.48);for(const q of raw)if(!draft.points.length||distance(q,draft.points.at(-1))>.6)draft.points.push([...q,.65]);
    if(draft.points.length>180){draft=JSON.parse(history.pop());hint('Trait trop détaillé. Dessine moins de petits zigzags.')}
    else if(draft.points.length>=4&&distance(draft.points[0],draft.points.at(-1))<2.5)closeLoop();
    else hint('Continue depuis le bout du trait ou ferme la boucle.');
  }
  gesture=null;redraw();
};
sheet.onpointercancel=()=>{if(gesture){gesture=null;draft=JSON.parse(history.pop());selected=-1;redraw()}};
$('close').onclick=()=>{mark();closeLoop()};
$('undo').onclick=()=>{if(!history.length)return;draft=JSON.parse(history.pop());$('name').value=draft.name;selected=-1;mode=draft.closed?'edit':'pen';redraw();hint('Dernière modification annulée.')};
for(const [id,apply] of [['width',v=>draft.width=v],['round',v=>draft.points[selected][2]=v/100]]){
  let changing=false;$(id).oninput=()=>{if(!changing){mark();changing=true}apply(Number($(id).value));redraw()};$(id).onchange=()=>changing=false;
}
$('name').oninput=()=>{draft.name=$('name').value;dirty=true};
function shelf(){const list=lib.list();$('shelf').replaceChildren(...list.map(d=>new Option(d.name,d.id)));$('load').disabled=!list.length}
function storeDraft(){try{lib.build(draft);lib.save(draft);dirty=false;shelf();$('shelf').value=draft.id;hint('Circuit enregistré sur cet appareil.');return true}catch(e){hint(e.message);return false}}
$('save').onclick=storeDraft;$('test').onclick=()=>{if(storeDraft())location.href='local.html?mode=solo&circuit='+encodeURIComponent(draft.id)+(location.protocol==='file:'?'#dessin='+encodeURIComponent(JSON.stringify(draft)):'')};
function openDraft(d){if(dirty&&!confirm('Abandonner les modifications non enregistrées ?'))return;draft=d;history=[];selected=-1;dirty=false;mode=d.closed?'edit':'pen';$('name').value=d.name;redraw();hint(d.closed?'Sélectionne un virage à retoucher.':'Maintiens le clic et dessine. Reviens au point de départ pour fermer le circuit.')}
$('load').onclick=()=>{const d=lib.list().find(v=>v.id===$('shelf').value);if(d)openDraft(d)};
$('fresh').onclick=()=>openDraft(fresh());
$('pen').onclick=()=>hint('Maintiens le clic pour tracer la piste.');$('edit').onclick=()=>hint('Sélectionne puis déplace un point de réglage.');
shelf();openDraft(draft);
