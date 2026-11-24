
const straightTrack = [
  [6, 38], [6, 29], [5, 25], [3, 21], [3, 17], [5, 13],
  [9, 10], [9, 2], [21, 2], [21, 10], [20, 13], [16, 17],
  [15, 20], [17, 24], [18, 29], [18, 38],
];
const straightCourse = {
  width:24, height:39, boundaries:[straightTrack],
  start:{ axis:'y',at:34,min:6,max:18,direction:-1 },
  finish:{ axis:'y',at:7,min:9,max:21,direction:-1 },
  grid:[[9,34],[11,34],[13,34],[15,34]], checkpoints:[],
};
const startFinish = { axis:'x',at:32,min:35.9,max:41,direction:-1 };
const paperCourse = {
  width:102, height:46,
  boundaries:[
    [[3,33],[3,9],[3.4,5.6],[4.5,4.1],[6,3.6],[13,3.3],[24,3.7],
      [32,2.9],[44,2.8],[55,3],[63,2.6],[74,2.9],[86,2.5],[96.8,2.6],
      [97.4,3.5],[97.3,6.3],[96.8,9],[97,14.8],[90,15],[79,14.4],
      [70,14],[65.2,14],[65.7,15.5],[69,17.5],[74,19.8],[78,23],
      [83,27.5],[87,30.8],[88.9,33.6],[88.8,35.8],[86,38],[81,39.5],
      [73,40.5],[64,41.6],[56,42.4],[48,42.4],[40,41.4],[32,40.9],
      [24,40.5],[17,39.9],[11,39.9],[5.4,39.1],[4.7,38],[4.1,36],[3,34.2]],
    [[8.9,34.3],[8.5,30],[7.9,26],[7.7,19],[7.6,13],[8,8],[9,6.5],
      [11,6],[22,6.5],[29,6.6],[40,7.4],[48,7],[59,6.9],[70,7.3],
      [82,7.8],[93,7.8],[93,10.5],[88,10.9],[74,10.6],[62,10.5],
      [59,11.1],[58,12.4],[58.2,14.4],[59.3,16.3],[62,18.5],[67,21.1],
      [72,24.1],[77,27.3],[80,30],[81.6,33.8],[81.7,35.1],[79.5,36.6],
      [77,37],[69,36.7],[56,36.8],[45,37],[37,36.6],[32,35.9],[23,35.8],
      [16,35.6],[11,34.9]],
  ],
  start:startFinish, finish:startFinish, grid:[[32,37],[32,38],[32,39],[32,40]],
  checkpoints:[
    {axis:'y',at:23,min:3,max:8,direction:-1},
    {axis:'x',at:52,min:2.8,max:7.2,direction:1},
    {axis:'x',at:75,min:10.5,max:14.5,direction:-1},
    {axis:'x',at:55,min:36.7,max:42.5,direction:-1},
  ],
};
// Centre du ruban dans le sens de la course. Chaque portion rectiligne
// est raccourcie aux deux extrémités par les raccords des virages.
const spaSectors = [
  [[13,42],[7,42],[5,40],[6,37],[14,34],[18,30],[23,30],[25,26]],
  [[25,26],[37,20],[41,19],[43,15],[48,15],[52,12],[54,7],[51,5],[46,7]],
  [[46,7],[40,10],[37,8],[32,9],[26,14],[18,16],[15,20],[17,23],[13,26]],
  [[13,26],[10,25],[7,26],[3,30],[1,36],[2,43],[5,48],[10,50],[20,50],[25,47],[25,42],[22,39],[19,39],[18,42],[13,42]],
];
const spaNodes = spaSectors.flatMap(sector => sector.slice(0,-1));
function spaEdges() {
  const left=[], right=[];
  spaNodes.forEach(([x,y],i) => {
    const n=spaNodes.length;
    const [px,py]=spaNodes[(i+n-1)%n], [nx,ny]=spaNodes[(i+1)%n];
    const before=Math.hypot(x-px,y-py), after=Math.hypot(nx-x,ny-y);
    const trim=Math.min(2.8,before*.45,after*.45);
    const ax=x+(px-x)*trim/before, ay=y+(py-y)*trim/before;
    const bx=x+(nx-x)*trim/after, by=y+(ny-y)*trim/after;
    for(let j=0;j<=6;j++){
      const t=j/6,u=1-t;
      const cx=u*u*ax+2*u*t*x+t*t*bx, cy=u*u*ay+2*u*t*y+t*t*by;
      const dx=u*(x-ax)+t*(bx-x),dy=u*(y-ay)+t*(by-y);
      const halfWidth = Math.abs(cy-42)<.01 && cx>=7 && cx<=18 ? 2.1 : 1.7;
      const scale=halfWidth/Math.hypot(dx,dy);
      left.push([cx-dy*scale,cy+dx*scale]);
      right.push([cx+dy*scale,cy-dx*scale]);
    }
  });
  const area=ring=>Math.abs(ring.reduce((sum,[x,y],i)=>{const [a,b]=ring[(i+1)%ring.length];return sum+x*b-y*a},0));
  return [left,right].sort((a,b)=>area(b)-area(a));
}
const spaLine={axis:'x',at:13,min:39.9,max:44.1,direction:-1};
const spaCourse={
  width:62,height:54,boundaries:spaEdges(),start:spaLine,finish:spaLine,
  lapMarkers:[[14,46],[27,19],[47,11]],
  grid:[[13,40],[13,41],[13,42],[13,43]],
  checkpoints:[
    {axis:'x',at:25,min:23,max:30,direction:1},
    {axis:'x',at:46,min:4,max:10,direction:-1},
    {axis:'x',at:13,min:23,max:28,direction:-1},
  ],
  kerbs:[[[12,26],[68,85],[111,123],[167,180]],[[23,35],[82,95],[133,145],[235,248]]],
};
const seasonDefinitions = [
  {id:"r01", name:"Rives d’Opale", scale:1.45,
   points:[[20,40],[12,40],[7,35],[9,29],[6,23],[10,17],[19,14],[24,8],[32,6],[38,10],[40,18],[47,22],[48,28],[43,29],[39,35],[32,33],[27,40]]},
  {id:"r02", name:"Le Nautile", scale:1.29,
   points:[[20,40],[12,40],[6,36],[4,28],[8,23],[14,23],[17,28],[15,33],[22,32],[26,25],[22,19],[17,15],[19,8],[29,6],[35,10],[37,17],[45,19],[49,14],[54,16],[53,23],[44,30],[38,34],[31,33],[27,40]]},
  {id:"r03", name:"Les Rubans Jumeaux", scale:1.17,
   points:[[20,40],[12,40],[7,36],[5,29],[9,24],[15,26],[18,21],[14,17],[18,12],[24,14],[28,9],[35,8],[38,13],[34,17],[28,19],[26,24],[31,27],[38,23],[46,18],[51,19],[54,25],[50,31],[41,34],[35,32],[31,37],[27,40]]},
  {id:"r04", name:"Le Bassin Corail", scale:1.33,
   points:[[20,40],[12,40],[7,36],[8,30],[14,26],[18,20],[24,21],[29,17],[24,12],[15,13],[11,10],[16,6],[30,6],[34,10],[39,8],[46,12],[47,16],[42,19],[45,23],[51,25],[51,30],[44,32],[36,38],[30,36],[27,40]]},
  {id:"r05", name:"L’Île des Brisants", scale:0.85,
   points:[[20,40],[12,40],[6,37],[6,32],[10,30],[9,25],[15,21],[22,20],[25,15],[31,14],[35,8],[42,6],[46,9],[44,14],[35,20],[31,25],[23,30],[20,34],[26,35],[31,31],[36,32],[35,37],[27,40]]},
  {id:"r06", name:"Les Balcons d’Ambre", scale:1.13,
   points:[[20,40],[12,40],[8,36],[12,32],[8,27],[7,19],[12,14],[20,12],[22,6],[28,5],[33,9],[30,14],[25,16],[25,21],[32,23],[39,18],[45,20],[46,25],[39,29],[34,28],[31,32],[36,35],[35,39],[27,40]]},
  {id:"r07", name:"La Crête Fauve", scale:0.85,
   points:[[20,40],[12,40],[5,34],[8,26],[15,23],[17,16],[24,10],[34,8],[38,12],[34,16],[27,17],[24,22],[28,26],[35,24],[40,18],[47,17],[51,22],[47,29],[40,32],[36,37],[27,40]]},
  {id:"r08", name:"Les Trois Alpages", scale:1.05,
   points:[[20,40],[12,40],[8,37],[9,32],[16,26],[19,20],[27,14],[35,5],[40,6],[40,13],[34,21],[37,25],[44,24],[45,29],[40,34],[33,33],[30,37],[27,40]]},
  {id:"r09", name:"La Rafale", scale:0.77,
   points:[[20,40],[12,40],[6,35],[8,29],[16,27],[20,22],[15,18],[7,20],[4,15],[9,8],[17,6],[23,10],[28,8],[31,12],[37,10],[40,15],[48,20],[50,26],[44,30],[37,28],[33,32],[34,37],[27,40]]},
  {id:"r10", name:"Le Vallon des Aiguilles", scale:0.61,
   points:[[13,42],[7,42],[5,40],[6,37],[14,34],[18,30],[23,30],[25,26],[37,20],[41,19],[43,15],[48,15],[52,12],[54,7],[51,5],[46,7],[40,10],[37,8],[32,9],[26,14],[18,16],[15,20],[17,23],[13,26],[10,25],[7,26],[3,30],[1,36],[2,43],[5,48],[10,50],[20,50],[25,47],[25,42],[22,39],[19,39],[18,42]]},
  {id:"r11", name:"Le Chaudron Vert", scale:1.21,
   points:[[20,40],[12,40],[6,37],[4,29],[8,24],[15,25],[19,20],[14,16],[8,17],[7,11],[16,6],[23,8],[27,13],[33,10],[37,14],[36,21],[42,24],[47,20],[51,24],[49,31],[43,35],[38,32],[33,32],[30,37],[27,40]]},
  {id:"r12", name:"Les Dunes Obliques", scale:0.69,
   points:[[20,40],[12,40],[6,37],[5,31],[11,28],[15,30],[19,26],[16,21],[8,22],[5,16],[10,10],[17,8],[21,12],[27,10],[32,14],[37,13],[40,18],[36,24],[41,27],[48,24],[51,29],[46,35],[38,34],[33,38],[27,40]]},
  {id:"r13", name:"Les Flèches de Fer", scale:1.05,
   points:[[20,40],[12,40],[8,36],[10,32],[7,29],[9,21],[16,15],[25,11],[28,6],[33,6],[36,10],[33,15],[38,19],[44,18],[49,23],[45,29],[37,31],[33,35],[27,40]]},
  {id:"r14", name:"La Spirale Ocre", scale:0.89,
   points:[[20,40],[12,40],[5,35],[6,29],[12,27],[14,21],[9,17],[11,10],[18,8],[23,12],[29,10],[32,5],[40,5],[47,11],[48,18],[43,23],[36,23],[31,19],[26,21],[26,27],[33,30],[40,28],[43,33],[38,37],[27,40]]},
  {id:"r15", name:"Les Remparts de Verre", scale:0.77,
   points:[[20,40],[12,40],[5,36],[5,27],[15,27],[15,19],[9,19],[9,12],[19,12],[21,6],[30,6],[32,12],[37,14],[36,20],[42,22],[47,20],[51,25],[47,29],[39,31],[34,36],[27,40]]},
  {id:"r16", name:"Les Deux Moussons", scale:0.77,
   points:[[20,40],[12,40],[6,38],[5,33],[10,29],[15,30],[16,24],[10,20],[7,13],[12,7],[20,8],[26,14],[32,12],[36,6],[44,9],[48,17],[43,23],[36,22],[30,26],[25,32],[32,33],[41,28],[46,31],[43,36],[34,39],[27,40]]},
  {id:"r17", name:"Les Quais de Jade", scale:1.29,
   points:[[20,40],[12,40],[6,36],[6,29],[12,29],[12,23],[7,20],[7,13],[17,13],[17,7],[26,7],[30,11],[36,11],[36,17],[43,17],[47,21],[46,27],[39,27],[39,32],[32,32],[32,37],[27,40]]},
  {id:"r18", name:"Le Serpent Rouge", scale:1.33,
   points:[[20,40],[12,40],[5,36],[6,30],[15,25],[16,20],[21,21],[24,16],[29,17],[33,12],[41,10],[43,5],[49,7],[49,14],[40,21],[33,26],[36,30],[42,27],[49,28],[50,33],[43,37],[36,36],[31,33],[27,40]]},
  {id:"r19", name:"L’Arène des Masques", scale:1.41,
   points:[[20,40],[12,40],[6,36],[7,29],[12,25],[11,19],[16,13],[23,10],[23,5],[30,6],[33,12],[30,17],[34,22],[40,20],[43,24],[41,30],[35,30],[31,26],[25,27],[23,32],[30,35],[27,40]]},
  {id:"r20", name:"La Combe Pourpre", scale:0.93,
   points:[[20,40],[12,40],[5,36],[6,31],[12,27],[12,22],[18,18],[26,14],[32,8],[40,7],[45,11],[42,17],[35,19],[32,23],[36,26],[42,24],[46,28],[44,32],[37,34],[31,31],[27,33],[27,40]]},
  {id:"r21", name:"Les Néons de Minuit", scale:0.77,
   points:[[20,40],[12,40],[6,37],[6,30],[12,27],[16,29],[20,25],[20,16],[25,11],[32,11],[34,5],[43,5],[46,10],[42,15],[40,23],[34,28],[37,32],[44,31],[46,35],[40,39],[31,37],[27,40]]},
  {id:"r22", name:"Les Ailes du Sirocco", scale:1.33,
   points:[[20,40],[12,40],[5,35],[7,27],[13,24],[14,18],[22,14],[25,7],[33,6],[39,11],[37,17],[31,21],[33,25],[40,23],[46,18],[51,22],[49,29],[42,33],[36,32],[30,36],[27,40]]},
  {id:"r23", name:"Le Croissant Indigo", scale:0.77,
   points:[[20,40],[12,40],[6,37],[5,30],[10,26],[15,26],[18,20],[13,16],[8,17],[7,11],[14,6],[23,7],[28,13],[36,15],[42,10],[48,12],[47,18],[39,23],[36,28],[42,29],[46,34],[40,38],[33,36],[27,40]]}
];
function buildSeasonCourse(definition){
  const {id,name,points,scale}=definition;
  const [ox,oy]=points[0],sx=Math.round(ox*scale),sy=Math.round(oy*scale);
  const nodes=points.map(([x,y])=>[sx+(x-ox)*scale,sy+(y-oy)*scale]);
  const boundaries=seasonEdges(nodes,sx,sy);
  const finish={axis:'x',at:sx,min:sy-2.02,max:sy+2.02,direction:-1};
  const checkpoints=[],sectors=[];
  let startIndex=0;
  for(let k=1;k<=3;k++){
    const i=Math.floor(nodes.length*k/4);
    const [x,y]=nodes[i],[a,b]=nodes[i+1];
    const horizontal=Math.abs(a-x)>Math.abs(b-y);
    const mid=[(x+a)/2,(y+b)/2];
    const [at,across]=horizontal?mid:[mid[1],mid[0]];
    checkpoints.push({axis:horizontal?'x':'y',at,min:across-3.2,max:across+3.2,direction:Math.sign(horizontal?a-x:b-y)});
    sectors.push([...(k>1?[sectors.at(-1).at(-1)]:[]),...nodes.slice(startIndex,i+1),mid]);
    startIndex=i+1;
  }
  sectors.push([sectors.at(-1).at(-1),...nodes.slice(startIndex),nodes[0]]);
  // Le marqueur est à l’intérieur de l’îlot, du côté intérieur de la ligne.
  const signed=nodes.reduce((v,[x,y],i)=>{const [a,b]=nodes[(i+1)%nodes.length];return v+x*b-y*a},0);
  const winding=Math.sign(signed);
  return {id,name,nodes,sectors,boundaries,checkpoints,winding,lapMarkers:id==="r10"?[[14,46],[27,19],[47,11]].map(([x,y])=>[sx+(x-ox)*scale,sy+(y-oy)*scale]):[[sx,sy-3*winding]],
    width:Math.ceil(Math.max(...nodes.map(p=>p[0])))+5,height:Math.ceil(Math.max(...nodes.map(p=>p[1])))+5,
    start:finish,finish,grid:[-1,0,1,2].map(offset=>[sx,sy+offset]),
    kerbs:[0,1].map(side=>nodes.flatMap((_,i)=>i%3===side?[[i*7,i*7+7]]:[]))};
}
function seasonEdges(nodes,sx,sy){
  const sides=[[],[]];
  nodes.forEach(([x,y],i)=>{
    const [px,py]=nodes[(i+nodes.length-1)%nodes.length],[nx,ny]=nodes[(i+1)%nodes.length];
    const before=Math.hypot(px-x,py-y),after=Math.hypot(nx-x,ny-y);
    const trim=Math.min(2.6,before*.41,after*.41);
    const ax=x+(px-x)*trim/before,ay=y+(py-y)*trim/before;
    const bx=x+(nx-x)*trim/after,by=y+(ny-y)*trim/after;
    for(let j=0;j<=6;j++){
      const t=j/6,u=1-t,cx=u*u*ax+2*u*t*x+t*t*bx,cy=u*u*ay+2*u*t*y+t*t*by;
      const dx=u*(x-ax)+t*(bx-x),dy=u*(y-ay)+t*(by-ay);
      const half=1.45+.58*Math.max(0,1-Math.abs(cx-sx)/4)*(Math.abs(cy-sy)<.02?1:0);
      const normal=half/Math.hypot(dx,dy);
      for(const [idx,k] of [[0,1],[1,-1]])sides[idx].push([cx-k*dy*normal,cy+k*dx*normal]);
    }
  });
  function area(ring){return Math.abs(ring.reduce((sum,[x,y],i)=>{const [a,b]=ring[(i+1)%ring.length];return sum+x*b-y*a},0))}
  return sides.sort((a,b)=>area(b)-area(a));
}
const seasonCourses=Object.fromEntries(seasonDefinitions.map(d=>[d.id,buildSeasonCourse(d)]));
function fillCoursePicker(picker){
  for(const course of Object.values(seasonCourses))picker.add(new Option(course.id.slice(1)+" · "+course.name,course.id));
  picker.value='r10';
}
const courseFor = room => Object.hasOwn(seasonCourses,room?.course) ? seasonCourses[room.course] : ({paper:paperCourse,spa:spaCourse})[room?.course] ?? straightCourse;
const paperSectors = [
  [[32,38],[15,38],[7,37],[5,32],[5,23]],
  [[5,23],[5,8],[7,5],[20,5],[52,5]],
  [[52,5],[84,5],[94,5],[95,10],[95,12],[75,12]],
  [[75,12],[64,13],[62,14],[66,18],[78,25],[85,33],[85,36],[76,39],[55,40]],
  [[55,40],[40,39],[32,38]],
];
function sectorProgress(player, points) {
  let travelled = 0;
  let best = 0;
  let closest = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [x,y] = points[i-1];
    const [nx,ny] = points[i];
    const dx = nx-x, dy = ny-y;
    const length = Math.hypot(dx,dy);
    const t = Math.max(0,Math.min(1,((player.x-x)*dx+(player.y-y)*dy)/(length*length)));
    const distance = Math.hypot(player.x-x-t*dx,player.y-y-t*dy);
    if (distance < closest) {
      closest = distance;
      best = travelled+t*length;
    }
    travelled += length;
  }
  return best/travelled;
}

