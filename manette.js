// Commandes standard de la Gamepad API (Xbox A/B/X, croix, stick gauche, LB/RB).
globalThis.RacePad = (() => {
  const pref = 'raceapp:manette';
  function preference(){
    try { return localStorage.getItem(pref)!=='off'; } catch { return true; }
  }
  let enabled=preference();
  let race = null, toolsTurn = null, typing = null, focused = null;
  let lastStatus = '', frame = 0, retry = 0, connected = false, nonstandard = false, unavailable = false;
  const previous = new Map();
  const root = document.documentElement;
  const selector = 'a[href], button, select, input:not([type="hidden"])';

  function status() {
    root.classList.toggle('pad-connected',enabled && connected);
    const message = !enabled ? 'Désactivée' : unavailable || !navigator.getGamepads ? 'Indisponible dans ce navigateur' :
      connected ? 'Manette connectée' : nonstandard ? 'Manette sans disposition standard' : 'Appuie sur une touche de la manette pour la détecter.';
    if (lastStatus === message) return;
    lastStatus = message;
    for (const el of document.querySelectorAll('[data-pad-status]')) el.textContent = message;
  }
  function setFocus(el) {
    if (focused !== el) focused?.classList.remove('pad-focus');
    focused = el || null;
    if (!el) return;
    el.classList.add('pad-focus');
    el.focus({preventScroll:true});
    el.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function clearPadUI() {
    setFocus(null);
    root.classList.remove('pad-active','pad-tools');
    toolsTurn = null;
  }
  function displayed(el) {
    return !el.disabled && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0;
  }

  // Le premier choix se situe autour de la position prévue par l’élan de la voiture.
  function firstMove(moves, origin, dx, dy) {
    const target = {x:origin.x+dx,y:origin.y+dy};
    return moves.reduce((best,p) => {
      const dist = Math.hypot(p.x-target.x,p.y-target.y);
      return !best || dist < best.dist ? {item:p,dist} : best;
    },null)?.item;
  }
  function ahead(items, origin, dx, dy, point) {
    let best=null, score=Infinity;
    for (const item of items) {
      const p=point(item), x=p.x-origin.x, y=p.y-origin.y;
      const forward=x*dx+y*dy;
      if (forward <= .001) continue;
      const cross=Math.abs(x*dy-y*dx);
      const cost=Math.hypot(x,y) + 3*cross + 2*cross*cross/forward;
      if (cost<score) {score=cost; best=item;}
    }
    return best;
  }
  function cycle(list, current, step) {
    const i=list.indexOf(current);
    return list[i<0 ? (step<0 ? list.length-1 : 0) : (i+step+list.length)%list.length];
  }
  function center(el) {
    const b=el.getBoundingClientRect();
    return {x:b.left+b.width/2,y:b.top+b.height/2};
  }
  function chooseMove(action,room) {
    if (race.busy() || room.you!==room.turn || room.players[room.turn].forfeit) return;
    if (action.type==='cancel') {race.select(null);return;}
    if (action.type==='accept') {
      if (race.canConfirm()) race.confirm();
      return;
    }
    const moves=race.options(room).filter(m=>!m.blocked);
    if (!moves.length) return;
    const selected=race.selected();
    const current=moves.find(m=>m.x===selected?.x && m.y===selected?.y);
    let next;
    if (action.type==='cycle') next=cycle(moves,current,action.step);
    if (action.type==='direction') {
      next=current ? ahead(moves,current,action.x,action.y,p=>p)
        : firstMove(moves,race.origin(room),action.x,action.y);
    }
    if(next && next!==current)race.select(next);
  }

  function finishTyping(save) {
    if (!typing) return;
    const {field,dialog,value}=typing;
    typing=null;
    dialog.close();
    dialog.remove();
    if(save){
      field.value=value;
      field.dispatchEvent(new Event('input',{bubbles:true}));
      field.dispatchEvent(new Event('change',{bubbles:true}));
    }
    setFocus(field);
  }
  // Le clavier système ne s’ouvre pas toujours sur un focus initié par la Gamepad API.
  function editText(field) {
    const dialog=document.createElement('dialog');
    dialog.className='pad-keyboard';
    dialog.setAttribute('aria-label','Saisie à la manette');
    const title=document.createElement('h2');
    title.textContent=field.labels?.[0]?.textContent.trim() || 'Saisie';
    const output=document.createElement('output');
    const letters=document.createElement('div');
    letters.className='pad-keys';
    const actions=document.createElement('div');
    actions.className='pad-key-actions';
    typing={field,dialog,value:field.value};
    let upper=field.id==='room-code', symbols=false;
    const update=()=>{output.textContent=field.type==='password' ? '•'.repeat(typing.value.length) : typing.value;};
    function key(parent,label,fn) {
      const button=document.createElement('button');
      button.type='button';button.textContent=label;button.onclick=fn;parent.append(button);
    }
    function append(s) {
      if(field.maxLength<0 || typing.value.length+s.length<=field.maxLength)typing.value+=s;
      update();
    }
    function drawKeys() {
      letters.replaceChildren();
      const chars=symbols ? "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~éèêëàâäçîïôöùûüœ" : '1234567890azertyuiopqsdfghjklmwxcvbn';
      for(const c of chars) {
        const v=upper?c.toLocaleUpperCase('fr'):c;
        key(letters,v,()=>append(v));
      }
    }
    drawKeys();update();
    key(actions,'Maj.',()=>{upper=!upper;drawKeys();});
    key(actions,'Signes',()=>{symbols=!symbols;drawKeys();});
    key(actions,'Espace',()=>append(' '));
    key(actions,'Effacer',()=>{typing.value=Array.from(typing.value).slice(0,-1).join('');update();});
    key(actions,'Terminer',()=>finishTyping(true));
    key(actions,'Annuler',()=>finishTyping(false));
    dialog.addEventListener('cancel',e=>{e.preventDefault();finishTyping(false);});
    dialog.append(title,output,letters,actions);document.body.append(dialog);
    dialog.showModal();setFocus(letters.firstElementChild);
  }

  function menu(action,racing) {
    const scope=typing?.dialog || document;
    const list=Array.from(scope.querySelectorAll(selector)).filter(el=>
      displayed(el) && !(el.readOnly && el.tagName==='INPUT') &&
      (!racing || typing || el.id!=='primary'));
    const current=list.includes(focused) ? focused : null;
    if (action.type==='cancel') {
      if(typing){finishTyping(false);return;}
      if(racing){toolsTurn=null;root.classList.remove('pad-tools');setFocus(null);return;}
      const back=document.querySelector('#home, #return, .back-button');
      if(back && displayed(back))back.click();
      return;
    }
    if (!list.length)return;
    if (!current) {
      const initial=list.find(el=>el.hasAttribute('data-pad-first')) || list[0];
      setFocus(initial);return;
    }
    const select=current.tagName==='SELECT';
    function adjust(step){
      const options=Array.from(current.options).filter(o=>!o.disabled && !o.parentElement?.disabled);
      const next=cycle(options,current.selectedOptions[0],step);
      if(next){current.value=next.value;current.dispatchEvent(new Event('change',{bubbles:true}));}
    }
    if(action.type==='direction'){
      if(select && action.x && !action.y){adjust(action.x);return;}
      if(current.type==='range' && action.x && !action.y){
        if(action.x>0)current.stepUp();else current.stepDown();
        current.dispatchEvent(new Event('input',{bubbles:true}));
        current.dispatchEvent(new Event('change',{bubbles:true}));return;
      }
      const next=ahead(list,center(current),action.x,action.y,center);
      if(next)setFocus(next);
    }else if(action.type==='cycle'){
      setFocus(cycle(list,current,action.step));
    }else if(action.type==='accept'){
      if(select){adjust(1);return;}
      if(current.tagName==='INPUT' && ['text','password','search','email'].includes(current.type)){editText(current);return;}
      current.click();
    }
  }

  function dispatch(action) {
    root.classList.add('pad-active');
    const room=race?.room();
    const racing=room?.state==='racing';
    const turnKey=racing ? [room.raceId,room.round,room.turn].join('/') : null;
    if(toolsTurn && toolsTurn!==turnKey){toolsTurn=null;root.classList.remove('pad-tools');setFocus(null);}
    if(racing && action.type==='tools' && !typing) {
      toolsTurn=toolsTurn ? null : turnKey;
      root.classList.toggle('pad-tools',Boolean(toolsTurn));
      const zoom=document.getElementById('zoom-in');
      setFocus(toolsTurn ? (zoom && displayed(zoom) ? zoom : document.getElementById('toggle-zoom')) : null);
      return;
    }
    if(racing && !toolsTurn && !typing){setFocus(null);chooseMove(action,room);}
    else menu(action,racing);
  }

  function sample(pad) {
    const down=i=>Boolean(pad.buttons[i]?.pressed);
    const axis=v=>Math.abs(v)>.55 ? Math.sign(v) : 0;
    const dpad=[12,13,14,15].some(down);
    return {x:dpad ? Number(down(15))-Number(down(14)) : axis(pad.axes[0]||0),
      y:dpad ? Number(down(13))-Number(down(12)) : axis(pad.axes[1]||0),
      cancel:down(1),accept:down(0),tools:down(2),prev:down(4),next:down(5)};
  }
  function edge(now,old) {
    if(now.cancel && !old.cancel)return {type:'cancel'};
    if(now.tools && !old.tools)return {type:'tools'};
    if((now.x || now.y) && (now.x!==old.x || now.y!==old.y))return {type:'direction',x:now.x,y:now.y};
    if(now.next && !old.next)return {type:'cycle',step:1};
    if(now.prev && !old.prev)return {type:'cycle',step:-1};
    if(now.accept && !old.accept)return {type:'accept'};
  }
  function poll() {
    frame=0;
    if(document.hidden || !document.hasFocus() || !enabled || !navigator.getGamepads)return;
    let pads;
    try {pads=Array.from(navigator.getGamepads()).filter(p=>p && p.connected!==false);}
    catch {unavailable=true;status();return;}
    unavailable=false;
    const supported=pads.filter(p=>p.mapping==='standard');
    connected=supported.length>0;nonstandard=pads.length>supported.length;
    // Relâcher puis presser après branchement, retour sur l’onglet ou changement de page.
    let action;
    for (const pad of supported) {
      const now=sample(pad),old=previous.get(pad.index);
      if(old && old.id===pad.id && !action)action=edge(now,old.state);
      previous.set(pad.index,{id:pad.id,state:now});
    }
    for(const index of previous.keys())if(!supported.some(p=>p.index===index))previous.delete(index);
    if(!connected && root.classList.contains('pad-active'))clearPadUI();
    status();
    if(action)dispatch(action);
    if(connected)frame=requestAnimationFrame(poll);
    else retry=setTimeout(wake,1000); // Certains navigateurs exposent la manette avant l’événement de connexion.
  }
  function wake() {clearTimeout(retry);if(!frame)frame=requestAnimationFrame(poll);}
  function suspend() {clearTimeout(retry);cancelAnimationFrame(frame);frame=0;previous.clear();}
  function syncPreference(next) {
    enabled=next;
    for(const other of document.querySelectorAll('[data-pad-toggle]'))other.checked=enabled;
    if(!enabled && typing)finishTyping(false);
    suspend();clearPadUI();status();wake();
  }
  function init() {
    for (const input of document.querySelectorAll('[data-pad-toggle]')) {
      input.checked=enabled;
      input.addEventListener('change',()=>{
        const next=input.checked;
        try {localStorage.setItem(pref,next?'on':'off');}catch{}
        syncPreference(next);
      });
    }
    status();wake();
    window.addEventListener('gamepadconnected',wake);
    window.addEventListener('gamepaddisconnected',event=>{previous.delete(event.gamepad.index);wake();});
    window.addEventListener('focus',wake);window.addEventListener('blur',suspend);
    window.addEventListener('pageshow',event=>event.persisted ? syncPreference(preference()) : wake());
    window.addEventListener('storage',event=>{if(event.key===pref || event.key===null)syncPreference(preference());});
    window.addEventListener('pagehide',suspend);
    document.addEventListener('visibilitychange',()=>document.hidden?suspend():wake());
    document.addEventListener('pointerdown',()=>{if(!typing)clearPadUI();},true);
  }
  document.addEventListener('DOMContentLoaded',init);
  return {bindRace(adapter){race=adapter;}};
})();
