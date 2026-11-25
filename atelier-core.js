// Moteur commun à l'éditeur, au navigateur de course et au serveur.
globalThis.RaceAtelier=(()=>{
  const key='raceapp:atelier:v1',dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const area=r=>r.reduce((v,p,i)=>{const q=r[(i+1)%r.length];return v+p[0]*q[1]-p[1]*q[0]},0);
  const fail=msg=>{throw new Error(msg)};
  function shape(d){
    if(!d||!Number.isFinite(d.width)||d.width<3||d.width>6||!Array.isArray(d.points)||d.points.length<3||d.points.length>180)fail('Trace une boucle avec au moins trois virages.');
    for(const p of d.points)if(!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v))||p[0]<0||p[0]>96||p[1]<0||p[1]>64||p[2]<0||p[2]>1)fail('Point de tracé invalide.');
    if(d.widths!==undefined && (!Array.isArray(d.widths)||d.widths.length!==d.points.length||d.widths.some(w=>!Number.isFinite(w)||w<3||w>6)))fail('La largeur de chaque segment doit être comprise entre 3 et 6 carreaux.');
    const r=[],n=d.points.length;
    for(let i=0;i<n;i++){
      const p=d.points[i],a=d.points[(i+n-1)%n],b=d.points[(i+1)%n];
      const da=dist(p,a),db=dist(p,b);
      if(Math.min(da,db)<.15)fail('Écarte les deux points de réglage trop proches.');
      const incoming=d.widths?.[(i+n-1)%n]??d.width;
      const outgoing=d.widths?.[i]??d.width;
      const t=Math.min(da,db)*.48*p[2];
      if(t<.05){
        if(incoming!==outgoing){
          const transition=Math.min(1,da*.2,db*.2);
          r.push([...mix(p,a,transition/da),incoming], [p[0],p[1],(incoming+outgoing)/2], [...mix(p,b,transition/db),outgoing]);
        }else r.push([p[0],p[1],incoming]);
        continue;
      }
      const u=mix(p,a,t/da),v=mix(p,b,t/db);
      for(let j=0;j<=4;j++){const f=j/4;r.push([...mix(mix(u,p,f),mix(p,v,f),f),incoming+(outgoing-incoming)*f])}
    }
    return r;
  }
  function intersections(r,x){
    const ys=[];
    r.forEach((p,i)=>{const q=r[(i+1)%r.length];if((p[0]>x)!==(q[0]>x))ys.push(p[1]+(q[1]-p[1])*(x-p[0])/(q[0]-p[0]))});
    return ys.sort((a,b)=>a-b);
  }
  function crossing(a,b,c,d){
    const ux=b[0]-a[0],uy=b[1]-a[1],vx=d[0]-c[0],vy=d[1]-c[1],den=ux*vy-uy*vx;
    if(Math.abs(den)<1e-9)return;
    const dx=c[0]-a[0],dy=c[1]-a[1],t=(dx*vy-dy*vx)/den,s=(dx*uy-dy*ux)/den;
    if(t>=0&&t<=1&&s>=0&&s<=1)return mix(a,b,t);
  }
  function stripLoops(r,repair){
    for(let attempt=0;attempt<180;attempt++){
      let changed=false;
      outer:for(let i=0;i<r.length-2;i++)for(let j=i+2;j<r.length;j++){
        if(i===0&&j===r.length-1)continue;
        const p=crossing(r[i],r[i+1],r[j],r[(j+1)%r.length]);if(!p)continue;
        if(!repair)fail('Le trait se croise. Déplace un point du virage pour séparer les passages.');
        const a=[p,...r.slice(i+1,j+1)],b=[p,...r.slice(j+1),...r.slice(0,i+1)];
        if(Math.min(Math.abs(area(a)),Math.abs(area(b)))>4)fail('Deux portions de piste se recouvrent. Écarte-les ou réduis la largeur.');
        r=Math.abs(area(a))>Math.abs(area(b))?a:b;changed=true;break outer;
      }
      if(!changed)return r;
    }
    fail('Espace davantage les virages.');
  }
  function offset(r,w){
    return stripLoops(r.map((p,i)=>{
      const a=r[(i+r.length-1)%r.length],b=r[(i+1)%r.length],u=dist(p,a),v=dist(b,p);
      const ux=(p[0]-a[0])/u,uy=(p[1]-a[1])/u,vx=(b[0]-p[0])/v,vy=(b[1]-p[1])/v;
      const factor=w*p[2]/2/Math.max(.18,1+ux*vx+uy*vy);
      return [p[0]-(uy+vy)*factor,p[1]+(ux+vx)*factor];
    }),true);
  }
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
  const along=(p,v,t)=>[p[0]+v[0]*t,p[1]+v[1]*t];
  function insideRing(ring,p){return intersections(ring,p[0]).filter(y=>y>p[1]).length%2===1}
  function interiorMarker(hole){
    // Un intervalle ouvert entre deux intersections est dans l'îlot, même à l'épingle.
    let best=0,marker;
    const xs=hole.map(p=>p[0]),left=Math.min(...xs),right=Math.max(...xs);
    for(let i=0;i<25;i++){
      const x=left+(i+.5)*(right-left)/25,ys=intersections(hole,x);
      for(let j=0;j+1<ys.length;j+=2){
        const span=ys[j+1]-ys[j];if(span>best){best=span;marker=[x,(ys[j]+ys[j+1])/2]}
      }
    }
    if(!marker)fail('Élargis l’espace au centre de la boucle.');
    return marker;
  }
  function bankHits(rings,anchor,tangent,normal){
    const hits=[];
    rings.forEach((ring,bank)=>ring.forEach((p,i)=>{
      const q=ring[(i+1)%ring.length],a=dot(sub(p,anchor),tangent),b=dot(sub(q,anchor),tangent);
      if((a>0)===(b>0))return;
      const point=mix(p,q,a/(a-b));
      hits.push({bank,i,point,t:dot(sub(point,anchor),normal)});
    }));
    hits.sort((a,b)=>a.t-b.t);
    const front=hits.findIndex(h=>h.t>0);
    return front>0?[hits[front-1],hits[front]]:[];
  }
  function alignBank(ring,hit,tangent){
    // Deux petits raccords encadrent un bord droit exactement orthogonal au damier.
    let ordered=[hit.point,...ring.slice(hit.i+1),...ring.slice(0,hit.i+1),hit.point];
    let length=0;const vertices=[];
    for(let i=1;i<ordered.length;i++){length+=dist(ordered[i-1],ordered[i]);vertices.push({p:ordered[i],s:length})}
    const trim=.6;
    const remaining=vertices.filter(v=>v.s>trim && v.s<length-trim).map(v=>v.p);
    if(remaining.length<2)return ring;
    const near=ordered.find(p=>dist(p,hit.point)>.001);
    const sign=dot(sub(near,hit.point),tangent)>=0?1:-1;
    return [along(hit.point,tangent,.35*sign),...remaining,along(hit.point,tangent,-.35*sign)];
  }
  function startSection(r,boundaries,target){
    const projections=r.map((p,i)=>{
      const q=r[(i+1)%r.length],v=sub(q,p),length=dist(p,q);
      const f=target?Math.max(0,Math.min(1,dot(sub(target,p),v)/(length*length))):.5;
      const center=mix(p,q,f);
      return {i,center,length,unit:v.map(a=>a/length),score:target?dist(target,center):-length};
    }).sort((a,b)=>a.score-b.score);
    if(target && projections[0].score>4.5)fail('Touche la chaussée à l’endroit du départ.');
    const inside=p=>insideRing(boundaries[0],p)&&!insideRing(boundaries[1],p);
    for(const part of projections){
      if(target && part.score>projections[0].score+3)break;
      const [cx,cy]=part.center,candidates=[];
      for(let x=Math.round(cx)-2;x<=Math.round(cx)+2;x++)for(let y=Math.round(cy)-2;y<=Math.round(cy)+2;y++){
        const anchor=[x,y];if(!inside(anchor))continue;
        for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1],[2,1],[2,-1],[1,2],[1,-2],[3,1],[3,-1],[1,3],[1,-3],[3,2],[3,-2],[2,3],[2,-3]]){
          const step=Math.hypot(dx,dy),normal=[dx/step,dy/step];
          const error=Math.abs(dot(normal,part.unit));if(error>.44)continue;
          let tangent=[normal[1],-normal[0]];
          if(dot(tangent,part.unit)<0)tangent=tangent.map(v=>-v);
          candidates.push({anchor,normal,tangent,step,score:dist(anchor,part.center)+error*5});
        }
      }
      candidates.sort((a,b)=>a.score-b.score);
      for(const {anchor,normal,tangent,step} of candidates){
        const hits=bankHits(boundaries,anchor,tangent,normal);
        if(hits.length!==2||hits[0].bank===hits[1].bank)continue;
        if(Math.max(-hits[0].t,hits[1].t)+1e-7<step)continue;
        const banks=boundaries.slice();
        for(const h of hits)banks[h.bank]=alignBank(banks[h.bank],h,tangent);
        const grid=[];
        for(let x=anchor[0]-7;x<=anchor[0]+7;x++)for(let y=anchor[1]-7;y<=anchor[1]+7;y++){
          const v=sub([x,y],anchor),depth=-dot(v,tangent),side=dot(v,normal);
          if(depth<-.000001||depth>4||side<hits[0].t-1e-7||side>hits[1].t+1e-7)continue;
          if(insideRing(banks[0],[x,y])&&!insideRing(banks[1],[x,y]))grid.push({p:[x,y],depth,side:Math.abs(side)});
        }
        grid.sort((a,b)=>Math.round(a.depth*1e6)-Math.round(b.depth*1e6)||a.side-b.side);
        if(grid.length<4)continue;
        const gridPoints=[];
        for(let k=Math.ceil((hits[0].t-1e-7)/step);k<=Math.floor((hits[1].t+1e-7)/step);k++){
          gridPoints.push(along(anchor,normal,k*step).map(Math.round));
        }
        const finish={anchor,forward:tangent,ends:hits.map(h=>h.point),gridPoints};
        // Partir du croisement réel avec le milieu de la piste.
        let nearest;
        r.forEach((p,i)=>{
          const q=r[(i+1)%r.length],a=dot(sub(p,anchor),tangent),b=dot(sub(q,anchor),tangent);
          if(a>0||b<=0)return;
          const point=mix(p,q,a/(a-b)),gap=dist(point,anchor);
          if(!nearest||gap<nearest.gap)nearest={i,point,gap};
        });
        if(!nearest||nearest.gap>4)continue;
        const nodes=[nearest.point,...r.slice(nearest.i+1),...r.slice(0,nearest.i+1)].map(p=>p.slice(0,2)).filter((p,i,a)=>!i||dist(p,a[i-1])>.02);
        if(dist(nodes[0],nodes.at(-1))<.02)nodes.pop();
        return {finish,grid:grid.slice(0,4).map(v=>v.p),nodes,boundaries:banks};
      }
    }
    fail('Écarte légèrement les deux portions de piste près du départ.');
  }
  function gateView(gate){
    let ends=gate.ends,forward=gate.forward;
    if(!ends){
      const {axis,at,min,max,direction}=gate;
      ends=axis==='x'?[[at,min],[at,max]]:[[min,at],[max,at]];
      forward=axis==='x'?[direction,0]:[0,direction];
    }
    const [a,b]=ends;
    function stripe(offset=0){
      const [x1,y1]=along(a,forward,offset),[x2,y2]=along(b,forward,offset);
      return {x1,y1,x2,y2};
    }
    return {stripe,mid:mix(a,b,.5),angle:Math.atan2(forward[1],forward[0])*180/Math.PI};
  }
  function crossGate(p,m,g){
    const a=dot(sub([p.x,p.y],g.anchor),g.forward),b=dot(sub([m.x,m.y],g.anchor),g.forward);
    if(a>1e-8||b<=1e-8)return null;
    const point=mix([p.x,p.y],[m.x,m.y],Math.max(0,-a)/(b-a));
    const span=sub(g.ends[1],g.ends[0]),k=dot(sub(point,g.ends[0]),span)/dot(span,span);
    return k>=-1e-8&&k<=1+1e-8?{point,distance:Math.round(b*1e8)/1e8}:null;
  }

  function build(d,preview=false){
    if(typeof d?.name!=='string'||!d.name.trim()||d.name.length>40)fail('Donne un nom au circuit (40 caractères maximum).');
    const r=stripLoops(d.reverse?shape(d).reverse():shape(d),false);
    if(Math.abs(area(r))<65)fail('Agrandis la boucle pour laisser un espace au milieu.');
    const boundaries=[offset(r,1),offset(r,-1)].sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
    const [outer,hole]=boundaries;
    for(let i=0;i<outer.length;i++)for(let j=0;j<hole.length;j++)if(crossing(outer[i],outer[(i+1)%outer.length],hole[j],hole[(j+1)%hole.length]))fail('Deux bords se touchent. Écarte les virages ou affine le trait.');
    if(d.finishPoint && (!Array.isArray(d.finishPoint)||d.finishPoint.length!==2||d.finishPoint.some(v=>!Number.isFinite(v))))fail('Position de la ligne invalide.');
    let section;
    try{section=startSection(r,boundaries,d.finishPoint)}catch(e){if(preview)return {boundaries};throw e}
    const {finish,nodes}=section;
    return {...section,id:d.id,name:d.name.trim(),start:finish,width:Math.ceil(Math.max(...outer.map(p=>p[0])))+2,height:Math.ceil(Math.max(...outer.map(p=>p[1])))+2,checkpoints:[],sectors:[[...nodes,nodes[0]]],kerbs:[[],[]],lapMarkers:[interiorMarker(hole)],winding:Math.sign(area(r))};
  }
  // Sur iPad les contacts natifs restent associés au document, même quand la
  // grille SVG remplace ses éléments ou que Safari annule un PointerEvent.
  function bindTouchPair(surface,enabled,begin,move,finish){
    const ids=new Set();
    let active=false,signature='';
    function handle(event){
      if(event.type==='touchstart' && enabled()){
        const box=surface.getBoundingClientRect();
        for(const t of event.changedTouches){
          if(surface.contains(t.target) || (t.clientX>=box.left&&t.clientX<=box.right&&t.clientY>=box.top&&t.clientY<=box.bottom&&surface.contains(document.elementFromPoint(t.clientX,t.clientY))))ids.add(t.identifier);
        }
      }
      const points=Array.from(event.touches).filter(t=>ids.has(t.identifier)).sort((a,b)=>a.identifier-b.identifier);
      const current=new Set(points.map(t=>t.identifier));
      for(const id of ids)if(!current.has(id))ids.delete(id);
      if(points.length<2 && !active)return;
      if(event.cancelable)event.preventDefault();
      if(points.length>=2 && enabled()){
        const [a,b]=points;
        const pair={x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2,
          distance:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY))};
        const next=a.identifier+'-'+b.identifier;
        if(!active||signature!==next){active=true;signature=next;begin(pair)}
        else if(event.type==='touchmove')move(pair);
      }else if(!points.length || !enabled()){
        active=false;signature='';finish();
      }else signature='';
    }
    for(const type of ['touchstart','touchmove','touchend','touchcancel'])
      document.addEventListener(type,handle,{capture:true,passive:false});
    surface.addEventListener('gesturestart',e=>{if(enabled())e.preventDefault()},{passive:false});
    surface.addEventListener('gesturechange',e=>{if(enabled())e.preventDefault()},{passive:false});
    return ()=>active;
  }

  function list(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
  function save(d){const all=list().filter(x=>x.id!==d.id);localStorage.setItem(key,JSON.stringify([...all,d]))}
  return {shape,build,list,save,gateView,crossGate,bindTouchPair};
})();