function standings(room) {
  const sectors = courseFor(room).sectors ?? {paper:paperSectors,spa:spaSectors}[room.course];
  const order = room.players.map((player,index) => {
    const sector = player.checkpoint ?? 0;
    const progress = sectors ?
      (player.laps ?? 0)*sectors.length+sector+sectorProgress(player,sectors[sector]) :
      -player.y;
    return {player,index,progress,finish:player.finish ?? -1};
  }).sort((a,b) => b.finish-a.finish || b.progress-a.progress);
  let rank = 1;
  return order.map((item,index) => {
    const previous = order[index-1];
    if (previous && (item.finish !== previous.finish ||
        item.finish < 0 && Math.abs(item.progress-previous.progress) > 1e-6)) rank = index+1;
    return {...item,rank};
  });
}
const colors = ['#f5bf63', '#64e2c3', '#ff829e', '#b5a4ff'];
const steps = [-1, 0, 1].flatMap(y => [-1, 0, 1].map(x => [x,y]));
const cross = (ax, ay, bx, by) => ax * by - ay * bx;
const speedOf = (x, y) => Math.max(Math.abs(x), Math.abs(y));

function onSegment(x, y, ax, ay, bx, by) {
  return Math.abs(cross(x-ax, y-ay, bx-ax, by-ay)) < 1e-8 &&
    x >= Math.min(ax,bx)-1e-8 && x <= Math.max(ax,bx)+1e-8 &&
    y >= Math.min(ay,by)-1e-8 && y <= Math.max(ay,by)+1e-8;
}

