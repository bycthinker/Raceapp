'use strict';
const $=id=>document.getElementById(id), sheet=$('sheet'), layer=$('drawing'), lib=RaceAtelier;
const uid=()=> 'perso-'+crypto.randomUUID();
const fresh=()=>({id:uid(),name:'Mon circuit',width:4,points:[],closed:false});
let draft=fresh(),mode='pen',selected=-1,segment=-1,gesture=null,history=[],dirty=false;
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
  if(closed){
    try{
      const {boundaries,finish}=lib.build(draft,true);
      layer.replaceChildren();
      svg('path',{d:boundaries.map(b=>path(b,true)).join(' '),fill:'#385d51','fill-rule':'evenodd',stroke:'#173e34','stroke-width':'.13'});
      svg('path',{d,fill:'none',stroke:'#d1dfbc','stroke-width':.11,'stroke-dasharray':'.48 .48'});
      if(segment>=0){
        const a=draft.points[segment],b=draft.points[(segment+1)%draft.points.length];
        svg('path',{d:path([a,b],false),stroke:'#f4ba65','stroke-width':'.32',fill:'none','stroke-dasharray':'.55 .32'});
      }
      if(finish){
        const view=lib.gateView(finish),ends=view.stripe();
        svg('line',{...ends,stroke:'#162322','stroke-width':'.6'});
        svg('line',{...ends,stroke:'#f4edd2','stroke-width':'.46','stroke-dasharray':'.42 .28'});
        for(const [cx,cy] of finish.gridPoints)svg('circle',{cx,cy,r:.19,fill:'#fff',stroke:'#193f36','stroke-width':.08});
        const translate=view.mid;
        svg('path',{d:'M .6 0H3 m -.8 -.65 .8 .65 -.8 .65',transform:'translate('+translate.join(' ')+') rotate('+view.angle+')',stroke:'#ffbd63','stroke-width':'.38',fill:'none'});
      }
      if(mode==='edit')draft.points.forEach(([cx,cy],i)=>svg('circle',{cx,cy,r:selected===i?.55:.38,fill:selected===i?'#fa9c37':'#f5ffcd',stroke:'#193f36','stroke-width':'.12'}));
    }catch{}
  }
  if(pts.length&&!closed)svg('circle',{cx:pts[0][0],cy:pts[0][1],r:.65,fill:'#f5ad48'});
  $('pen').setAttribute('aria-pressed',mode==='pen');$('edit').setAttribute('aria-pressed',mode==='edit');
  $('undo').disabled=!history.length;$('close').disabled=closed||draft.points.length<3;
  $('edit').disabled=!closed;$('pen').disabled=closed;$('save').disabled=$('test').disabled=!closed;
  $('round').disabled=!closed||selected<0;$('round').value=selected<0?65:Math.round(draft.points[selected][2]*100);
  $('roundVal').textContent=selected<0?'—':$('round').value+' %';
  $('finish').disabled=$('reverse').disabled=!closed;
  $('finish').setAttribute('aria-pressed',mode==='finish');
  $('widthScope').textContent=segment>=0?'· segment sélectionné':'· toute la piste';
  const width=draft.widths?.[segment]??draft.width;
  $('width').value=width;$('widthVal').textContent=width.toLocaleString('fr')+' carreaux';
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
  if(mode==='finish'){
    const previous=draft.finishPoint;draft.finishPoint=p;
    try{lib.build(draft)}catch(err){draft.finishPoint=previous;hint(err.message);return}
    draft.finishPoint=previous;mark();draft.finishPoint=p;
    mode='edit';redraw();hint('Ligne placée. La flèche indique le sens de course.');return;
  }
  if(mode==='edit'){
    let nearest=-1,best=2.2;draft.points.forEach((v,i)=>{const n=distance(p,v);if(n<best){nearest=i;best=n}});
    selected=nearest;segment=-1;
    if(nearest<0){
      let bestDistance=3.2;
      draft.points.forEach((a,i)=>{
        const b=draft.points[(i+1)%draft.points.length],dx=b[0]-a[0],dy=b[1]-a[1];
        const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
        const d=distance(p,[a[0]+t*dx,a[1]+t*dy]);
        if(d<bestDistance){bestDistance=d;segment=i}
      });
      if(segment>=0)hint('Règle la largeur du segment sélectionné avec le curseur.');
      redraw();return;
    }
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
$('undo').onclick=()=>{if(!history.length)return;draft=JSON.parse(history.pop());$('name').value=draft.name;selected=segment=-1;mode=draft.closed?'edit':'pen';redraw();hint('Dernière modification annulée.')};
for(const [id,apply] of [['width',v=>{
  if(segment<0){draft.width=v;delete draft.widths}
  else{draft.widths??=draft.points.map(()=>draft.width);draft.widths[segment]=v}
}],['round',v=>draft.points[selected][2]=v/100]]){
  let changing=false;$(id).oninput=()=>{if(!changing){mark();changing=true}apply(Number($(id).value));redraw()};$(id).onchange=()=>changing=false;
}
$('name').oninput=()=>{draft.name=$('name').value;dirty=true};
function shelf(){const list=lib.list();$('shelf').replaceChildren(...list.map(d=>new Option(d.name,d.id)));$('load').disabled=!list.length}
function storeDraft(){try{lib.build(draft);lib.save(draft);dirty=false;shelf();$('shelf').value=draft.id;hint('Circuit enregistré sur cet appareil.');return true}catch(e){hint(e.message);return false}}
$('save').onclick=storeDraft;$('test').onclick=()=>{if(storeDraft())location.href='local.html?mode=solo&from=atelier&circuit='+encodeURIComponent(draft.id)+(location.protocol==='file:'?'#dessin='+encodeURIComponent(JSON.stringify(draft)):'')};
function openDraft(d){if(dirty&&!confirm('Abandonner les modifications non enregistrées ?'))return;draft=d;history=[];selected=segment=-1;dirty=false;mode=d.closed?'edit':'pen';$('name').value=d.name;redraw();hint(d.closed?'Sélectionne un virage à retoucher.':'Maintiens le clic et dessine. Reviens au point de départ pour fermer le circuit.')}
$('load').onclick=()=>{const d=lib.list().find(v=>v.id===$('shelf').value);if(d)openDraft(d)};
$('fresh').onclick=()=>openDraft(fresh());
$('pen').onclick=()=>hint('Maintiens le clic pour tracer la piste.');$('edit').onclick=()=>{mode='edit';redraw();hint('Clique sur un point pour modifier un virage ou entre deux points pour régler la largeur du segment.')};
$('finish').onclick=()=>{mode='finish';selected=segment=-1;redraw();hint('Clique sur le tracé à l’endroit où placer la ligne de départ et d’arrivée.')};
$('reverse').onclick=()=>{mark();draft.reverse=!draft.reverse;redraw();hint('Sens de course inversé. La flèche indique la nouvelle direction.')};
shelf();
const returningId = new URLSearchParams(location.search).get('circuit');
const returningDraft = returningId && lib.list().find(item => item.id === returningId);
openDraft(returningDraft || draft);
if (returningDraft) $('shelf').value = returningId;

// Le premier contact tactile reste réversible jusqu'au relevé du doigt.
{
  const down=sheet.onpointerdown, move=sheet.onpointermove, up=sheet.onpointerup;
  const fingers=new Map();
  let owner=null, pen=null, navigating=false, initial=null, snapshot=null;
  function remember(){
    return {draft:structuredClone(draft),history:history.slice(),mode,selected,segment,dirty};
  }
  function rollback(){
    if(!snapshot)return;
    ({draft,history,mode,selected,segment,dirty}=snapshot);
    gesture=null;snapshot=null;owner=null;redraw();
  }
  function pair(){
    const [a,b]=[...fingers.values()];
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
  }
  function anchor(m=pair()){
    const view=sheet.viewBox.baseVal;
    const center=new DOMPoint(m.x,m.y).matrixTransform(sheet.getScreenCTM().inverse());
    initial={m,width:view.width,center};
  }
  function panZoom(m=pair()){
    const rect=sheet.getBoundingClientRect();
    const width=Math.min(96,Math.max(8,initial.width*initial.m.d/m.d)),height=width*2/3;
    const x=initial.center.x-(m.x-rect.left)*width/rect.width;
    const y=initial.center.y-(m.y-rect.top)*height/rect.height;
    sheet.setAttribute('viewBox',[Math.max(0,Math.min(96-width,x)),Math.max(0,Math.min(64-height,y)),width,height].join(' '));
  }
  const nativeNavigation=lib.bindTouchPair(sheet,()=>pen===null,
    p=>{rollback();anchor({...p,d:p.distance})},p=>panZoom({...p,d:p.distance}),()=>{initial=null;fingers.clear();navigating=false});
  sheet.onpointerdown=e=>{
    if(e.button!==0||nativeNavigation())return;
    if(e.pointerType==='touch'){
      if(pen!==null||('ontouchstart' in window && e.isPrimary===false))return;
      fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});sheet.setPointerCapture(e.pointerId);
      if(!('ontouchstart' in window)&&fingers.size>=2){rollback();navigating=true;anchor();return}
      if(navigating)return;
    }else if(e.pointerType==='pen'){
      rollback();fingers.clear();navigating=false;pen=e.pointerId;
    }else if(owner!==null||navigating)return;
    snapshot=remember();owner=e.pointerId;sheet.setPointerCapture(owner);down(e);
  };
  sheet.onpointermove=e=>{
    if(nativeNavigation())return;
    if(fingers.has(e.pointerId)){
      fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(navigating){if(fingers.size>=2)panZoom();return}
    }
    if(e.pointerId!==owner)return;
    const samples=e.pointerType==='pen'?e.getCoalescedEvents?.():null;
    if(samples?.length)for(const sample of samples)move(sample);
    else move(e);
  };
  function end(e,cancelled){
    if(e.pointerId===owner){
      if(cancelled)rollback();else up(e);
      snapshot=null;owner=null;
    }
    if(e.pointerId===pen)pen=null;
    if(fingers.delete(e.pointerId)){
      if(fingers.size>=2)anchor();
      if(!fingers.size)navigating=false;
    }
  }
  sheet.onpointerup=e=>end(e,false);
  sheet.onpointercancel=sheet.onlostpointercapture=e=>end(e,true);
  $('resetView').onclick=()=>sheet.setAttribute('viewBox','0 0 96 64');
  hint('Dessine au Pencil ou à un doigt. À deux doigts, pince pour zoomer ou glisse pour déplacer la feuille.');
}
