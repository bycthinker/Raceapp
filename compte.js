(async()=>{
  const el=id=>document.getElementById(id);
  const profile=RaceProfile;
  const fallback=new URL('index.html',location.href);
  let back=fallback;
  try {
    const input=new URLSearchParams(location.search).get('retour');
    const target=new URL(input||fallback,location.href);
    if (target.origin===location.origin && ['http:','https:'].includes(target.protocol)
        && ['/','/index.html','/online','/online.html','/stats','/stats.html','/local.html'].includes(target.pathname)) back=target;
  } catch {}
  el('return').href=back.href;
  await profile.ready;
  const user=profile.user;
  el('access').hidden=Boolean(user) || !profile.available;
  el('my-history').hidden=!user;
  el('guest').textContent=user?'Se déconnecter et jouer en invité':'Continuer en invité';
  el('session').textContent=user?'Connecté en tant que '+user.name+'.':
    profile.available?'Retrouve ton pilote et tes courses.':'Le compte pilote nécessite le serveur Raceapp. Le jeu local reste accessible.';
  let action='login';
  function select(next) {
    action=next;
    const register=next==='register';
    el('login').setAttribute('aria-pressed',String(!register));
    el('register').setAttribute('aria-pressed',String(register));
    el('password').autocomplete=register?'new-password':'current-password';
    el('password').minLength=register?10:1;
    el('password-help').hidden=!register;
    el('submit').textContent=register?'Créer mon compte':'Se connecter';
    el('feedback').textContent='';
  }
  el('login').onclick=()=>select('login');el('register').onclick=()=>select('register');
  el('auth').onsubmit=async event=>{
    event.preventDefault();el('submit').disabled=true;
    try {
      await profile.request('/api/account/'+action,{name:el('handle').value,password:el('password').value});
      location.replace(back.href);
    } catch(error) {el('feedback').textContent=error.message;}
    finally {el('submit').disabled=false;}
  };
  el('guest').onclick=async()=>{
    el('guest').disabled=true;
    try { if (user) await profile.request('/api/account/logout',{});location.replace(back.href); }
    catch(error){el('feedback').textContent=error.message;el('guest').disabled=false;}
  };
})();