function insideBoundary(x, y, track) {
  let hit = false;
  for (let i = 0, j = track.length-1; i < track.length; j = i++) {
    const [ax, ay] = track[j], [bx, by] = track[i];
    if (onSegment(x,y,ax,ay,bx,by)) return 0;
    if ((ay > y) !== (by > y) && x < ax+(bx-ax)*(y-ay)/(by-ay)) hit = !hit;
  }
  return hit ? 1 : -1;
}

function inside(x, y, course = straightCourse) {
  const [outer,...holes] = course.boundaries;
  return insideBoundary(x,y,outer) >= 0 && holes.every(hole => insideBoundary(x,y,hole) <= 0);
}

function staysInside(ax, ay, bx, by, course) {
  if (!inside(ax,ay,course) || !inside(bx,by,course)) return false;
  if (ax === bx && ay === by) return true;
  const dx = bx-ax, dy = by-ay;
  const cuts = [0, 1];
  for (const track of course.boundaries) for (let i = 0; i < track.length; i++) {
    const [x,y] = track[i], [nx,ny] = track[(i+1)%track.length];
    const ex = nx-x, ey = ny-y;
    const denominator = cross(dx,dy,ex,ey);
    if (!denominator) {
      for (const [px,py] of [[x,y],[nx,ny]]) {
        if (onSegment(px,py,ax,ay,bx,by)) cuts.push(dx ? (px-ax)/dx : (py-ay)/dy);
      }
      continue;
    }
    const t = cross(x-ax,y-ay,ex,ey)/denominator;
    const u = cross(x-ax,y-ay,dx,dy)/denominator;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
  }
  cuts.sort((a,b) => a-b);
  return cuts.slice(1).every((t,i) => {
    const mid = (cuts[i]+t)/2;
    return inside(ax+mid*dx,ay+mid*dy,course);
  });
}

