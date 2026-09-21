window.EHF_MOBILE_SITE_NAV_VERSION='4.2.41-MOBILE-NAV-LEITURA-INTELIGENTE';
(function(){
  'use strict';
  const VERSION = window.EHF_MOBILE_SITE_NAV_VERSION;
  const $ = (s,r=document)=>r.querySelector(s);
  const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  const route = () => (location.hash || '#painel').replace(/[?&].*$/,'').toLowerCase();
  const navItems = [
    {hash:'#painel', label:'Painel', icon:'▣'},
    {hash:'#bipagem', label:'Bipar', icon:'▦'},
    {hash:'#embalagem', label:'Embalar', icon:'▤'},
    {hash:'#atrasados', label:'Atrasos', icon:'!'}
  ];
  const extraItems = [
    {hash:'#logistica', label:'Logística', desc:'Rotas, entregas e romaneio operacional'},
    {hash:'#motorista', label:'Motorista', desc:'Tela de motorista/rota'},
    {hash:'#admin', label:'Admin', desc:'Configurações e manutenção'},
    {hash:'#painel', label:'Painel completo', desc:'Visão geral operacional'},
    {hash:'#embalagem', label:'Conferência de embalagem', desc:'Conferir pedido por etiqueta'},
    {hash:'#bipagem', label:'Bipagem/romaneio', desc:'Coleta por câmera ou leitor'}
  ];

  function injectStyle(){
    if($('#ehf-mobile-site-nav-style')) return;
    const st=document.createElement('style');
    st.id='ehf-mobile-site-nav-style';
    st.textContent=`
      @media(max-width:760px){
        body{padding-bottom:72px!important}
        #ehf-mobile-clean-shell{padding-bottom:88px!important}
        #ehf-mobile-global-nav{position:fixed;left:8px;right:8px;bottom:8px;z-index:99980;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;background:rgba(5,7,10,.94);border:1px solid rgba(255,255,255,.10);border-radius:18px;padding:7px;box-shadow:0 18px 60px rgba(0,0,0,.62);backdrop-filter:blur(12px);font-family:Inter,Arial,sans-serif}
        .ehf-mnav-btn{appearance:none;border:0;background:transparent;color:#94a3b8;border-radius:13px;min-height:46px;padding:5px 2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-weight:900;font-size:9px;line-height:1;cursor:pointer}
        .ehf-mnav-btn b{font-size:15px;line-height:1;color:inherit}.ehf-mnav-btn.active{background:#ff8a00;color:#0b0f17;box-shadow:0 8px 18px rgba(255,138,0,.24)}.ehf-mnav-btn:active{transform:scale(.98)}
        #ehf-mobile-menu-drawer{position:fixed;inset:auto 8px 82px 8px;z-index:99981;background:#07111d;border:1px solid rgba(255,138,0,.55);border-radius:18px;padding:12px;box-shadow:0 25px 85px rgba(0,0,0,.75);font-family:Inter,Arial,sans-serif;display:none;max-height:68vh;overflow:auto}
        #ehf-mobile-menu-drawer.open{display:block}.ehf-md-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.ehf-md-head h3{margin:0;color:#fff;font-size:14px;font-weight:950}.ehf-md-close{border:0;background:#162235;color:#fff;border-radius:11px;padding:8px 10px;font-weight:900}
        .ehf-md-grid{display:grid;gap:8px}.ehf-md-item{border:1px solid rgba(255,255,255,.08);background:#0b1320;color:#fff;border-radius:14px;padding:11px;text-align:left;font-weight:950}.ehf-md-item span{display:block;color:#94a3b8;font-size:10px;font-weight:700;margin-top:2px;line-height:1.25}.ehf-md-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ehf-md-action{border:0;border-radius:14px;min-height:44px;background:#162235;color:#fff;font-weight:950}.ehf-md-action.orange{background:#ff8a00;color:#111827}.ehf-md-action.blue{background:#0ea5e9;color:#03111c}
        html.ehf-mobile-force-desktop #ehf-mobile-global-nav, html.ehf-mobile-force-desktop #ehf-mobile-menu-drawer, html.ehf-mobile-force-desktop #ehf-mobile-clean-shell{display:none!important}
        html.ehf-mobile-force-desktop body{padding-bottom:0!important}
      }
      @media(min-width:761px){#ehf-mobile-global-nav,#ehf-mobile-menu-drawer{display:none!important}}
    `;
    document.head.appendChild(st);
  }

  function go(hash){
    try{ localStorage.removeItem('ehf_mobile_force_desktop'); }catch(_){ }
    document.documentElement.classList.remove('ehf-mobile-force-desktop');
    closeMenu();
    if(location.hash !== hash) location.hash = hash;
    setTimeout(()=>{ window.scrollTo({top:0,behavior:'smooth'}); update(); },80);
  }
  function openMenu(){ const d=ensureDrawer(); d.classList.add('open'); }
  function closeMenu(){ $('#ehf-mobile-menu-drawer')?.classList.remove('open'); }
  function toggleMenu(){ const d=ensureDrawer(); d.classList.toggle('open'); }
  function forceDesktop(){ try{localStorage.setItem('ehf_mobile_force_desktop','1')}catch(_){ } document.documentElement.classList.add('ehf-mobile-force-desktop'); closeMenu(); }
  function restoreMobile(){ try{localStorage.removeItem('ehf_mobile_force_desktop')}catch(_){ } document.documentElement.classList.remove('ehf-mobile-force-desktop'); update(); }

  function ensureDrawer(){
    let d=$('#ehf-mobile-menu-drawer');
    if(d) return d;
    d=document.createElement('div'); d.id='ehf-mobile-menu-drawer';
    d.innerHTML=`
      <div class="ehf-md-head"><h3>Menu do painel</h3><button type="button" class="ehf-md-close" data-close>Fechar</button></div>
      <div class="ehf-md-grid">
        ${extraItems.map(x=>`<button type="button" class="ehf-md-item" data-go="${x.hash}">${x.label}<span>${x.desc}</span></button>`).join('')}
      </div>
      <div class="ehf-md-actions">
        <button type="button" class="ehf-md-action blue" data-reload>Atualizar</button>
        <button type="button" class="ehf-md-action orange" data-desktop>Versão completa</button>
      </div>
    `;
    document.body.appendChild(d);
    d.addEventListener('click', e=>{
      const goBtn=e.target.closest('[data-go]');
      if(goBtn) return go(goBtn.getAttribute('data-go'));
      if(e.target.closest('[data-close]')) return closeMenu();
      if(e.target.closest('[data-reload]')) return location.reload();
      if(e.target.closest('[data-desktop]')) return forceDesktop();
    });
    return d;
  }

  function ensureNav(){
    if(!isMobile()) return null;
    injectStyle();
    if(String(localStorage.getItem('ehf_mobile_force_desktop')||'')==='1') document.documentElement.classList.add('ehf-mobile-force-desktop');
    let nav=$('#ehf-mobile-global-nav');
    if(nav) return nav;
    nav=document.createElement('nav'); nav.id='ehf-mobile-global-nav'; nav.setAttribute('aria-label','Navegação mobile EHF');
    nav.innerHTML = navItems.map(x=>`<button type="button" class="ehf-mnav-btn" data-go="${x.hash}"><b>${x.icon}</b>${x.label}</button>`).join('') + `<button type="button" class="ehf-mnav-btn" data-menu><b>☰</b>Menu</button>`;
    document.body.appendChild(nav);
    nav.addEventListener('click', e=>{
      const b=e.target.closest('button'); if(!b) return;
      if(b.hasAttribute('data-menu')) return toggleMenu();
      const h=b.getAttribute('data-go'); if(h) return go(h);
    });
    return nav;
  }

  function update(){
    if(!isMobile()) return;
    const nav=ensureNav(); ensureDrawer();
    if(!nav) return;
    const r=route();
    nav.querySelectorAll('.ehf-mnav-btn').forEach(b=>{
      const h=b.getAttribute('data-go');
      b.classList.toggle('active', !!h && r.includes(h.replace('#','')));
    });
  }

  window.EHFMobileSiteNav={version:VERSION,update,go,openMenu,closeMenu,restoreMobile,forceDesktop};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',update); else update();
  window.addEventListener('hashchange',()=>setTimeout(update,80));
  window.addEventListener('resize',()=>setTimeout(update,120));
  setInterval(()=>{ if(isMobile()) update(); },3000);
})();
