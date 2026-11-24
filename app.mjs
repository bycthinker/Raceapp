import {seasonCourses,fillCoursePicker,courseFor,standings,colors,inside,options} from './game.mjs';
const byId = id => document.getElementById(id);
const board = byId('board');
const entry = byId('entry');
const game = byId('game');
const message = byId('message');
const primary = byId('primary');
const inviteCode = new URL(location.href).searchParams.get('salle') ?? '';
const roomInput = byId('room-code');
const trackPicker=byId('track');fillCoursePicker(trackPicker);
trackPicker.addEventListener('change',()=>render());
roomInput.value = inviteCode.toUpperCase();
byId('name').value = localStorage.getItem('cq-name') ?? '';

let room = null;
let token = null;
let selected = null;
let zoom = 0;
let pending = false;
let polling = false;
let primaryAction = null;

function notice(text = '') {
  message.textContent = text;
  message.hidden = !text;
}

async function request(path,body,authorization = token) {
  const headers = authorization ? { Authorization:'Bearer '+authorization } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/rooms'+path,{
    method:body ? 'POST' : 'GET',headers,body:body ? JSON.stringify(body) : undefined,
    signal:globalThis.AbortSignal?.timeout?.(8000),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setRoom(next) {
  if (room?.code === next.code && room.revision > next.revision) return;
  const justFinished = room?.state === 'racing' && next.state === 'finished';
  if (next.state !== 'finished') stopReplay();
  if (room?.revision !== next.revision) selected = null;
  if (room?.state !== next.state || room?.turn !== next.turn || room?.round !== next.round) camera = null;
  if (room?.state !== 'racing' && next.state === 'racing') zoom = matchMedia('(max-width: 680px)').matches ? 3 : 0;
  room = next;
  lastChoicePress = null;
  room.doubleConfirm = byId('double-confirm').checked;
  render();
  if (justFinished) playFinishedReplay();
}

function remember(data) {
  token = data.token;
  const code = data.room.code;
  localStorage.setItem('cq-last',code);
  localStorage.setItem('cq-token-'+code,token);
  const url = new URL(location.href);
  url.searchParams.set('salle',code);
  history.replaceState(null,'',url);
  setRoom(data.room);
}

async function refresh() {
  if (!room || pending || polling) return;
  const code = room.code;
  const activeToken = token;
  polling = true;
  try {
    const result = await request('/'+code,undefined,activeToken);
    if (room?.code === code && token === activeToken && result.room.revision > room.revision) setRoom(result.room);
    if (message.dataset.connection) {
      delete message.dataset.connection;
      notice();
    }
  } catch (error) {
    if (room?.code === code && token === activeToken && !message.dataset.connection) {
      message.dataset.connection = 'true';
      notice('Synchronisation interrompue. Nouvelle tentative en cours.');
    }
  } finally {
    polling = false;
  }
}

async function busy(operation) {
  if (pending) return;
  pending = true;
  notice();
  render();
  try {
    await operation();
  } catch (error) {
    notice(error.status ? error.message : 'Connexion impossible. Réessaie dans un instant.');
  } finally {
    pending = false;
    render();
  }
}

let lastChoicePress=null;
function svg(tag, attrs, parent = board) {
  const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  parent.append(node);
  return node;
}

const zoomSizes = [null,[30,24],[20,18],[14,16],[10,10]];
let camera = null;

function bindZoom() {
  let previous = 3;
  function changeZoom(level) {
    if (zoom > 0) previous = zoom;
    zoom = level;
    render();
  }
  byId('zoom-out').addEventListener('click',() => changeZoom(Math.max(0,zoom-1)));
  byId('zoom-in').addEventListener('click',() => changeZoom(Math.min(zoomSizes.length-1,zoom+1)));
  byId('toggle-zoom').addEventListener('click',() => changeZoom(zoom ? 0 : previous));
  byId('recenter-board').addEventListener('click',() => { camera = null; render(); });
}

function fieldBounds(course) {
  // Reserve space for a maximum-speed move and the entire circular hit target.
  const margin = 7;
  let left = -margin, top = -margin;
  let right = course.width+margin, bottom = course.height+margin;
  for (const driver of room?.players ?? []) {
    for (const [x,y] of driver.trail) {
      left = Math.min(left,x-margin);
      right = Math.max(right,x+margin);
      top = Math.min(top,y-margin);
      bottom = Math.max(bottom,y+margin);
    }
  }
  return {x:left,y:top,width:right-left,height:bottom-top};
}

function fullView(target, field) {
  target.setAttribute('viewBox',[field.x,field.y,field.width,field.height].join(' '));
}

function setViewport(course, width, height, center) {
  const field = fieldBounds(course);
  const x = Math.max(field.x,Math.min(field.x+field.width-width,center.x-width/2));
  const y = Math.max(field.y,Math.min(field.y+field.height-height,center.y-height/2));
  board.setAttribute('viewBox',[x,y,width,height].join(' '));
  syncMapFrame();
  return {x:x+width/2,y:y+height/2};
}

function bindPan() {
  let gesture = null;
  let suppressClick = false;
  const canPan = () => zoom && room?.state === 'racing';

  function pan(dx,dy) {
    const {x,y,width,height} = board.viewBox.baseVal;
    camera = setViewport(courseFor(room),width,height,{x:x+width/2+dx,y:y+height/2+dy});
    byId('recenter-board').hidden = false;
  }
  board.addEventListener('pointerdown',event => {
    if (event.button !== 0 || !event.isPrimary) return;
    suppressClick = false;
    if (canPan()) gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,dragging:false};
  });
  board.addEventListener('pointermove',event => {
    if (gesture?.id !== event.pointerId || !canPan()) return;
    const dx = event.clientX-gesture.x;
    const dy = event.clientY-gesture.y;
    if (!gesture.dragging && Math.hypot(dx,dy) < 6) return;
    const transform = board.getScreenCTM();
    if (!transform) return;
    if (!gesture.dragging) {
      gesture.dragging = true;
      suppressClick = true;
      lastChoicePress = null;
      board.setPointerCapture(event.pointerId);
      board.setAttribute('data-dragging','');
    }
    pan(-dx/transform.a,-dy/transform.d);
    gesture.x = event.clientX;
    gesture.y = event.clientY;
  });
  function end(event) {
    if (gesture?.id !== event.pointerId) return;
    gesture = null;
    board.removeAttribute('data-dragging');
  }
  for (const type of ['pointerup','pointercancel','lostpointercapture']) board.addEventListener(type,end);
  board.addEventListener('click',event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.stopPropagation();
  },true);
  board.addEventListener('keydown',event => {
    if (event.target !== board || !canPan()) return;
    const offset = {ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]}[event.key];
    if (!offset) return;
    event.preventDefault();
    pan(...offset);
  });
}