function racer(name, token, index, course = straightCourse) {
  const [x, y] = course.grid[index];
  return { name, token, x, y, vx:0, vy:0, recovery:0, trail:[[x,y]], finish:null, laps:0, checkpoint:0 };
}

function options(room) {
  const player = room.players[room.turn];
  const course = courseFor(room);
  const recovering = player.recovery > 0 || !inside(player.x,player.y,course);
  const candidates = steps.flatMap(([dx,dy]) => {
    const vx = recovering ? dx : player.vx+dx;
    const vy = recovering ? dy : player.vy+dy;
    const speed = speedOf(vx,vy);
    const x = player.x+vx, y = player.y+vy;
    if (speed < 1 || speed > 6) return [];
    const blocked = room.players.some(other => !other.forfeit && other !== player &&
      onSegment(other.x,other.y,player.x,player.y,x,y));
    return [{ x,y,vx,vy,speed,blocked, center:!dx&&!dy,
      offTrack: recovering ? !inside(x,y,course) : !staysInside(player.x,player.y,x,y,course) }];
  });
  const exits = candidates.filter(move => move.offTrack && !move.blocked);
  const slowestExit = Math.min(...exits.map(move => move.speed));
  return candidates.filter(move => !move.offTrack || move.speed === slowestExit);
}

