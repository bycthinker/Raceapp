// Moteur commun à l'éditeur, au navigateur de course et au serveur.
globalThis.RaceAtelier=(()=>{
  const key='raceapp:atelier:v1',dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const area=r=>r.reduce((v,p,i)=>{const q=r[(i+1)%r.length];return v+p[0]*q[1]-p[1]*q[0]},0);
  const fail=msg=>{throw new Error(msg)};
  function shape(d){
    if(!d||!Number.isFinite(d.width)||d.width<3||d.width>6||!Array.isArray(d.points)||d.points.length<3||d.points.length>180)fail('Trace une boucle avec au moins trois virages.');
    for(const p of d.points)if(!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v))||p[0]<0||p[0]>96||p[1]<0||p[1]>64||p[2]<0||p[2]>1)fail('Point de tracé invalide.');
    const r=[],n=d.points.length;
    for(let i=0;i<n;i++){
      const p=d.points[i],a=d.points[(i+n-1)%n],b=d.points[(i+1)%n];
      const da=dist(p,a),db=dist(p,b);
      if(Math.min(da,db)<.15)fail('Écarte les deux points de réglage trop proches.');
      const t=Math.min(da,db)*.48*p[2];
      if(t<.05){r.push(p.slice(0,2));continue}
      const u=mix(p,a,t/da),v=mix(p,b,t/db);
      for(let j=0;j<=4;j++){const f=j/4;r.push(mix(mix(u,p,f),mix(p,v,f),f))}
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
      const factor=w/Math.max(.18,1+ux*vx+uy*vy);
      return [p[0]-(uy+vy)*factor,p[1]+(ux+vx)*factor];
    }),true);
  }
  function build(d){
    if(typeof d?.name!=='string'||!d.name.trim()||d.name.length>40)fail('Donne un nom au circuit (40 caractères maximum).');
    const r=stripLoops(shape(d),false);
    if(Math.abs(area(r))<65)fail('Agrandis la boucle pour laisser un espace au milieu.');
    const boundaries=[offset(r,d.width/2),offset(r,-d.width/2)].sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
    const [outer,hole]=boundaries;
    for(let i=0;i<outer.length;i++)for(let j=0;j<hole.length;j++)if(crossing(outer[i],outer[(i+1)%outer.length],hole[j],hole[(j+1)%hole.length]))fail('Deux bords se touchent. Écarte les virages ou affine le trait.');
    const contains=(ring,x,y)=>intersections(ring,x).filter(h=>h>y).length%2===1;
    const onTrack=(x,y)=>contains(outer,x,y)&&!contains(hole,x,y);
    // La ligne est placée sur un tronçon vers la gauche, compatible avec le damier du jeu.
    const segments=r.map((p,i)=>({p,q:r[(i+1)%r.length],i})).filter(({p,q})=>p[0]>q[0]).sort((a,b)=>(b.p[0]-b.q[0])/(1+Math.abs(b.p[1]-b.q[1])*.25)-(a.p[0]-a.q[0])/(1+Math.abs(a.p[1]-a.q[1])*.25));
    for(const {p,q,i} of segments){
      const x=Math.round((p[0]+q[0])/2);if(x>p[0]||x<q[0])continue;
      const y=p[1]+(q[1]-p[1])*(x-p[0])/(q[0]-p[0]);
      const cuts=boundaries.flatMap(b=>intersections(b,x)).sort((a,b)=>a-b);
      const h=cuts.findIndex(k=>k>y);if(h<1)continue;
      const min=cuts[h-1],max=cuts[h],grid=[];
      for(let xx=x;xx<=x+2&&grid.length<4;xx++)for(let yy=Math.ceil(min);yy<=Math.floor(max)&&grid.length<4;yy++)if(onTrack(xx,yy))grid.push([xx,yy]);
      if(grid.length<4)continue;
      const ys=intersections(hole,x);if(ys.length<2)continue;
      let marker=[x,(ys[0]+ys[1])/2],gap=ys[1]-ys[0];
      for(let j=2;j+1<ys.length;j+=2)if(ys[j+1]-ys[j]>gap){gap=ys[j+1]-ys[j];marker=[x,(ys[j]+ys[j+1])/2]}
      const finish={axis:'x',at:x,min,max,direction:-1};
      const nodes=[[x,y],...r.slice(i+1),...r.slice(0,i+1)].filter((v,k,arr)=>!k||dist(v,arr[k-1])>.02);
      if(dist(nodes[0],nodes.at(-1))<.02)nodes.pop();
      return {id:d.id,name:d.name.trim(),nodes,boundaries,grid,start:finish,finish,width:Math.ceil(Math.max(...outer.map(p=>p[0])))+2,height:Math.ceil(Math.max(...outer.map(p=>p[1])))+2,checkpoints:[],sectors:[[...nodes,nodes[0]]],kerbs:[[],[]],lapMarkers:[marker],winding:Math.sign(area(r))};
    }
    fail('Allonge un tronçon vers la gauche pour placer la ligne de départ.');
  }
  function list(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
  function save(d){const all=list().filter(x=>x.id!==d.id);localStorage.setItem(key,JSON.stringify([...all,d]))}
  return {shape,build,list,save};
})();