function trackPath(points) {
  return 'M '+points.map(point => point.join(',')).join(' L ');
}

function drawSurface(course, target = board) {
  const {boundaries} = course;
  const field = fieldBounds(course);
  const prefix = target.id === 'replay-board' ? 'replay-' : '';
  const defs = svg('defs',{},target);
  const grid = svg('pattern',{id:prefix+'grid',width:1,height:1,patternUnits:'userSpaceOnUse'},defs);
  svg('path',{d:'M 0 1 V 0 H 1',fill:'none',stroke:'#b2c7ce','stroke-width':.065,opacity:.35},grid);
  const grass = svg('pattern',{id:prefix+'grass',width:4,height:4,patternUnits:'userSpaceOnUse',patternTransform:'rotate(35)'},defs);
  svg('rect',{width:4,height:4,fill:'#192a25'},grass);
  svg('rect',{width:2,height:4,fill:'#22342b'},grass);
  const outline = boundaries.map(points => trackPath(points)+' Z').join(' ');
  const clip = svg('clipPath',{id:prefix+'asphalt-clip'},defs);
  svg('path',{d:outline,'clip-rule':'evenodd'},clip);
  svg('rect',{...field,fill:`url(#${prefix}grass)`},target);
  const rail = {d:outline,fill:'none','stroke-linejoin':'round'};
  svg('path',{...rail,stroke:'#101918','stroke-width':.9},target);
  svg('path',{...rail,stroke:'#65737a','stroke-width':.58},target);
  svg('path',{...rail,stroke:'#a3aeb0','stroke-width':.37},target);
  svg('path',{...rail,stroke:'#344448','stroke-width':.61,'stroke-dasharray':'.11 1.35'},target);
  svg('path',{d:outline,fill:'#303940','fill-rule':'evenodd'},target);
  svg('rect',{...field,fill:`url(#${prefix}grid)`},target);
  svg('path',{...rail,stroke:'#c2ccc9','stroke-width':.10},target);
  if (boundaries.length !== 2) return;

  const kerbs = svg('g',{'clip-path':`url(#${prefix}asphalt-clip)`},target);
  const corners = course.kerbs ?? [[[1,5],[16,21],[24,29],[29,34],[42,48]],[[4,8],[13,17],[19,24],[29,35]]];
  boundaries.forEach((points,index) => {
    for (const [from,to] of corners[index]) {
      const corner = {d:trackPath(points.slice(from,to)),fill:'none','stroke-width':.65,'stroke-linejoin':'round'};
      svg('path',{...corner,stroke:'#ddd9ca'},kerbs);
      svg('path',{...corner,stroke:'#ba463c','stroke-dasharray':'.65 .65'},kerbs);
    }
  });
}