function crossing(player, move, gate) {
  const {axis,at,min,max,direction} = gate;
  const from = (player[axis]-at)*direction;
  const to = (move[axis]-at)*direction;
  if (from > 0 || to <= 0) return null;
  const across = axis === 'x' ? 'y' : 'x';
  const intersection = player[across] + (move[across]-player[across])*(-from)/(to-from);
  if (intersection < min || intersection > max) return null;
  const point = axis === 'x' ? [at,intersection] : [intersection,at];
  return {distance:to,point};
}

// Fermer le trajet sur la ligne permet de compter les tours même après
// une sortie de piste ou un passage juste à côté d’un repère de classement.
function completedCircuit(player, finishPoint, markers, direction=-1) {
  const path = player.trail.slice(player.lapTrailStart ?? 0);
  if (player.lapOrigin) path.unshift(player.lapOrigin);
  path.push(finishPoint);
  return markers.every(([mx,my]) => {
    let winding = 0;
    for (let i=0; i<path.length; i++) {
      const [x,y] = path[i], [nx,ny] = path[(i+1)%path.length];
      const side = (nx-x)*(my-y)-(ny-y)*(mx-x);
      if (y <= my && ny > my && side > 0) winding++;
      if (y > my && ny <= my && side < 0) winding--;
    }
    return winding*direction>0;
  });
}

