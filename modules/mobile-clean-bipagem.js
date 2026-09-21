window.EHF_MOBILE_CLEAN_BIPAGEM_VERSION='4.2.45-LOJA-ROMANEIO-RESUMO';
(function(){
  'use strict';
  const VERSION = window.EHF_MOBILE_CLEAN_BIPAGEM_VERSION;
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function injectStyle(){
    if(document.getElementById('ehf-mobile-clean-bipagem-style')) return;
    const st=document.createElement('style');
    st.id='ehf-mobile-clean-bipagem-style';
    st.textContent = `
      @media(max-width:760px){
        html.ehf-mobile-clean-bipagem, html.ehf-mobile-clean-bipagem body{background:#05070a!important;color:#fff!important;overflow-x:hidden!important;width:100%!important;max-width:100%!important}
        html.ehf-mobile-clean-bipagem body{margin:0!important;font-family:Inter,Arial,sans-serif!important;font-size:13px!important}
        html.ehf-mobile-clean-bipagem .enterprise-sidebar, html.ehf-mobile-clean-bipagem aside.sidebar, html.ehf-mobile-clean-bipagem .sidebar, html.ehf-mobile-clean-bipagem .menu-lateral{display:none!important}
        html.ehf-mobile-clean-bipagem .enterprise-layout, html.ehf-mobile-clean-bipagem .app-shell, html.ehf-mobile-clean-bipagem .main-layout{display:block!important;width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;grid-template-columns:1fr!important}
        html.ehf-mobile-clean-bipagem .topbar{display:none!important}
        html.ehf-mobile-clean-bipagem #view-bipagem.active{display:block!important;width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;background:#05070a!important}
        html.ehf-mobile-clean-bipagem #view-bipagem.active .bip-pro-page{display:block!important;width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;background:#05070a!important;box-sizing:border-box!important}
        html.ehf-mobile-clean-bipagem #view-bipagem.active .bip-pro-page > :not(#ehf-mobile-clean-shell):not(#bip-session-panel):not(.ehf-camera-modal){display:none!important}
        html.ehf-mobile-clean-bipagem:not(.ehf-mobile-show-session) #view-bipagem.active #bip-session-panel{display:none!important}
        html.ehf-mobile-clean-bipagem.ehf-mobile-show-session #view-bipagem.active #bip-session-panel{display:block!important;position:fixed!important;inset:10px!important;z-index:99990!important;overflow:auto!important;background:#07111d!important;border:1px solid rgba(255,138,0,.65)!important;border-radius:18px!important;padding:14px!important;box-shadow:0 28px 90px rgba(0,0,0,.75)!important;max-height:calc(100vh - 20px)!important}
        html.ehf-mobile-clean-bipagem.ehf-mobile-show-session #view-bipagem.active #bip-session-panel .bip-session-summary-grid{display:none!important}
        html.ehf-mobile-clean-bipagem.ehf-mobile-show-session #view-bipagem.active #bip-session-panel .bip-session-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
        html.ehf-mobile-clean-bipagem.ehf-mobile-show-session #view-bipagem.active #bip-session-panel .bip-session-form{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
        html.ehf-mobile-clean-bipagem.ehf-mobile-show-session #view-bipagem.active #bip-session-panel input,
        html.ehf-mobile-clean-bipagem.ehf-mobile-show-session #view-bipagem.active #bip-session-panel select,
        html.ehf-mobile-clean-bipagem.ehf-mobile-show-session #view-bipagem.active #bip-session-panel textarea{min-height:44px!important;font-size:14px!important;border-radius:12px!important}
        #ehf-mobile-clean-shell{display:block!important;width:100%!important;max-width:460px!important;margin:0 auto!important;padding:10px 10px 92px!important;box-sizing:border-box!important;background:#05070a!important;min-height:100vh!important}
        .ehf-mob-top{position:sticky;top:0;z-index:40;background:linear-gradient(180deg,#05070a 0%,rgba(5,7,10,.94) 100%);padding:8px 0 10px;border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(8px)}
        .ehf-mob-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.ehf-mob-title h1{font-size:16px!important;margin:0!important;color:#fff!important;font-weight:950!important;letter-spacing:-.02em}.ehf-mob-title b{color:#ff8a00}.ehf-mob-version{font-size:9px;color:#64748b;font-weight:800}
        .ehf-mob-pill-row{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.ehf-mob-pill-row::-webkit-scrollbar{display:none}.ehf-mob-pill{flex:0 0 auto;border:1px solid rgba(255,255,255,.08);background:#0c1522;color:#cbd5e1;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:900}.ehf-mob-pill strong{color:#fff}
        .ehf-mob-card{background:#0b1320;border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:12px;margin:10px 0;box-shadow:0 14px 34px rgba(0,0,0,.28)}
        .ehf-mob-card.orange{border-color:rgba(255,138,0,.42);background:linear-gradient(135deg,rgba(255,138,0,.12),#0b1320 50%)}
        .ehf-mob-card h2{font-size:13px!important;margin:0 0 3px!important;color:#fff!important;font-weight:950}.ehf-mob-card small{display:block;color:#94a3b8;font-size:10px;line-height:1.35}
        .ehf-mob-rom-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ehf-mob-meta{border:1px solid rgba(255,255,255,.08);background:#07101b;border-radius:12px;padding:9px;min-height:48px}.ehf-mob-meta span{display:block;color:#7b8796;font-size:9px;font-weight:900;text-transform:uppercase}.ehf-mob-meta b{display:block;color:#fff;font-size:14px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ehf-mob-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ehf-mob-btn{border:0;border-radius:14px;min-height:48px;padding:10px 9px;font-size:13px;font-weight:950;cursor:pointer;background:#162235;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.18)}.ehf-mob-btn.primary{background:#0ea5e9;color:#001018}.ehf-mob-btn.orange{background:#ff8a00;color:#111827}.ehf-mob-btn.green{background:#22c55e;color:#04130a}.ehf-mob-btn.red{background:#991b1b;color:#fff}.ehf-mob-btn.full{grid-column:1/-1}.ehf-mob-btn:active{transform:scale(.99)}
        .ehf-mob-scan{display:grid;grid-template-columns:1fr;gap:8px}.ehf-mob-scan input{width:100%;box-sizing:border-box;background:#02050a;color:#fff;border:2px solid rgba(255,138,0,.72);border-radius:16px;min-height:58px;padding:10px 12px;text-align:center;font-size:20px;font-weight:950;outline:none}.ehf-mob-scan input:focus{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.17)}
        .ehf-mob-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ehf-mob-kpi{background:#0b1320;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px}.ehf-mob-kpi span{display:block;font-size:9px;color:#7b8796;text-transform:uppercase;font-weight:900}.ehf-mob-kpi b{display:block;font-size:24px;color:#fff;line-height:1.1;margin-top:3px}.ehf-mob-kpi.green b{color:#22c55e}.ehf-mob-kpi.blue b{color:#38bdf8}.ehf-mob-kpi.red b{color:#fb7185}
        .ehf-mob-rom-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.ehf-mob-rom-summary .box{background:#07101b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:9px}.ehf-mob-rom-summary .box span{display:block;color:#7b8796;font-size:9px;font-weight:900;text-transform:uppercase}.ehf-mob-rom-summary .box b{display:block;color:#fff;font-size:19px;margin-top:2px}.ehf-mob-rom-summary .box.warn b{color:#fb7185}.ehf-mob-last-code{background:#07101b;border:1px dashed rgba(255,255,255,.14);border-radius:12px;padding:9px;margin:8px 0;color:#94a3b8;font-size:10px}.ehf-mob-last-code b{display:block;color:#fff;font-size:12px;margin-top:3px;word-break:break-all}.ehf-mob-details-toggle{width:100%;margin-top:8px;min-height:40px;border-radius:12px;border:1px solid rgba(255,138,0,.38);background:rgba(255,138,0,.10);color:#ffb35c;font-size:11px;font-weight:950}.ehf-mob-details-wrap{display:grid;gap:8px;margin-top:8px}
        .ehf-mob-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.ehf-mob-list-head h2{margin:0!important}.ehf-mob-list{display:grid;gap:8px}.ehf-mob-empty{border:1px dashed rgba(255,255,255,.16);border-radius:14px;padding:16px;text-align:center;color:#94a3b8;font-size:11px;background:#07101b}.ehf-mob-read{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border:1px solid rgba(255,255,255,.08);background:#07101b;border-radius:14px;padding:10px}.ehf-mob-read-code{font-size:13px;font-weight:950;color:#fff;overflow:hidden;text-overflow:ellipsis}.ehf-mob-read-meta{font-size:10px;color:#94a3b8;margin-top:3px;line-height:1.35}.ehf-mob-status{display:inline-flex;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:950;margin-top:5px;background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.3)}.ehf-mob-status.bad{background:rgba(239,68,68,.12);color:#fecaca;border-color:rgba(239,68,68,.28)}.ehf-mob-remove{border:1px solid rgba(239,68,68,.42);background:rgba(239,68,68,.12);color:#fecaca;border-radius:10px;padding:8px 9px;font-size:10px;font-weight:900;min-width:74px}
        .ehf-mob-saved{display:grid;gap:8px}.ehf-mob-saved .ehf-romaneios-panel{display:block!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}.ehf-mob-saved .ehf-romaneios-head{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:8px!important}.ehf-mob-saved .ehf-romaneios-head h3{font-size:13px!important}.ehf-mob-saved .ehf-romaneios-head small{font-size:10px!important}.ehf-mob-saved .ehf-romaneio-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;width:100%!important}.ehf-mob-saved .ehf-romaneio-month{grid-column:1/-1!important;width:100%!important;box-sizing:border-box!important;min-height:42px!important}.ehf-mob-saved .ehf-romaneios-list{display:grid!important;gap:8px!important}.ehf-mob-saved .ehf-romaneio-item{grid-template-columns:1fr!important;padding:10px!important}.ehf-mob-saved .ehf-romaneio-print{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;justify-content:stretch!important}.ehf-mob-saved .ehf-romaneio-btn{min-height:40px!important;font-size:11px!important}
        .ehf-mob-hidden-input{position:absolute!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
        html.ehf-mobile-clean-bipagem #input-leitor-codigo{position:absolute!important;left:-9999px!important;top:-9999px!important;opacity:0!important;width:1px!important;height:1px!important;pointer-events:none!important}
      }
      @media(min-width:761px){#ehf-mobile-clean-shell{display:none!important}}
    `;
    document.head.appendChild(st);
  }

  function isBipagem(){ return location.hash.includes('bipagem') || $('#view-bipagem')?.classList.contains('active') || document.body.classList.contains('ehf-bipagem-ativa'); }
  function inputOriginal(){ return document.getElementById('input-leitor-codigo'); }
  function session(){ try { return window.ehfGetBipSessionDetail?.() || null; } catch(_) { return null; } }
  function text(id){ return document.getElementById(id)?.textContent?.trim() || '0'; }
  function getOperator(){
    const raw = ($('.operator-badge')?.textContent || $('.topbar')?.textContent || '').match(/Operador:\s*([A-Za-zÀ-ÿ0-9_-]+)/i);
    return raw ? raw[1] : (localStorage.getItem('ehf_operador') || '').replace(/"/g,'') || '-';
  }

  function ensureShell(){
    if(!isMobile() || !isBipagem()) return;
    document.documentElement.classList.add('ehf-mobile-clean-bipagem');
    document.body.classList.add('ehf-mobile-clean-bipagem-body');
    const page = $('#view-bipagem .bip-pro-page') || $('#view-bipagem') || document.body;
    let shell = document.getElementById('ehf-mobile-clean-shell');
    if(shell) return shell;
    shell=document.createElement('div');
    shell.id='ehf-mobile-clean-shell';
    shell.innerHTML = `
      <div class="ehf-mob-top">
        <div class="ehf-mob-title"><h1>Bipagem <b>EHF</b></h1><span class="ehf-mob-version">v4.2.36</span></div>
        <div class="ehf-mob-pill-row">
          <span class="ehf-mob-pill">Operador: <strong id="ehf-mob-op">-</strong></span>
          <span class="ehf-mob-pill">Data: <strong id="ehf-mob-date">--/--</strong></span>
          <span class="ehf-mob-pill">Romaneio: <strong id="ehf-mob-rom-id">--</strong></span>
        </div>
      </div>

      <section class="ehf-mob-card orange" id="ehf-mob-rom-card">
        <h2>Romaneio em andamento</h2>
        <small>Bipe pelo celular. O PC consulta os romaneios salvos para imprimir.</small>
        <div class="ehf-mob-rom-meta">
          <div class="ehf-mob-meta"><span>Canal</span><b id="ehf-mob-canal">--</b></div>
          <div class="ehf-mob-meta"><span>Coletor</span><b id="ehf-mob-coletor">--</b></div>
          <div class="ehf-mob-meta"><span>Conferente</span><b id="ehf-mob-conf">--</b></div>
          <div class="ehf-mob-meta"><span>Status</span><b id="ehf-mob-status">--</b></div>
        </div>
        <div class="ehf-mob-actions">
          <button type="button" class="ehf-mob-btn" id="ehf-mob-config">Configurar</button>
          <button type="button" class="ehf-mob-btn green" id="ehf-mob-save">Salvar atual</button>
        </div>
      </section>

      <section class="ehf-mob-card">
        <h2>Leitura da etiqueta</h2>
        <small>Use câmera, leitor físico ou digite o código manualmente.</small>
        <div class="ehf-mob-scan">
          <button type="button" class="ehf-mob-btn primary full" id="ehf-mob-camera">Ler com câmera</button>
          <input id="ehf-mob-code" placeholder="Digite ou cole o código" autocomplete="off">
          <button type="button" class="ehf-mob-btn orange full" id="ehf-mob-bipar">Bipar código</button>
        </div>
      </section>

      <section class="ehf-mob-kpis">
        <div class="ehf-mob-kpi green"><span>Bipados</span><b id="ehf-mob-bipados">0</b></div>
        <div class="ehf-mob-kpi blue"><span>Identificados</span><b id="ehf-mob-tiny">0</b></div>
        <div class="ehf-mob-kpi red"><span>Não localizados</span><b id="ehf-mob-nao">0</b></div>
        <div class="ehf-mob-kpi"><span>Pacotes</span><b id="ehf-mob-packs">0</b></div>
      </section>

      <section class="ehf-mob-card">
        <div class="ehf-mob-list-head"><h2>Resumo do romaneio</h2><button type="button" class="ehf-mob-btn" id="ehf-mob-refresh" style="min-height:34px;padding:6px 9px;font-size:10px">Atualizar</button></div>
        <div id="ehf-mob-leituras" class="ehf-mob-list"><div class="ehf-mob-empty">Nenhuma leitura ainda.</div></div>
      </section>

      <section class="ehf-mob-card" id="ehf-mob-saved-card">
        <div class="ehf-mob-list-head"><h2>Romaneios salvos</h2><button type="button" class="ehf-mob-btn" id="ehf-mob-saved-refresh" style="min-height:34px;padding:6px 9px;font-size:10px">Buscar</button></div>
        <small>Use no PC para imprimir ou consultar por mês. No celular fica compacto.</small>
        <div class="ehf-mob-saved" id="ehf-mob-saved-slot"></div>
      </section>
    `;
    page.prepend(shell);
    bindShell(shell);
    moveSavedPanel();
    updateShell();
    return shell;
  }

  function bindShell(shell){
    shell.querySelector('#ehf-mob-camera')?.addEventListener('click', async () => {
      if(window.EHFMobileCameraScan?.open) return window.EHFMobileCameraScan.open('bipagem');
      const old=document.querySelector('.ehf-camera-btn,.ehf-pack-camera-btn'); if(old) return old.click();
      alert('Leitor de câmera ainda não carregou. Atualize a página.');
    });
    shell.querySelector('#ehf-mob-bipar')?.addEventListener('click', () => bipCode(shell.querySelector('#ehf-mob-code')?.value || ''));
    shell.querySelector('#ehf-mob-code')?.addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); bipCode(e.currentTarget.value || ''); } });
    shell.querySelector('#ehf-mob-save')?.addEventListener('click', () => { if(window.ehfSalvarRomaneioAtual) window.ehfSalvarRomaneioAtual('EM_ANDAMENTO'); else alert('Função de salvar romaneio não carregou.'); });
    shell.querySelector('#ehf-mob-config')?.addEventListener('click', () => showSessionConfig(true));
    shell.querySelector('#ehf-mob-refresh')?.addEventListener('click', updateShell);
    shell.querySelector('#ehf-mob-saved-refresh')?.addEventListener('click', () => { if(window.EHFLoadRomaneiosSalvos) window.EHFLoadRomaneiosSalvos(true); setTimeout(moveSavedPanel,500); });
  }

  function showSessionConfig(show){
    document.documentElement.classList.toggle('ehf-mobile-show-session', !!show);
    let btn=document.getElementById('ehf-mobile-session-close');
    const panel=document.getElementById('bip-session-panel');
    if(show && panel && !btn){
      btn=document.createElement('button');
      btn.id='ehf-mobile-session-close'; btn.type='button'; btn.textContent='Fechar configuração';
      btn.className='bip-session-btn'; btn.style.cssText='width:100%;margin:0 0 10px;background:#1f2937;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:11px;font-weight:950';
      btn.onclick=()=>showSessionConfig(false);
      panel.prepend(btn);
    }
  }

  function bipCode(code){
    code = String(code || '').trim();
    if(!code) return;
    const inp=inputOriginal();
    if(!inp){ alert('Campo de bipagem não encontrado.'); return; }
    inp.value = code;
    inp.dispatchEvent(new Event('input', { bubbles:true }));
    inp.dispatchEvent(new KeyboardEvent('keydown', { bubbles:true, cancelable:true, key:'Enter', code:'Enter' }));
    const mob=document.getElementById('ehf-mob-code'); if(mob) mob.value='';
    setTimeout(updateShell,500);
  }

  function moveSavedPanel(){
    const slot=document.getElementById('ehf-mob-saved-slot');
    const panel=document.querySelector('.ehf-romaneios-panel');
    if(slot && panel && panel.parentElement!==slot){ slot.appendChild(panel); }
  }

  function rowToObj(tr){
    const tds=$$('td',tr);
    const btn=tr.querySelector('button[onclick*="ehfRemoverBipagem"],button');
    return {
      time: tds[0]?.textContent?.trim() || '', loja: tds[1]?.textContent?.trim() || '', plataforma: tds[2]?.textContent?.trim() || '', canal: tds[3]?.textContent?.trim() || '', codigo: tds[4]?.querySelector('b')?.textContent?.trim() || tds[4]?.textContent?.trim() || '', obs: tds[4]?.querySelector('div')?.textContent?.trim() || '', operador: tds[5]?.textContent?.trim() || '', status: tds[6]?.textContent?.trim() || '', button: btn
    };
  }

  function renderMobileHistory(){
    const box=document.getElementById('ehf-mob-leituras'); if(!box) return;
    const rows=$$('#lista-bipagens-historico tr').filter(tr => tr.offsetParent !== null || tr.textContent.trim());
    const scans=rows.map(rowToObj).filter(r=>r.codigo);
    if(!scans.length){
      box.innerHTML='<div class="ehf-mob-empty">Nenhuma leitura ainda.</div>';
      return;
    }

    const total=scans.length;
    const divergentes=scans.filter(r=>/diverg|nao|não|erro|bloq|canal/i.test((r.status||'')+' '+(r.obs||''))).length;
    const identificados=Math.max(0,total-divergentes);
    const lojas=new Set(scans.map(r=>r.loja).filter(Boolean));
    const canais=new Set(scans.map(r=>r.canal || r.plataforma).filter(Boolean));
    const ultimo=scans[0] || scans[scans.length-1] || {};
    const showDetails=!!window.__ehfMobShowReadDetails;

    const summaryHtml = `
      <div class="ehf-mob-rom-summary">
        <div class="box"><span>Leituras</span><b>${total}</b></div>
        <div class="box"><span>Identificados</span><b>${identificados}</b></div>
        <div class="box warn"><span>Divergentes</span><b>${divergentes}</b></div>
        <div class="box"><span>Lojas/Canais</span><b>${lojas.size}/${canais.size}</b></div>
      </div>
      <div class="ehf-mob-last-code">Última leitura<b>${esc(ultimo.codigo || '--')}</b></div>
      <button type="button" class="ehf-mob-details-toggle" id="ehf-mob-toggle-details">${showDetails ? 'Ocultar leituras' : 'Ver / remover leituras'}</button>
    `;

    const detailsHtml = showDetails ? `<div class="ehf-mob-details-wrap">${scans.slice(0,80).map((r,i)=>`
      <div class="ehf-mob-read" data-i="${i}">
        <div>
          <div class="ehf-mob-read-code">${esc(r.codigo)}</div>
          <div class="ehf-mob-read-meta">${esc(r.time)} · ${esc(r.loja || '-')} · ${esc(r.canal || r.plataforma || '-')}</div>
          ${r.obs ? `<div class="ehf-mob-read-meta">${esc(r.obs)}</div>` : ''}
          <span class="ehf-mob-status ${/diverg|nao|não|erro|bloq/i.test(r.status) ? 'bad' : ''}">${esc(r.status || 'Registrado')}</span>
        </div>
        <button type="button" class="ehf-mob-remove" data-remove-i="${i}">Remover</button>
      </div>`).join('')}</div>` : '';

    box.innerHTML = summaryHtml + detailsHtml;
    box.querySelector('#ehf-mob-toggle-details')?.addEventListener('click',()=>{
      window.__ehfMobShowReadDetails = !window.__ehfMobShowReadDetails;
      renderMobileHistory();
    });
    box.querySelectorAll('[data-remove-i]').forEach(b=>{
      b.onclick=()=>{ const idx=Number(b.dataset.removeI); scans[idx]?.button?.click?.(); setTimeout(updateShell,650); };
    });
  }

  function updateShell(){
    if(!isMobile() || !isBipagem()) return;
    const sh=ensureShell(); if(!sh) return;
    moveSavedPanel();
    const s=session(); const ss=s?.session || {};
    const today=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    const packText = document.getElementById('bip-session-packages')?.textContent?.trim() || text('audit-bipados-total');
    const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
    set('ehf-mob-op', getOperator());
    set('ehf-mob-date', today);
    set('ehf-mob-rom-id', ss.id ? '#'+ss.id : '--');
    set('ehf-mob-canal', ss.channel_name || document.getElementById('bip-session-channel')?.selectedOptions?.[0]?.textContent || '--');
    set('ehf-mob-coletor', ss.collector_name || document.getElementById('bip-session-collector')?.value || '--');
    set('ehf-mob-conf', ss.checker_name || ss.operator || document.getElementById('bip-session-checker')?.value || getOperator());
    set('ehf-mob-status', ss.status === 'ABERTA' ? 'Aberto' : (ss.status || 'Configurar'));
    set('ehf-mob-bipados', text('audit-bipados-total'));
    set('ehf-mob-tiny', text('audit-tiny-total'));
    set('ehf-mob-nao', text('bip-nao-localizadas-total'));
    set('ehf-mob-packs', packText || '0');
    renderMobileHistory();
  }

  function boot(){
    injectStyle();
    if(isMobile() && isBipagem()) {
      ensureShell();
      updateShell();
      setTimeout(updateShell,500); setTimeout(updateShell,1500); setTimeout(updateShell,3500);
    }
  }
  window.EHFMobileCleanBipagem = { version: VERSION, update: updateShell, bip: bipCode, showConfig: showSessionConfig };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('hashchange',()=>setTimeout(boot,120));
  window.addEventListener('resize',()=>setTimeout(boot,120));
  window.addEventListener('ehf:romaneioAtualizado',()=>setTimeout(updateShell,600));
  setInterval(()=>{ if(isMobile() && isBipagem()) updateShell(); }, 2500);
  const mo = new MutationObserver(()=>{ if(isMobile() && isBipagem()) { clearTimeout(window.__ehfMobCleanT); window.__ehfMobCleanT=setTimeout(updateShell,180); } });
  mo.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