function draw(active, choices) {
  board.replaceChildren();
  const course=room?courseFor(room):seasonCourses[trackPicker.value];
  byId('circuit-title').textContent=course.name??('Le Vallon des Aiguilles');
  const {width,height,start,finish,grid:startingPositions} = course;
  if (zoom && active) {
    const [zoomWidth,zoomHeight] = zoomSizes[zoom];
    const viewWidth = Math.min(width+1.2,zoomWidth);
    const viewHeight = Math.min(height+1.2,zoomHeight);
    const recovering = active.recovery || !inside(active.x,active.y,course);
    const center = {x:active.x+(recovering ? 0 : active.vx/2),y:active.y+(recovering ? 0 : active.vy/2)};
    setViewport(course,viewWidth,viewHeight,camera ?? center);
  } else {
    fullView(board,fieldBounds(course));
  }
  board.setAttribute('data-overview',String(!(zoom && active)));
  drawSurface(course);
  const gates = start === finish ? [[finish,'#f5bf63']] : [[start,'#a6f2d7'],[finish,'#f5bf63']];
  for (const [line,color] of gates) {
    const endpoints = line.axis === 'x' ? {x1:line.at,x2:line.at,y1:line.min,y2:line.max} :
      {x1:line.min,x2:line.max,y1:line.at,y2:line.at};
    if (start === finish) {
      svg('line',{...endpoints,stroke:'#121a1e','stroke-width':.54});
      for (const side of [-1,1]) {
        const x = line.at+side*.13;
        svg('line',{...endpoints,x1:x,x2:x,stroke:'#f2eee2','stroke-width':.26,
          'stroke-dasharray':'.26 .26','stroke-dashoffset':side < 0 ? 0 : .26});
      }
      svg('path',{d:`M ${line.at-1} ${line.min-.75} h -2 m 1 -.65 l -1 .65 1 .65`,
        fill:'none',stroke:color,'stroke-width':.24,'stroke-linecap':'round','stroke-linejoin':'round'});
    } else {
      svg('line',{...endpoints,stroke:color,'stroke-dasharray':'.54 .24','stroke-width':.25});
    }
  }
  const checkpoint = active && course.checkpoints[active.checkpoint ?? 0];
  if (checkpoint) {
    const {axis,at,min,max} = checkpoint;
    const endpoints = axis === 'x' ? {x1:at,x2:at,y1:min,y2:max} : {x1:min,x2:max,y1:at,y2:at};
    svg('line',{...endpoints,stroke:'#a6f2d7','stroke-opacity':.78,'stroke-dasharray':'.18 .21','stroke-width':.12});
  }
  const drivers = room?.players ?? [];
  if (room?.state === 'lobby' || !room) {
    startingPositions.forEach(([cx,cy],i) => svg('circle',{cx,cy,r:.25,fill:colors[i],opacity:.6}));
  }
  drivers.forEach((driver,index) => {
    const trail = driver.trail.slice(driver.lapTrailStart ?? 0);
    const visibleLine = driver.lapOrigin ? [driver.lapOrigin,...trail] : trail;
    svg('polyline',{ points:visibleLine.map(point => point.join(',')).join(' '), fill:'none',
      stroke:colors[index],'stroke-width':.14,'stroke-linejoin':'round',opacity:.74 });
    for (const [x,y] of trail.slice(0,-1)) {
      svg('path',{ d:`M ${x-.12} ${y-.12} l .24 .24 m -.24 0 l .24 -.24`, stroke:colors[index],'stroke-width':.07 });
    }
  });
  drivers.forEach((driver,index) => {
    if(driver.forfeit)return;
    svg('circle',{cx:driver.x,cy:driver.y,r:driver===active ? .37 : .29,
      fill:colors[index],stroke:'#102029','stroke-width':.09});
  });
  for (const choice of choices) {
    const attributes = { transform:`translate(${choice.x} ${choice.y})` };
    const color = choice.blocked ? '#a6b2b7' : colors[room.turn];
    const chosen = choice.x === selected?.x && choice.y === selected?.y;
    if (!choice.blocked) Object.assign(attributes,{
      class:'choice',role:'button',tabindex:0,'aria-label':`Case ${choice.x}, ${choice.y}, vitesse ${choice.speed}${choice.offTrack ? ', hors piste' : ''}`,
      'aria-pressed':chosen,
    });
    const marker = svg('g',attributes);
    svg('rect',{x:-.49,y:-.49,width:.98,height:.98,fill:'transparent'},marker);
    svg('circle',{class:'choice-ring',r:choice.center ? .42 : .34,fill:'#101d22','fill-opacity':.28,
      stroke:color,'stroke-opacity':chosen ? 1 : .75,
      ...(choice.offTrack && !choice.blocked ? {'stroke-dasharray':'.16 .10'} : {}),
      'stroke-width':chosen ? .16 : choice.center ? .13 : .08},marker);
    const label = svg('text',{y:.15,'text-anchor':'middle',fill:color,'fill-opacity':chosen ? 1 : .68,
      'font-size':.46,'font-weight':750,'pointer-events':'none'},marker);
    label.textContent = choice.blocked ? '×' : choice.speed;
    if (choice.blocked) continue;
    const choose = (pressTime = null) => {
      if (pending) return;
      const previous = lastChoicePress;
      const isDoublePress = room.doubleConfirm && pressTime !== null && previous?.room === room &&
        previous.turn === room.turn && previous.round === room.round &&
        previous.x === choice.x && previous.y === choice.y &&
        pressTime >= previous.time && pressTime-previous.time <= 450;
      lastChoicePress = pressTime === null ? null :
        {room,turn:room.turn,round:room.round,x:choice.x,y:choice.y,time:pressTime};
      selected = choice;
      if (isDoublePress) {
        confirmMove();
        return;
      }
      render();
      if (pressTime === null) board.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    };
    marker.addEventListener('click',event => choose(event.timeStamp));
    marker.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose();
      }
    });
  }
}

