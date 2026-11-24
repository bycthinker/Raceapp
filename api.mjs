import { racer, play, spaCourse, advanceTurn, forfeitRace } from './game.mjs';

class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const headers = { 'Cache-Control':'no-store' };
const json = (value, status) => Response.json(value,{status,headers});
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function playerName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 24) {
    throw new GameError('Entre un pseudo de 1 à 24 caractères.');
  }
  return value.trim();
}

function view(room, token) {
  const you = room.players.findIndex(player => player.token === token);
  return { ...room, you, players:room.players.map(({ token: omitted, ...player }) => player) };
}

export async function api(request, store) {
  try {
    const path = new URL(request.url).pathname;
    const match = /^\/api\/rooms(?:\/([A-Z2-9]{6})(?:\/(join|start|move|restart|leave))?)?$/.exec(path);
    if (!match) throw new GameError('Adresse inconnue.',404);
    const [,code,action] = match;
    const token = request.headers.get('Authorization')?.replace(/^Bearer /,'');
    if (request.method === 'POST' && !code) {
      const { name,lapGoal } = await request.json();
      const newToken = crypto.randomUUID();
      const player = racer(playerName(name),newToken,0,spaCourse);
      for (let attempt = 0; attempt < 8; attempt++) {
        const roomCode = Array.from(crypto.getRandomValues(new Uint8Array(6)),
          byte => codeAlphabet[byte % codeAlphabet.length]).join('');
        const room = { code:roomCode,course:"spa",lapGoal:lapGoal===2?2:1, revision:0, state:'lobby', turn:0, round:1, players:[player], winners:[] };
        if (await store.insert(room)) return json({ room:view(room,newToken), token:newToken },201);
      }
      throw new GameError('Création impossible. Réessaie.',503);
    }
    const room = code && await store.get(code);
    if (!room) throw new GameError('Salle introuvable.',404);
    if (room.state === 'racing' && Date.now() >= room.deadline) {
      const missed = 1 + Math.floor((Date.now()-room.deadline)/15000);
      advanceTurn(room);
      if(room.state === 'racing'){
        const active=room.players.flatMap((p,i)=>p.forfeit?[]:[i]);
        const pos=active.indexOf(room.turn)+missed-1;
        room.round+=Math.floor(pos/active.length);room.turn=active[pos%active.length];
      }
      room.deadline += missed*15000;
      room.revision++;
      if (!await store.update(room)) throw new GameError('La salle a changé. Réessaie.',409);
    }
    const you = room.players.findIndex(player => player.token === token);
    if (request.method === 'GET' && !action) {
      if (you < 0) throw new GameError('Rejoins la salle pour voir la course.',403);
      return json({ room:view(room,token) });
    }
    if (request.method !== 'POST' || !action) throw new GameError('Action inconnue.',405);
    let newToken = token;
    if (action === 'join') {
      if (you >= 0) return json({ room:view(room,token),token });
      if (room.state !== 'lobby' || room.players.length >= 4) throw new GameError('La salle est pleine ou la course a déjà commencé.',409);
      const { name } = await request.json();
      newToken = crypto.randomUUID();
      room.players.push(racer(playerName(name),newToken,room.players.length,spaCourse));
    } else {
      if (you < 0) throw new GameError('Rejoins la salle pour jouer.',403);
      const body = await request.json();
      if (body.revision !== room.revision) throw new GameError('La salle a changé. Réessaie.',409);
      const keepDeadline=action==='leave' && room.turn!==you;
      if(action==='leave'){
        if(room.state==='lobby'){
          room.players.splice(you,1);
          room.players=room.players.map((p,i)=>racer(p.name,p.token,i,spaCourse));
          if(!room.players.length)room.state='closed';
        }else if(room.state==='racing'){forfeitRace(room,you);}
      }else if (action === 'start') {
        if (you !== 0 || room.state !== 'lobby' || room.players.length < 2) {
          throw new GameError('L’hôte peut lancer la course dès que deux joueurs sont prêts.',409);
        }
        room.state = 'racing';room.raceId=crypto.randomUUID();
      } else if (action === 'restart') {
        if (you !== 0 || room.state !== 'finished') throw new GameError('L’hôte peut relancer une course terminée.',409);
        room.players = room.players.filter(p=>!p.forfeit).map((driver,index) => racer(driver.name,driver.token,index,spaCourse));
        if(room.players.length<2)throw new GameError('Crée une nouvelle salle pour la revanche.',409);
        Object.assign(room,{raceId:crypto.randomUUID(),byForfeit:false,state:'racing',turn:0,round:1,winners:[],replay:[],lastLap:null});
      } else {
        if (room.state !== 'racing' || room.turn !== you) throw new GameError('Attends ton tour.',409);
        if (!play(room,body.x,body.y)) throw new GameError('Ce déplacement est interdit.',409);
      }
      if(room.state === 'racing' && !keepDeadline) room.deadline=Date.now()+15000;
    }
    room.revision += 1;
    if (!await store.update(room)) throw new GameError('La salle a changé. Réessaie.',409);
    return json({room:view(room,newToken), ...(action === 'join' ? {token:newToken} : {})});
  } catch (error) {
    if (error instanceof GameError) return json({error:error.message},error.status);
    if (error instanceof SyntaxError || error instanceof TypeError && error.message.includes('JSON')) {
      return json({error:'Requête invalide.'},400);
    }
    console.error(error);
    return json({error:'Le serveur n’a pas pu répondre.'},500);
  }
}
