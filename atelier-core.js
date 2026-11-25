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
  function build(d,preview=false){
    if(typeof d?.name!=='string'||!d.name.trim()||d.name.length>40)fail('Donne un nom au circuit (40 caractères maximum).');
    const r=stripLoops(d.reverse?shape(d).reverse():shape(d),false);
    if(Math.abs(area(r))<65)fail('Agrandis la boucle pour laisser un espace au milieu.');
    const boundaries=[offset(r,1),offset(r,-1)].sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
    const [outer,hole]=boundaries;
    for(let i=0;i<outer.length;i++)for(let j=0;j<hole.length;j++)if(crossing(outer[i],outer[(i+1)%outer.length],hole[j],hole[(j+1)%hole.length]))fail('Deux bords se touchent. Écarte les virages ou affine le trait.');
    const contains=(ring,x,y)=>intersections(ring,x).filter(h=>h>y).length%2===1;
    const onTrack=(x,y)=>contains(outer,x,y)&&!contains(hole,x,y);
    const segments=r.map((p,i)=>({p,q:r[(i+1)%r.length],i}));
    if(d.finishPoint && (!Array.isArray(d.finishPoint)||d.finishPoint.length!==2||d.finishPoint.some(v=>!Number.isFinite(v))))fail('Position de la ligne invalide.');
    function proximity({p,q}){
      const [x,y]=d.finishPoint;
      const dx=q[0]-p[0],dy=q[1]-p[1];
      const t=Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy)));
      return dist([x,y],mix(p,q,t));
    }
    if(d.finishPoint)segments.sort((a,b)=>proximity(a)-proximity(b));
    else segments.sort((a,b)=>dist(b.p,b.q)-dist(a.p,a.q));
    const preferred=d.finishPoint?proximity(segments[0]):null;
    if(preferred!==null && preferred>4){if(preview)return {boundaries};fail("Clique directement sur la piste pour placer la ligne.")}
    for(const {p,q,i} of segments){
      if(preferred!==null && proximity({p,q})>preferred+2)break;
      const axis=Math.abs(q[0]-p[0])>=Math.abs(q[1]-p[1])?'x':'y';
      const a=axis==='x'?0:1,b=1-a;
      const target=d.finishPoint?.[a]??(p[a]+q[a])/2;
      const at=Math.max(Math.ceil(Math.min(p[a],q[a])),Math.min(Math.floor(Math.max(p[a],q[a])),Math.round(target)));
      if(at<Math.min(p[a],q[a])||at>Math.max(p[a],q[a])||p[a]===q[a])continue;
      const across=p[b]+(q[b]-p[b])*(at-p[a])/(q[a]-p[a]);
      const oriented=ring=>a?ring.map(([x,y])=>[y,x]):ring;
      const cuts=boundaries.flatMap(r=>intersections(oriented(r),at)).sort((a,b)=>a-b);
      const h=cuts.findIndex(k=>k>across);if(h<1||h%2===0)continue;
      const min=cuts[h-1],max=cuts[h],grid=[],direction=Math.sign(q[a]-p[a]);
      const xy=(along,other)=>a?[other,along]:[along,other];
      for(let row=0;row<=3&&grid.length<4;row++){
        for(let col=Math.ceil(min);col<=Math.floor(max)&&grid.length<4;col++){
          const cell=xy(at-row*direction,col);
          const front=xy(at-(row-1)*direction,col);
          if(onTrack(...cell)&&onTrack(...front))grid.push(cell);
        }
      }
      if(grid.length<4)continue;
      const ys=intersections(oriented(hole),at);if(ys.length<2)continue;
      let marker=xy(at,(ys[0]+ys[1])/2),gap=ys[1]-ys[0];
      for(let j=2;j+1<ys.length;j+=2)if(ys[j+1]-ys[j]>gap){gap=ys[j+1]-ys[j];marker=xy(at,(ys[j]+ys[j+1])/2)}
      const finish={axis,at,min,max,direction};
      const nodes=[xy(at,across),...r.slice(i+1).map(p=>p.slice(0,2)),...r.slice(0,i+1).map(p=>p.slice(0,2))].filter((v,k,arr)=>!k||dist(v,arr[k-1])>.02);
      if(dist(nodes[0],nodes.at(-1))<.02)nodes.pop();
      return {id:d.id,name:d.name.trim(),nodes,boundaries,grid,start:finish,finish,width:Math.ceil(Math.max(...outer.map(p=>p[0])))+2,height:Math.ceil(Math.max(...outer.map(p=>p[1])))+2,checkpoints:[],sectors:[[...nodes,nodes[0]]],kerbs:[[],[]],lapMarkers:[marker],winding:Math.sign(area(r))};
    }
    if(preview)return {boundaries};
    fail('Place la ligne sur un tronçon plus droit avec assez de place pour la grille.');
  }
  function list(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
  function save(d){const all=list().filter(x=>x.id!==d.id);localStorage.setItem(key,JSON.stringify([...all,d]))}
  return {shape,build,list,save};
})();