function syncMapFrame() {
  const frame = byId('map-frame');
  if (!frame) return;
  const viewport = replayRun ? byId('replay-board') : board;
  const {x,y,width,height} = viewport.viewBox.baseVal;
  for (const [name,value] of Object.entries({x,y,width,height})) frame.setAttribute(name,value);
}

function drawMinimap(course) {
  const map = byId('minimap');
  map.replaceChildren();
  fullView(map,fieldBounds(course));
  map.setAttribute('data-can-pan',String(room.state === 'racing'));
  const outline = course.boundaries.map(points => trackPath(points)+' Z').join(' ');
  svg('path',{d:outline,fill:'#627473','fill-rule':'evenodd',stroke:'#92a09c','stroke-width':.28},map);
  svg('rect',{id:'map-frame',fill:'#e7f5ef','fill-opacity':.10,stroke:'#e7f5ef','stroke-width':.45},map);
  room.players.forEach((player,index) => {
    svg('circle',{id:'map-car-'+index,cx:player.x,cy:player.y,r:index === room.turn ? 1.05 : .77,
      fill:colors[index],stroke:'#152729','stroke-width':.24},map);
  });
  syncMapFrame();
}

function bindMinimap() {
  const map = byId('minimap');
  map.addEventListener('click',event => {
    if (room?.state !== 'racing') return;
    const transform = map.getScreenCTM();
    if (!transform) return;
    camera = new DOMPoint(event.clientX,event.clientY).matrixTransform(transform.inverse());
    if (!zoom) zoom = 3;
    render();
  });
}