function countProgress(room, player, move, course) {
  const next = player.checkpoint ?? 0;
  if (next < course.checkpoints.length && crossing(player,move,course.checkpoints[next])) {
    player.checkpoint = next+1;
  }
  const crossingLine = crossing(player,move,course.finish);
  if (!crossingLine) return;
  const complete = course.lapMarkers
    ? completedCircuit(player,crossingLine.point,course.lapMarkers,course.winding)
    : player.checkpoint >= course.checkpoints.length;
  if (complete) {
    player.checkpoint = 0;
    player.laps = (player.laps ?? 0)+1;
    if (player.laps >= (room.lapGoal ?? 1)) {
      player.finish = crossingLine.distance;
    } else {
      player.lapTrailStart = player.trail.length;
      player.lapOrigin = crossingLine.point;
      room.lastLap = {index:room.turn,laps:player.laps};
    }
  }
}

function play(room, x, y) {
  const player = room.players[room.turn];
  const choices = options(room).filter(move => !move.blocked);
  const move = choices.find(choice => choice.x === x && choice.y === y);
  if (!move && (choices.length || x !== null || y !== null)) return false;
  if (move) {
    const course = courseFor(room);
    const recovering = player.recovery > 0 || !inside(player.x,player.y,course);
    countProgress(room,player,move,course);
    player.recovery = recovering ? Math.max(0,player.recovery-1) : move.offTrack ? 2 : 0;
    Object.assign(player,{ x:move.x, y:move.y, vx:move.vx, vy:move.vy });
    player.trail.push([move.x,move.y]);
    (room.replay ??= []).push(room.turn);
  }
  advanceTurn(room);
  return true;
}

function forfeitRace(room,index){
  const driver=room.players[index];
  if(room.state!=='racing'||!driver||driver.forfeit)return false;
  driver.forfeit=true;
  driver.finish=null;
  const remaining=room.players.flatMap((p,i)=>p.forfeit?[]:[i]);
  if(remaining.length<=1){
    room.state='finished'; room.winners=remaining; room.byForfeit=true;
  }else if(room.turn===index) advanceTurn(room);
  return true;
}
function advanceTurn(room){
  do{
    room.turn++;
    if(room.turn===room.players.length){
      room.turn=0;
      const best=Math.max(...room.players.map(p=>p.forfeit?-1:p.finish??-1));
      if(best>=0){
        room.state='finished';
        room.winners=room.players.flatMap((p,i)=>!p.forfeit&&p.finish===best?[i]:[]);
        return;
      }
      room.round++;
    }
  }while(room.players[room.turn].forfeit);
}




export {seasonCourses,fillCoursePicker,forfeitRace,spaCourse, courseFor, racer, play, advanceTurn, options, inside, standings, colors};
