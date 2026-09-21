/* EHF Panel Guard v4.2.23 — estabiliza o painel do Vercel contra renderizadores antigos */
(function(){
  const VERSION='4.2.23-PANEL-GUARD';
  window.EHF_PANEL_GUARD_VERSION=VERSION;
  const WORKER=String(window.EHF_TINY_WORKER_BASE||window.EHF_SUMMARY_API_BASE||localStorage.getItem('ehf_summary_api_base')||localStorage.getItem('ehf_worker_api_base')||'https://atendente-vesco-tiny-worker.2cwhzy.easypanel.host').replace(/\/+$/,'');
  const ACCOUNTS=[
    {key:'comercio',label:'EHF COMÉRCIO'},
    {key:'suprimentos',label:'EHF SUPRIMENTOS'},
    {key:'ekn',label:'EHF EKN'},
    {key:'distribuidora',label:'EHF DISTRIBUIDORA'}
  ];
  let lastSnapshot=null;
  let lastApply=0;
  let applying=false;
  let refreshBusy=false;
  const log=[];
  function now(){return new Date().toISOString();}
  function push(type,data){log.push({ts:now(),type,...(data||{})}); if(log.length>400)log.shift();}
  function n(v){const x=Number(v||0); return Number.isFinite(x)?x:0;}
  function key(k){return String(k||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
  function setText(id,val){const el=document.getElementById(id); if(el && String(el.textContent)!==String(val)) el.textContent=String(val);}
  function statusName(s){return String(s||'').trim();}
  function normalizeStore(store){
    const status=store?.status||store?.counts||{};
    const aguardando=n(store?.aguardando ?? store?.aguardando_total ?? status['1']);
    const separadas=n(store?.separadas ?? store?.separadas_total ?? status['2']);
    const embaladas=n(store?.embaladas ?? store?.embaladas_total ?? status['3']);
    const emSeparacao=n(store?.emSeparacao ?? store?.em_separacao ?? store?.em_separao ?? status['4']);
    const total=n(store?.total) || aguardando+emSeparacao+separadas+embaladas;
    return {...(store||{}), aguardando, emSeparacao, separadas, embaladas, total};
  }
  function storesFrom(data){
    const raw=data?.raw?.perStore||data?.perStore||data?.summary?.perStore||data?.dbSnapshot?.perStore||data?.byAccount||{};
    const out={};
    Object.entries(raw||{}).forEach(([k0,v])=>{ const kk=key(k0); if(kk) out[kk]=normalizeStore(v||{}); });
    ACCOUNTS.forEach(a=>{ if(!out[a.key]) out[a.key]=normalizeStore({}); });
    return out;
  }
  function totalsFrom(stores){
    const t={aguardando:0,emSeparacao:0,separadas:0,embaladas:0,total:0};
    Object.values(stores||{}).forEach(s=>{t.aguardando+=n(s.aguardando); t.emSeparacao+=n(s.emSeparacao); t.separadas+=n(s.separadas); t.embaladas+=n(s.embaladas);});
    t.total=t.aguardando+t.emSeparacao+t.separadas+t.embaladas;
    return t;
  }
  function channelName(id){
    const x=String(id||'0');
    const map={
      '769570519':'Mercado Envios','772849381':'Mercado Envios','847199235':'Mercado Envios',
      '780391986':'Mercado Envios Flex','780375701':'Mercado Envios Flex',
      '778029845':'Shopee Envios','778034480':'Shopee Envios','778095610':'Shopee Envios','854536867':'Shopee - SPX',
      '854284026':'TikTok Shipping','849173976':'Amazon DBA','854064525':'Amazon DBA','850044775':'Magalu Entregas','853036097':'Magalu Entregas'
    };
    return map[x]||('ID '+x);
  }
  function renderDetails(storeKey, store){
    const el=document.getElementById('container-'+storeKey); if(!el) return;
    const counts=store?.situacaoEnvioCounts||store?.situacao_envio_counts||{};
    const labels={aguardando:'AGUARDANDO SEPARAÇÃO',emSeparacao:'EM SEPARAÇÃO',separadas:'SEPARADAS',embaladas:'EMBALADAS / CHECKOUT'};
    const chunks=[];
    ['aguardando','emSeparacao','separadas','embaladas'].forEach(st=>{
      const obj=counts?.[st]||{};
      const rows=Object.entries(obj).filter(([,q])=>n(q)>0);
      if(!rows.length) return;
      chunks.push('<div class="status-group-title">'+labels[st]+'</div><ul class="channel-badge-list">'+rows.map(([id,q])=>'<li class="channel-badge-item"><span>'+channelName(id)+'</span><span class="channel-val">'+n(q)+'</span></li>').join('')+'</ul>');
    });
    if(chunks.length) el.innerHTML=chunks.join('');
  }
  function apply(snapshot, reason){
    if(!snapshot) return;
    applying=true;
    try{
      const stores=storesFrom(snapshot);
      const totals=totalsFrom(stores);
      setText('total-a-separar',totals.aguardando);
      setText('total-em-separacao',totals.emSeparacao);
      setText('total-separadas',totals.separadas);
      setText('total-embaladas',totals.embaladas);
      setText('remaining-to-pack',totals.aguardando+totals.emSeparacao+totals.separadas);
      ACCOUNTS.forEach(a=>{
        const s=stores[a.key]||normalizeStore({});
        setText('row-'+a.key+'-aguardando',s.aguardando);
        setText('row-'+a.key+'-separacao',s.emSeparacao);
        setText('row-'+a.key+'-separadas',s.separadas);
        setText('row-'+a.key+'-embaladas',s.embaladas);
        setText('row-'+a.key+'-total',s.total);
        renderDetails(a.key,s);
      });
      const last=document.getElementById('last-sync'); if(last) last.textContent=new Date(snapshot.ts||Date.now()).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'});
      document.documentElement.setAttribute('data-ehf-panel-guard',VERSION);
      window.EHF_LAST_CANONICAL_PANEL={ts:now(),reason,totals,stores,source:WORKER};
      lastApply=Date.now();
      push('apply',{reason,totals});
    }finally{applying=false;}
  }
  async function refresh(reason){
    if(refreshBusy) return; refreshBusy=true;
    try{
      const r=await fetch(WORKER+'/api/summary?ts='+Date.now(),{cache:'no-store'});
      const data=await r.json();
      if(!r.ok||data?.ok===false) throw new Error(data?.error||('HTTP '+r.status));
      lastSnapshot=data;
      apply(data,reason||'refresh');
    }catch(e){push('refresh-error',{message:e?.message||String(e)});}
    finally{refreshBusy=false;}
  }
  function installMutationGuard(){
    const ids=new Set(['total-a-separar','total-em-separacao','total-separadas','total-embaladas','remaining-to-pack','row-comercio-aguardando','row-comercio-separacao','row-comercio-separadas','row-comercio-embaladas','row-suprimentos-aguardando','row-suprimentos-separacao','row-suprimentos-separadas','row-suprimentos-embaladas','row-distribuidora-aguardando','row-distribuidora-separacao','row-distribuidora-separadas','row-distribuidora-embaladas']);
    const touched=muts=>muts.some(m=>{let t=m.target; if(t&&t.nodeType===3)t=t.parentElement; return t&&(ids.has(t.id)||t.closest?.('[id^="row-"],#total-a-separar,#total-em-separacao,#total-separadas,#total-embaladas,#remaining-to-pack'));});
    const obs=new MutationObserver(muts=>{
      if(applying||!lastSnapshot) return;
      if(!touched(muts)) return;
      push('dom-overwrite',{msSinceApply:Date.now()-lastApply});
      clearTimeout(window.__ehfPanelGuardTimer);
      window.__ehfPanelGuardTimer=setTimeout(()=>apply(lastSnapshot,'guard-reapply-after-dom-change'),30);
    });
    obs.observe(document.body,{subtree:true,childList:true,characterData:true});
    window.EHF_PANEL_GUARD_OBSERVER=obs;
  }
  window.EHF_PANEL_DIAG=function(){
    return {
      version:VERSION,
      worker:WORKER,
      scripts:[...document.scripts].map(s=>s.src||s.id||'inline').filter(Boolean),
      visual:document.documentElement.getAttribute('data-ehf-visual'),
      guard:document.documentElement.getAttribute('data-ehf-panel-guard'),
      runtime:window.EHF_PANEL_RUNTIME_VERSION||null,
      lastCanonical:window.EHF_LAST_CANONICAL_PANEL||null,
      log
    };
  };
  function start(){installMutationGuard(); setTimeout(()=>refresh('boot'),400); setInterval(()=>refresh('interval-guard'),30000); push('started',{version:VERSION});}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
