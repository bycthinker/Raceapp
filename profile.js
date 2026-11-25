// La session est portée par le cookie du serveur. Le jeu local fonctionne aussi hors ligne.
globalThis.RaceProfile = (() => {
  const profile={user:null,available:false};
  async function request(path,body,extra={}) {
    const response=await fetch(path,{method:body===undefined?'GET':'POST',
      credentials:'same-origin',cache:'no-store',
      ...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
      signal:AbortSignal.timeout(7000),...extra});
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || 'Connexion au serveur impossible.');
    return data;
  }
  profile.ready=(async()=>{
    if (location.protocol==='file:') return;
    try {
      const data=await request('/api/account');
      profile.user=data.user;profile.available=true;
    } catch {}
  })();
  // Une page restaurée peut appartenir à un compte qui vient d’être déconnecté.
  window.addEventListener('pageshow',async event=>{
    if(!event.persisted || !profile.available)return;
    try {
      const data=await request('/api/account');
      if((data.user?.id || null)!==(profile.user?.id || null))location.reload();
    }catch{}
  });
  profile.request=request;
  profile.accountLink=()=>{
    const target=new URL('compte.html',location.href);
    target.searchParams.set('retour',location.pathname+location.search);
    return target.href;
  };
  document.addEventListener('DOMContentLoaded',async()=>{
    await profile.ready;
    for (const link of document.querySelectorAll('[data-profile]')) {
      link.textContent=profile.user ? profile.user.name+' · Mon compte' : 'Invité · Se connecter';
      link.href=profile.accountLink();
    }
  });
  return profile;
})();
