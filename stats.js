// Une entrée par course et par siège. Actualiser l'écran conserve le même résultat.
function recordRace(room, label, indexes){
  if(!room || room.state==='lobby' || !room.raceId || label==='Tutoriel')return;
  for(const i of indexes){
    const p=room.players[i]; if(!p)continue;
    const key='raceapp:result:'+room.raceId+':'+i;
    const result=p.forfeit?'Forfait':room.state!=='finished'?'En cours':
      !room.winners.includes(i)?'Perdue':room.winners.length>1?'Égalité':'Gagnée';
    const value=JSON.stringify({name:p.name,mode:label,result});
    try{if(localStorage.getItem(key)!==value)localStorage.setItem(key,value);}catch{}
  }
}
function renderStats(){
  const body=document.querySelector('#stats-body');if(!body)return;
  const rows=new Map();
  for(const key of Object.keys(localStorage)){
    if(!key.startsWith('raceapp:result:'))continue;
    let s;try{s=JSON.parse(localStorage.getItem(key));}catch{continue;}
    const id=JSON.stringify([s.name,s.mode]);
    const row=rows.get(id)??[s.name,s.mode,0,0,0,0];
    row[2]++;if(s.result==='Gagnée')row[3]++;if(s.result==='Égalité')row[4]++;if(s.result==='Forfait')row[5]++;
    rows.set(id,row);
  }
  for(const row of rows.values()){
    const tr=body.insertRow();for(const value of row)tr.insertCell().textContent=value;
  }
  document.querySelector('#empty').hidden=rows.size>0;
}
document.addEventListener('DOMContentLoaded',renderStats);