function drawFormulaCar(parent, color) {
  const car = svg('g',{},parent);
  for (const x of [-.92,.47]) {
    for (const y of [-.66,.36]) {
      svg('rect',{x,y,width:.47,height:.30,rx:.08,fill:'#11181d',stroke:'#727e83','stroke-width':.05},car);
    }
  }
  svg('path',{d:'M -1.18 -.62 H -.91 V -.26 H -.52 L -.40 -.40 H .42 L .54 -.17 H .98 V -.62 H 1.2 V .62 H .98 V .17 H .54 L .42 .40 H -.40 L -.52 .26 H -.91 V .62 H -1.18 Z',
    fill:color,stroke:'#182227','stroke-width':.06,'stroke-linejoin':'round'},car);
  svg('ellipse',{cx:-.12,cy:0,rx:.26,ry:.16,fill:'#152027'},car);
  return car;
}

let replayRun = null;
function replayAvailable() {
  return room?.state === 'finished' && room.replay?.length > 0 &&
    room.replay.length === room.players.reduce((total,player) => total+player.trail.length-1,0);
}

function updateReplayControls() {
  const running = replayRun !== null;
  board.toggleAttribute('hidden',running);
  byId('replay-board').toggleAttribute('hidden',!running);
  byId('replay-controls').hidden = !replayAvailable();
  byId('replay-toggle').textContent = running ? 'Quitter le replay' : 'Voir le replay';
  byId('replay-pause').hidden = !running;
  byId('replay-pause').textContent = replayRun?.paused ? 'Reprendre' : 'Pause';
  syncMapFrame();
}

function stopReplay() {
  if (!replayRun) return;
  cancelAnimationFrame(replayRun.frame);
  replayRun = null;
  updateReplayControls();
  if (room && room.state !== 'lobby') drawMinimap(courseFor(room));
}

function playFinishedReplay() {
  if (replayAvailable() && !matchMedia('(prefers-reduced-motion: reduce)').matches) startReplay();
}

