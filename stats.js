const RaceHistory=(()=>{
  const guestPrefix='raceapp:result:';
  const prefix=owner=>'raceapp:pending:'+owner+':';
  let sending=false;
  function keys(){try{return Object.keys(localStorage);}catch{return [];}}
  function result(room,p,i) {
    if(p.forfeit)return 'Forfait';
    if(room.state!=='finished')return 'En cours';
    if(!room.winners.includes(i))return 'Perdue';
    return room.winners.length>1?'Égalité':'Gagnée';
  }
  async function sync() {
    const owner=RaceProfile.user?.id;
    if (!owner || sending) return;
    sending=true;
    try {
      // Une fin de course peut remplacer « En cours » pendant l’envoi.
      for (;;) {
        const key=keys().find(k=>k.startsWith(prefix(owner)));
        if(!key)break;
        const value=localStorage.getItem(key);
        let item;
        try{item=JSON.parse(value);}catch{localStorage.removeItem(key);continue;}
        if(!item || item.owner!==owner){localStorage.removeItem(key);continue;}
        await RaceProfile.request('/api/history',item,{keepalive:true});
        if(localStorage.getItem(key)===value)localStorage.removeItem(key);
      }
    } catch {} finally {sending=false;}
  }
  function record(room,mode,indexes) {
    if (!room?.raceId || !['racing','finished'].includes(room.state) || mode==='Tutoriel')return;
    // Les résultats du direct sont déjà enregistrés par le serveur pour tous les comptes.
    if(mode==='En direct' && room.players[room.you]?.member)return;
    for(const i of indexes) {
      const p=room.players[i];if(!p)continue;
      const state=result(room,p,i);
      if (room.owner) {
        if(i!==0 || room.lastSavedResult===state)continue;
        const item={owner:room.owner,race:room.raceId,mode,circuit:room.circuitName,result:state,started:room.started};
        try {localStorage.setItem(prefix(room.owner)+room.raceId,JSON.stringify(item));room.lastSavedResult=state;}catch{}
        void sync();
      } else {
        const key=guestPrefix+room.raceId+':'+i;
        const item={name:p.name,mode,result:state};
        try {const value=JSON.stringify(item);if(localStorage.getItem(key)!==value)localStorage.setItem(key,value);}catch{}
      }
    }
  }
  function row(body,values) {
    const tr=body.insertRow();
    for(const v of values)tr.insertCell().textContent=String(v);
  }
  async function display() {
    const table=document.querySelector('#stats-body');
    if(!table)return;
    const user=RaceProfile.user;
    const info=document.querySelector('#scope'),empty=document.querySelector('#empty'),detail=document.querySelector('#history');
    let entries=[];
    if (user) {
      info.textContent='Historique de '+user.name+' · Toutes les courses de ton compte.';
      try {
        await sync();
        const data=await RaceProfile.request('/api/history');
        entries=data.races.map(r=>({...r,name:user.name}));
      } catch {info.textContent='Impossible de charger ton historique. Réessaie une fois connecté.';empty.hidden=true;return;}
      detail.hidden=!entries.length;
      const list=document.querySelector('#history-body');
      list.replaceChildren();
      for (const r of entries)row(list,[new Date(r.started).toLocaleString('fr-BE',{dateStyle:'short',timeStyle:'short'}),r.mode,r.circuit,r.result]);
    } else {
      info.textContent='Statistiques des pilotes invités sur cet appareil.';
      for(const key of keys().filter(k=>k.startsWith(guestPrefix))) {
        try{const r=JSON.parse(localStorage.getItem(key));if(r?.name && r.mode)entries.push(r);}catch{}
      }
    }
    const groups=new Map();
    for(const s of entries) {
      const id=JSON.stringify([s.name,s.mode]);
      const counts=groups.get(id)??[s.name,s.mode,0,0,0,0];
      counts[2]++;if(s.result==='Gagnée')counts[3]++;if(s.result==='Égalité')counts[4]++;if(s.result==='Forfait')counts[5]++;
      groups.set(id,counts);
    }
    table.replaceChildren();
    for(const counts of groups.values())row(table,counts);
    empty.hidden=groups.size>0;
  }
  document.addEventListener('DOMContentLoaded',async()=>{await RaceProfile.ready;if(document.querySelector('#stats-body'))await display();else await sync();});
  window.addEventListener('online',sync);
  return {record,sync};
})();
function recordRace(room,mode,indexes){RaceHistory.record(room,mode,indexes);}