function makeReplayPath(trail) {
  const anchors = trail.filter(([x,y],index) => !index || x !== trail[index-1][0] || y !== trail[index-1][1]);
  const samples = [{x:anchors[0][0],y:anchors[0][1],distance:0}];
  const waypoints = [0];
  function add(x,y) {
    const previous = samples.at(-1);
    const length = Math.hypot(x-previous.x,y-previous.y);
    if (length > 1e-8) samples.push({x,y,distance:previous.distance+length});
    return samples.at(-1).distance;
  }
  for (let index = 1; index < anchors.length-1; index++) {
    const [x,y] = anchors[index];
    const [px,py] = anchors[index-1];
    const [nx,ny] = anchors[index+1];
    const incoming = Math.hypot(px-x,py-y);
    const outgoing = Math.hypot(nx-x,ny-y);
    const radius = Math.min(.85,incoming*.32,outgoing*.32);
    const ax = x+(px-x)*radius/incoming, ay = y+(py-y)*radius/incoming;
    const bx = x+(nx-x)*radius/outgoing, by = y+(ny-y)*radius/outgoing;
    add(ax,ay);
    for (let step = 1; step <= 8; step++) {
      const t = step/8, u = 1-t;
      const distance = add(u*u*ax+2*u*t*x+t*t*bx,u*u*ay+2*u*t*y+t*t*by);
      if (step === 4) waypoints.push(distance);
    }
  }
  if (anchors.length > 1) waypoints.push(add(...anchors.at(-1)));
  const length = samples.at(-1).distance;

  function locate(distance) {
    if (distance <= 0) return samples[0];
    if (distance >= length) return samples.at(-1);
    let lo = 0, hi = samples.length-1;
    while (hi-lo > 1) {
      const mid = Math.floor((lo+hi)/2);
      if (samples[mid].distance <= distance) lo = mid;
      else hi = mid;
    }
    const a = samples[lo], b = samples[hi];
    const t = (distance-a.distance)/(b.distance-a.distance);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
  return {
    moves:waypoints.length-1,
    pose(time, heading) {
      const move = Math.floor(time);
      const from = waypoints[move] ?? length;
      const to = waypoints[move+1] ?? length;
      const distance = from+(to-from)*(time-move);
      const {x,y} = locate(distance);
      const before = locate(distance-.14);
      const after = locate(distance+.14);
      const dx = after.x-before.x, dy = after.y-before.y;
      return {x,y,heading:Math.hypot(dx,dy) > 1e-6 ? Math.atan2(dy,dx)*180/Math.PI : heading};
    },
  };
}

function startReplay() {
  if (!replayAvailable() || replayRun) return;
  const scene = byId('replay-board');
  const {width,height,finish} = courseFor(room);
  scene.replaceChildren();
  fullView(scene,fieldBounds(courseFor(room)));
  drawSurface(courseFor(room),scene);
  const finishLine = finish.axis === 'x' ? {x1:finish.at,x2:finish.at,y1:finish.min,y2:finish.max} :
    {x1:finish.min,x2:finish.max,y1:finish.at,y2:finish.at};
  svg('line',{...finishLine,stroke:'#f2eee2','stroke-width':.38,'stroke-dasharray':'.30 .23'},scene);
  const players = room.players;
  const cars = players.map((_,index) => drawFormulaCar(scene,colors[index]));
  const paths = players.map(player => makeReplayPath(player.trail));
  const moves = Math.max(...paths.map(path => path.moves));
  const duration = Math.max(1400,Math.min(16000,moves*235));
  const headings = players.map(() => courseFor(room).start.axis === 'x' ? 180 : -90);
  const run = {frame:0,paused:false,last:null,elapsed:0,tick:null};
  replayRun = run;

  function positionCar(path,index,time) {
    const {x,y,heading} = path.pose(time,headings[index]);
    headings[index] = heading;
    cars[index].setAttribute('transform',`translate(${x} ${y}) rotate(${heading}) scale(1.55)`);
    const dot = byId('map-car-'+index);
    dot?.setAttribute('cx',x);
    dot?.setAttribute('cy',y);
  }
  paths.forEach((path,index) => positionCar(path,index,0));
  run.tick = timestamp => {
    if (replayRun !== run || run.paused) return;
    if (run.last !== null) run.elapsed += Math.min(timestamp-run.last,100);
    run.last = timestamp;
    const progress = Math.min(1,run.elapsed/duration);
    paths.forEach((path,index) => positionCar(path,index,progress*path.moves));
    if (run.elapsed >= duration+1300) {
      stopReplay();
    } else {
      run.frame = requestAnimationFrame(run.tick);
    }
  };
  updateReplayControls();
  run.frame = requestAnimationFrame(run.tick);
}

function bindReplay() {
  byId('replay-toggle').addEventListener('click',() => {
    if (replayRun) stopReplay();
    else startReplay();
  });
  byId('replay-pause').addEventListener('click',() => {
    if (!replayRun) return;
    replayRun.paused = !replayRun.paused;
    if (replayRun.paused) cancelAnimationFrame(replayRun.frame);
    else {
      replayRun.last = null;
      replayRun.frame = requestAnimationFrame(replayRun.tick);
    }
    updateReplayControls();
  });
}

function layoutRaceControls(racing) {
  byId('race-hud').hidden = !racing;
  byId('race-dock').hidden = !racing;
  for (const [node,inRace,outsideRace] of [
    ['players','race-positions','result-positions'],
    ['minimap-panel','race-map','result-map'],
    ['turn-controls','race-dock','result-turn'],
    ['message','race-dock','control-panel'],
  ]) {
    const element = byId(node);
    const destination = byId(racing ? inRace : outsideRace);
    if (element.parentNode !== destination) destination.append(element);
  }
}

function render() {
  byId('forfeit').hidden=room?.state!=='racing'||room.players[room.you]?.forfeit;
  if(room)recordRace(room,'En direct',[room.you]);
  entry.hidden = Boolean(room);
  game.hidden = !room;
  const racing = room?.state === 'racing';
  document.querySelector('.shell').classList.toggle('playing',racing);
  layoutRaceControls(racing);
  for (const button of entry.querySelectorAll('button')) button.disabled = pending;
  const active = room?.state === 'racing' ? room.players[room.turn] : null;
  const course = courseFor(room);
  const myTurn = active && room.you === room.turn;
  const choices = myTurn ? options(room) : [];
  byId('zoom-controls').hidden = !active;
  byId('zoom-out').disabled = zoom === 0;
  byId('zoom-in').disabled = zoom === zoomSizes.length-1;
  byId('toggle-zoom').textContent = zoom ? 'Vue entière' : 'Recentrer';
  byId('recenter-board').hidden = !active || !zoom || camera === null;
  draw(active,choices);
  updateReplayControls();
  updateClock();
  if (!room) return;
  byId('display-code').textContent = room.code;
  const lobby = byId('lobby-heading');
  if (lobby) lobby.hidden = room.state !== 'lobby';
  byId('leave').hidden = room.state === 'racing';
  byId('minimap-panel').hidden = room.state === 'lobby';
  if (room.state !== 'lobby') drawMinimap(course);
  const list = byId('players');
  list.replaceChildren();
  const ordered = room.state === 'lobby' ? room.players.map((player,index) => ({player,index})) : standings(room);
  ordered.forEach(({player,index,rank}) => {
    const row = document.createElement('li');
    row.classList.toggle('active',player===active);
    const marker = document.createElement('i');
    marker.style.backgroundColor = colors[index];
    const name = document.createElement('span');
    name.textContent = player.name+(player.forfeit?' · Forfait':'');
    const speed = document.createElement('span');
    speed.textContent = room.state === 'lobby' ? (index === 0 ? 'Hôte' : 'Prêt') :
      'Vitesse '+(player.recovery ? 1 : Math.max(Math.abs(player.vx),Math.abs(player.vy)));
    if (room.lapGoal) speed.textContent = `${player.laps}/${room.lapGoal} tours · ${speed.textContent}`;
    if (rank) {
      const position = document.createElement('strong');
      position.className = 'position';
      position.textContent = rank === 1 ? '1er' : rank+'e';
      row.append(position);
    }
    row.append(marker,name,speed);
    list.append(row);
  });
  const status = byId('status');
  const roundCount = byId('round-count');
  const lapNotice = byId('lap-notice');
  const lastLap = room.state === 'racing' ? room.lastLap : null;
  lapNotice.hidden = !lastLap;
  lapNotice.textContent = lastLap ?
    `${room.players[lastLap.index].name} boucle le tour ${lastLap.laps}/${room.lapGoal}.` : '';
  const completedRounds = room.state === 'finished' ? room.round : room.round-1;
  roundCount.hidden = room.state === 'lobby';
  roundCount.textContent = `Manches terminées · ${completedRounds}`;
  if (active) {
    const total = room.lapGoal ?? 1;
    byId('race-round').textContent = completedRounds;
    byId('race-lap').textContent = `${Math.min((active.laps ?? 0)+1,total)}/${total}`;
  }
  const hint = byId('hint');
  primary.hidden = true;
  primaryAction = null;
  const showButton = (label,action,disabled = false) => {
    primary.hidden = false;
    primary.textContent = label;
    primary.disabled = pending || disabled;
    primaryAction = action;
  };
  if (room.state === 'lobby') {
    status.textContent = room.players.length+' joueur'+(room.players.length === 1 ? '' : 's')+' sur 4';
    hint.textContent = room.you === 0 ? 'Envoie le lien à tes adversaires. Dès qu’une personne a rejoint, tu peux lancer la course.' : 'En attente du départ.';
    if (room.you === 0) showButton('Lancer la course','start',room.players.length < 2);
  } else if (room.state === 'finished') {
    const names = room.winners.map(index => room.players[index].name).join(' et ');
    status.textContent = room.winners.length > 1 ? 'Égalité · '+names : names+' remporte la course';
    const distance = room.players[room.winners[0]].finish;
    hint.textContent = room.byForfeit?'Victoire par forfait.':`Manche ${room.round} · ${distance} ${distance === 1 ? 'case' : 'cases'} après la ligne.`;
    if (!room.players.some(p=>p.forfeit) && room.you === 0) showButton('Rejouer','restart');
  } else {
    status.textContent = 'Au tour de '+active.name;
    const canMove = choices.some(choice => !choice.blocked);
    hint.textContent = '';
    if (myTurn) {
      hint.textContent = !canMove ? 'Toutes les destinations sont bloquées.' :
        selected?.offTrack ? 'Ce point termine hors piste ou le trait franchit le bord.' :
        active.recovery ? `Retour en première · ${active.recovery} déplacement(s) d’une case.` :
        !inside(active.x,active.y,course) ? 'Reviens sur la piste à vitesse 1.' : 'Choisis une intersection sur la grille.';
      if (room.players.some(player => player.finish !== null)) {
        hint.textContent = 'Arrivée franchie. Finissez la manche. '+hint.textContent;
      }
      if (selected && room.doubleConfirm) hint.textContent += ' Deux pressions rapides sur la même case valident le coup.';
      showButton(canMove ? 'Valider le déplacement' : 'Passer le tour','move',canMove&&!selected);
    }
  }
}



entry.addEventListener('submit',event => {
  event.preventDefault();
  const name = byId('name').value.trim();
  if (!name) { notice('Entre ton pseudo.'); return; }
  const joining = event.submitter?.value === 'join';
  const code = roomInput.value.trim().toUpperCase();
  if (joining && !/^[A-Z2-9]{6}$/.test(code)) { notice('Entre le code à 6 caractères.'); return; }
  busy(async () => {
    const key = joining ? localStorage.getItem('cq-token-'+code) : null;
    const data = await request(joining ? '/'+code+'/join' : '',{name,course:trackPicker.value,design:RaceAtelier.list().find(d=>d.id===trackPicker.value),lapGoal:Number(byId('lap-goal').value)},key);
    localStorage.setItem('cq-name',name);
    remember(data);
  });
});

function submitAction() {
  if (!room || !primaryAction) return;
  const action = primaryAction;
  const move = selected;
  busy(async () => {
    const result = await request('/'+room.code+'/'+action,{revision:room.revision,
      ...(action==='move' ? {x:move?.x ?? null,y:move?.y ?? null} : {})});
    setRoom(result.room);
  });
}
primary.addEventListener('click',submitAction);
function confirmMove() { if(primaryAction === 'move') submitAction(); }
bindZoom();
bindPan();
bindMinimap();
bindReplay();
byId('invite').addEventListener('click',async () => {
  const url = new URL(location.href);
  url.searchParams.set('salle',room.code);
  try {
    await navigator.clipboard.writeText(url.href);
    notice('Lien d’invitation copié.');
  } catch {
    notice('Lien d’invitation · '+url.href);
  }
});
async function exitRoom(event){
  event?.preventDefault();
  if(!room){location.href='/';return;}
  if(pending)return;
  if(room.state==='racing' && !confirm('Quitter cette course et déclarer forfait ?'))return;
  if(room.state==='racing'||room.state==='lobby'){
    pending=true;try{const data=await request('/'+room.code+'/leave',{revision:room.revision});if(room.state==='racing')recordRace(data.room,'En direct',[room.you]);}catch(error){notice(error.message);return;}finally{pending=false;}
  }
  if (pending) return;
  stopReplay();
  roomInput.value = room.code;
  room = null;
  token = null;
  selected = null;
  camera = null;
  zoom = 0;
  localStorage.removeItem('cq-last');
  history.replaceState(null,'',location.pathname);
  notice();
  location.href='/';
}
for(const id of ['leave','forfeit','home'])byId(id).onclick=exitRoom;
document.querySelector('.mast a').onclick=exitRoom;

render();
const resumeCode = inviteCode || localStorage.getItem('cq-last');
const resumeToken = resumeCode && localStorage.getItem('cq-token-'+resumeCode);
if (resumeToken) busy(async () => {
  const data = await request('/'+resumeCode,undefined,resumeToken);
  remember({...data,token:resumeToken});
});
setInterval(refresh,1400);
document.addEventListener('visibilitychange',() => { if (!document.hidden) refresh(); });

function updateClock() {
  const clock=byId('clock');
  clock.hidden=room?.state!=='racing';
  if(!clock.hidden) clock.textContent=Math.max(0,Math.ceil((room.deadline-Date.now())/1000))+' s';
}
setInterval(updateClock,250);
